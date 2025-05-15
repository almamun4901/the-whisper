"""
Debug script to test API imports
"""

try:
    import sys
    print(f"Python version: {sys.version}")
    
    print("Importing FastAPI...")
    from fastapi import FastAPI
    print("FastAPI imported successfully")
    
    print("Importing SQLAlchemy...")
    from sqlalchemy.orm import Session
    from database.database import SessionLocal, engine, Base
    print("SQLAlchemy imported successfully")
    
    print("Importing models...")
    from database.models import User
    print("Models imported successfully")
    
    print("Importing main app...")
    from main import app
    print("Main app imported successfully")
    
    print("All imports successful!")
except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc() 