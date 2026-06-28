import { describe, it, expect } from "vitest";
import { toMermaid } from "./serializer";
import type { ERDNode, ERDEdge, ERDEntityData, ERDEdgeData } from "./types";

const userNode: ERDNode = {
  id: "n1",
  type: "entity",
  position: { x: 0, y: 0 },
  data: {
    label: "User",
    fields: [
      { id: "f1", name: "id", type: "int", primaryKey: true, foreignKey: false, nullable: false },
      { id: "f2", name: "email", type: "string", primaryKey: false, foreignKey: false, nullable: false },
    ],
  } satisfies ERDEntityData,
};

const postNode: ERDNode = {
  id: "n2",
  type: "entity",
  position: { x: 400, y: 0 },
  data: {
    label: "Post",
    fields: [
      { id: "f3", name: "id", type: "int", primaryKey: true, foreignKey: false, nullable: false },
      { id: "f4", name: "title", type: "string", primaryKey: false, foreignKey: false, nullable: false },
    ],
  } satisfies ERDEntityData,
};

const oneToManyEdge: ERDEdge = {
  id: "e1",
  source: "n1",
  target: "n2",
  data: { label: "writes", relationType: "one_to_many" } satisfies ERDEdgeData,
};

describe("toMermaid", () => {
  it("erDiagram 헤더를 포함한다", () => {
    expect(toMermaid([userNode], [])).toMatch(/^erDiagram/);
  });

  it("엔티티 블록을 생성한다", () => {
    const result = toMermaid([userNode], []);
    expect(result).toContain("User {");
    expect(result).toContain("int id PK");
    expect(result).toContain("string email");
  });

  it("one_to_many 관계를 ||--o{ 화살표로 직렬화한다", () => {
    const result = toMermaid([userNode, postNode], [oneToManyEdge]);
    expect(result).toContain('User ||--o{ Post : "writes"');
  });

  it("one_to_many 에지가 many-side에 FK 필드를 자동 삽입한다", () => {
    const result = toMermaid([userNode, postNode], [oneToManyEdge]);
    const postBlock = result.slice(result.indexOf("Post {"), result.indexOf("}", result.indexOf("Post {")));
    expect(postBlock).toContain("int user_id FK");
  });

  it("already declared FK는 중복 삽입하지 않는다", () => {
    const postWithFK: ERDNode = {
      ...postNode,
      data: {
        ...postNode.data,
        fields: [
          ...postNode.data.fields,
          { id: "fk1", name: "user_id", type: "int", primaryKey: false, foreignKey: true, nullable: true },
        ],
      },
    };
    const result = toMermaid([userNode, postWithFK], [oneToManyEdge]);
    const count = (result.match(/user_id/g) || []).length;
    expect(count).toBe(1);
  });

  it("label이 없는 에지는 'relates' 기본값을 사용한다", () => {
    const noLabelEdge: ERDEdge = {
      ...oneToManyEdge,
      data: { label: "", relationType: "one_to_many" } satisfies ERDEdgeData,
    };
    expect(toMermaid([userNode, postNode], [noLabelEdge])).toContain(': "relates"');
  });

  it("many_to_many 관계를 }o--o{ 화살표로 직렬화한다", () => {
    const m2mEdge: ERDEdge = {
      ...oneToManyEdge,
      data: { label: "tags", relationType: "many_to_many" } satisfies ERDEdgeData,
    };
    expect(toMermaid([userNode, postNode], [m2mEdge])).toContain("}o--o{");
  });

  it("엔티티가 없으면 헤더만 반환한다", () => {
    expect(toMermaid([], [])).toBe("erDiagram");
  });
});
