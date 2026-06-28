"""SQLAlchemy 모델 파일 → ERDiagram 역파싱.

이 도구가 생성한 Python 코드 구조를 가정한다:
  app/models/<entity_snake>.py  → class <Entity>(Base): ...
"""
import re
from pathlib import Path
from typing import Optional

from src.ir.models import ERDiagram, IREntity, IRField, IRRelation, FieldType, RelationType

# SQLAlchemy 타입 → IR 타입
_SA_TYPE_MAP: dict[str, FieldType] = {
    "Integer":  FieldType.INT,
    "String":   FieldType.STRING,
    "Float":    FieldType.FLOAT,
    "Boolean":  FieldType.BOOLEAN,
    "DateTime": FieldType.DATETIME,
    "Date":     FieldType.DATE,
    "Text":     FieldType.TEXT,
}

# 중첩 괄호(String(255))를 피해 타입만 직접 추출: Column(TypeName...
_COL_TYPE_RE = re.compile(r"=\s*Column\(\s*(\w+)")
# ForeignKey 존재 여부
_FK_RE = re.compile(r"ForeignKey\(")
# nullable=False 여부
_NULLABLE_FALSE_RE = re.compile(r"nullable\s*=\s*False")
# primary_key=True 여부
_PK_RE = re.compile(r"primary_key\s*=\s*True")


def parse_python_project(project_dir: Path) -> ERDiagram:
    """프로젝트 루트를 받아 app/models/*.py 를 파싱한다."""
    models_dir = project_dir / "app" / "models"
    if not models_dir.exists():
        raise FileNotFoundError(f"models 디렉토리를 찾을 수 없습니다: {models_dir}")

    diagram = ERDiagram()

    for model_file in sorted(models_dir.glob("*.py")):
        if model_file.name == "__init__.py":
            continue
        entity = _parse_model_file(model_file.read_text(encoding="utf-8"))
        if entity:
            diagram.entities.append(entity)

    _infer_relations(diagram)
    return diagram


def _parse_model_file(content: str) -> Optional[IREntity]:
    # class <Name>(Base): 찾기
    class_match = re.search(r"^class\s+(\w+)\s*\(Base\)\s*:", content, re.MULTILINE)
    if not class_match:
        return None

    entity = IREntity(name=class_match.group(1))

    # 줄 단위로 Column() 선언 추출 — relationship() 라인은 자동 제외
    # 한 줄에 Column(이 포함된 라인만 처리 (중첩 괄호 문제 회피)
    for line in content.splitlines():
        stripped = line.strip()
        if "= Column(" not in stripped:
            continue

        # 필드명: 라인 시작 부분
        name_match = re.match(r"(\w+)\s*=\s*Column\(", stripped)
        if not name_match:
            continue

        field_name = name_match.group(1)
        if field_name.startswith("_"):
            continue

        type_match = _COL_TYPE_RE.search(line)
        field_type = _SA_TYPE_MAP.get(type_match.group(1), FieldType.STRING) if type_match else FieldType.STRING
        is_pk = bool(_PK_RE.search(line))
        is_fk = bool(_FK_RE.search(line))
        nullable = not bool(_NULLABLE_FALSE_RE.search(line)) and not is_pk

        entity.fields.append(IRField(
            name=field_name,
            type=field_type,
            primary_key=is_pk,
            foreign_key=is_fk,
            nullable=nullable,
        ))

    return entity if entity.fields else None



def _infer_relations(diagram: ERDiagram) -> None:
    """FK 컬럼만으로 관계를 추론한다 (relationship() 라인은 사용하지 않음).

    FK 필드 이름 패턴: {table_name}.{pk} → 파싱된 엔티티의 plural_snake를 키로 역참조.
    예) ForeignKey("users.id") → table="users" → 엔티티 "User" 탐색
    """
    # plural_snake → entity 이름 조회 테이블
    name_lookup = {e.name_plural_snake: e.name for e in diagram.entities}

    for entity in diagram.entities:
        for field in entity.fields:
            if not field.foreign_key:
                continue

            # FK 필드의 ForeignKey("table.col") 에서 테이블명 복원은 불가능
            # (파싱 시 col_body를 저장하지 않음) → 필드명 패턴으로 추론
            # 패턴: {xxx}_id  → 테이블명 후보 = xxx + "s" (단순 복수)
            if not field.name.endswith("_id"):
                continue

            base = field.name[:-3]  # "user_id" → "user"

            # 파싱된 엔티티 이름과 대소문자 무시 비교 (CamelCase → lower)
            one_entity_name = next(
                (e.name for e in diagram.entities if e.name.lower() == base.lower()),
                None,
            )
            # plural snake lookup 도 시도 (예: company_id → companies → Company)
            if one_entity_name is None:
                plural_candidate = base + "s"
                one_entity_name = name_lookup.get(plural_candidate)

            if one_entity_name is None:
                continue

            diagram.relations.append(IRRelation(
                from_entity=one_entity_name,
                to_entity=entity.name,
                type=RelationType.ONE_TO_MANY,
                label="relates",
            ))
