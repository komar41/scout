import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/physical_layer.json";

import fetchPng from "../assets/fetch.png"; // your icon
import "./PhysicalLayerNode.css";

export type PhysicalLayerNode = Node<BaseNodeData, "physicalLayerNode">;

const PhysicalLayerNode = memo(function PhysicalLayerNode(
  props: NodeProps<PhysicalLayerNode>
) {
  const { id, data, selected } = props;

  const onFetch = useCallback(() => {
    // prefer a provided handler; otherwise log
    data?.onFetch?.(id as string);
    if (!data?.onFetch) console.log("fetch clicked:", id);

    console.log(data);
  }, [data, id]);

  return (
    <BaseGrammarNode
      id={id}
      selected={selected}
      data={{
        ...data,
        title: data.title ?? "Grammar • physical_layer",
        schema,
        pickInner: (v) => (v as any)?.physical_layer,

        // NEW: second footer button just for physical layer
        footerActions: (
          <button
            type="button"
            onClick={onFetch}
            title="Fetch data"
            aria-label="Fetch data"
            className="gnode__actionBtn"
          >
            <img
              src={fetchPng}
              alt="Fetch data"
              className="gnode__actionIcon"
            />
          </button>
        ),
      }}
    />
  );
});

export default PhysicalLayerNode;
