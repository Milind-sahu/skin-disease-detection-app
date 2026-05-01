from fastapi import APIRouter, File, UploadFile, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io
import base64
from typing import Optional

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
ui_templates = Jinja2Templates(directory="app/static/ui")

# This will be set when initializing the app
predictor = None

def set_predictor(pred):
    global predictor
    predictor = pred

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page with image upload form"""
    return ui_templates.TemplateResponse("index.html", {"request": request})

@router.post("/predict", response_class=HTMLResponse)
async def predict(request: Request, file: Optional[UploadFile] = File(None)):
    """Handle image upload and return prediction results"""
    
    if not predictor or not predictor.is_model_loaded():
        return templates.TemplateResponse(
            "result.html", 
            {
                "request": request, 
                "error": "Model not loaded properly. Please check server logs."
            }
        )
    
    if not file:
        return templates.TemplateResponse(
            "result.html", 
            {"request": request, "error": "No image file provided"}
        )
    
    try:
        # Read and validate image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Make prediction
        result = predictor.predict(image)
        
        if result['success']:
            # Convert image to base64 for display
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            # Prepare data for template
            return templates.TemplateResponse(
                "result.html",
                {
                    "request": request,
                    "success": True,
                    "predicted_class": result['predicted_class'],
                    "confidence": result['confidence_percentage'],
                    "probabilities": result['all_probabilities'],
                    "image_base64": img_str,
                    "filename": file.filename
                }
            )
        else:
            return templates.TemplateResponse(
                "result.html",
                {"request": request, "error": result['error']}
            )
            
    except Exception as e:
        return templates.TemplateResponse(
            "result.html",
            {"request": request, "error": f"Error processing image: {str(e)}"}
        )

@router.post("/api/predict")
async def predict_api(file: UploadFile = File(...)):
    """REST API endpoint for JSON response"""
    
    if not predictor or not predictor.is_model_loaded():
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Model not loaded"}
        )
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        result = predictor.predict(image)
        
        return JSONResponse(content=result)
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": predictor.is_model_loaded() if predictor else False
    }