"""프로젝트 디렉토리에서 언어를 자동 탐지하고 역파싱을 실행한다."""
from pathlib import Path

from src.ir.models import ERDiagram


def detect_language(project_dir: Path) -> str:
    if (project_dir / "app" / "models").exists():
        return "python"
    if next(project_dir.rglob("*.kt"), None) and next(project_dir.rglob("entity"), None):
        return "kotlin"
    if next(project_dir.rglob("*.java"), None) and next(project_dir.rglob("entity"), None):
        return "java"
    raise ValueError(
        f"언어를 자동 탐지할 수 없습니다: {project_dir}\n"
        "app/models/ (Python), entity/*.java, 또는 entity/*.kt 가 없습니다."
    )


def reverse_parse(project_dir: Path, language: str = "") -> ERDiagram:
    lang = language.lower() if language else detect_language(project_dir)

    if lang == "python":
        from src.reverse.python_parser import parse_python_project
        return parse_python_project(project_dir)
    if lang == "java":
        from src.reverse.java_parser import parse_java_project
        return parse_java_project(project_dir)
    if lang == "kotlin":
        from src.reverse.kotlin_parser import parse_kotlin_project
        return parse_kotlin_project(project_dir)

    raise ValueError(f"지원하지 않는 언어: {lang}")
