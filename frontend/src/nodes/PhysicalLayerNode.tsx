import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/physical_layer.json";

import fetchPng from "../assets/fetch.png";
import "./PhysicalLayerNode.css";

export type PhysicalLayerNode = Node<BaseNodeData, "physicalLayerNode">;

const PhysicalLayerNode = memo(function PhysicalLayerNode(
  props: NodeProps<PhysicalLayerNode>
) {
  const { id, data, selected } = props;

  const onFetch = useCallback(async () => {
    const val: any = (data.value as any)?.physical_layer;

    if (!val) {
      console.warn("No physical_layer data found for node", id);
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/ingest-physical-layer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(val),
        }
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // const result = await response.json();
      // console.log("Flask response:", result);
    } catch (err) {
      console.error("Error sending data to Flask:", err);
    }
  }, [data, id]);

  return (
    <BaseGrammarNode
      id={id}
      selected={selected}
      data={{
        ...data,
        title: "Grammar • physical_layer",
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
