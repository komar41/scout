import { memo, useCallback, useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Position, NodeResizer, useReactFlow, Handle } from "@xyflow/react";
import "./PyCodeEditorNode.css";
import restartPng from "../assets/restart.png";
import runPng from "../assets/run.png";
import { PhysicalLayerDef, ViewDef, InteractionDef } from "./utils/types";
import PythonCodeEditor from "../components/PythonCodeEditor";

export type PyCodeEditorNodeData = {
  code?: string; // <-- added here
  onClose?: (id: string) => void;
  onRun?: (srcId: string, code: string) => void;
  physical_layers?: PhysicalLayerDef[];
  view?: ViewDef[];
  interactions?: InteractionDef[];
};

export type PyCodeEditorNode = Node<PyCodeEditorNodeData, "pyCodeEditorNode">;

const PyCodeEditorNode = memo(function PyCodeEditorNode({
  id,
  data,
}: NodeProps<PyCodeEditorNode>) {
  const rf = useReactFlow();

  // NEW: store output panel data
  const [output, setOutput] = useState<{ stdout: string; stderr: string }>({
    stdout: "",
    stderr: "",
  });

  // ---------- CLOSE ACTION ----------
  const handleClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);

    // default: remove this node
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  // ---------- RUN ACTION ----------
  const handleRun = useCallback(async () => {
    const code = data?.code ?? "";
    if (data?.onRun) {
      return data.onRun(id, code);
    }
    console.log("[PyCodeEditorNode RUN]", id, code);

    const res = await fetch("http://localhost:5000/api/run-python", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const result = await res.json();

    // Update the output panel
    setOutput({
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    });
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
        >
          <img src={runPng} alt="Run Code" className="pcenode__actionIcon" />
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="viewport-in-1"
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
