import { useEffect, useRef } from "react";
import JSONEditor from "jsoneditor";
import "jsoneditor/dist/jsoneditor.css";

type Props = {
  value?: unknown;
  onChange?: (val: unknown) => void;
  height?: number | string;
  mode?: "tree" | "code" | "view" | "form" | "text";
};

export default function JsonEditor({
  value = {},
  onChange,
  height = 400,
  mode = "code",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<JSONEditor | null>(null);

  // guards to prevent collapsing + redundant updates
  const isInternalChangeRef = useRef(false);
  const lastAppliedJSONRef = useRef<string>("");

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = new JSONEditor(containerRef.current, {
      mode,
      onChangeJSON: (json) => {
        // mark as internal so the sync effect doesn't immediately push back
        isInternalChangeRef.current = true;
        try {
          onChange?.(json);
        } finally {
          // clear flag after React state flushes
          queueMicrotask(() => {
            isInternalChangeRef.current = false;
          });
        }
      },
    });

    // set initial value
    editorRef.current.set(value as object);
    lastAppliedJSONRef.current = JSON.stringify(value);

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []); // create once

  // keep editor in sync if 'value' prop changes externally, without collapsing
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // ignore while we're processing an internal editor-originated change
    if (isInternalChangeRef.current) return;

    const incoming = JSON.stringify(value);

    // skip if nothing actually changed
    if (incoming === lastAppliedJSONRef.current) return;

    try {
      editor.update(value as object);
      lastAppliedJSONRef.current = incoming;
    } catch {
      // if value is temporarily invalid for the current mode, you could fallback:
      // editor.set(value as object); // (note: this will collapse)
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
      }}
    />
  );
}
