// src/nodes/InteractionNode.tsx

import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";

import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/interaction.json";

export type InteractionNodeData = BaseNodeData;

export type InteractionNode = Node<InteractionNodeData, "interactionNode">;

const InteractionNode = memo(function InteractionNode(
  props: NodeProps<InteractionNode>
) {
  const { id, data, selected } = props;

  return (
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
  );
});

export default InteractionNode;
