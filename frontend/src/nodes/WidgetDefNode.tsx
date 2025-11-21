// src/nodes/InteractionNode.tsx

import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/widgetDef.json";

import "./BaseGrammarNode.css";
// import { ViewportNodeData } from "./ViewportNode";

export type WidgetDefNodeData = BaseNodeData;

export type WidgetDefNode = Node<WidgetDefNodeData, "widgetDefNode">;

const WidgetDefNode = memo(function WidgetDefNode(
  props: NodeProps<WidgetDefNode>
) {
  const { id, data, selected } = props;
  const { getNode, getEdges, setNodes, setEdges } = useReactFlow();

  const onCloseWidgetDefNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n || n.type !== "widgetDefNode") return;

      const curEdges = getEdges();

      // Interaction spec from this node
      const wdValue = (n.data as BaseNodeData)?.value as any;
      const wdId: string | undefined = wdValue?.widget?.id;

      // All targets currently connected FROM this physical node
      const targetIds = curEdges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      // 1) Update connected view nodes: remove this physical layer ref
      setNodes((nds) =>
        nds
          //   .map((nn) => {
          //     if (nn.type !== "viewportNode" || !targetIds.includes(nn.id)) {
          //       return nn;
          //     }

          //     const vpData = nn.data as ViewportNodeData;
          //     const existing = vpData.interactions ?? [];

          //     const next = iId ? existing.filter((d) => d.id !== iId) : existing;

          //     return {
          //       ...nn,
          //       data: {
          //         ...nn.data,
          //         interactions: next.length ? next : undefined,
          //       } as ViewportNodeData,
          //     };
          //   })
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
          title: "Grammar • widget",
          schema,
          pickInner: (v) => (v as any)?.widget,
          onClose: onCloseWidgetDefNode,
          // no custom onClose; BaseGrammarNode default remove is fine
        }}
      />

      {/* <Handle
        type="source"
        position={Position.Left}
        id="widgetDef-out-1"
        className="gnode__handle__source"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="widgetDef-out-2"
        className="gnode__handle__source"
      /> */}

      <Handle
        type="source"
        position={Position.Top}
        id="widgetDef-out-3"
        className="gnode__handle__source"
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="widgetDef-out-4"
        className="gnode__handle__source"
      />
    </>
  );
});

export default WidgetDefNode;
