import React, { memo, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { NodeProps, Node } from "@xyflow/react";
import JsonEditor from "./JsonEditor";
import { PhysicalLayer } from "./types/physical-layer";
import Unscaled from "./unscaled";

type PhysicalLayerData = {
  value: PhysicalLayer;
  onChange?: (val: PhysicalLayer, id: string) => void;
  title?: string;
  mode?: "tree" | "code" | "view" | "form" | "text";
  height?: number | string;
};

export type PhysicalLayerNode = Node<PhysicalLayerData, "physicalLayerDefn">;

const PhysicalLayerDefnNode = memo(function PhysicalLayerDefnNode({
  id,
  data,
  selected,
}: NodeProps<PhysicalLayerNode>) {
  const handleChange = useCallback(
    (val: PhysicalLayer) => data?.onChange?.(val, id),
    [data, id]
  );

  return (
    <div
      className="nodrag"
      style={{
        width: "100%",
        height: "100%",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 12,
        display: "grid",
        gridTemplateRows: "40px 1fr",
        overflow: "hidden",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <NodeResizer isVisible={!!selected} minWidth={420} minHeight={320} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontWeight: 600,
          fontSize: 13,
          borderBottom: "1px solid #eee",
          background: "#fafafa",
          userSelect: "none",
        }}
      >
        {data?.title ?? "Physical Layer Definition"}
      </div>

      {/* Editor container must be allowed to shrink; minHeight: 0 prevents overflow */}
      <div
        style={{
          padding: 8,
          minHeight: 0,
          height: "100%",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ height: "100%", width: "100%" }}>
          <JsonEditor
            value={data.value}
            onChange={handleChange as (v: unknown) => void}
            mode={data?.mode ?? "form"}
            height="100%"
          />
        </div>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

export default PhysicalLayerDefnNode;
