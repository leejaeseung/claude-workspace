"""JPA 엔티티 Kotlin 파일 → ERDiagram 역파싱.

이 도구가 생성한 Kotlin 코드 구조를 가정한다:
  src/main/kotlin/**/*.kt  →  @Entity 클래스 (primary constructor 스타일)
"""
import re
from pathlib import Path
from typing import Optional

from src.ir.models import ERDiagram, IREntity, IRField, IRRelation, FieldType, RelationType

_KOTLIN_TYPE_MAP: dict[str, FieldType] = {
    "Long":          FieldType.INT,
    "Int":           FieldType.INT,
    "String":        FieldType.STRING,
    "Double":        FieldType.FLOAT,
    "Float":         FieldType.FLOAT,
    "Boolean":       FieldType.BOOLEAN,
    "LocalDateTime": FieldType.DATETIME,
    "LocalDate":     FieldType.DATE,
}


def parse_kotlin_project(project_dir: Path) -> ERDiagram:
    entity_dir = next(project_dir.rglob("entity"), None)
    if entity_dir is None:
        raise FileNotFoundError(f"entity 디렉토리를 찾을 수 없습니다: {project_dir}")

    diagram = ERDiagram()
    for kt_file in sorted(entity_dir.glob("*.kt")):
        entity = _parse_kotlin_file(kt_file.read_text(encoding="utf-8"))
        if entity:
            diagram.entities.append(entity)

    _infer_relations(diagram)
    return diagram


def _parse_kotlin_file(content: str) -> Optional[IREntity]:
    if "@Entity" not in content:
        return None

    class_match = re.search(r"class\s+(\w+)\s*[\(\{]", content)
    if not class_match:
        return None

    entity = IREntity(name=class_match.group(1))

    # 생성자 파라미터: var/val <name>: <Type>? = ...
    # 클래스 바디 프로퍼티: val <name>: MutableList<...> — 컬렉션은 스킵
    param_re = re.compile(
        r"(?:var|val)\s+(\w+)\s*:\s*([\w<>?]+)",
        re.MULTILINE,
    )
    for m in param_re.finditer(content):
        field_name = m.group(1)
        raw_type = m.group(2).rstrip("?")  # nullable "?" 제거

        # 컬렉션 타입 스킵
        if any(c in raw_type for c in ["List", "MutableList", "Set", "Collection"]):
            continue

        field_type = _KOTLIN_TYPE_MAP.get(raw_type, FieldType.STRING)

        preceding = content[max(0, m.start() - 200):m.start()]
        is_pk = "@Id" in preceding
        is_fk = field_name.endswith("_id")
        nullable = "?" in m.group(2)

        entity.fields.append(IRField(
            name=field_name,
            type=field_type,
            primary_key=is_pk,
            foreign_key=is_fk,
            nullable=nullable,
        ))

    return entity if entity.fields else None


def _infer_relations(diagram: ERDiagram) -> None:
    for entity in diagram.entities:
        for field in entity.fields:
            if not field.foreign_key or not field.name.endswith("_id"):
                continue

            base = field.name[:-3]
            one_entity_name = next(
                (e.name for e in diagram.entities if e.name.lower() == base.lower()),
                None,
            )
            if one_entity_name is None:
                continue

            diagram.relations.append(IRRelation(
                from_entity=one_entity_name,
                to_entity=entity.name,
                type=RelationType.ONE_TO_MANY,
                label="relates",
            ))
