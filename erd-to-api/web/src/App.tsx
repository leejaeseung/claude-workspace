import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import EntityNode from "./components/EntityNode";
import Sidebar from "./components/Sidebar";
import type { ERDNode, ERDEdge, ERDEntityData, ERDEdgeData } from "./types";

const nodeTypes: NodeTypes = { entity: EntityNode as NodeTypes["entity"] };

let nodeIdCounter = 3;

function makeEntityNode(x: number, y: number): ERDNode {
  const id = `n${nodeIdCounter++}`;
  const data: ERDEntityData = {
    label: `Entity${nodeIdCounter - 1}`,
    fields: [
      { id: `${id}f1`, name: "id", type: "int", primaryKey: true, foreignKey: false, nullable: false },
      { id: `${id}f2`, name: "name", type: "string", primaryKey: false, foreignKey: false, nullable: false },
    ],
  };
  return { id, type: "entity", position: { x, y }, data };
}

const initialNodes: ERDNode[] = [
  {
    id: "n1",
    type: "entity",
    position: { x: 80, y: 100 },
    data: {
      label: "User",
      fields: [
        { id: "n1f1", name: "id", type: "int", primaryKey: true, foreignKey: false, nullable: false },
        { id: "n1f2", name: "email", type: "string", primaryKey: false, foreignKey: false, nullable: false },
        { id: "n1f3", name: "name", type: "string", primaryKey: false, foreignKey: false, nullable: false },
        { id: "n1f4", name: "created_at", type: "datetime", primaryKey: false, foreignKey: false, nullable: true },
      ],
    },
  },
  {
    id: "n2",
    type: "entity",
    position: { x: 480, y: 100 },
    data: {
      label: "Post",
      fields: [
        { id: "n2f1", name: "id", type: "int", primaryKey: true, foreignKey: false, nullable: false },
        { id: "n2f2", name: "title", type: "string", primaryKey: false, foreignKey: false, nullable: false },
        { id: "n2f3", name: "content", type: "text", primaryKey: false, foreignKey: false, nullable: true },
        { id: "n2f4", name: "created_at", type: "datetime", primaryKey: false, foreignKey: false, nullable: true },
      ],
    },
  },
];

const edgeData: ERDEdgeData = { label: "writes", relationType: "one_to_many" };
const initialEdges: ERDEdge[] = [
  {
    id: "e1",
    source: "n1",
    target: "n2",
    label: "writes",
    data: edgeData,
    style: { stroke: "#6366f1", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed" as const, color: "#6366f1" },
  },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ERDNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ERDEdge>(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      const data: ERDEdgeData = { label: "relates", relationType: "one_to_many" };
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            label: "relates",
            data,
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed" as const, color: "#6366f1" },
          },
          eds
        ) as ERDEdge[]
      );
    },
    [setEdges]
  );

  const addEntity = useCallback(() => {
    const x = 80 + (nodes.length % 3) * 400;
    const y = 100 + Math.floor(nodes.length / 3) * 320;
    setNodes((nds) => [...nds, makeEntityNode(x, y)]);
  }, [nodes.length, setNodes]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const handleImport = useCallback((newNodes: ERDNode[], newEdges: ERDEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f8fafc" }}>
      <Sidebar nodes={nodes} edges={edges} onAddEntity={addEntity} onClear={clearAll} onImport={handleImport} />

      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={{ style: { stroke: "#6366f1", strokeWidth: 2 } }}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap nodeColor="#6366f1" maskColor="rgba(15,23,42,0.05)" style={{ background: "#f1f5f9" }} />
        </ReactFlow>

        {nodes.length === 0 && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{ textAlign: "center", color: "#94a3b8", fontFamily: "Inter, sans-serif" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗂</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>왼쪽 패널에서 엔티티를 추가하세요</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>노드 오른쪽 핸들을 드래그해 관계를 연결합니다</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
