from fastapi import FastAPI
from app.routers.user import router as user_router
from app.routers.category import router as category_router
from app.routers.todo import router as todo_router

app = FastAPI(
    title="todo-api",
    description="Auto-generated REST API from ERD",
    version="0.1.0",
)

app.include_router(user_router, prefix="/users", tags=["User"])
app.include_router(category_router, prefix="/categories", tags=["Category"])
app.include_router(todo_router, prefix="/todos", tags=["Todo"])


@app.get("/health")
def health():
    return {"status": "ok"}