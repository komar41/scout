import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

// Adjust the import path to match your setup.
// If you have a path alias like "@/schemas", keep it;
// otherwise use: import schema from "../schemas/schema.json";
import schema from "./schema.json";

// Your existing code editor component
import JsonCodeEditor from "./JsonCodeEditor";

/** --------------------------
 *  Types
 *  -------------------------- */
type GrammarValue = unknown;

type GrammarNodeData = {
  value: GrammarValue;
  onChange?: (val: GrammarValue, id: string) => void;
  title?: string;
};

export type GrammarNode = Node<GrammarNodeData, "grammarNode">;

/** --------------------------
 *  Helpers
 *  -------------------------- */
function detectKind(
  v: any
): "physical_layer" | "view" | "join" | "interaction" | "choice" | "unknown" {
  if (!v || typeof v !== "object") return "unknown";
  const keys = [
    "physical_layer",
    "view",
    "join",
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

  // Create a single Ajv instance + compiled validator
  const ajvRef = useRef<Ajv | null>(null);

  if (!ajvRef.current) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    ajvRef.current = ajv;
  }
  const validate = useMemo(() => ajvRef.current!.compile(schema as any), []);

  const handleChange = useCallback(
    (val: GrammarValue) => {
      // Always propagate the edit upstream
      data?.onChange?.(val, id);

      // Validate the new value
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

  // Validate initial value once (so badge reflects current state on mount)
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
  }, []); // run once

  const kind = detectKind(data.value as any);
  const title =
    data?.title ?? (kind !== "unknown" ? `Grammar • ${kind}` : "Grammar");
  const badgeBg = isValid ? "#2ca25f" : "#de2d26";
  const badgeText = isValid ? "VALID" : "INVALID";

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
        gridTemplateRows: "40px 1fr 28px",
        overflow: "hidden",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <NodeResizer isVisible={!!selected} minWidth={360} minHeight={320} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          fontWeight: 500,
          fontSize: 14,
          borderBottom: "1px solid #eee",
          background: "#6a51a3",
          color: "white",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>{title}</span>
          {kind !== "unknown" && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.2)",
              }}
              title="Detected kind"
            >
              {kind}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background: badgeBg,
          }}
          title={
            isValid ? "Schema validation succeeded" : "Schema validation failed"
          }
        >
          {badgeText}
        </span>
      </div>

      {/* Editor */}
      <div
        style={{
          padding: 8,
          minHeight: 0,
          height: "100%",
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
          gap: 6,
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <JsonCodeEditor
            value={data.value}
            onChange={handleChange as (v: unknown) => void}
            height="100%"
          />
        </div>

        {/* Errors */}
        {!isValid && errors.length > 0 && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.3,
              color: "#7f1d1d",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "6px 8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
      </div>

      {/* Handles */}
      <div style={{ borderTop: "1px solid #eee", position: "relative" }}>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
});

export default GrammarNodeComponent;
