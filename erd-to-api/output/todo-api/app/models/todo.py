from sqlalchemy import Column, ForeignKey, Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    completed = Column(Boolean, nullable=True)
    due_date = Column(Date, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

