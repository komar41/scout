import { memo, use, useCallback, useEffect, useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Position, NodeResizer, useReactFlow, Handle } from "@xyflow/react";
import "./WidgetViewNode.css";
import restartPng from "../assets/restart.png";
import type { WidgetDef, WidgetOutput } from "./utils/types";
import { renderWidgetFromWidgetDef } from "./utils/renderWidget";

export type WidgetViewNodeData = {
  onClose?: (id: string) => void;
  onRun?: (srcId: string, trgId?: string) => void;
  widget?: WidgetDef;
  output?: WidgetOutput;
  pushToken?: string;
};

export type WidgetViewNode = Node<WidgetViewNodeData, "widgetViewNode">;

const WidgetViewNode = memo(function WidgetViewNode({
  id,
  data,
}: NodeProps<WidgetViewNode>) {
  const { setNodes } = useReactFlow();

  // store current widget id + value
  const [widgetValue, setWidgetValue] = useState<WidgetOutput | null>(null);

  // inside WidgetViewNode component
  const handleClose = useCallback(() => {
    if (data?.onClose) {
      // App-level callback: (nodeId: string) => void
      return data.onClose(id);
    }
  }, [data, id]);

  const onRun = useCallback(() => {
    if (data?.onRun) {
      // you can pass widgetValue along later if you want
      return data.onRun(id);
    }
    console.log("WidgetViewNode onRun value:", widgetValue);
  }, [data, id, widgetValue]);

  // if the widget definition changes (or node is created), sync default
  useEffect(() => {
    const w: any = data?.widget;
    if (!w) return;

    const out: WidgetOutput = {
      id: w.id,
      variable: w["variable"],
      value: w["default-value"],
    };
    console.log("Setting widget default value:", out.value);

    setWidgetValue(out);

    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...(n.data as WidgetViewNodeData),
                output: out,
              },
            }
          : n
      )
    );
  }, [data?.widget, data?.pushToken, id, setNodes]);

  return (
    <div className="wvnode">
      <NodeResizer />

      <div className="wvnode__header">
        <div className="wvnode__title">Widget</div>
        <button
          type="button"
          className="wvnode__iconBtn wvnode__iconBtn--close"
          onClick={handleClose}
        >
          ✕
        </button>
      </div>

      <div className="wvnode__body">
        {renderWidgetFromWidgetDef(
          data?.widget,
          widgetValue?.value, // current value drives the widget (controlled)
          (wid, v, val) => {
            const out: WidgetOutput = {
              id: wid,
              variable: v,
              value: val,
            };
            setWidgetValue(out);
            console.log("Widget value changed:", wid, v, val);

            // mirror into the node's data.output
            setNodes((nds) =>
              nds.map((n) =>
                n.id === id
                  ? {
                      ...n,
                      data: {
                        ...(n.data as WidgetViewNodeData),
                        output: out,
                      },
                    }
                  : n
              )
            );
          }
        )}
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
