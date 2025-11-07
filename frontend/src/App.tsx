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
import type { ViewportNodeData } from "./nodes/ViewportNode";

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

function Canvas() {
  const idCounter = useRef(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<BaseNodeData | ViewportNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { getNode, getEdges } = useReactFlow();

  const pushPhysicalToViews = useCallback(
    (srcId: string, trgId?: string) => {
      console.log("Pushing physical layer to views", srcId, trgId);
      const src = getNode(srcId);
      if (!src || src.type !== "physicalLayerNode") return;

      const val: any = (src.data as BaseNodeData).value;
      const pl = val?.physical_layer;
      if (!pl) return;

      const targetIds = trgId
        ? [trgId]
        : getEdges()
            .filter((e) => e.source === srcId)
            .map((e) => e.target!)
            .filter(Boolean);

      setNodes((nds) =>
        nds.map((n) => {
          if (!targetIds.includes(n.id) || n.type !== "viewNode") return n;

          const existing = (n.data as ViewNodeData).physical_layers ?? [];
          const already = existing.some((e) => e.id === pl.id);
          const nextPhysicalLayers = already
            ? existing.map((e) => (e.id === pl.id ? pl : e))
            : [...existing, pl];

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
    [getNode, getEdges, setNodes]
  );

  const pushViewToViewports = useCallback(
    (srcId: string, trgId?: string) => {
      console.log("Pushing view to viewports", srcId, trgId);
      const src = getNode(srcId);
      if (!src || src.type !== "viewNode") return;

      const value: any = (src.data as BaseNodeData).value;
      const viewSpec = value?.view;
      const physical_layers = (src.data as ViewNodeData).physical_layers;
      if (!Array.isArray(viewSpec)) return;

      const targetIds = trgId
        ? [trgId]
        : getEdges()
            .filter((e) => e.source === srcId)
            .map((e) => e.target!)
            .filter(Boolean);

      setNodes((nds) =>
        nds.map((n) => {
          if (!targetIds.includes(n.id)) return n;

          if (n.type !== "viewportNode") return n;
          console.log("Updating viewport node", n.id);
          return { ...n, data: { ...n.data, view: viewSpec, physical_layers } };
        })
      );
    },
    [getNode, getEdges, setNodes]
  );

  // Then remove the oncloseNode from createGrammarNode calls and declarations
  const addNode = useCallback(
    (tpl: TemplateKey) => {
      const nextId = `grammar-${idCounter.current++}`;
      createGrammarNode({
        id: nextId,
        setNodes,
        template: tpl,
        getNode,
        onRunPhysical: pushPhysicalToViews,
        onRunView: pushViewToViewports,
      });
    },
    [setNodes, getNode, pushPhysicalToViews, pushViewToViewports]
  );

  const addViewport = useCallback(() => {
    const nextId = `viewport-${idCounter.current++}`;
    createViewportNode({ id: nextId, setNodes });
  }, [setNodes]);

  // --- allow only physicalLayerNode -> viewNode
  const allow = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return false;
      const src = getNode(conn.source);
      const trg = getNode(conn.target);
      if (!src || !trg) return false;
      const physToView =
        src.type === "physicalLayerNode" && trg.type === "viewNode";
      const viewToViewport =
        src.type === "viewNode" && trg.type === "viewportNode";
      const interactionToViewport =
        src.type === "interactionNode" && trg.type === "viewportNode";

      return physToView || viewToViewport || interactionToViewport;
    },
    [getNode]
  );

  // onConnect is fine. Should be there.. Here we handle connections and onConnections between nodes
  const onConnect = useCallback(
    (conn: Connection) => {
      if (!allow(conn)) return;

      setEdges((eds) => addEdge({ ...conn, animated: true }, eds));

      const srcId = conn.source!;
      const src = getNode(conn.source!);
      const trg = getNode(conn.target!);
      const trgId = conn.target!;
      if (!src || !trg) return;

      if (src.type === "physicalLayerNode" && trg.type === "viewNode") {
        // push (with validation) immediately on connect
        pushPhysicalToViews(srcId, trgId);
        return;
      }

      if (src.type === "viewNode" && trg.type === "viewportNode") {
        // push current edited view spec immediately on connect
        pushViewToViewports(srcId, trgId);
        return;
      }
    },
    [allow, getNode, setEdges, pushPhysicalToViews, pushViewToViewports]
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
        <Toolbar onAdd={addNode} onAddViewport={addViewport} />
      </ReactFlow>
    </div>
  );
}

function Toolbar({
  onAdd,
  onAddViewport,
}: {
  onAdd: (tpl: TemplateKey) => void;
  onAddViewport: () => void;
}) {
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

  const handleAddViewport = useCallback(() => {
    (window as any)._desiredGrammarPos = getDropPosition();
    onAddViewport();
  }, [getDropPosition, onAddViewport]);

  return (
    <div className="toolbar">
      <div className="toolbar__dropdown">
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

      <button onClick={handleAddViewport} className="toolbar__btn">
        ➕ Viewport
      </button>
    </div>
  );
}

// Map template key -> node type key from ./nodes
const kindToType: Record<TemplateKey, keyof typeof nodeTypes> = {
  physical_layer: "physicalLayerNode",
  view: "viewNode",
  interaction: "interactionNode",
};

function createGrammarNode({
  id,
  setNodes,
  template,
  getNode,
  onRunPhysical,
  onRunView,
}: {
  id: string;
  setNodes: React.Dispatch<
    React.SetStateAction<Node<BaseNodeData | ViewportNodeData>[]>
  >;
  template: TemplateKey;
  getNode: (id: string) => Node | undefined;
  onRunPhysical: (srcId: string) => void;
  onRunView: (srcId: string) => void;
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
      // Each node type decides how to "run" itself
      onRun: (nodeId) => {
        const node = getNode(nodeId);
        if (!node) return;
        if (node.type === "physicalLayerNode") {
          onRunPhysical(nodeId);
        } else if (node.type === "viewNode") {
          onRunView(nodeId);
        }
      },
    },
  };

  setNodes((nds) => nds.concat(newNode));
}

function createViewportNode({
  id,
  setNodes,
  data,
}: {
  id: string;
  setNodes: React.Dispatch<
    React.SetStateAction<Node<BaseNodeData | ViewportNodeData>[]>
  >;
  data?: { center?: [number, number]; zoom?: number };
}) {
  const pos = (window as any)._desiredGrammarPos ?? { x: 100, y: 100 };

  const newNode: Node<ViewportNodeData> = {
    id,
    type: "viewportNode",
    position: pos,
    width: 400,
    height: 400,
    data: {
      center: data?.center ?? [41.881, -87.63],
      zoom: data?.zoom ?? 14,
    },
  };

  setNodes((nds) => nds.concat(newNode));
}
