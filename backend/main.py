import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import sales, printer, display, payments

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos-backend")

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Himmel POS Backend API",
    description="Python FastAPI backend for POS register sales database, ESC/POS hardware printing, customer LCD display, and Czech EET 2.0 / QR payment verification.",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(sales.router)
app.include_router(printer.router)
app.include_router(display.router)
app.include_router(payments.router)


@app.get("/")
def root():
    return {
        "status": "ONLINE",
        "app": "Himmel POS Python FastAPI Backend",
        "docs_url": "/docs",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
