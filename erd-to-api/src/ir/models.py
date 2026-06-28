from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
import re


class FieldType(Enum):
    INT = "int"
    STRING = "string"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TEXT = "text"


class RelationType(Enum):
    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_ONE = "many_to_one"
    MANY_TO_MANY = "many_to_many"


@dataclass
class IRField:
    name: str
    type: FieldType
    primary_key: bool = False
    foreign_key: bool = False
    nullable: bool = True
    unique: bool = False

    @property
    def python_type(self) -> str:
        mapping = {
            FieldType.INT: "int",
            FieldType.STRING: "str",
            FieldType.FLOAT: "float",
            FieldType.BOOLEAN: "bool",
            FieldType.DATETIME: "datetime",
            FieldType.DATE: "date",
            FieldType.TEXT: "str",
        }
        return mapping[self.type]

    @property
    def sa_type(self) -> str:
        mapping = {
            FieldType.INT: "Integer",
            FieldType.STRING: "String(255)",
            FieldType.FLOAT: "Float",
            FieldType.BOOLEAN: "Boolean",
            FieldType.DATETIME: "DateTime",
            FieldType.DATE: "Date",
            FieldType.TEXT: "Text",
        }
        return mapping[self.type]

    @property
    def java_type(self) -> str:
        mapping = {
            FieldType.INT: "Long",
            FieldType.STRING: "String",
            FieldType.FLOAT: "Double",
            FieldType.BOOLEAN: "Boolean",
            FieldType.DATETIME: "LocalDateTime",
            FieldType.DATE: "LocalDate",
            FieldType.TEXT: "String",
        }
        return mapping[self.type]

    @property
    def kotlin_type(self) -> str:
        return self.java_type

    @property
    def java_imports(self) -> List[str]:
        mapping = {
            FieldType.DATETIME: ["java.time.LocalDateTime"],
            FieldType.DATE: ["java.time.LocalDate"],
        }
        return mapping.get(self.type, [])


@dataclass
class IRRelation:
    from_entity: str
    to_entity: str
    type: RelationType
    label: str = ""

    @property
    def is_collection(self) -> bool:
        return self.type in (RelationType.ONE_TO_MANY, RelationType.MANY_TO_MANY)


@dataclass
class IREntity:
    name: str
    fields: List[IRField] = field(default_factory=list)

    @property
    def name_lower(self) -> str:
        return self.name[0].lower() + self.name[1:]

    @property
    def name_snake(self) -> str:
        return re.sub(r"(?<!^)(?=[A-Z])", "_", self.name).lower()

    @property
    def name_plural_snake(self) -> str:
        snake = self.name_snake
        if snake.endswith("y"):
            return snake[:-1] + "ies"
        return snake + "s"

    @property
    def name_plural_lower(self) -> str:
        n = self.name_lower
        if n.endswith("y"):
            return n[:-1] + "ies"
        return n + "s"

    @property
    def pk_field(self) -> Optional[IRField]:
        for f in self.fields:
            if f.primary_key:
                return f
        return None

    @property
    def non_pk_fields(self) -> List[IRField]:
        return [f for f in self.fields if not f.primary_key]

    @property
    def non_fk_non_pk_fields(self) -> List[IRField]:
        return [f for f in self.fields if not f.primary_key and not f.foreign_key]


@dataclass
class ERDiagram:
    entities: List[IREntity] = field(default_factory=list)
    relations: List[IRRelation] = field(default_factory=list)

    def get_entity(self, name: str) -> Optional[IREntity]:
        for e in self.entities:
            if e.name.lower() == name.lower():
                return e
        return None

    def relations_for(self, entity_name: str) -> List[IRRelation]:
        return [r for r in self.relations if r.from_entity.lower() == entity_name.lower()]
