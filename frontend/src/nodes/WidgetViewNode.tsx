import { memo, use, useCallback, useEffect, useRef, useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Position, NodeResizer, useReactFlow, Handle } from "@xyflow/react";
// import "./ViewportNode.css";
import "./WidgetViewNode.css";
import restartPng from "../assets/restart.png";
import { WidgetDef, WidgetOutput } from "./utils/types";
import { renderWidgetFromWidgetDef } from "./utils/renderWidget";
// import { TransformationNodeData } from "./TransformationNode";

export type WidgetViewNodeData = {
  onClose?: (id: string) => void;
  onRun?: (srcId: string, trgId?: string) => void;
  widget?: WidgetDef;
};

export type WidgetViewNode = Node<WidgetViewNodeData, "widgetViewNode">;

const WidgetViewNode = memo(function WidgetViewNode({
  id,
  data,
}: NodeProps<WidgetViewNode>) {
  const { getEdges, setEdges } = useReactFlow();
  const rf = useReactFlow();

  // store current widget id + value
  const [widgetValue, setWidgetValue] = useState<WidgetOutput | null>(null);

  const onClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));

    const curEdges = getEdges();

    // All targets currently connected FROM this widgetview node
    const targetIds = curEdges
      .filter((e) => e.source === id)
      .map((e) => e.target);

    // 3) Remove all edges touching the closed view node
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [data, id, rf, getEdges, setEdges]);

  const onRun = useCallback(() => {
    if (data?.onRun) return data.onRun(id);
  }, [data, id, widgetValue]);

  // if the widget definition changes (or node is created), sync default
  useEffect(() => {
    const w: any = data?.widget;
    if (!w) return;
    console.log("Setting widget default value:", w["default-value"]);
    setWidgetValue({ id: w.id, value: w["default-value"] });
  }, [data?.widget]);

  return (
    <div className="wvnode">
      <NodeResizer />

      <div className="wvnode__header">
        <div className="wvnode__title">Widget</div>
        <button
          type="button"
          className="wvnode__iconBtn wvnode__iconBtn--close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="wvnode__body">
        {renderWidgetFromWidgetDef(data?.widget, (wid, val) => {
          setWidgetValue({ id: wid, value: val });
          console.log("Widget value changed:", wid, val);
        })}
      </div>

      <div className="wvnode__footer">
        <button
          type="button"
          onClick={onRun}
          title="update"
          aria-label="update"
          className="wvnode__actionBtn"
        >
          <img src={restartPng} alt="update" className="wvnode__actionIcon" />
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="viewport-in-1"
        className="wvnode__handle__source"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="viewport-in-2"
        className="wvnode__handle__source"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="viewport-out-1"
        className="wvnode__handle__target"
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="viewport-out-2"
        className="wvnode__handle__target"
      />
    </div>
  );
});

export default WidgetViewNode;
