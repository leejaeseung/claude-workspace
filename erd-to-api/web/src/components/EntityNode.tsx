import { useState, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import type { ERDNode, ERDField, FieldType } from "../types";
import { FIELD_TYPES } from "../types";

let fieldIdCounter = 1000;

function newField(): ERDField {
  return {
    id: `f${fieldIdCounter++}`,
    name: "field",
    type: "string",
    primaryKey: false,
    foreignKey: false,
    nullable: true,
  };
}

export default function EntityNode({ id, data, selected }: NodeProps<ERDNode>) {
  const { updateNodeData } = useReactFlow();
  const [editingName, setEditingName] = useState(false);

  const fields = data.fields as ERDField[];
  const label = data.label as string;

  const updateFields = useCallback(
    (fields: ERDField[]) => updateNodeData(id, { fields }),
    [id, updateNodeData]
  );

  const updateLabel = useCallback(
    (newLabel: string) => updateNodeData(id, { label: newLabel }),
    [id, updateNodeData]
  );

  const addField = () => updateFields([...fields, newField()]);
  const removeField = (fid: string) => updateFields(fields.filter((f) => f.id !== fid));
  const patchField = (fid: string, patch: Partial<ERDField>) =>
    updateFields(fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)));

  return (
    <div
      style={{
        background: "#fff",
        border: selected ? "2px solid #6366f1" : "2px solid #e2e8f0",
        borderRadius: 10,
        minWidth: 240,
        boxShadow: selected ? "0 0 0 3px #e0e7ff" : "0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#6366f1" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#6366f1" }} />

      {/* 헤더 */}
      <div
        style={{
          background: "#6366f1",
          color: "#fff",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "text",
        }}
        onDoubleClick={() => setEditingName(true)}
      >
        {editingName ? (
          <input
            autoFocus
            defaultValue={label}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              width: "100%",
              outline: "none",
            }}
            onBlur={(e) => {
              updateLabel(e.target.value || label);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                updateLabel((e.target as HTMLInputElement).value || label);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{label}</span>
        )}
        <span style={{ fontSize: 10, opacity: 0.7 }}>더블클릭 편집</span>
      </div>

      {/* 필드 목록 */}
      <div style={{ padding: "4px 0" }}>
        {fields.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderBottom: "1px solid #f1f5f9",
              background: f.primaryKey ? "#fafafa" : "transparent",
            }}
          >
            <span
              title="Primary Key 토글"
              onClick={() => patchField(f.id, { primaryKey: !f.primaryKey, foreignKey: false })}
              style={{
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 700,
                color: f.primaryKey ? "#f59e0b" : "#cbd5e1",
                userSelect: "none",
                minWidth: 18,
              }}
            >
              PK
            </span>

            <select
              value={f.type}
              onChange={(e) => patchField(f.id, { type: e.target.value as FieldType })}
              style={{ fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 2px", color: "#64748b" }}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              value={f.name}
              onChange={(e) => patchField(f.id, { name: e.target.value })}
              style={{
                flex: 1,
                border: "none",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 12,
                padding: "1px 2px",
                outline: "none",
                minWidth: 0,
              }}
            />

            <span
              title="nullable 토글"
              onClick={() => patchField(f.id, { nullable: !f.nullable })}
              style={{ cursor: "pointer", fontSize: 10, color: f.nullable ? "#94a3b8" : "#ef4444", userSelect: "none" }}
            >
              {f.nullable ? "null" : "NN"}
            </span>

            <button
              onClick={() => removeField(f.id)}
              style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 8px" }}>
        <button
          onClick={addField}
          style={{
            width: "100%",
            border: "1px dashed #cbd5e1",
            background: "none",
            borderRadius: 6,
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 12,
            padding: "4px 0",
          }}
        >
          + 필드 추가
        </button>
      </div>
    </div>
  );
}
