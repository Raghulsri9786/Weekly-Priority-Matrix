
import os
import uuid
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Weekly Priority Matrix Pro")

# Firebase Init
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Firebase Init Warning: {e}. Ensure serviceAccountKey.json is present for Python backend.")

class UserLogin(BaseModel):
    name: str
    email: EmailStr

class WeeklyPlanUpdate(BaseModel):
    plan: dict

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/login")
async def login(user: UserLogin):
    try:
        doc_ref = db.collection('users').document()
        doc_ref.set({
            "name": user.name,
            "email": user.email,
            "weeklyPlan": {d: "" for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]},
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {"id": doc_ref.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weekly/{user_id}")
async def get_weekly(user_id: str):
    try:
        doc = db.collection('users').document(user_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        return doc.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
