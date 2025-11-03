import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/view.json";

export type ViewNode = Node<BaseNodeData, "viewNode">;

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

        // inputs expected from physical/thematic upstream (you can refine ports)
        targetHandles: [
          { id: "dataset", topPct: 45 },
          { id: "id", topPct: 55 },
          { id: "roi", topPct: 65 },
        ],
        // output render spec
        sourceHandles: [{ id: "render", topPct: 50 }],
      }}
    />
  );
});

export default ViewNode;
