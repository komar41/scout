import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import JsonCodeEditor from "../components/JsonCodeEditor";
import "./BaseGrammarNode.css";
import restartPng from "../assets/restart.png";
import fetchPng from "../assets/fetch.png";

export type GrammarValue = unknown;

export type BaseNodeData = {
  value: GrammarValue;
  title?: string;
  onChange?: (val: GrammarValue, id: string) => void;
  onClose?: (id: string) => void;
  onRun?: (id: string) => void;

  /** Pass the schema for the INNER value (e.g., object under "physical_layer" or array under "view") */
  schema?: object;
  /** Extract the inner value to validate (defaults to value itself) */
  pickInner?: (v: GrammarValue) => unknown;

  /** Optional extra footer actions (buttons, etc.) */
  footerActions?: React.ReactNode;
};

export type BaseNode = Node<BaseNodeData, string>;

function fmt(errs: ErrorObject[] | null | undefined, max = 4): string[] {
  if (!errs || !errs.length) return [];
  return errs
    .slice(0, max)
    .map((e) => `${e.instancePath || ""} ${e.message ?? ""}`.trim());
}

const BaseGrammarNode = memo(function BaseGrammarNode({
  id,
  data,
  selected,
}: NodeProps<BaseNode>) {
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [hasSyntaxError, setHasSyntaxError] = useState(false);
  const rf = useReactFlow();

  const ajvRef = useRef<Ajv | null>(null);
  if (!ajvRef.current) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    ajvRef.current = ajv;
  }

  const validate = useMemo(() => {
    if (!data.schema) return null;
    return ajvRef.current!.compile(data.schema as any);
  }, [data.schema]);

  const innerValue = useMemo(
    () => (data.pickInner ? data.pickInner(data.value) : data.value),
    [data.pickInner, data.value]
  );

  const runValidation = useCallback(
    (val: unknown) => {
      if (!validate) {
        setIsValid(true);
        setErrors([]);
        return;
      }
      try {
        const ok = validate(val);
        setIsValid(!!ok);
        setErrors(fmt(validate.errors));
      } catch (e) {
        setIsValid(false);
        setErrors([String(e)]);
      }
    },
    [validate]
  );

  const handleChange = useCallback(
    (val: GrammarValue) => {
      data?.onChange?.(val, id);
      runValidation(data.pickInner ? data.pickInner(val) : val);
    },
    [data, id, runValidation]
  );

  useMemo(() => {
    runValidation(innerValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate]); // re-run when schema (and thus validate) changes

  const title = data?.title ?? "Grammar";
  const overallValid = isValid && !hasSyntaxError;

  const onClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  const onRun = useCallback(() => {
    if (data?.onRun) return data.onRun(id);
    console.log("[run]", id);
  }, [data, id]);

  return (
    <div className="gnode">
      <NodeResizer isVisible={!!selected} minWidth={360} minHeight={320} />

      {/* Header */}
      <div className="gnode__header">
        <div className="gnode__title">{title}</div>
        <div className="gnode__headerActions">
          <span
            className={`gnode__badge ${
              overallValid ? "is-valid" : "is-invalid"
            }`}
          >
            {overallValid ? "VALID" : "INVALID"}
          </span>
          <button
            type="button"
            className="gnode__iconBtn gnode__iconBtn--close"
            onClick={onClose}
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
      </div>
    </div>
  );
});

export default BaseGrammarNode;
