// src/nodes/InteractionNode.tsx

import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/transformation.json";

import "./BaseGrammarNode.css";

// import { ViewportNodeData } from "./ViewportNode";

export type TransformationNodeData = BaseNodeData;

export type TransformationNode = Node<TransformationNodeData, "transformationNode">;

const TransformationNode = memo(function TransformationNode(
  props: NodeProps<TransformationNode>
) {
  const { id, data, selected } = props;
  const { getNode, getEdges, setNodes, setEdges } = useReactFlow();

  const onCloseTransformationNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n || n.type !== "transformationNode") return;

      // will fill this later. Have to remove connection from viewport and model



      // 3) Remove all edges touching this node
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [
        // getNode, getEdges, setNodes, setEdges
    ]
  );

  return (
    <>
      <BaseGrammarNode
        id={id}
        selected={selected}
        data={{
          ...data,
          title: "Grammar • interaction",
          schema,
          pickInner: (v) => (v as any)?.transformation,
          onClose: onCloseTransformationNode,
          // no custom onClose; BaseGrammarNode default remove is fine
        }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="transformation-in"
        className="gnode__handle gnode__handle--left"
      />

      {/* Source: to ViewportNode */}
      <Handle
        type="target"
        position={Position.Right}
        id="transformation-out"
        className="gnode__handle gnode__handle--right"
      />
    </>
  );
});

export default TransformationNode;
