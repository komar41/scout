import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/view.json";

export type ViewNodeData = BaseNodeData & {
  rcvd_data?: {
    roi?: unknown;
    from?: string;
    at?: number;
    extras?: unknown;
  };
};

export type ViewNode = Node<ViewNodeData, "viewNode">;

const ViewNode = memo(function ViewNode(props: NodeProps<ViewNode>) {
  const { id, data, selected } = props;

  return (
    <BaseGrammarNode
      id={id}
      selected={selected}
      data={{
        ...data,
        title: data.title ?? "Grammar • view",
        schema,
        pickInner: (v) => (v as any)?.view,
      }}
    />
  );
});

export default ViewNode;
