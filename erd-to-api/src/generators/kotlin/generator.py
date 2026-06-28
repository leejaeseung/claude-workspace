from pathlib import Path
from src.generators.base import BaseGenerator
from src.ir.models import ERDiagram

TEMPLATE_DIR = Path(__file__).parent / "templates"
BASE_PACKAGE = "com.example"


class KotlinGenerator(BaseGenerator):
    def __init__(self):
        super().__init__(TEMPLATE_DIR)

    def generate(self, diagram: ERDiagram, project_name: str, output_dir: Path) -> None:
        root = output_dir / project_name
        pkg_name = f"{BASE_PACKAGE}.{project_name.lower().replace('-', '')}"
        pkg_path = Path(*pkg_name.split("."))
        src = root / "src" / "main" / "kotlin" / pkg_path
        resources = root / "src" / "main" / "resources"

        app_class = "".join(w.capitalize() for w in project_name.replace("-", "_").split("_"))

        self.write(root / "build.gradle.kts", self.render("build.gradle.kts.j2", project_name=project_name, pkg_name=pkg_name))
        self.write(root / "settings.gradle.kts", f'rootProject.name = "{project_name}"\n')
        self.write(root / "docker-compose.yml", self.render("docker-compose.yml.j2", project_name=project_name))
        self.write(resources / "application.yml", self.render("application.yml.j2", project_name=project_name))
        self.write(
            resources / "db" / "migration" / "V1__init.sql",
            self.render("migration.sql.j2", diagram=diagram),
        )
        self.write(
            src / f"{app_class}Application.kt",
            self.render("Application.kt.j2", pkg_name=pkg_name, app_class=app_class),
        )

        for entity in diagram.entities:
            relations = diagram.relations_for(entity.name)
            java_imports = sorted({imp for f in entity.fields for imp in f.java_imports})

            ctx = dict(entity=entity, pkg_name=pkg_name, relations=relations, java_imports=java_imports)

            self.write(src / "entity" / f"{entity.name}.kt", self.render("Entity.kt.j2", **ctx))
            self.write(src / "repository" / f"{entity.name}Repository.kt", self.render("Repository.kt.j2", **ctx))
            self.write(src / "service" / f"{entity.name}Service.kt", self.render("Service.kt.j2", **ctx))
            self.write(src / "controller" / f"{entity.name}Controller.kt", self.render("Controller.kt.j2", **ctx))
            self.write(src / "dto" / f"{entity.name}Dto.kt", self.render("Dto.kt.j2", **ctx))
