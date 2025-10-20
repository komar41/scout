// App.tsx
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import PhysicalLayerDefnNode, {
  PhysicalLayerNode,
} from "./PhysicalLayerDefnNode";
import type { PhysicalLayer } from "./types/physical-layer";

const initialValue: PhysicalLayer = {
  physical_layer: {
    id: "baselayer-0",
    region_of_interest: {
      type: "bbox",
      value: [-87.9401, 41.6445, -87.5237, 42.023],
    },
    layers: [
      {
        name: "buildings",
        schema: {
          id: "numeric",
          geometry: "multipolygons",
          features: {
            height: "numeric",
          },
        },
      },
    ],
  },
};

const nodeTypes = { physicalLayerDefn: PhysicalLayerDefnNode };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<PhysicalLayerNode>([
    {
      id: "pl-1",
      type: "physicalLayerDefn",
      position: { x: 160, y: 120 },
      data: {
        title: "Physical Layer (baselayer-0)",
        value: initialValue,
        mode: "code",
        height: 360,
        onChange: (val, id) => {
          // keep node.data.value in sync as you edit
          setNodes((nds) =>
            nds.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, value: val } } : n
            )
          );
        },
      },
      style: { width: 400, height: 420 },
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
