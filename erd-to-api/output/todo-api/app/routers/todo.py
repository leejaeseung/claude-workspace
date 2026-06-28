from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.todo import Todo
from app.schemas.todo import (
    TodoCreate,
    TodoUpdate,
    TodoResponse,
)

router = APIRouter()


@router.get("/", response_model=List[TodoResponse])
def list_todos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Todo).offset(skip).limit(limit).all()


@router.post("/", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(body: TodoCreate, db: Session = Depends(get_db)):
    obj = Todo(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{item_id}", response_model=TodoResponse)
def get_todo(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Todo).filter(Todo.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return obj


@router.put("/{item_id}", response_model=TodoResponse)
def update_todo(item_id: int, body: TodoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Todo).filter(Todo.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Todo).filter(Todo.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    db.delete(obj)
    db.commit()