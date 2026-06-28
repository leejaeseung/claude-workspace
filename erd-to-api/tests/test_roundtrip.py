"""라운드트립 검증: blog.mmd → 코드 생성 → 역파싱 → 구조 비교.

비교 기준: 엔티티 이름, 필드(이름·타입·PK·FK), 관계(방향·카디널리티).
라벨은 역파싱 시 복원 불가능하므로 비교에서 제외한다.
"""
import sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parser import mermaid as mermaid_parser
from src.generators.python.generator import PythonGenerator
from src.reverse.detector import reverse_parse
from src.reverse.mermaid_writer import to_mermaid
from src.ir.models import ERDiagram, IREntity, RelationType


def _entity_signature(entity: IREntity) -> dict:
    return {
        "name": entity.name,
        "fields": sorted(
            [
                {
                    "name": f.name,
                    "type": f.type.value,
                    "pk": f.primary_key,
                    "fk": f.foreign_key,
                }
                for f in entity.fields
            ],
            key=lambda x: x["name"],
        ),
    }


def _relation_signature(diagram: ERDiagram) -> set:
    return {
        (r.from_entity, r.to_entity, r.type.value)
        for r in diagram.relations
    }


ERD_TEXT = Path(__file__).parent.parent / "examples" / "blog.mmd"


def test_python_roundtrip():
    original = mermaid_parser.parse(ERD_TEXT.read_text())

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        PythonGenerator().generate(original, "blog", out)
        reversed_diagram = reverse_parse(out / "blog", "python")

    orig_entities = {e.name: _entity_signature(e) for e in original.entities}
    rev_entities = {e.name: _entity_signature(e) for e in reversed_diagram.entities}

    assert set(orig_entities.keys()) == set(rev_entities.keys()), (
        f"엔티티 이름 불일치: {set(orig_entities.keys())} vs {set(rev_entities.keys())}"
    )

    for name in orig_entities:
        o = orig_entities[name]
        r = rev_entities[name]
        assert o["fields"] == r["fields"], (
            f"[{name}] 필드 불일치:\n원본: {o['fields']}\n역파싱: {r['fields']}"
        )

    # 관계: 방향·카디널리티 비교 (라벨 제외)
    orig_rels = _relation_signature(original)
    rev_rels = _relation_signature(reversed_diagram)
    assert orig_rels == rev_rels, (
        f"관계 불일치:\n원본: {orig_rels}\n역파싱: {rev_rels}"
    )

    # mermaid_writer → 다시 파싱해도 구조가 유지되는지 확인
    mmd_text = to_mermaid(reversed_diagram)
    re_parsed = mermaid_parser.parse(mmd_text)
    assert {e.name for e in re_parsed.entities} == {e.name for e in original.entities}

    print("✅ Python 라운드트립 통과")
    print(f"  엔티티: {[e.name for e in reversed_diagram.entities]}")
    print(f"  관계:  {[(r.from_entity, '->', r.to_entity) for r in reversed_diagram.relations]}")


if __name__ == "__main__":
    test_python_roundtrip()
