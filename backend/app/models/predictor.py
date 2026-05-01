import tensorflow as tf
import keras
import numpy as np
from PIL import Image
import os

# Monkey-patch Keras Dense layer to fix serialization bug with 'quantization_config'
# This is a known issue in some Keras 3 versions when loading models saved with different metadata
original_dense_init = keras.layers.Dense.__init__
def patched_dense_init(self, *args, **kwargs):
    kwargs.pop('quantization_config', None)
    return original_dense_init(self, *args, **kwargs)
keras.layers.Dense.__init__ = patched_dense_init

class SkinDiseasePredictor:
    def __init__(self, model_path):
        """Load the trained model"""
        self.model = None
        self.class_names = [
            'Atopic Dermatitis', 
            'Normal Skin', 
            'Melanoma', 
            'Seborrheic Keratoses and other Benign Tumors',
            'Nail Fungus', 
            'Chickenpox'
        ]
        self.img_size = (224, 224)
        self.load_model(model_path)
    
    def load_model(self, model_path):
        """Load the trained Keras model"""
        try:
            if os.path.exists(model_path):
                # Use standalone keras for loading as it handles Keras 3 formats (.keras) better
                self.model = keras.models.load_model(model_path, compile=False)
                print(f"Model loaded successfully from {model_path}")
            else:
                print(f"Model not found at {model_path}")
                raise FileNotFoundError(f"Model not found at {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
    
    def preprocess_image(self, image):
        """Preprocess image for model prediction"""
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize image
        image = image.resize(self.img_size)
        
        # Convert to array
        image_array = np.array(image, dtype=np.float32)
        
        # Preprocess for ResNet50
        image_array = tf.keras.applications.resnet.preprocess_input(image_array)
        
        # Add batch dimension
        image_array = np.expand_dims(image_array, axis=0)
        
        return image_array
    
    def predict(self, image):
        """Make prediction on a single image"""
        if self.model is None:
            return {
                'success': False,
                'error': 'Model not loaded properly'
            }
        
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)
            
            # Make prediction
            predictions = self.model.predict(processed_image, verbose=0)
            
            # Get predicted class and confidence
            predicted_idx = np.argmax(predictions[0])
            confidence = float(np.max(predictions[0]))
            predicted_class = self.class_names[predicted_idx]
            
            # Get all probabilities
            probabilities = {
                self.class_names[i]: float(predictions[0][i]) 
                for i in range(len(self.class_names))
            }
            
            # Sort probabilities by confidence
            sorted_probs = dict(sorted(probabilities.items(), key=lambda x: x[1], reverse=True))
            
            return {
                'success': True,
                'predicted_class': predicted_class,
                'confidence': confidence,
                'confidence_percentage': f"{confidence:.2%}",
                'all_probabilities': sorted_probs,
                'predicted_index': int(predicted_idx)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Prediction failed: {str(e)}"
            }
    
    def is_model_loaded(self):
        """Check if model is loaded"""
        return self.model is not None