import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

import schema from "./schema.json";
import JsonCodeEditor from "./JsonCodeEditor";

import restartPng from "./assets/restart.png";
import fetchPng from "./assets/fetch.png";

import "./GrammarNode.css";

/** --------------------------
 *  Types
 *  -------------------------- */
type GrammarValue = unknown;

type GrammarNodeData = {
  value: GrammarValue;
  onChange?: (val: GrammarValue, id: string) => void;
  title?: string;

  // Optional callbacks for actions
  onClose?: (id: string) => void;
  onRun?: (id: string) => void;
  onFetch?: (id: string) => void; // used only for physical_layer nodes
};

export type GrammarNode = Node<GrammarNodeData, "grammarNode">;

/** --------------------------
 *  Helpers
 *  -------------------------- */
function detectKind(
  v: any
):
  | "physical_layer"
  | "view"
  | "join"
  | "transformation"
  | "interaction"
  | "choice"
  | "unknown" {
  if (!v || typeof v !== "object") return "unknown";
  const keys = [
    "physical_layer",
    "view",
    "join",
    "transformation",
    "interaction",
    "choice",
  ].filter((k) => k in v);
  return keys.length === 1 ? (keys[0] as any) : "unknown";
}

function formatErrors(
  errs: ErrorObject[] | null | undefined,
  max = 4
): string[] {
  if (!errs || errs.length === 0) return [];
  return errs.slice(0, max).map((e) => {
    const path = e.instancePath || e.schemaPath || "";
    return `${path} ${e.message ?? ""}`.trim();
  });
}

/** --------------------------
 *  Component
 *  -------------------------- */
const GrammarNodeComponent = memo(function GrammarNodeComponent({
  id,
  data,
  selected,
}: NodeProps<GrammarNode>) {
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [hasSyntaxError, setHasSyntaxError] = useState(false);

  const rf = useReactFlow();

  // Ajv validator (singleton per component)
  const ajvRef = useRef<Ajv | null>(null);
  if (!ajvRef.current) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    ajvRef.current = ajv;
  }
  const validate = useMemo(() => ajvRef.current!.compile(schema as any), []);

  const handleChange = useCallback(
    (val: GrammarValue) => {
      data?.onChange?.(val, id);
      try {
        const ok = validate(val);
        setIsValid(!!ok);
        setErrors(formatErrors(validate.errors));
      } catch (e) {
        setIsValid(false);
        setErrors([String(e)]);
      }
    },
    [data, id, validate]
  );

  // Validate initial value once (badge state on mount)
  useMemo(() => {
    try {
      const ok = validate(data.value);
      setIsValid(!!ok);
      setErrors(formatErrors(validate.errors));
    } catch (e) {
      setIsValid(false);
      setErrors([String(e)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kind = detectKind(data.value as any);
  const title =
    data?.title ?? (kind !== "unknown" ? `Grammar • ${kind}` : "Grammar");
  const isOverallValid = isValid && !hasSyntaxError;

  // Actions
  const onClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  const onRun = useCallback(() => {
    if (data?.onRun) return data.onRun(id);
    console.log(`[run] node ${id} (kind=${kind})`);
  }, [data, id, kind]);

  const onFetch = useCallback(() => {
    if (data?.onFetch) return data.onFetch(id);
    console.log(`[fetch] node ${id} (kind=${kind})`);
  }, [data, id, kind]);

  return (
    <div className="gnode">
      <NodeResizer isVisible={!!selected} minWidth={360} minHeight={320} />

      {/* Header */}
      <div className="gnode__header">
        <div className="gnode__title">
          <span>{title}</span>
          {kind !== "unknown" && (
            <span className="gnode__kind" title="Detected kind">
              {kind}
            </span>
          )}
        </div>

        <div className="gnode__headerActions">
          <span
            className={`gnode__badge ${
              isOverallValid ? "is-valid" : "is-invalid"
            }`}
            title={
              isValid
                ? "Schema validation succeeded"
                : "Schema validation failed"
            }
          >
            {isOverallValid ? "VALID" : "INVALID"}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="gnode__iconBtn gnode__iconBtn--close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="gnode__editor">
        <div className="gnode__editorInner">
          <JsonCodeEditor
            value={data.value}
            onChange={handleChange as (v: unknown) => void}
            onDiagnostics={(diags) => setHasSyntaxError(diags.length > 0)}
            height="100%"
          />
        </div>

        {!isValid && errors.length > 0 && (
          <div className="gnode__errors">
            <div className="gnode__errorsTitle">Schema errors:</div>
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
      </div>

      {/* Footer action bar */}
      <div className="gnode__footer">
        <button
          type="button"
          onClick={onRun}
          title="Re-run"
          aria-label="Re-run"
          className="gnode__actionBtn"
        >
          <img src={restartPng} alt="Re-run" className="gnode__actionIcon" />
        </button>

        {detectKind(data.value as any) === "physical_layer" && (
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
        )}
      </div>

      {/* CONNECTORS */}
      <Handle
        type="target"
        position={Position.Left}
        className="gnode__handle gnode__handle--left"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="gnode__handle gnode__handle--right"
      />
    </div>
  );
});

export default GrammarNodeComponent;
