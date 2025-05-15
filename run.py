"""
Application entry point for WhisperChain+.

This file:
1. Loads environment variables
2. Initializes the application
3. Configures logging
4. Starts the server
5. Handles graceful shutdown
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True) 