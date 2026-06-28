import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Callable

import anthropic

from src.ir.models import ERDiagram, IREntity

MODEL = "claude-sonnet-4-6"


def _client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
    return anthropic.Anthropic(api_key=api_key)


def _entity_to_dict(entity: IREntity) -> dict:
    return {
        "name": entity.name,
        "fields": [
            {
                "name": f.name,
                "type": f.type.value,
                "primary_key": f.primary_key,
                "foreign_key": f.foreign_key,
                "nullable": f.nullable,
            }
            for f in entity.fields
        ],
    }


def _call(client: anthropic.Anthropic, system: str, user: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


def _extract_code(text: str) -> str:
    """마크다운 코드블록을 제거하고 순수 코드만 반환."""
    lines = text.splitlines()
    result = []
    in_block = False
    for line in lines:
        if line.strip().startswith("```"):
            in_block = not in_block
            continue
        result.append(line)
    return "\n".join(result).strip()


SYSTEM_PYTHON = """\
You are an expert FastAPI developer. You will receive auto-generated Python code and enhance it.
Rules:
- Return ONLY valid Python code, no markdown, no explanations.
- Preserve all existing imports and structure; only ADD content.
- Use Pydantic v2 syntax (model_config, field_validator, etc.).
- Do not remove or rename anything that already exists.
"""

SYSTEM_JAVA = """\
You are an expert Spring Boot developer. You will receive auto-generated Java code and enhance it.
Rules:
- Return ONLY valid Java code, no markdown, no explanations.
- Add jakarta.validation annotations where appropriate.
- Preserve the existing package structure and class name.
- Do not remove or rename anything that already exists.
"""

SYSTEM_KOTLIN = """\
You are an expert Spring Boot + Kotlin developer. You will receive auto-generated Kotlin code and enhance it.
Rules:
- Return ONLY valid Kotlin code, no markdown, no explanations.
- Add jakarta.validation annotations where appropriate.
- Preserve the existing package structure and class name.
- Do not remove or rename anything that already exists.
"""


def enhance_python_schema(client: anthropic.Anthropic, entity: IREntity, schema_code: str) -> str:
    entity_json = json.dumps(_entity_to_dict(entity), ensure_ascii=False, indent=2)
    prompt = f"""Entity definition:
{entity_json}

Current schema code:
```python
{schema_code}
```

Enhance the schema by:
1. Adding field_validator or Annotated validators for fields with semantic meaning:
   - Fields named "email" → use EmailStr (import from pydantic)
   - Fields named "password" → add min_length=8 validator
   - Fields named "url" or ending with "_url" → use AnyHttpUrl
   - Non-nullable string fields → add Field(min_length=1)
2. Adding Field(examples=[...]) for OpenAPI docs on at least 2 fields.
3. Keep all three classes: {entity.name}Base, {entity.name}Create, {entity.name}Update, {entity.name}Response.
"""
    result = _call(client, SYSTEM_PYTHON, prompt)
    return _extract_code(result)


def enhance_python_router(
    client: anthropic.Anthropic,
    entity: IREntity,
    diagram: ERDiagram,
    router_code: str,
) -> str:
    entity_json = json.dumps(_entity_to_dict(entity), ensure_ascii=False, indent=2)
    relations = diagram.relations_for(entity.name)
    relations_json = json.dumps(
        [{"to": r.to_entity, "type": r.type.value, "label": r.label} for r in relations],
        ensure_ascii=False,
        indent=2,
    )

    prompt = f"""Entity definition:
{entity_json}

Relations from this entity:
{relations_json}

Current router code:
```python
{router_code}
```

Enhance the router by:
1. For each ONE_TO_MANY relation, add a nested GET endpoint:
   - Pattern: @router.get("/{{item_id}}/{{related_plural}}", response_model=List[...])
   - Example: for User→Post relation, add GET /{{item_id}}/posts
   - Import the related model from app.models.<related_lower>
   - Import the related schema from app.schemas.<related_lower>
2. Add a query parameter "q" to the list endpoint for simple name/title search (if the entity has a "name" or "title" field).
3. Preserve ALL existing endpoints exactly as they are.
"""
    result = _call(client, SYSTEM_PYTHON, prompt)
    return _extract_code(result)


def enhance_java_dto(client: anthropic.Anthropic, entity: IREntity, dto_code: str) -> str:
    entity_json = json.dumps(_entity_to_dict(entity), ensure_ascii=False, indent=2)
    prompt = f"""Entity definition:
{entity_json}

Current CreateDto code:
```java
{dto_code}
```

Enhance by adding jakarta.validation annotations:
- @NotBlank for non-nullable String fields
- @Email for fields named "email"
- @Size(min=8) for fields named "password"
- @NotNull for non-nullable non-String fields
Add import statements for any new annotations used.
"""
    result = _call(client, SYSTEM_JAVA, prompt)
    return _extract_code(result)


def enhance_kotlin_dto(client: anthropic.Anthropic, entity: IREntity, dto_code: str) -> str:
    entity_json = json.dumps(_entity_to_dict(entity), ensure_ascii=False, indent=2)
    prompt = f"""Entity definition:
{entity_json}

Current Dto code:
```kotlin
{dto_code}
```

Enhance the CreateDto data class by adding jakarta.validation annotations on fields:
- @field:NotBlank for non-nullable String fields
- @field:Email for fields named "email"
- @field:Size(min=8) for fields named "password"
- @field:NotNull for non-nullable non-String fields
Add import statements for any new annotations used.
Preserve UpdateDto and ResponseDto exactly as they are.
"""
    result = _call(client, SYSTEM_KOTLIN, prompt)
    return _extract_code(result)


def enhance_project(
    diagram: ERDiagram,
    project_dir: Path,
    language: str,
    on_progress: Callable[[str], None] = print,
) -> None:
    client = _client()

    if language == "python":
        _enhance_python(client, diagram, project_dir, on_progress)
    elif language == "java":
        _enhance_java(client, diagram, project_dir, on_progress)
    elif language == "kotlin":
        _enhance_kotlin(client, diagram, project_dir, on_progress)


def _enhance_python(
    client: anthropic.Anthropic,
    diagram: ERDiagram,
    project_dir: Path,
    log: Callable,
) -> None:
    app_dir = project_dir / "app"

    for entity in diagram.entities:
        schema_path = app_dir / "schemas" / f"{entity.name_snake}.py"
        router_path = app_dir / "routers" / f"{entity.name_snake}.py"

        log(f"  [LLM] {entity.name} 스키마 보강 중...")
        enhanced = enhance_python_schema(client, entity, schema_path.read_text())
        schema_path.write_text(enhanced, encoding="utf-8")

        log(f"  [LLM] {entity.name} 라우터 보강 중...")
        enhanced = enhance_python_router(client, entity, diagram, router_path.read_text())
        router_path.write_text(enhanced, encoding="utf-8")


def _enhance_java(
    client: anthropic.Anthropic,
    diagram: ERDiagram,
    project_dir: Path,
    log: Callable,
) -> None:
    # Java 패키지 경로 탐색
    dto_base = next(project_dir.rglob("dto"), None)
    if not dto_base:
        log("  [경고] dto 디렉토리를 찾을 수 없습니다.")
        return

    for entity in diagram.entities:
        create_dto = dto_base / f"{entity.name}CreateDto.java"
        if not create_dto.exists():
            continue
        log(f"  [LLM] {entity.name} CreateDto 보강 중...")
        enhanced = enhance_java_dto(client, entity, create_dto.read_text())
        create_dto.write_text(enhanced, encoding="utf-8")


def _enhance_kotlin(
    client: anthropic.Anthropic,
    diagram: ERDiagram,
    project_dir: Path,
    log: Callable,
) -> None:
    dto_base = next(project_dir.rglob("dto"), None)
    if not dto_base:
        log("  [경고] dto 디렉토리를 찾을 수 없습니다.")
        return

    for entity in diagram.entities:
        dto_file = dto_base / f"{entity.name}Dto.kt"
        if not dto_file.exists():
            continue
        log(f"  [LLM] {entity.name} Dto 보강 중...")
        enhanced = enhance_kotlin_dto(client, entity, dto_file.read_text())
        dto_file.write_text(enhanced, encoding="utf-8")
