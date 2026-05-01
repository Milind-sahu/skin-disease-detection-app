from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager
import os

from app.models.predictor import SkinDiseasePredictor
from app.routes import predict

# Global predictor instance
predictor_instance = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load the model
    global predictor_instance
    model_path = os.getenv('MODEL_PATH', 'trained_model/SKIN_MODEL_BEST.keras')
    
    # Try different possible paths
    possible_paths = [
        model_path,
        'trained_model/SKIN_MODEL_BEST.keras',
        '../trained_model/SKIN_MODEL_BEST.keras',
        './trained_model/SKIN_MODEL_BEST.keras'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            model_path = path
            break
    
    print(f"Loading model from: {model_path}")
    predictor_instance = SkinDiseasePredictor(model_path)
    
    # Set predictor in routes
    predict.set_predictor(predictor_instance)
    
    yield
    
    # Shutdown: Clean up
    print("Shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Skin Disease Prediction API",
    description="API for skin disease classification using deep learning",
    version="1.0.0",
    lifespan=lifespan
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Include routes
app.include_router(predict.router)

@app.get("/info")
async def get_info():
    """Get model information"""
    if predictor_instance and predictor_instance.is_model_loaded():
        return {
            "model_loaded": True,
            "classes": predictor_instance.class_names,
            "image_size": predictor_instance.img_size
        }
    else:
        return {
            "model_loaded": False,
            "error": "Model not loaded"
        }