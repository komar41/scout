import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/physical_layer.json";

export type PhysicalLayerNode = Node<BaseNodeData, "physicalLayerNode">;

const PhysicalLayerNode = memo(function PhysicalLayerNode(
  props: NodeProps<PhysicalLayerNode>
) {
  const { id, data, selected } = props;

  return (
    <BaseGrammarNode
      id={id}
      selected={selected}
      data={{
        ...data,
        title: data.title ?? "Grammar • physical_layer",
        schema,
        pickInner: (v) => (v as any)?.physical_layer,
      }}
    />
  );
});

export default PhysicalLayerNode;
