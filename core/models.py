from pydantic import BaseModel
from typing import TypedDict

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class KeywordRequest(BaseModel):
    keyword: str

class AgentState(TypedDict):
    keyword: str
    competitors_summary: str
    gaps: str
    final_article: str