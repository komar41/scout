import { memo, useCallback } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { useReactFlow, Handle, Position } from "@xyflow/react";

import BaseGrammarNode, { BaseNodeData } from "./BaseGrammarNode";
import schema from "../schemas/physical_layer.json";

import fetchPng from "../assets/fetch.png";
import "./PhysicalLayerNode.css";
import "./BaseGrammarNode.css";

import type { ViewNodeData } from "./ViewNode";

export type PhysicalLayerNode = Node<BaseNodeData, "physicalLayerNode">;

const PhysicalLayerNode = memo(function PhysicalLayerNode(
  props: NodeProps<PhysicalLayerNode>
) {
  const { id, data, selected } = props;
  const { getNode, getEdges, setNodes, setEdges } = useReactFlow();

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

  const onClosePhysicalNode = useCallback(
    (nodeId: string) => {
      const n = getNode(nodeId);
      if (!n || n.type !== "physicalLayerNode") return;

      const curEdges = getEdges();

      // Physical layer spec from this node
      const plValue = (n.data as BaseNodeData)?.value as any;
      const plId: string | undefined = plValue?.physical_layer?.id;

      // All targets currently connected FROM this physical node
      const targetIds = curEdges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      // 1) Update connected view nodes: remove this physical layer ref
      setNodes((nds) =>
        nds
          .map((nn) => {
            if (nn.type !== "viewNode" || !targetIds.includes(nn.id)) {
              return nn;
            }

            const vData = nn.data as ViewNodeData;
            const existing = vData.physical_layers ?? [];

            const next = plId
              ? existing.filter((d) => d.id !== plId)
              : existing;

            return {
              ...nn,
              data: {
                ...nn.data,
                physical_layers: next.length ? next : undefined,
              } as ViewNodeData,
            };
          })
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
          title: "Grammar • physical_layer",
          schema,
          pickInner: (v) => (v as any)?.physical_layer,
          onClose: onClosePhysicalNode,
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
