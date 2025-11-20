import { memo, useCallback, useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Position, NodeResizer, useReactFlow, Handle } from "@xyflow/react";
import "./PyCodeEditorNode.css";
import restartPng from "../assets/restart.png";
import runPng from "../assets/run.png";
import checkPng from "../assets/check-mark.png";
import { WidgetOutput } from "./utils/types";
import PythonCodeEditor from "../components/PythonCodeEditor";

export type PyCodeEditorNodeData = {
  code?: string; // <-- added here
  onClose?: (id: string) => void;
  onRun?: (srcId: string, code: string) => void;

  widgetOutputs?: WidgetOutput[];
};

export type PyCodeEditorNode = Node<PyCodeEditorNodeData, "pyCodeEditorNode">;

const PyCodeEditorNode = memo(function PyCodeEditorNode({
  id,
  data,
}: NodeProps<PyCodeEditorNode>) {
  const rf = useReactFlow();

  const [running, setRunning] = useState(false);
  const [runningSuccess, setRunningSuccess] = useState(false);

  // NEW: store output panel data
  const [output, setOutput] = useState<{ stdout: string; stderr: string }>({
    stdout: "",
    stderr: "",
  });

  // ---------- CLOSE ACTION ----------
  const handleClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  // ---------- RUN ACTION ----------
  const handleRun = useCallback(async () => {
    const code = data?.code ?? "";
    const widgetLines =
      (data?.widgetOutputs ?? [])
        .map((w) => {
          const val =
            typeof w.value === "string"
              ? `"${w.value}"` // string literal
              : JSON.stringify(w.value); // numbers, arrays, booleans
          return `${w.variable} = ${val}`;
        })
        .join("\n") + "\n\n";

    const finalCode = widgetLines + code;

    if (data?.onRun) {
      return data.onRun(id, finalCode);
    }

    try {
      setRunning(true);

      // Update the output panel
      setOutput({
        stdout: "",
        stderr: "",
      });

      const res = await fetch("http://localhost:5000/api/run-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });

      const result = await res.json();

      // Update the output panel
      setOutput({
        stdout: result.stdout || "",
        stderr: result.stderr || "",
      });
      setRunningSuccess(true);
      setTimeout(() => setRunningSuccess(false), 2000);
    } catch (err) {
      console.error("Error running code:", err);
    } finally {
      setRunning(false);
    }
  }, [data, id]);

  // ---------- CODE CHANGE ----------
  const handleCodeChange = useCallback(
    (nextCode: string) => {
      // store inside node.data
      rf.setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, code: nextCode } } : n
        )
      );
    },
    [id, rf]
  );

  return (
    <div className="pcenode">
      <NodeResizer minWidth={300} minHeight={260} />

      <div className="pcenode__header">
        <div className="pcenode__title">Code</div>
        <button
          type="button"
          className="pcenode__iconBtn pcenode__iconBtn--close"
          onClick={handleClose}
        >
          ✕
        </button>
      </div>

      <div className="pcenode__body">
        <div className="pcenode__editor">
          <div className="pcenode__editor-inner">
            <PythonCodeEditor
              value={data?.code ?? ""} // <-- bind value
              onChange={handleCodeChange} // <-- bind handler
            />
          </div>
        </div>

        {/* NEW: OUTPUT PANEL */}
        {(output.stdout || output.stderr) && (
          <div className="pcenode__output">
            {output.stdout && (
              <pre className="pcenode__stdout">{output.stdout}</pre>
            )}
            {output.stderr && (
              <pre className="pcenode__stderr">{output.stderr}</pre>
            )}
          </div>
        )}
      </div>

      <div className="pcenode__footer">
        <button
          type="button"
          onClick={handleRun}
          title="update"
          aria-label="update"
          className="pcenode__actionBtn"
        >
          <img src={restartPng} alt="update" className="pcenode__actionIcon" />
        </button>

        <button
          type="button"
          onClick={handleRun}
          title="Run code"
          aria-label="Run code"
          className="pcenode__actionBtn"
          disabled={running}
        >
          {running ? (
            <span className="pcenode__spinner" aria-hidden="true" />
          ) : runningSuccess ? (
            <img src={checkPng} alt="Success" className="pcenode__actionIcon" />
          ) : (
            <img src={runPng} alt="Run Code" className="pcenode__actionIcon" />
          )}
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="viewport-in-1"
        className="pcenode__handle"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="viewport-in-2"
        className="pcenode__handle pcenode__handle--left"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="viewport-out"
        className="pcenode__handle pcenode__handle--right"
      />
    </div>
  );
});

export default PyCodeEditorNode;
