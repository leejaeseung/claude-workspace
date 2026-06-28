from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Category).offset(skip).limit(limit).all()


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    obj = Category(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{item_id}", response_model=CategoryResponse)
def get_category(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return obj


@router.put("/{item_id}", response_model=CategoryResponse)
def update_category(item_id: int, body: CategoryUpdate, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    db.delete(obj)
    db.commit()