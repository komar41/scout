// JsonCodeEditor.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonLanguage } from "@codemirror/lang-json";
import { linter, Diagnostic, lintGutter } from "@codemirror/lint";
import { EditorView, keymap } from "@codemirror/view";
import {
  openSearchPanel,
  searchKeymap,
  search,
  highlightSelectionMatches,
} from "@codemirror/search";
import "./JsonCodeEditor.css";

type Props = {
  value?: unknown;
  onChange?: (val: unknown) => void;
  /** Give a concrete height to avoid 0-height mount in transformed parents (React Flow) */
  height?: number | string; // e.g., "420px" or 420
  readOnly?: boolean;
};

export default function JsonCodeEditor({
  value = {},
  onChange,
  height = "420px",
  readOnly = false,
}: Props) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const lastApplied = useRef<string>(JSON.stringify(value));

  // keep editor text in sync with external value changes
  useEffect(() => {
    const incoming = JSON.stringify(value);
    if (incoming !== lastApplied.current) {
      lastApplied.current = incoming;
      setText(JSON.stringify(value, null, 2));
    }
  }, [value]);

  // Linter: mark JSON syntax errors at correct ranges + JSON.parse validation
  const jsonSyntaxLinter = useMemo(
    () =>
      linter((view): Diagnostic[] => {
        const doc = view.state.doc.toString();
        const tree = jsonLanguage.parser.parse(doc);
        const diags: Diagnostic[] = [];

        tree.iterate({
          enter(node) {
            if (node.type.isError) {
              diags.push({
                from: node.from,
                to: node.to,
                severity: "error",
                message: "JSON syntax error",
              });
            }
          },
        });

        if (diags.length === 0) {
          try {
            JSON.parse(doc);
          } catch (e: any) {
            diags.push({
              from: 0,
              to: Math.min(1, doc.length),
              severity: "error",
              message: e?.message || "Invalid JSON",
            });
          }
        }
        return diags;
      }),
    []
  );

  const handleChange = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      lastApplied.current = JSON.stringify(parsed);
      onChange?.(parsed);
    } catch {
      /* ignore until valid again */
    }
  };

  return (
    <div
      className="nodrag nowheel"
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      <CodeMirror
        // Ensure correct measurements before first search, then focus
        onCreateEditor={(view) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              view.requestMeasure();
              view.focus();
            });
          });
          // Re-measure when container resizes (fitView / node resize)
          const ro = new ResizeObserver(() => view.requestMeasure());
          const host = view.dom.parentElement || view.dom;
          ro.observe(host);
          // store for optional cleanup if your wrapper supports it
          (view as any)._ro = ro;
        }}
        value={text}
        onChange={handleChange}
        readOnly={readOnly}
        height="100%"
        width="100%"
        style={{ width: "100%", height: "100%" }}
        extensions={[
          json(),
          jsonSyntaxLinter,
          lintGutter(),
          EditorView.editable.of(!readOnly),
          // Search extensions (panel + highlights)
          search({ top: false }),
          highlightSelectionMatches(),
          keymap.of([
            {
              key: "Mod-f",
              run: (view) => {
                view.requestMeasure();
                return openSearchPanel(view);
              },
            },
            ...searchKeymap,
          ]),
          // No wrap + proper scrollbars
        ]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          autocompletion: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
        }}
      />
    </div>
  );
}
