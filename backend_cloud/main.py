from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from database import init_staging_db
except ImportError:
    from backend_cloud.database import init_staging_db
import os

app = FastAPI(title="VoltFlow POS Cloud API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from routers import auth, dashboard, analytics, staging, exports, catalog
except ImportError:
    from backend_cloud.routers import auth, dashboard, analytics, staging, exports, catalog

@app.on_event("startup")
def startup_event():
    init_staging_db()

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(staging.router)
app.include_router(exports.router)
app.include_router(catalog.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
