from abc import ABC, abstractmethod
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from src.ir.models import ERDiagram


class BaseGenerator(ABC):
    def __init__(self, template_dir: Path):
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, template_name: str, **ctx) -> str:
        return self.env.get_template(template_name).render(**ctx)

    def write(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    @abstractmethod
    def generate(self, diagram: ERDiagram, project_name: str, output_dir: Path) -> None:
        pass
