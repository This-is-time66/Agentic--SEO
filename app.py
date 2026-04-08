import os
import json
import secrets
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv

load_dotenv()

from core.models import SignupRequest, LoginRequest, KeywordRequest
from core.database import db_execute, db_fetchone, db_fetchall, hash_password
from core.agents import competitor_agent, gap_agent, writer_agent

app = FastAPI()
security = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def generate_token() -> str:
    return secrets.token_urlsafe(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    row = db_fetchone(
        "SELECT u.id, u.email, u.full_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = %s",
        (token,)
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")
    return row

@app.get("/")
async def serve_frontend(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/signup")
async def signup(req: SignupRequest):
    existing = db_fetchone("SELECT id FROM users WHERE email = %s", (req.email,))
    if existing: raise HTTPException(status_code=400, detail="Email registered")
    hashed = hash_password(req.password)
    user = db_execute("INSERT INTO users (email, full_name, password_hash, created_at) VALUES (%s,%s,%s,%s) RETURNING id, email, full_name", (req.email, req.full_name, hashed, datetime.utcnow()))
    token = generate_token()
    db_execute("INSERT INTO sessions (user_id, token, created_at) VALUES (%s, %s, %s)", (user["id"], token, datetime.utcnow()))
    return {"token": token, "user": user}

@app.post("/api/login")
async def login(req: LoginRequest):
    hashed = hash_password(req.password)
    user = db_fetchone("SELECT id, email, full_name FROM users WHERE email = %s AND password_hash = %s", (req.email, hashed))
    if not user: raise HTTPException(status_code=401, detail="Invalid credentials")
    token = generate_token()
    db_execute("INSERT INTO sessions (user_id, token, created_at) VALUES (%s, %s, %s)", (user["id"], token, datetime.utcnow()))
    return {"token": token, "user": user}

@app.get("/api/history")
async def get_history(current_user=Depends(get_current_user)):
    rows = db_fetchall("SELECT id, keyword, competitors_summary, gaps, final_article, created_at FROM search_history WHERE user_id = %s ORDER BY created_at DESC", (current_user["id"],))
    for r in rows:
        r["id"] = str(r["id"])
        if r.get("created_at"): r["created_at"] = r["created_at"].isoformat()
    return {"history": rows}

# --- ACCOUNT MANAGEMENT (DELETE ACCOUNT) ---
@app.delete("/api/account")
async def delete_user_account(current_user = Depends(get_current_user)):
    """
    Permanently deletes all data associated with the user:
    1. Search History
    2. Sessions
    3. User Account
    """
    user_id = current_user["id"]
    
    # Delete related history first to avoid database constraint errors
    db_execute("DELETE FROM search_history WHERE user_id = %s", (user_id,))
    
    # Delete all active sessions
    db_execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
    
    # Delete the user itself
    db_execute("DELETE FROM users WHERE id = %s", (user_id,))
    
    return {"message": "Account and all associated data deleted successfully."}



@app.post("/api/seo-agent")
async def seo_agent(request: KeywordRequest, current_user=Depends(get_current_user)):
    def event_stream():
        state = {"keyword": request.keyword}
        
        # 1. Competitor
        yield f"data: {json.dumps({'event': 'agent_start', 'agent': 'competitor'})}\n\n"
        r1 = competitor_agent(state)
        state.update(r1)
        yield f"data: {json.dumps({'event': 'agent_done', 'agent': 'competitor', 'data': r1['competitors_summary']})}\n\n"
        
        # 2. Gap
        yield f"data: {json.dumps({'event': 'agent_start', 'agent': 'gap'})}\n\n"
        r2 = gap_agent(state)
        state.update(r2)
        yield f"data: {json.dumps({'event': 'agent_done', 'agent': 'gap', 'data': r2['gaps']})}\n\n"
        
        # 3. Writer
        yield f"data: {json.dumps({'event': 'agent_start', 'agent': 'writer'})}\n\n"
        r3 = writer_agent(state)
        state.update(r3)
        yield f"data: {json.dumps({'event': 'agent_done', 'agent': 'writer', 'data': r3['final_article']})}\n\n"

        # Save
        db_execute(
            "INSERT INTO search_history (user_id, keyword, competitors_summary, gaps, final_article, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
            (current_user["id"], request.keyword, state["competitors_summary"], state["gaps"], state["final_article"], datetime.utcnow())
        )

        # Final yield - Fixed syntax for multiline
        completion_data = {
            "event": "complete",
            "competitors_summary": state["competitors_summary"],
            "gaps": state["gaps"],
            "final_article": state["final_article"]
        }
        yield f"data: {json.dumps(completion_data)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")