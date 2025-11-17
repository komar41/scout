import { memo, useCallback, useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { useReactFlow, Handle, Position } from "@xyflow/react";

import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/physical_layer.json";

import fetchPng from "../assets/fetch.png";
import checkPng from "../assets/check-mark.png";
import "./PhysicalLayerNode.css";
import "./BaseGrammarNode.css";

export type PhysicalLayerNode = Node<BaseNodeData, "physicalLayerNode">;

const PhysicalLayerNode = memo(function PhysicalLayerNode(
  props: NodeProps<PhysicalLayerNode>
) {
  const { id, data, selected } = props;
  const rf = useReactFlow();
  const { setEdges } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [loadingSuccess, setLoadingSuccess] = useState(false);

  const onFetch = useCallback(async () => {
    const val: any = (data.value as any)?.physical_layer;

    if (!val) {
      console.warn("No physical_layer data found for node", id);
      return;
    }

    try {
      setLoading(true);
      setLoadingSuccess(false);
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
      setLoadingSuccess(true);
      setTimeout(() => setLoadingSuccess(false), 2000);
    } catch (err) {
      console.error("Error sending data to Flask:", err);
    } finally {
      setLoading(false);
    }
  }, [data, id]);

  const onClosePhysicalNode = useCallback(
    (nodeId: string) => {
      rf.setNodes((nds) => nds.filter((n) => n.id !== nodeId));

      // 3) Remove all edges touching this node
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [rf, setEdges]
  );

  return (
    <>
      <BaseGrammarNode
        id={id}
        selected={selected}
        data={{
          ...data,
          title: "Grammar • physical_layer",
          schema,
          pickInner: (v) => (v as any)?.physical_layer,
          onClose: onClosePhysicalNode,
          // NEW: second footer button just for physical layer
          footerActions: (
            <button
              type="button"
              onClick={onFetch}
              title={loading ? "Fetching..." : "Fetch data"}
              aria-label="Fetch data"
              className="gnode__actionBtn"
              disabled={loading}
            >
              {loading ? (
                <span className="gnode__spinner" aria-hidden="true" />
              ) : loadingSuccess ? (
                <img
                  src={checkPng}
                  alt="Success"
                  className="gnode__actionIcon"
                />
              ) : (
                <img
                  src={fetchPng}
                  alt="Fetch data"
                  className="gnode__actionIcon"
                />
              )}
            </button>
          ),
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="physical-out"
        className="gnode__handle gnode__handle--right"
      />
    </>
  );
});

export default PhysicalLayerNode;
