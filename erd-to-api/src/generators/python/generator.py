from pathlib import Path
from src.generators.base import BaseGenerator
from src.ir.models import ERDiagram, FieldType

TEMPLATE_DIR = Path(__file__).parent / "templates"

SA_IMPORTS = {
    FieldType.INT: "Integer",
    FieldType.STRING: "String",
    FieldType.FLOAT: "Float",
    FieldType.BOOLEAN: "Boolean",
    FieldType.DATETIME: "DateTime",
    FieldType.DATE: "Date",
    FieldType.TEXT: "Text",
}

PYDANTIC_IMPORTS = {
    FieldType.DATETIME: "datetime",
    FieldType.DATE: "date",
}


class PythonGenerator(BaseGenerator):
    def __init__(self):
        super().__init__(TEMPLATE_DIR)

    def generate(self, diagram: ERDiagram, project_name: str, output_dir: Path) -> None:
        root = output_dir / project_name
        app = root / "app"

        self._write_root_files(root, project_name, diagram)
        self._write_database(app)
        self._write_main(app, project_name, diagram)

        # FK 필드명 → 정확한 타깃 테이블명 사전 (entity.name_plural_snake 사용)
        fk_table_map: dict[str, str] = {}
        for entity in diagram.entities:
            for field in entity.fields:
                if field.foreign_key and field.name.endswith("_id"):
                    base = field.name[:-3]
                    target = diagram.get_entity(base)
                    if target:
                        fk_table_map[field.name] = target.name_plural_snake

        for entity in diagram.entities:
            relations = diagram.relations_for(entity.name)
            sa_types = sorted({SA_IMPORTS[f.type] for f in entity.fields})
            py_imports = sorted({PYDANTIC_IMPORTS[f.type] for f in entity.fields if f.type in PYDANTIC_IMPORTS})

            self.write(
                app / "models" / f"{entity.name_snake}.py",
                self.render("model.py.j2", entity=entity, relations=relations,
                            sa_types=sa_types, fk_table_map=fk_table_map),
            )
            self.write(
                app / "schemas" / f"{entity.name_snake}.py",
                self.render("schema.py.j2", entity=entity, py_imports=py_imports),
            )
            self.write(
                app / "routers" / f"{entity.name_snake}.py",
                self.render("router.py.j2", entity=entity),
            )

        for pkg in ["models", "schemas", "routers"]:
            (app / pkg / "__init__.py").write_text("", encoding="utf-8")

        (app / "__init__.py").write_text("", encoding="utf-8")

    def _write_root_files(self, root: Path, project_name: str, diagram: ERDiagram) -> None:
        self.write(root / "requirements.txt", self.render("requirements.txt.j2"))
        self.write(root / "docker-compose.yml", self.render("docker-compose.yml.j2", project_name=project_name))
        self.write(root / ".env", self.render("env.j2", project_name=project_name))
        self.write(root / "alembic.ini", self.render("alembic.ini.j2", project_name=project_name))
        alembic_env = self.render("alembic_env.py.j2", diagram=diagram)
        self.write(root / "alembic" / "env.py", alembic_env)
        (root / "alembic" / "versions").mkdir(parents=True, exist_ok=True)

    def _write_database(self, app: Path) -> None:
        self.write(app / "database.py", self.render("database.py.j2"))

    def _write_main(self, app: Path, project_name: str, diagram: ERDiagram) -> None:
        self.write(app / "main.py", self.render("main.py.j2", project_name=project_name, diagram=diagram))
