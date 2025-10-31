// App.tsx
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import GrammarNodeComponent, { GrammarNode } from "./GrammarNode";

// A valid instance for your current schema
const initialValue = {
  physical_layer: {
    id: "baselayer-0",
    datafile: "chicago",
    region_of_interest: {
      type: "bbox",
      value: [-87.9401, 41.6445, -87.5237, 42.023],
    },
    layers: [
      {
        tag: "buildings",
        features: ["height"], // optional; keep or remove
      },
    ],
  },
};

// Register the new node type
const nodeTypes = { grammarNode: GrammarNodeComponent };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<GrammarNode>([
    {
      id: "grammar-1",
      type: "grammarNode",
      position: { x: 160, y: 120 },
      data: {
        title: "Grammar",
        value: initialValue,
        onChange: (val, id) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, value: val } } : n
            )
          );
        },
      },
    },
  ]);

  const [edges, , onEdgesChange] = useEdgesState([]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
