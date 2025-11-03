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
import { ViewNodeData } from "./nodes/ViewNode";

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
  const { getNode, getEdges } = useReactFlow();

  const onCloseNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n) return;

      const curEdges = getEdges(); // live edges

      if (n.type === "physicalLayerNode") {
        // read the physical layer id from the closing node
        const pl = (n.data as BaseNodeData)?.value as any;
        const plId: string | undefined = pl?.physical_layer?.id;

        // all targets currently connected from this physical node
        const targetIds = curEdges
          .filter((e) => e.source === nodeId)
          .map((e) => e.target);

        // 1) update connected view nodes: remove the matching physical layer
        setNodes((nds) =>
          nds
            .map((nn) => {
              if (nn.type !== "viewNode" || !targetIds.includes(nn.id))
                return nn;

              const data = nn.data as ViewNodeData;
              const existing = data.physical_layers ?? [];

              // filter out the descriptor coming from this physical node
              const next = plId
                ? existing.filter((d) => d.id !== plId)
                : existing;

              return {
                ...nn,
                data: {
                  ...nn.data,
                  physical_layers: next.length ? next : undefined,
                } as ViewNodeData,
              };
            })
            // 2) finally remove the physical node itself
            .filter((nn) => nn.id !== nodeId)
        );

        // 3) remove all edges touching the closed node
        // setEdges((eds) =>
        //   eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
        // );
      }
    },
    [
      getNode,
      getEdges,
      setNodes,
      // setEdges
    ]
  );

  const addNode = useCallback(
    (tpl: TemplateKey) => {
      const nextId = `grammar-${idCounter.current++}`;
      createGrammarNode({ id: nextId, setNodes, template: tpl, onCloseNode });
    },
    [setNodes, onCloseNode]
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

      setEdges((eds) => addEdge({ ...conn, animated: true }, eds));

      const src = getNode(conn.source!);
      const trg = getNode(conn.target!);
      if (!src || !trg) return;

      // read physical_layer JSON from the source node
      const val = (src.data as BaseNodeData).value as any;
      const pl = val?.physical_layer;
      if (!pl) return;

      // build the descriptor we store on the view node
      const descriptor = {
        id: pl.id as string,
        datafile: pl.datafile as string,
        region_of_interest: pl.region_of_interest as {
          type: "bbox" | "geojson";
          value: number[] | string;
        },
        layers: (pl.layers ?? []) as { tag: string; features: string[] }[],
      };

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== trg.id || n.type !== "viewNode") return n;

          const existing = (n.data as ViewNodeData).physical_layers ?? [];
          const already = existing.some((e) => e.id === descriptor.id);

          // append if new; replace if same id (optional behavior shown)
          const nextPhysicalLayers = already
            ? existing.map((e) => (e.id === descriptor.id ? descriptor : e))
            : [...existing, descriptor];

          return {
            ...n,
            data: {
              ...n.data,
              physical_layers: nextPhysicalLayers,
            } as ViewNodeData,
          };
        })
      );
    },
    [allow, getNode, setEdges, setNodes]
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
  onCloseNode,
}: {
  id: string;
  setNodes: React.Dispatch<React.SetStateAction<Node<BaseNodeData>[]>>;
  template: TemplateKey;
  onCloseNode: (nodeId: string) => void;
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
      onClose: (nodeId) => onCloseNode(nodeId),
      onRun: (nodeId) => {
        setNodes((nds) => {
          const node = nds.find((n) => n.id === nodeId);
          if (node) console.log(node);
          return nds;
        });
      },
    },
  };

  setNodes((nds) => nds.concat(newNode));
}
