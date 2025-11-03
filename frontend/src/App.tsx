// src/App.tsx
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  useReactFlow,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef, useState } from "react";

import { nodeTypes } from "./nodes"; // <-- { physicalLayerNode, viewNode, ... }
import type { Node, Connection, Edge } from "@xyflow/react";
import type { BaseNodeData } from "./nodes/BaseGrammarNode";

import { TEMPLATES, TEMPLATE_LABELS, TemplateKey } from "./templates";
import "./App.css";

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

function Canvas() {
  const idCounter = useRef(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BaseNodeData>>(
    []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { getNode } = useReactFlow();

  const addNode = useCallback(
    (tpl: TemplateKey) => {
      const nextId = `grammar-${idCounter.current++}`;
      createGrammarNode({ id: nextId, setNodes, template: tpl });
    },
    [setNodes]
  );

  // --- allow only physicalLayerNode -> viewNode
  const allow = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return false;
      const src = getNode(conn.source);
      const trg = getNode(conn.target);
      if (!src || !trg) return false;
      return src.type === "physicalLayerNode" && trg.type === "viewNode";
    },
    [getNode]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!allow(conn)) return;
      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            animated: true,
          },
          eds
        )
      );
    },
    [allow, setEdges]
  );

  return (
    <div className="app">
      <ReactFlow
        className="canvas"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={allow}
        fitView
      >
        <Background />
        <Controls position="bottom-right" />
        <Toolbar onAdd={addNode} />
      </ReactFlow>
    </div>
  );
}

function Toolbar({ onAdd }: { onAdd: (tpl: TemplateKey) => void }) {
  const { screenToFlowPosition } = useReactFlow();
  const [open, setOpen] = useState(false);

  const getDropPosition = useCallback(() => {
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }, [screenToFlowPosition]);

  const handleChoose = useCallback(
    (tpl: TemplateKey) => {
      (window as any)._desiredGrammarPos = getDropPosition();
      onAdd(tpl);
      setOpen(false);
    },
    [getDropPosition, onAdd]
  );

  return (
    <div className="toolbar">
      <button
        onClick={() => setOpen((v) => !v)}
        className="toolbar__btn"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ➕ Grammar
      </button>

      {open && (
        <div role="menu" className="menu">
          <div className="menu__title">Select template</div>
          <div className="menu__divider" />
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
            <button
              key={key}
              role="menuitem"
              onClick={() => handleChoose(key)}
              className="menu__item"
            >
              {TEMPLATE_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Map template key -> node type key from ./nodes
const kindToType: Record<TemplateKey, keyof typeof nodeTypes> = {
  physical_layer: "physicalLayerNode",
  view: "viewNode",
};

function createGrammarNode({
  id,
  setNodes,
  template,
}: {
  id: string;
  setNodes: React.Dispatch<React.SetStateAction<Node<BaseNodeData>[]>>;
  template: TemplateKey;
}) {
  const pos = (window as any)._desiredGrammarPos ?? { x: 100, y: 100 };
  const type = kindToType[template];

  const newNode: Node<BaseNodeData> = {
    id,
    type,
    position: pos,
    data: {
      title: "Grammar",
      value: TEMPLATES[template] ?? {},
      onChange: (val, targetId) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === targetId ? { ...n, data: { ...n.data, value: val } } : n
          )
        );
      },
      onClose: (nodeId) =>
        setNodes((nds) => nds.filter((n) => n.id !== nodeId)),
      onRun: (nodeId) => console.log("run clicked:", nodeId),
    },
  };

  // console log new nodes node type
  console.log("Creating new node:", newNode);
  console.log("Node type:", type);

  setNodes((nds) => nds.concat(newNode));
}
