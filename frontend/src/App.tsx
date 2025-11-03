import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef, useState } from "react";

import GrammarNodeComponent, { GrammarNode } from "./GrammarNode";
import { TEMPLATES, TEMPLATE_LABELS, TemplateKey } from "./templates";
import "./App.css";

const nodeTypes = { grammarNode: GrammarNodeComponent } as const;

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

function Canvas() {
  const idCounter = useRef(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<GrammarNode>([]);
  const [edges, , onEdgesChange] = useEdgesState([]);

  const addNode = useCallback(
    (tpl: TemplateKey) => {
      const nextId = `grammar-${idCounter.current++}`;
      createGrammarNode({ id: nextId, setNodes, template: tpl });
    },
    [setNodes]
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

function createGrammarNode({
  id,
  setNodes,
  template,
}: {
  id: string;
  setNodes: ReturnType<typeof useNodesState>[1];
  template: TemplateKey;
}) {
  const pos = (window as any)._desiredGrammarPos ?? { x: 100, y: 100 };

  const newNode: GrammarNode = {
    id,
    type: "grammarNode",
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
    },
  };

  setNodes((nds) => nds.concat(newNode));
}
