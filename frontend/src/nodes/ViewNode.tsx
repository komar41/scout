import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/view.json";

export type ViewNodeData = BaseNodeData & {
  physical_layers?: {
    id: string;
    datafile: string;
    region_of_interest: {
      type: "bbox" | "geojson";
      value: number[] | string; // bbox or geojson filename
    };
    layers: {
      tag: string;
      features: string[];
    }[];
  }[];
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
        title: "Grammar • view",
        schema,
        pickInner: (v) => (v as any)?.view,
      }}
    />
  );
});

export default ViewNode;
