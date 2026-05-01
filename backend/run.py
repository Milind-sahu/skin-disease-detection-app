#!/usr/bin/env python
import uvicorn
import os
import sys

# Add the current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("=" * 60)
    print("SKIN DISEASE DETECTION SYSTEM - FASTAPI BACKEND")
    print("=" * 60)
    print("\nStarting server...")
    print("Visit http://localhost:8000 to access the web interface")
    print("API docs available at http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop the server")
    print("=" * 60)
    
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )