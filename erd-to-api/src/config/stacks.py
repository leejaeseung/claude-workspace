from dataclasses import dataclass
from typing import Dict


@dataclass
class StackConfig:
    language: str
    framework: str
    orm: str
    migration: str
    build_tool: str
    db: str
    description: str


STACKS: Dict[str, StackConfig] = {
    "python": StackConfig(
        language="Python 3.11+",
        framework="FastAPI 0.115",
        orm="SQLAlchemy 2.0",
        migration="Alembic",
        build_tool="pip / requirements.txt",
        db="PostgreSQL 16 (Docker)",
        description="FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic",
    ),
    "java": StackConfig(
        language="Java 21",
        framework="Spring Boot 3.3",
        orm="Spring Data JPA (Hibernate 6)",
        migration="Flyway",
        build_tool="Maven",
        db="PostgreSQL 16 (Docker)",
        description="Spring Boot 3 + Spring Data JPA + Lombok + Flyway",
    ),
    "kotlin": StackConfig(
        language="Kotlin 1.9 (JVM 21)",
        framework="Spring Boot 3.3",
        orm="Spring Data JPA (Hibernate 6)",
        migration="Flyway",
        build_tool="Gradle Kotlin DSL",
        db="PostgreSQL 16 (Docker)",
        description="Spring Boot 3 + Spring Data JPA + Kotlin data classes + Flyway",
    ),
}


def get_stack(language: str) -> StackConfig:
    key = language.lower()
    if key not in STACKS:
        raise ValueError(f"지원하지 않는 언어: {language}. 선택 가능: {list(STACKS.keys())}")
    return STACKS[key]
