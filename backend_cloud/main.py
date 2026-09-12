from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_staging_db
import os

app = FastAPI(title="VoltFlow POS Cloud API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, dashboard, analytics, staging, exports

@app.on_event("startup")
def startup_event():
    init_staging_db()

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(staging.router)
app.include_router(exports.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
