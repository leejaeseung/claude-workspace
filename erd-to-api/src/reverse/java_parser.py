"""JPA 엔티티 Java 파일 → ERDiagram 역파싱.

이 도구가 생성한 Java 코드 구조를 가정한다:
  src/main/java/**/*.java  →  @Entity 클래스
"""
import re
from pathlib import Path
from typing import Optional

from src.ir.models import ERDiagram, IREntity, IRField, IRRelation, FieldType, RelationType

_JAVA_TYPE_MAP: dict[str, FieldType] = {
    "Long":           FieldType.INT,
    "Integer":        FieldType.INT,
    "int":            FieldType.INT,
    "long":           FieldType.INT,
    "String":         FieldType.STRING,
    "Double":         FieldType.FLOAT,
    "Float":          FieldType.FLOAT,
    "double":         FieldType.FLOAT,
    "float":          FieldType.FLOAT,
    "Boolean":        FieldType.BOOLEAN,
    "boolean":        FieldType.BOOLEAN,
    "LocalDateTime":  FieldType.DATETIME,
    "LocalDate":      FieldType.DATE,
}

# 컬렉션 타입 — 스킵 대상
_COLLECTION_RE = re.compile(r"List<|MutableList<|Set<|Collection<")


def parse_java_project(project_dir: Path) -> ERDiagram:
    entity_dir = next(project_dir.rglob("entity"), None)
    if entity_dir is None:
        raise FileNotFoundError(f"entity 디렉토리를 찾을 수 없습니다: {project_dir}")

    diagram = ERDiagram()
    for java_file in sorted(entity_dir.glob("*.java")):
        entity = _parse_java_file(java_file.read_text(encoding="utf-8"))
        if entity:
            diagram.entities.append(entity)

    _infer_relations(diagram)
    return diagram


def _parse_java_file(content: str) -> Optional[IREntity]:
    if "@Entity" not in content:
        return None

    class_match = re.search(r"public\s+class\s+(\w+)", content)
    if not class_match:
        return None

    entity = IREntity(name=class_match.group(1))

    # private <Type> <name>; 패턴 (컬렉션 타입 제외)
    field_re = re.compile(r"^\s+private\s+(\w+)\s+(\w+)\s*;", re.MULTILINE)
    for m in field_re.finditer(content):
        java_type = m.group(1)
        field_name = m.group(2)

        # 컬렉션(List<Comment> 등)은 이미 걸러짐 — 제네릭 없는 List는 드물지만 방어
        if java_type in ("List", "Set", "Collection", "MutableList"):
            continue

        field_type = _JAVA_TYPE_MAP.get(java_type, FieldType.STRING)

        # 직전 줄의 어노테이션으로 PK 여부 판단
        field_start = m.start()
        preceding = content[max(0, field_start - 200):field_start]
        is_pk = "@Id" in preceding.split("\n")[-5:]  # 직전 5줄 내 @Id
        is_fk = field_name.endswith("_id")
        nullable = "@Column(nullable = false)" not in preceding

        entity.fields.append(IRField(
            name=field_name,
            type=field_type,
            primary_key=is_pk,
            foreign_key=is_fk,
            nullable=nullable,
        ))

    return entity if entity.fields else None


def _infer_relations(diagram: ERDiagram) -> None:
    """Java는 ForeignKey 타깃이 코드에 명시되지 않으므로 필드명 패턴으로 추론.

    user_id → "user" → 엔티티 이름과 대소문자 무시 비교
    """
    for entity in diagram.entities:
        for field in entity.fields:
            if not field.foreign_key:
                continue
            if not field.name.endswith("_id"):
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
