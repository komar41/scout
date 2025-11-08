// src/nodes/InteractionNode.tsx

import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/interaction.json";

import "./BaseGrammarNode.css";
import { ViewportNodeData } from "./ViewportNode";

export type InteractionNodeData = BaseNodeData;

export type InteractionNode = Node<InteractionNodeData, "interactionNode">;

const InteractionNode = memo(function InteractionNode(
  props: NodeProps<InteractionNode>
) {
  const { id, data, selected } = props;
  const { getNode, getEdges, setNodes, setEdges } = useReactFlow();

  const onCloseInteractionNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n || n.type !== "interactionNode") return;

      const curEdges = getEdges();

      // Interaction spec from this node
      const iValue = (n.data as BaseNodeData)?.value as any;
      const iId: string | undefined = iValue?.interaction?.id;

      // All targets currently connected FROM this physical node
      const targetIds = curEdges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      // 1) Update connected view nodes: remove this physical layer ref
      setNodes((nds) =>
        nds
          .map((nn) => {
            if (nn.type !== "viewPortNode" || !targetIds.includes(nn.id)) {
              return nn;
            }

            const vpData = nn.data as ViewportNodeData;
            const existing = vpData.interactions ?? [];

            const next = iId ? existing.filter((d) => d.id !== iId) : existing;

            return {
              ...nn,
              data: {
                ...nn.data,
                interactions: next.length ? next : undefined,
              } as ViewportNodeData,
            };
          })
          // 2) Remove this physical-layer node itself
          .filter((nn) => nn.id !== nodeId)
      );

      // 3) Remove all edges touching this node
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [getNode, getEdges, setNodes, setEdges]
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
          pickInner: (v) => (v as any)?.interaction,
          // no custom onClose; BaseGrammarNode default remove is fine
        }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="view-in-1"
        className="interactionnode__handle"
      />

      {/* Source: to ViewportNode */}
      <Handle
        type="source"
        position={Position.Right}
        id="view-in-2"
        className="interactionnode__handle"
      />
    </>
  );
});

export default InteractionNode;
