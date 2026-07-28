import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import sales, printer, display, payments, eet

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
app.include_router(eet.router)
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


@app.post("/api/v1/system/shutdown")
def shutdown_system():
    """Safely stop backend service & terminal windows on cashier request."""
    import os, subprocess, threading
    logger.info("Shutdown requested by cashier via POS interface.")

    def terminate():
        try:
            # Taskkill background launcher terminal windows and process trees
            subprocess.run('taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web*"', shell=True, capture_output=True)
            subprocess.run('taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Launcher*"', shell=True, capture_output=True)
            subprocess.run('taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Kiosk Launcher*"', shell=True, capture_output=True)
            subprocess.run('taskkill /F /IM node.exe', shell=True, capture_output=True)
            subprocess.run('taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq http://localhost:5173*"', shell=True, capture_output=True)
            subprocess.run('taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq Himmel POS App*"', shell=True, capture_output=True)
            subprocess.run('taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*"', shell=True, capture_output=True)
        except Exception as e:
            logger.warning(f"Error during terminal cleanup: {e}")
        finally:
            os._exit(0)

    timer = threading.Timer(0.3, terminate)
    timer.start()
    return {"status": "SUCCESS", "message": "Pokladní systém byl úspěšně ukončen."}




if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
