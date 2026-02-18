"""
FastAPI application factory and main application setup.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .connection_manager import ConnectionManager
from .api import create_api_router
from .websockets import create_websocket_router

# Use simplified auth for demo (works on ANY Python version)
# Only requires Pillow - already installed and working
# Other options: .auth_opencv (requires opencv), .auth_production (requires Python 3.12 + dlib)
from .auth_simple import create_auth_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    
    app = FastAPI(
        title=settings.title,
        description=settings.description,
        version=settings.version,
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=settings.get_cors_list(settings.cors_methods),
        allow_headers=settings.get_cors_list(settings.cors_headers),
    )
    
    # Initialize connection manager
    manager = ConnectionManager()
    
    # Include routers
    app.include_router(create_api_router(manager))
    app.include_router(create_websocket_router(manager), prefix="/ws")
    app.include_router(create_auth_router(), prefix="/auth")
    
    return app


# Create app instance
app = create_app()