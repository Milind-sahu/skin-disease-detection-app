import numpy as np
import os
import threading

class SkinDiseasePredictor:
    def __init__(self, model_path):
        """Initialize predictor and lazy-load model on first prediction."""
        self.model = None
        self.model_path = model_path
        self._tf = None
        self._load_attempted = False
        self._is_loading = False
        self._load_lock = threading.Lock()
        self.class_names = [
            'Atopic Dermatitis', 
            'Normal Skin', 
            'Melanoma', 
            'Seborrheic Keratoses and other Benign Tumors',
            'Nail Fungus', 
            'Chickenpox'
        ]
        self.img_size = (224, 224)
    
    def load_model(self):
        """Load the trained Keras model only when needed."""
        with self._load_lock:
            if self._load_attempted:
                return
            self._load_attempted = True
            self._is_loading = True

            try:
                import tensorflow as tf
                import keras

                # Monkey-patch Keras Dense layer to fix serialization metadata mismatches.
                original_dense_init = keras.layers.Dense.__init__
                def patched_dense_init(self, *args, **kwargs):
                    kwargs.pop('quantization_config', None)
                    return original_dense_init(self, *args, **kwargs)
                keras.layers.Dense.__init__ = patched_dense_init

                self._tf = tf
                model_path = self.model_path
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
            finally:
                self._is_loading = False

    def start_loading_in_background(self):
        """Start model loading in a background thread if needed."""
        if self.model is not None or self._load_attempted or self._is_loading:
            return

        thread = threading.Thread(target=self.load_model, daemon=True)
        thread.start()
    
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
        image_array = self._tf.keras.applications.resnet.preprocess_input(image_array)
        
        # Add batch dimension
        image_array = np.expand_dims(image_array, axis=0)
        
        return image_array
    
    def predict(self, image):
        """Make prediction on a single image"""
        if self.model is None:
            return {
                'success': False,
                'error': 'Model is initializing. Please retry in a few seconds.',
                'is_loading': True
            }

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

    def is_loading(self):
        """Check if model is currently loading."""
        return self._is_loading