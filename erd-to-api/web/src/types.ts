import type { Node, Edge } from "@xyflow/react";

export type FieldType =
  | "int"
  | "string"
  | "float"
  | "boolean"
  | "datetime"
  | "date"
  | "text";

export interface ERDField {
  id: string;
  name: string;
  type: FieldType;
  primaryKey: boolean;
  foreignKey: boolean;
  nullable: boolean;
}

// Record<string, unknown> 제약을 만족시키기 위해 인덱스 시그니처 추가
export interface ERDEntityData extends Record<string, unknown> {
  label: string;
  fields: ERDField[];
}

export type RelationshipType = "one_to_one" | "one_to_many" | "many_to_many";

export interface ERDEdgeData extends Record<string, unknown> {
  label: string;
  relationType: RelationshipType;
}

// @xyflow/react v12용 노드/엣지 타입 별칭
export type ERDNode = Node<ERDEntityData, "entity">;
export type ERDEdge = Edge<ERDEdgeData>;

export const FIELD_TYPES: FieldType[] = [
  "int", "string", "float", "boolean", "datetime", "date", "text",
];

export const RELATION_MERMAID: Record<RelationshipType, string> = {
  one_to_one:   "||--||",
  one_to_many:  "||--o{",
  many_to_many: "}o--o{",
};
