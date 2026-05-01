import tensorflow as tf
import os

h5_path = r'c:\Users\milin\OneDrive\Desktop\Btech PROJECT\skin_app\backend\trained_model\SKIN_MODEL_BEST.keras'

print("TensorFlow version:", tf.__version__)
print("H5 path:", h5_path)
print("File exists:", os.path.exists(h5_path))

try:
    print("\nAttempting to load model with compile=False...")
    model = tf.keras.models.load_model(h5_path, compile=False)
    print("✅ Model loaded successfully!")
    model.summary()
    
    # Try a dummy prediction to see if it works
    import numpy as np
    dummy_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
    # The code in predictor.py uses resnet preprocess_input, but for a random dummy it doesn't matter much.
    prediction = model.predict(dummy_input, verbose=0)
    print("✅ Prediction successful! Output shape:", prediction.shape)
    
except Exception as e:
    print("❌ Error loading model:", str(e))
    import traceback
    traceback.print_exc()
