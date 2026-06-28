import { useState, useRef } from "react";
import type { ERDNode, ERDEdge, ERDEntityData, ERDEdgeData, ERDField, FieldType, RelationshipType } from "../types";
import { toMermaid } from "../serializer";

interface ImportedDiagram {
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; primary_key: boolean; foreign_key: boolean; nullable: boolean }>;
  }>;
  relations: Array<{ from_entity: string; to_entity: string; type: string; label: string }>;
  mermaid: string;
}

interface Props {
  nodes: ERDNode[];
  edges: ERDEdge[];
  onAddEntity: () => void;
  onClear: () => void;
  onImport: (nodes: ERDNode[], edges: ERDEdge[]) => void;
}

const API_BASE = "http://localhost:8080";
let importIdCounter = 100;

function diagramToFlow(data: ImportedDiagram): { nodes: ERDNode[]; edges: ERDEdge[] } {
  const nodes: ERDNode[] = data.entities.map((entity, i) => {
    const entityData: ERDEntityData = {
      label: entity.name,
      fields: entity.fields.map((f): ERDField => ({
        id: `imp_${entity.name}_${f.name}`,
        name: f.name,
        type: f.type as FieldType,
        primaryKey: f.primary_key,
        foreignKey: f.foreign_key,
        nullable: f.nullable,
      })),
    };
    return {
      id: `imp_n${importIdCounter++}`,
      type: "entity" as const,
      position: { x: (i % 3) * 420 + 80, y: Math.floor(i / 3) * 340 + 80 },
      data: entityData,
    };
  });

  const nameToId = new Map(nodes.map((n) => [n.data.label as string, n.id]));

  const edges: ERDEdge[] = data.relations
    .map((rel, i): ERDEdge | null => {
      const src = nameToId.get(rel.from_entity);
      const tgt = nameToId.get(rel.to_entity);
      if (!src || !tgt) return null;
      const edgeData: ERDEdgeData = {
        label: rel.label || "relates",
        relationType: (rel.type === "one_to_many" ? "one_to_many"
          : rel.type === "one_to_one" ? "one_to_one"
          : "many_to_many") as RelationshipType,
      };
      return {
        id: `imp_e${importIdCounter++}_${i}`,
        source: src,
        target: tgt,
        label: rel.label || "relates",
        data: edgeData,
        style: { stroke: "#6366f1", strokeWidth: 2 },
        markerEnd: { type: "arrowclosed" as const, color: "#6366f1" },
      };
    })
    .filter((e): e is ERDEdge => e !== null);

  return { nodes, edges };
}

export default function Sidebar({ nodes, edges, onAddEntity, onClear, onImport }: Props) {
  const [lang, setLang] = useState<"python" | "java" | "kotlin">("python");
  const [projectName, setProjectName] = useState("my-api");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [importError, setImportError] = useState("");
  const [mermaidPreview, setMermaidPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mermaid = toMermaid(nodes, edges);

  const handleGenerate = async () => {
    if (nodes.length === 0) {
      setErrorMsg("엔티티를 먼저 추가하세요.");
      setStatus("error");
      return;
    }
    if (!projectName.trim()) {
      setErrorMsg("프로젝트 이름을 입력하세요.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erd_mermaid: mermaid, language: lang, project_name: projectName }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}-${lang}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
      setStatus("error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("loading");
    setImportError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", "");

    try {
      const res = await fetch(`${API_BASE}/api/reverse`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).detail || "가져오기 실패");
      const data: ImportedDiagram = await res.json();
      const { nodes: newNodes, edges: newEdges } = diagramToFlow(data);
      onImport(newNodes, newEdges);
      setImportStatus("idle");
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "알 수 없는 오류");
      setImportStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stackInfo = {
    python: "FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic",
    java: "Spring Boot 3.3 + Spring Data JPA + Lombok + Flyway",
    kotlin: "Spring Boot 3.3 + Spring Data JPA + Kotlin + Flyway",
  };

  return (
    <div style={{
      width: 280, background: "#1e293b", color: "#e2e8f0",
      display: "flex", flexDirection: "column", padding: "20px 16px",
      gap: 16, fontFamily: "Inter, sans-serif", fontSize: 13, flexShrink: 0,
    }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>ERD → Code Generator</div>

      {/* 다이어그램 제어 */}
      <section>
        <label style={labelStyle}>다이어그램</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onAddEntity} style={btnPrimary}>+ 엔티티</button>
          <button onClick={onClear} style={btnSecondary}>초기화</button>
        </div>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
          헤더 더블클릭으로 이름 편집 · 오른쪽 핸들 드래그로 관계 연결
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #334155" }} />

      {/* 코드 가져오기 */}
      <section>
        <label style={labelStyle}>코드 → 다이어그램</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: "none" }}
          onChange={handleImport}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === "loading"}
          style={{
            ...btnSecondary,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: importStatus === "loading" ? 0.6 : 1,
            borderStyle: "dashed",
          }}
        >
          {importStatus === "loading" ? "분석 중..." : "📂 프로젝트 ZIP 가져오기"}
        </button>
        {importStatus === "error" && (
          <div style={{ ...errorBox, marginTop: 6 }}>{importError}</div>
        )}
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
          이 도구로 생성된 Python·Java·Kotlin ZIP을 업로드하면 다이어그램으로 변환합니다
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #334155" }} />

      {/* 언어 선택 */}
      <section>
        <label style={labelStyle}>언어</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["python", "java", "kotlin"] as const).map((l) => (
            <label key={l} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="radio" name="lang" value={l} checked={lang === l}
                onChange={() => setLang(l)} style={{ accentColor: "#6366f1" }} />
              <span style={{ textTransform: "capitalize", fontWeight: lang === l ? 600 : 400 }}>{l}</span>
            </label>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>{stackInfo[lang]}</p>
      </section>

      {/* 프로젝트 이름 */}
      <section>
        <label style={labelStyle}>프로젝트 이름</label>
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
          placeholder="my-api"
          style={{ width: "100%", background: "#0f172a", border: "1px solid #334155",
            borderRadius: 6, color: "#e2e8f0", padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
      </section>

      {status === "error" && <div style={errorBox}>{errorMsg}</div>}

      <button onClick={handleGenerate} disabled={status === "loading"}
        style={{ ...btnPrimary, fontSize: 14, padding: "10px 0", opacity: status === "loading" ? 0.6 : 1 }}>
        {status === "loading" ? "생성 중..." : "ZIP 다운로드"}
      </button>

      <hr style={{ border: "none", borderTop: "1px solid #334155" }} />

      {/* Mermaid 미리보기 */}
      <section>
        <button onClick={() => setMermaidPreview((v) => !v)}
          style={{ ...btnSecondary, width: "100%", textAlign: "left" }}>
          {mermaidPreview ? "▼" : "▶"} Mermaid 미리보기
        </button>
        {mermaidPreview && (
          <pre style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
            padding: 10, fontSize: 11, color: "#94a3b8", whiteSpace: "pre-wrap",
            wordBreak: "break-all", marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {mermaid}
          </pre>
        )}
      </section>

      <div style={{ flex: 1 }} />
      <p style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
        엔티티 {nodes.length}개 · 관계 {edges.length}개
      </p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
};

const btnPrimary: React.CSSProperties = {
  background: "#6366f1", color: "#fff", border: "none", borderRadius: 6,
  padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, flex: 1,
};

const btnSecondary: React.CSSProperties = {
  background: "#334155", color: "#e2e8f0", border: "1px solid #475569",
  borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, flex: 1,
};

const errorBox: React.CSSProperties = {
  background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6,
  padding: "8px 10px", color: "#fca5a5", fontSize: 12,
};
