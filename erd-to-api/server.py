#!/usr/bin/env python3
"""FastAPI 서버: 다이어그램 UI + 코드 생성 API + 역방향 파싱 API"""
import io
import sys
import zipfile
import tempfile
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.parser import mermaid as mermaid_parser
from src.generators.python.generator import PythonGenerator
from src.generators.java.generator import JavaGenerator
from src.generators.kotlin.generator import KotlinGenerator
from src.reverse.detector import reverse_parse, detect_language
from src.reverse.mermaid_writer import to_mermaid

app = FastAPI(title="ERD to API Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GENERATORS = {
    "python": PythonGenerator,
    "java": JavaGenerator,
    "kotlin": KotlinGenerator,
}


# ── 공통 응답 모델 ──────────────────────────────────────────────────────────────

class FieldInfo(BaseModel):
    name: str
    type: str
    primary_key: bool = False
    foreign_key: bool = False
    nullable: bool = True


class EntityInfo(BaseModel):
    name: str
    fields: List[FieldInfo]


class RelationInfo(BaseModel):
    from_entity: str
    to_entity: str
    type: str = "one_to_many"
    label: str = "relates"


class ParsedDiagram(BaseModel):
    entities: List[EntityInfo]
    relations: List[RelationInfo]
    mermaid: str = ""


# ── 순방향: ERD → 코드 ────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    erd_mermaid: str
    language: str
    project_name: str


def _diagram_to_response(diagram, mermaid_text: str = "") -> ParsedDiagram:
    return ParsedDiagram(
        mermaid=mermaid_text,
        entities=[
            EntityInfo(
                name=e.name,
                fields=[
                    FieldInfo(
                        name=f.name,
                        type=f.type.value,
                        primary_key=f.primary_key,
                        foreign_key=f.foreign_key,
                        nullable=f.nullable,
                    )
                    for f in e.fields
                ],
            )
            for e in diagram.entities
        ],
        relations=[
            RelationInfo(
                from_entity=r.from_entity,
                to_entity=r.to_entity,
                type=r.type.value,
                label=r.label,
            )
            for r in diagram.relations
        ],
    )


@app.post("/api/preview", response_model=ParsedDiagram)
def preview(req: GenerateRequest):
    """Mermaid ERD를 파싱해 구조 정보를 반환합니다."""
    try:
        diagram = mermaid_parser.parse(req.erd_mermaid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ERD 파싱 실패: {e}")
    return _diagram_to_response(diagram, req.erd_mermaid)


@app.post("/api/generate")
def generate(req: GenerateRequest):
    """ERD로부터 프로젝트를 생성하고 ZIP으로 반환합니다."""
    lang = req.language.lower()
    if lang not in GENERATORS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 언어: {lang}")

    try:
        diagram = mermaid_parser.parse(req.erd_mermaid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ERD 파싱 실패: {e}")

    if not diagram.entities:
        raise HTTPException(status_code=400, detail="ERD에서 엔티티를 찾을 수 없습니다.")

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = Path(tmp)
        GENERATORS[lang]().generate(diagram, req.project_name, out_dir)

        zip_buf = io.BytesIO()
        project_dir = out_dir / req.project_name
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fp in sorted(project_dir.rglob("*")):
                if fp.is_file():
                    zf.write(fp, fp.relative_to(out_dir))
        zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={req.project_name}-{lang}.zip"},
    )


# ── 역방향: 코드 ZIP → ERD ───────────────────────────────────────────────────

@app.post("/api/reverse", response_model=ParsedDiagram)
async def reverse_from_zip(
    file: UploadFile = File(..., description="이 도구로 생성된 프로젝트 ZIP 파일"),
    language: str = Form("", description="언어 지정 (생략 시 자동 탐지: python/java/kotlin)"),
):
    """프로젝트 ZIP을 업로드하면 ERD 다이어그램 구조를 반환합니다."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="ZIP 파일만 허용됩니다.")

    content = await file.read()

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # ZIP 압축 해제
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                zf.extractall(tmp_path)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="유효하지 않은 ZIP 파일입니다.")

        # 언어 탐지: 최상위 디렉토리가 프로젝트 루트인 경우와 아닌 경우 모두 처리
        project_root = _find_project_root(tmp_path)

        try:
            detected = language.lower() if language else detect_language(project_root)
            diagram = reverse_parse(project_root, detected)
        except (FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=422, detail=str(e))

        mmd = to_mermaid(diagram)

    return _diagram_to_response(diagram, mmd)


def _find_project_root(base: Path) -> Path:
    """ZIP 내부가 단일 서브디렉토리로 감싸진 경우 그 안으로 진입."""
    children = [c for c in base.iterdir() if c.is_dir()]
    if len(children) == 1:
        inner = children[0]
        # Python 프로젝트: app/models 존재 여부
        if (inner / "app" / "models").exists():
            return inner
        # Java/Kotlin: src/main 존재 여부
        if (inner / "src" / "main").exists():
            return inner
    return base


# ── 헬스체크 & 정적 파일 ─────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


web_dist = Path(__file__).parent / "web" / "dist"
if web_dist.exists():
    app.mount("/", StaticFiles(directory=str(web_dist), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
