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
// import { ViewNodeData } from "./nodes/ViewNode";
import type { ViewportNodeData } from "./nodes/ViewportNode";
import type { PyCodeEditorNodeData } from "./nodes/PyCodeEditorNode";
import { TransformationNodeData } from "./nodes/TransformationNode";

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
      // Don't think we need to pass anything from physical layer to view for now!!
      // Later might need to pass some metadata? or will remove this function!
      const src = getNode(srcId);
      if (!src || src.type !== "physicalLayerNode") return;

      const val: any = (src.data as BaseNodeData).value;
      const pl_def = val?.physical_layer;
      if (!pl_def) return;

      const targetIds = trgId
        ? [trgId]
        : getEdges()
            .filter((e) => e.source === srcId)
            .map((e) => e.target!)
            .filter(Boolean);
    },
    [
      getNode,
      getEdges,
      // setNodes
    ]
  );

  const pushViewToViewports = useCallback(
    (srcId: string, trgId?: string) => {
      // console.log("Pushing view to viewports", srcId, trgId);
      const src = getNode(srcId);
      if (!src || src.type !== "viewNode") return;

      const value: any = (src.data as BaseNodeData).value;
      const viewSpec = value?.view;
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
          return { ...n, data: { ...n.data, view: viewSpec } };
        })
      );
    },
    [getNode, getEdges, setNodes]
  );

  const pushInteractionToViewport = useCallback(
    (srcId: string, trgId?: string) => {
      const src = getNode(srcId);
      if (!src || src.type !== "interactionNode") return;

      const val: any = (src.data as BaseNodeData).value;
      const i = val?.interaction;
      if (!i) return;

      const targetIds = trgId
        ? [trgId]
        : getEdges()
            .filter((e) => e.source === srcId)
            .map((e) => e.target!)
            .filter(Boolean);

      setNodes((nds) =>
        nds.map((n) => {
          if (!targetIds.includes(n.id) || n.type !== "viewportNode") return n;

          const existing = (n.data as ViewportNodeData).interactions ?? [];
          const already = existing.some((e) => e.id === i.id);
          const nextInteractions = already
            ? existing.map((e) => (e.id === i.id ? i : e))
            : [...existing, i];

          return {
            ...n,
            data: {
              ...n.data,
              interactions: nextInteractions,
            } as ViewportNodeData,
          };
        })
      );
    },
    [getNode, getEdges, setNodes]
  );

  const pushViewportToTransformation = useCallback(
    (srcId: string, trgId?: string) => {
      // Don't think we need to pass anything from viewport to transformation for now!!
      // Later might need to pass some metadata? or will remove this function!
      const src = getNode(srcId);
      if (!src || src.type !== "viewportNode") return;

      const val: any = src.data as ViewportNodeData;

      const targetIds = trgId
        ? [trgId]
        : getEdges()
            .filter((e) => e.source === srcId)
            .map((e) => e.target!)
            .filter(Boolean);
    },
    [
      getNode,
      getEdges,
      // setNodes
    ]
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
        onRunInteraction: pushInteractionToViewport,
      });
    },
    [
      setNodes,
      getNode,
      pushPhysicalToViews,
      pushViewToViewports,
      pushInteractionToViewport,
    ]
  );

  const addViewport = useCallback(() => {
    const nextId = `viewport-${idCounter.current++}`;
    createViewportNode({
      id: nextId,
      setNodes,
      onRunViewport: pushViewportToTransformation,
    });
  }, [setNodes, pushViewportToTransformation]);

  const addPyCodeEditorNode = useCallback(() => {
    const nextId = `pyCodeEditor-${idCounter.current++}`;
    createPyCodeEditorNode({
      id: nextId,
      setNodes,
      // onRunViewport: pushViewportToTransformation,
    });
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

      // This is not required, as instead of using transformation node, we are using code instead.
      // Maybe later will remove this condition block
      const viewportToTransformation =
        src.type === "viewportNode" && trg.type === "transformationNode";

      // Instead lets connect viewport to pyCodeEditorNode
      const viewportToPyCodeEditor =
        src.type === "viewportNode" && trg.type === "pyCodeEditorNode";

      const transformationToPyCodeEditor =
        src.type === "transformationNode" && trg.type === "pyCodeEditorNode";
      const PyCodeEditorToView =
        src.type === "pyCodeEditorNode" && trg.type === "viewNode";

      const PyCodeEditorToPyCodeEditor =
        src.type === "pyCodeEditorNode" && trg.type === "pyCodeEditorNode";

      return (
        physToView ||
        viewToViewport ||
        interactionToViewport ||
        viewportToPyCodeEditor ||
        viewportToTransformation ||
        transformationToPyCodeEditor ||
        PyCodeEditorToView ||
        PyCodeEditorToPyCodeEditor
      );
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
        pushPhysicalToViews(srcId, trgId);
        return;
      }

      if (src.type === "viewNode" && trg.type === "viewportNode") {
        pushViewToViewports(srcId, trgId);
        return;
      }

      if (src.type === "interactionNode" && trg.type === "viewportNode") {
        pushInteractionToViewport(srcId, trgId);
        return;
      }

      // This is not required, as instead of using transformation node, we are using code instead.
      // Maybe later will remove this if block
      if (src.type === "viewportNode" && trg.type === "transformationNode") {
        pushViewportToTransformation(srcId, trgId);
        return;
      }

      if (
        src.type === "transformationNode" &&
        trg.type === "pyCodeEditorNode"
      ) {
        // pushTransformationToPyCodeEditor(srcId, trgId);
        return;
      }
    },
    [
      allow,
      getNode,
      setEdges,
      pushPhysicalToViews,
      pushViewToViewports,
      pushInteractionToViewport,
      pushViewportToTransformation,
    ]
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
        minZoom={0.005}
        maxZoom={2}
      >
        <Background />
        <Controls position="bottom-right" />
        <Toolbar
          onAdd={addNode}
          onAddViewport={addViewport}
          onAddPyCodeEditor={addPyCodeEditorNode}
        />
      </ReactFlow>
    </div>
  );
}

function Toolbar({
  onAdd,
  onAddViewport,
  onAddPyCodeEditor,
}: {
  onAdd: (tpl: TemplateKey) => void;
  onAddViewport: () => void;
  onAddPyCodeEditor: () => void;
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

  const handleAddPyCodeEditor = useCallback(() => {
    (window as any)._desiredGrammarPos = getDropPosition();
    onAddPyCodeEditor();
  }, [getDropPosition, onAddPyCodeEditor]);

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

      <button onClick={handleAddPyCodeEditor} className="toolbar__btn">
        ➕ Code
      </button>
    </div>
  );
}

// Map template key -> node type key from ./nodes
const kindToType: Record<TemplateKey, keyof typeof nodeTypes> = {
  physical_layer: "physicalLayerNode",
  view: "viewNode",
  interaction: "interactionNode",
  transformation: "transformationNode",
};

function createGrammarNode({
  id,
  setNodes,
  template,
  getNode,
  onRunPhysical,
  onRunView,
  onRunInteraction,
}: {
  id: string;
  setNodes: React.Dispatch<
    React.SetStateAction<Node<BaseNodeData | ViewportNodeData>[]>
  >;
  template: TemplateKey;
  getNode: (id: string) => Node | undefined;
  onRunPhysical: (srcId: string) => void;
  onRunView: (srcId: string) => void;
  onRunInteraction: (srcId: string) => void;
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
        } else if (node.type === "interactionNode") {
          onRunInteraction(nodeId);
        } else if (node.type === "transformationNode") {
          const data = node.data as TransformationNodeData;
          console.log("Transformation node data:", data);
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
  onRunViewport,
}: {
  id: string;
  setNodes: React.Dispatch<
    React.SetStateAction<Node<BaseNodeData | ViewportNodeData>[]>
  >;
  data?: { center?: [number, number]; zoom?: number };
  onRunViewport?: (srcId: string) => void;
}) {
  const pos = { x: 100, y: 100 };

  const newNode: Node<ViewportNodeData> = {
    id,
    type: "viewportNode",
    position: pos,
    width: 400,
    height: 400,
    data: {
      center: data?.center ?? [41.881, -87.63],
      zoom: data?.zoom ?? 14,
      onRun: onRunViewport
        ? (srcId: string) => onRunViewport(srcId)
        : undefined,
    },
  };

  setNodes((nds) => nds.concat(newNode));
}

function createPyCodeEditorNode({
  id,
  setNodes,
  data,
}: // onRunViewport,
{
  id: string;
  setNodes: React.Dispatch<
    React.SetStateAction<Node<BaseNodeData | PyCodeEditorNodeData>[]>
  >;
  data?: {};
  // onRunViewport?: (srcId: string) => void;
}) {
  const pos = { x: 150, y: 150 };

  const newNode: Node<PyCodeEditorNodeData> = {
    id,
    type: "pyCodeEditorNode",
    position: pos,
    width: 400,
    height: 300,
    data: {
      // onRun: onRunViewport
      //   ? (srcId: string) => onRunViewport(srcId)
      //   : undefined,
    },
  };

  setNodes((nds) => nds.concat(newNode));
}
