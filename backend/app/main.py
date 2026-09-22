from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import upload, analysis, report, chat, share, ml

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="AI Data Analytics Bot",
    description="Backend for AI-powered data analytics bot.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(share.router, prefix="/api")
app.include_router(ml.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    """Health check endpoint with ML status."""
    ml_ok = False
    ml_error = None
    try:
        import sklearn
        import statsmodels
        ml_ok = True
    except ImportError as e:
        ml_error = str(e)
    
    return {
        "status": "ok",
        "ml_available": ml_ok,
        "ml_error": ml_error,
        "routes": [r.path for r in app.routes if hasattr(r, 'path')]
    }
