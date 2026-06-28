#!/usr/bin/env python3
import sys
from pathlib import Path

import click

sys.path.insert(0, str(Path(__file__).parent))

from src.config.stacks import STACKS, get_stack
from src.parser import mermaid as mermaid_parser
from src.generators.python.generator import PythonGenerator
from src.generators.java.generator import JavaGenerator
from src.generators.kotlin.generator import KotlinGenerator
from src.reverse.detector import reverse_parse, detect_language
from src.reverse.mermaid_writer import to_mermaid

GENERATORS = {
    "python": PythonGenerator,
    "java": JavaGenerator,
    "kotlin": KotlinGenerator,
}


@click.group()
def cli():
    pass


@cli.command()
def stacks():
    """지원하는 언어별 기술 스택 목록을 출력합니다."""
    click.echo("\n📦 지원 기술 스택\n" + "=" * 50)
    for lang, stack in STACKS.items():
        click.echo(f"\n[{lang.upper()}]")
        click.echo(f"  언어:      {stack.language}")
        click.echo(f"  프레임워크: {stack.framework}")
        click.echo(f"  ORM:       {stack.orm}")
        click.echo(f"  마이그레이션: {stack.migration}")
        click.echo(f"  빌드:      {stack.build_tool}")
        click.echo(f"  DB:        {stack.db}")
    click.echo()


@cli.command()
@click.argument("erd_file", type=click.Path(exists=True, path_type=Path))
@click.option(
    "--lang",
    type=click.Choice(["python", "java", "kotlin"], case_sensitive=False),
    prompt="생성할 언어를 선택하세요",
    help="타깃 언어 (python / java / kotlin)",
)
@click.option("--name", prompt="프로젝트 이름", help="생성할 프로젝트 이름")
@click.option(
    "--out",
    default="./output",
    show_default=True,
    type=click.Path(path_type=Path),
    help="출력 디렉토리",
)
@click.option(
    "--enhance",
    is_flag=True,
    default=False,
    help="Claude API로 유효성 검증·중첩 엔드포인트 등 LLM 보강 적용 (ANTHROPIC_API_KEY 필요)",
)
def generate(erd_file: Path, lang: str, name: str, out: Path, enhance: bool):
    """ERD 파일로부터 REST API 프로젝트를 생성합니다.

    ERD_FILE: Mermaid ERD 형식의 .mmd 파일 경로
    """
    stack = get_stack(lang)
    click.echo(f"\n🔍 ERD 파싱 중: {erd_file}")

    erd_text = erd_file.read_text(encoding="utf-8")
    diagram = mermaid_parser.parse(erd_text)

    if not diagram.entities:
        click.echo("❌ ERD에서 엔티티를 찾을 수 없습니다.", err=True)
        raise SystemExit(1)

    click.echo(f"✅ 엔티티 {len(diagram.entities)}개 파싱 완료: {[e.name for e in diagram.entities]}")
    click.echo(f"✅ 관계 {len(diagram.relations)}개 파싱 완료")
    click.echo(f"\n🔧 스택: {stack.description}")
    click.echo(f"📁 출력 경로: {out / name}\n")

    generator = GENERATORS[lang.lower()]()
    generator.generate(diagram, name, out)
    click.echo(f"✅ 템플릿 코드 생성 완료")

    if enhance:
        click.echo(f"\n✨ LLM 보강 시작 (claude-sonnet-4-6)...")
        try:
            from src.llm.enhancer import enhance_project
            enhance_project(
                diagram=diagram,
                project_dir=out / name,
                language=lang.lower(),
                on_progress=lambda msg: click.echo(msg),
            )
            click.echo("✅ LLM 보강 완료")
        except RuntimeError as e:
            click.echo(f"⚠️  LLM 보강 건너뜀: {e}", err=True)

    click.echo(f"\n✅ 프로젝트 생성 완료: {out / name}")
    _print_next_steps(lang.lower(), name, out)


def _print_next_steps(lang: str, name: str, out: Path):
    project_path = out / name
    click.echo("\n" + "=" * 50)
    click.echo("🚀 다음 단계\n")

    if lang == "python":
        click.echo(f"  cd {project_path}")
        click.echo("  docker-compose up -d db          # PostgreSQL 시작")
        click.echo("  pip install -r requirements.txt")
        click.echo("  alembic revision --autogenerate -m 'init'")
        click.echo("  alembic upgrade head             # 마이그레이션 실행")
        click.echo("  uvicorn app.main:app --reload    # 서버 시작")
        click.echo("  → http://localhost:8000/docs     # Swagger UI")
    elif lang == "java":
        click.echo(f"  cd {project_path}")
        click.echo("  docker-compose up -d db          # PostgreSQL 시작")
        click.echo("  mvn spring-boot:run              # 서버 시작")
        click.echo("  → http://localhost:8080          # API")
    elif lang == "kotlin":
        click.echo(f"  cd {project_path}")
        click.echo("  docker-compose up -d db          # PostgreSQL 시작")
        click.echo("  ./gradlew bootRun                # 서버 시작")
        click.echo("  → http://localhost:8080          # API")

    click.echo()


@cli.command()
@click.argument("project_dir", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option(
    "--lang",
    type=click.Choice(["python", "java", "kotlin"], case_sensitive=False),
    default="",
    help="언어 지정 (생략 시 자동 탐지)",
)
@click.option(
    "--out",
    default=None,
    type=click.Path(path_type=Path),
    help="출력 파일 경로 (.mmd). 생략 시 stdout",
)
def reverse(project_dir: Path, lang: str, out: Path | None):
    """기존 프로젝트 코드를 Mermaid ERD 다이어그램으로 변환합니다.

    PROJECT_DIR: 이 도구로 생성된 프로젝트 루트 경로
    """
    try:
        detected = lang or detect_language(project_dir)
        click.echo(f"🔍 언어 감지: {detected.upper()}", err=True)

        diagram = reverse_parse(project_dir, detected)
        click.echo(
            f"✅ 엔티티 {len(diagram.entities)}개 파싱: {[e.name for e in diagram.entities]}",
            err=True,
        )
        click.echo(f"✅ 관계 {len(diagram.relations)}개 추론", err=True)

        mmd = to_mermaid(diagram)

        if out:
            out.write_text(mmd, encoding="utf-8")
            click.echo(f"📄 저장 완료: {out}", err=True)
        else:
            click.echo(mmd)

    except (FileNotFoundError, ValueError) as e:
        click.echo(f"❌ {e}", err=True)
        raise SystemExit(1)


if __name__ == "__main__":
    cli()
