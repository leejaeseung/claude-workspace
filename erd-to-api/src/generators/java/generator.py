from pathlib import Path
from src.generators.base import BaseGenerator
from src.ir.models import ERDiagram

TEMPLATE_DIR = Path(__file__).parent / "templates"
BASE_PACKAGE = "com.example"


class JavaGenerator(BaseGenerator):
    def __init__(self):
        super().__init__(TEMPLATE_DIR)

    def generate(self, diagram: ERDiagram, project_name: str, output_dir: Path) -> None:
        root = output_dir / project_name
        pkg_name = f"{BASE_PACKAGE}.{project_name.lower().replace('-', '')}"
        pkg_path = Path(*pkg_name.split("."))
        src = root / "src" / "main" / "java" / pkg_path
        resources = root / "src" / "main" / "resources"

        app_class = "".join(w.capitalize() for w in project_name.replace("-", "_").split("_"))

        self.write(root / "pom.xml", self.render("pom.xml.j2", project_name=project_name, pkg_name=pkg_name))
        self.write(root / "docker-compose.yml", self.render("docker-compose.yml.j2", project_name=project_name))
        self.write(resources / "application.yml", self.render("application.yml.j2", project_name=project_name))
        self.write(
            resources / "db" / "migration" / "V1__init.sql",
            self.render("migration.sql.j2", diagram=diagram),
        )
        self.write(
            src / f"{app_class}Application.java",
            self.render("Application.java.j2", pkg_name=pkg_name, app_class=app_class),
        )

        for entity in diagram.entities:
            relations = diagram.relations_for(entity.name)
            java_imports = sorted({imp for f in entity.fields for imp in f.java_imports})

            ctx = dict(entity=entity, pkg_name=pkg_name, relations=relations, java_imports=java_imports)

            self.write(src / "entity" / f"{entity.name}.java", self.render("Entity.java.j2", **ctx))
            self.write(src / "repository" / f"{entity.name}Repository.java", self.render("Repository.java.j2", **ctx))
            self.write(src / "service" / f"{entity.name}Service.java", self.render("Service.java.j2", **ctx))
            self.write(src / "controller" / f"{entity.name}Controller.java", self.render("Controller.java.j2", **ctx))
            self.write(src / "dto" / f"{entity.name}CreateDto.java", self.render("CreateDto.java.j2", **ctx))
            self.write(src / "dto" / f"{entity.name}UpdateDto.java", self.render("UpdateDto.java.j2", **ctx))
            self.write(src / "dto" / f"{entity.name}ResponseDto.java", self.render("ResponseDto.java.j2", **ctx))
