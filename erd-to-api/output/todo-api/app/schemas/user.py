from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[datetime] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[datetime] = None


class UserResponse(UserBase):
    id: int

    model_config = {"from_attributes": True}