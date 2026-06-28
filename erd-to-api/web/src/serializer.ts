import type { ERDNode, ERDEdge, ERDEntityData, RelationshipType } from "./types";
import { RELATION_MERMAID } from "./types";

/**
 * ReactFlow 그래프 → Mermaid ERD 텍스트 변환
 *
 * 규칙 (파서/제너레이터 계약에서 유래):
 * 1. ONE_TO_MANY 관계에서 many-side 엔티티에 FK 필드를 자동 삽입
 * 2. 모든 relation은 label을 가져야 함 (파서 regex 요구)
 * 3. edge 방향: source=one-side, target=many-side
 */
export function toMermaid(nodes: ERDNode[], edges: ERDEdge[]): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  // many-side에 자동 삽입할 FK 집합: "entityName.fieldName"
  const autoFKs = new Map<string, string[]>();

  for (const edge of edges) {
    const rel = (edge.data?.relationType ?? "one_to_many") as RelationshipType;
    if (rel === "one_to_many") {
      const oneNode = nodeMap.get(edge.source);
      const manyNode = nodeMap.get(edge.target);
      if (!oneNode || !manyNode) continue;

      const oneData = oneNode.data as ERDEntityData;
      const manyData = manyNode.data as ERDEntityData;
      const fkName = `${oneData.label.toLowerCase()}_id`;
      const manyName = manyData.label;

      const alreadyDeclared = manyData.fields.some(
        (f) => f.name === fkName && f.foreignKey
      );
      if (!alreadyDeclared) {
        if (!autoFKs.has(manyName)) autoFKs.set(manyName, []);
      autoFKs.get(manyName)!.push(fkName);
      }
    }
  }

  const lines: string[] = ["erDiagram"];

  for (const node of nodes) {
    const entity = node.data as ERDEntityData;
    lines.push(`  ${entity.label} {`);

    for (const f of entity.fields) {
      const tags: string[] = [];
      if (f.primaryKey) tags.push("PK");
      if (f.foreignKey) tags.push("FK");
      const tagStr = tags.length ? " " + tags.join(" ") : "";
      lines.push(`    ${f.type} ${f.name}${tagStr}`);
    }

    // 자동 삽입 FK 필드
    for (const fkName of autoFKs.get(entity.label) ?? []) {
      lines.push(`    int ${fkName} FK`);
    }

    lines.push("  }");
  }

  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const rel = ((edge.data as ERDEntityData | undefined)?.relationType ?? "one_to_many") as RelationshipType;
    const arrow = RELATION_MERMAID[rel];
    const edgeLabel = (edge.data?.label as string | undefined)?.trim() || "relates";
    const srcData = src.data as ERDEntityData;
    const tgtData = tgt.data as ERDEntityData;
    lines.push(`  ${srcData.label} ${arrow} ${tgtData.label} : "${edgeLabel}"`);
  }

  return lines.join("\n");
}
