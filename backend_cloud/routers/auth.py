import os
import hmac
import pyotp
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request, Header
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

JWT_SECRET = os.getenv("POS_JWT_SECRET", "jwtchangeme123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

POS_CLOUD_SECRET_KEY = os.getenv("POS_CLOUD_SECRET_KEY", "changeme123")
ADMIN_USER = os.getenv("POS_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("POS_ADMIN_PASSWORD", "admin123")
# Stored TOTP secret for admin 2FA
TOTP_SECRET = os.getenv("POS_TOTP_SECRET", pyotp.random_base32())

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    totp_code: Optional[str] = None
):
    """
    Dual-mode login endpoint supporting both application/json and application/x-www-form-urlencoded.
    Validates username, password, and optional/required RFC 6238 TOTP 2FA.
    """
    content_type = request.headers.get("content-type", "")
    username = None
    password = None
    payload_totp = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username")
            password = body.get("password")
            payload_totp = body.get("totp_code")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
    else:
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
            payload_totp = form.get("totp_code")
        except Exception:
            pass

    admin_user = os.getenv("POS_ADMIN_USER", ADMIN_USER)
    admin_pass = os.getenv("POS_ADMIN_PASSWORD", ADMIN_PASSWORD)

    if username != admin_user or password != admin_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    effective_totp = totp_code or payload_totp
    require_totp = os.getenv("POS_REQUIRE_TOTP", "false").lower() == "true"

    if effective_totp or require_totp:
        if not effective_totp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="TOTP code required",
            )
        totp_secret = os.getenv("POS_TOTP_SECRET", TOTP_SECRET)
        totp = pyotp.TOTP(totp_secret)
        if not totp.verify(effective_totp, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code",
            )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/totp/setup")
def get_totp_setup():
    """Generates a TOTP setup URI and secret for Google Authenticator."""
    admin_user = os.getenv("POS_ADMIN_USER", ADMIN_USER)
    totp_secret = os.getenv("POS_TOTP_SECRET", TOTP_SECRET)
    totp = pyotp.TOTP(totp_secret)
    uri = totp.provisioning_uri(name=admin_user, issuer_name="VoltFlow Cloud")
    return {"uri": uri, "secret": totp_secret}


@router.post("/totp/verify")
def verify_totp(payload: dict):
    """Verifies a 6-digit TOTP code against the active secret."""
    code = (payload.get("code") or payload.get("totp_code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Chybí TOTP kód")
    totp_secret = os.getenv("POS_TOTP_SECRET", TOTP_SECRET)
    totp = pyotp.TOTP(totp_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Neplatný TOTP kód")
    return {"status": "SUCCESS", "message": "TOTP kód byl úspěšně ověřen"}


# Dependency for POS Mutual Machine Auth
def verify_pos_token(
    authorization: Optional[str] = Header(None),
    x_store_token: Optional[str] = Header(None, alias="X-Store-Token"),
    pos_auth_token: Optional[str] = Header(None, alias="pos-auth-token")
):
    """
    Validates the 256-bit mutual API Secret or Store Token sent by Store POS.
    Supports Authorization: Bearer <token>, X-Store-Token, or pos-auth-token.
    """
    expected_secret = os.getenv("POS_CLOUD_SECRET_KEY", POS_CLOUD_SECRET_KEY)
    require_auth = os.getenv("POS_REQUIRE_MACHINE_AUTH", "false").lower() == "true"

    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_store_token:
        token = x_store_token.strip()
    elif pos_auth_token:
        token = pos_auth_token.strip()

    if not token:
        if require_auth:
            raise HTTPException(status_code=403, detail="Missing POS API Secret")
        return True

    if not hmac.compare_digest(token, expected_secret):
        raise HTTPException(status_code=403, detail="Invalid POS API Secret")

    return True

