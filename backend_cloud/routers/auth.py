import os
import pyotp
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

JWT_SECRET = os.getenv("POS_JWT_SECRET", "jwtchangeme123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

POS_CLOUD_SECRET_KEY = os.getenv("POS_CLOUD_SECRET_KEY", "changeme123")
ADMIN_USER = os.getenv("POS_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("POS_ADMIN_PASSWORD", "admin123")
# In production this would be stored in the DB, hardcoded TOTP secret for demo/v1 scaffolding
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
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), totp_code: str = None):
    # Support form data (Swagger) or JSON body depending on how frontend calls it.
    # For scaffolding, we check env vars.
    if form_data.username != ADMIN_USER or form_data.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check TOTP if provided
    # For Phase 2.1 we scaffold it, requiring TOTP eventually. 
    # If totp_code is not provided or invalid, we can reject it.
    if totp_code:
        totp = pyotp.TOTP(TOTP_SECRET)
        if not totp.verify(totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code",
            )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/totp/setup")
def get_totp_setup():
    """Generates a TOTP setup URI for Google Authenticator."""
    totp = pyotp.TOTP(TOTP_SECRET)
    uri = totp.provisioning_uri(name=ADMIN_USER, issuer_name="VoltFlow Cloud")
    return {"uri": uri, "secret": TOTP_SECRET}

# Dependency for POS Mutual Auth
from fastapi import Header
def verify_pos_token(pos_auth_token: str = Header(...)):
    if pos_auth_token != POS_CLOUD_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid POS API Secret")
    return True
