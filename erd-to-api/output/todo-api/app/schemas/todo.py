from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class TodoBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[date] = None
    user_id: Optional[int] = None
    category_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[date] = None
    user_id: Optional[int] = None
    category_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TodoResponse(TodoBase):
    id: int

    model_config = {"from_attributes": True}