from pydantic import BaseModel
from typing import Optional


class CategoryBase(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    user_id: Optional[int] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    user_id: Optional[int] = None


class CategoryResponse(CategoryBase):
    id: int

    model_config = {"from_attributes": True}