"""Todo 앱 전체 시나리오 검증 (SQLite 인메모리)"""
import sys, os
sys.path.insert(0, ".")
os.environ["DATABASE_URL"] = "sqlite:///./test_todo.db"

import app.database as db_module
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///./test_todo.db", connect_args={"check_same_thread": False})
db_module.engine = engine
db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.database import Base
import app.models.user, app.models.category, app.models.todo
Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

# ── 1. 사용자 생성 ────────────────────────────────────────────────────────────
print("1. 사용자 생성")
r = client.post("/users/", json={"email": "alice@example.com", "name": "Alice"})
assert r.status_code == 201, r.text
user = r.json()
print(f"   {user}")

# ── 2. 카테고리 생성 ──────────────────────────────────────────────────────────
print("2. 카테고리 생성")
r = client.post("/categories/", json={"name": "업무", "color": "#6366f1", "user_id": user["id"]})
assert r.status_code == 201, r.text
cat = r.json()
print(f"   {cat}")

# ── 3. Todo 생성 ──────────────────────────────────────────────────────────────
print("3. Todo 생성")
todos_data = [
    {"title": "프로젝트 기획서 작성", "description": "Q3 로드맵 정리", "completed": False,
     "due_date": "2026-06-10", "user_id": user["id"], "category_id": cat["id"]},
    {"title": "코드 리뷰", "description": "PR #42 검토", "completed": False,
     "due_date": "2026-06-05", "user_id": user["id"], "category_id": cat["id"]},
    {"title": "팀 미팅 준비", "completed": True,
     "user_id": user["id"], "category_id": cat["id"]},
]
created_todos = []
for td in todos_data:
    r = client.post("/todos/", json=td)
    assert r.status_code == 201, r.text
    created_todos.append(r.json())
    print(f"   {r.json()['id']}. {r.json()['title']} (완료={r.json()['completed']})")

# ── 4. Todo 목록 조회 ─────────────────────────────────────────────────────────
print("4. 전체 Todo 조회")
r = client.get("/todos/")
assert r.status_code == 200
todos = r.json()
assert len(todos) == 3
print(f"   총 {len(todos)}개")

# ── 5. Todo 완료 처리 ─────────────────────────────────────────────────────────
print("5. Todo 완료 처리")
r = client.put(f"/todos/{created_todos[0]['id']}", json={"completed": True})
assert r.status_code == 200
assert r.json()["completed"] is True
print(f"   id={created_todos[0]['id']} 완료 처리 ✓")

# ── 6. Todo 단건 조회 ─────────────────────────────────────────────────────────
print("6. Todo 단건 조회")
r = client.get(f"/todos/{created_todos[1]['id']}")
assert r.status_code == 200
print(f"   {r.json()['title']}")

# ── 7. Todo 삭제 ──────────────────────────────────────────────────────────────
print("7. Todo 삭제")
r = client.delete(f"/todos/{created_todos[2]['id']}")
assert r.status_code == 204
r = client.get("/todos/")
assert len(r.json()) == 2
print(f"   삭제 후 남은 Todo: {len(r.json())}개")

# ── 8. 404 처리 ───────────────────────────────────────────────────────────────
print("8. 없는 Todo 조회 → 404")
r = client.get("/todos/9999")
assert r.status_code == 404
print(f"   {r.json()['detail']}")

# ── 9. 카테고리 목록 ──────────────────────────────────────────────────────────
print("9. 카테고리 조회")
r = client.get("/categories/")
assert r.status_code == 200
print(f"   {[c['name'] for c in r.json()]}")

import os; os.remove("./test_todo.db")
print("\n✅ Todo 앱 전체 시나리오 통과")
