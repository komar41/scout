import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { useReactFlow, Handle, Position } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/view.json";
import { PhysicalLayerDef } from "./utils/types";
import type { ViewportNodeData } from "./ViewportNode";

import "./BaseGrammarNode.css";

export type ViewNodeData = BaseNodeData & {
  physical_layers?: PhysicalLayerDef[];
};

export type ViewNode = Node<ViewNodeData, "viewNode">;

const ViewNode = memo(function ViewNode(props: NodeProps<ViewNode>) {
  const { id, data, selected } = props;
  const { getNode, getEdges, setNodes, setEdges } = useReactFlow();

  const onCloseViewNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n || n.type !== "viewNode") return;

      const curEdges = getEdges();

      // All targets currently connected FROM this view node
      const targetIds = curEdges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      console.log(targetIds);

      // 1) Clear physical_layers and view on connected viewport nodes
      setNodes((nds) =>
        nds
          .map((nn) => {
            if (nn.type !== "viewportNode" || !targetIds.includes(nn.id))
              return nn;

            const vd = nn.data as ViewportNodeData;
            const nextData: ViewportNodeData = {
              ...vd,
              physical_layers: undefined,
              view: undefined,
            };

            console.log(nextData);
            return { ...nn, data: nextData };
          })
          // 2) Remove this view node itself
          .filter((nn) => nn.id !== nodeId)
      );

      // 3) Remove all edges touching the closed view node
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
          title: "Grammar • view",
          schema,
          pickInner: (v) => (v as any)?.view,
          onClose: onCloseViewNode, 
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="view-in"
        className="gnode__handle gnode__handle--left"
      />

      {/* Source: to ViewportNode */}
      <Handle
        type="source"
        position={Position.Right}
        id="view-out"
        className="gnode__handle gnode__handle--right"
      />
    </>
  );
});

export default ViewNode;
