import re
from typing import Optional
from src.ir.models import ERDiagram, IREntity, IRField, IRRelation, FieldType, RelationType


FIELD_TYPE_MAP = {
    "int": FieldType.INT,
    "integer": FieldType.INT,
    "bigint": FieldType.INT,
    "long": FieldType.INT,
    "string": FieldType.STRING,
    "varchar": FieldType.STRING,
    "char": FieldType.STRING,
    "float": FieldType.FLOAT,
    "double": FieldType.FLOAT,
    "decimal": FieldType.FLOAT,
    "boolean": FieldType.BOOLEAN,
    "bool": FieldType.BOOLEAN,
    "datetime": FieldType.DATETIME,
    "timestamp": FieldType.DATETIME,
    "date": FieldType.DATE,
    "text": FieldType.TEXT,
}

# Mermaid ERD: left_end--right_end
# ||  = exactly one
# o|  = zero or one
# }|  = one or many
# o{  = zero or many (many side)
MANY_MARKERS = {"o{", "}o", "}{", "}|", "|{"}


def _is_many(marker: str) -> bool:
    return any(m in marker for m in ["{", "}", "o{", "}o"])


def _parse_relation_type(left: str, right: str) -> RelationType:
    left_many = _is_many(left)
    right_many = _is_many(right)

    if left_many and right_many:
        return RelationType.MANY_TO_MANY
    if right_many:
        return RelationType.ONE_TO_MANY
    if left_many:
        return RelationType.MANY_TO_ONE
    return RelationType.ONE_TO_ONE


def parse(erd_text: str) -> ERDiagram:
    diagram = ERDiagram()
    lines = [l.strip() for l in erd_text.strip().splitlines()]

    i = 0
    while i < len(lines):
        line = lines[i]

        if not line or line.lower().startswith("erdiagram") or line.startswith("%%"):
            i += 1
            continue

        # Entity block: ENTITY_NAME {
        entity_match = re.match(r"^([A-Za-z_]\w*)\s*\{", line)
        if entity_match:
            entity_name = entity_match.group(1)
            entity = IREntity(name=entity_name)
            i += 1
            while i < len(lines) and not lines[i].startswith("}"):
                f = _parse_field(lines[i])
                if f:
                    entity.fields.append(f)
                i += 1
            diagram.entities.append(entity)
            i += 1
            continue

        # Relation: A ||--o{ B : "label"  or  A }o--|| B : "label"
        rel = _parse_relation(line)
        if rel:
            diagram.relations.append(rel)

        i += 1

    return diagram


def _parse_field(line: str) -> Optional[IRField]:
    line = line.strip()
    if not line:
        return None

    # type name [PK] [FK] [UK] ["comment"]
    parts = line.split()
    if len(parts) < 2:
        return None

    type_str = parts[0].lower()
    name = parts[1]
    tags = {p.upper() for p in parts[2:] if not p.startswith('"')}

    field_type = FIELD_TYPE_MAP.get(type_str, FieldType.STRING)

    return IRField(
        name=name,
        type=field_type,
        primary_key="PK" in tags,
        foreign_key="FK" in tags,
        unique="UK" in tags,
        nullable="PK" not in tags,
    )


def _parse_relation(line: str) -> Optional[IRRelation]:
    # Patterns: A ||--o{ B : "label"   A }o--|| B : "writes"
    pattern = r"^(\w+)\s+([|o}{]+)--([|o}{]+)\s+(\w+)\s*:\s*[\"']?([^\"']*)[\"']?"
    m = re.match(pattern, line)
    if not m:
        return None

    from_entity = m.group(1)
    left_marker = m.group(2)
    right_marker = m.group(3)
    to_entity = m.group(4)
    label = m.group(5).strip()

    relation_type = _parse_relation_type(left_marker, right_marker)

    return IRRelation(
        from_entity=from_entity,
        to_entity=to_entity,
        type=relation_type,
        label=label,
    )
