from sqlalchemy import Column, ForeignKey, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=True)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=True)

    categorys = relationship("Category", backref="user", lazy="select")
    todos = relationship("Todo", backref="user", lazy="select")
