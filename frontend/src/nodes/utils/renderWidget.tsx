import type { ReactNode } from "react";
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  FormHelperText,
  Radio,
} from "@mui/material";
import type { WidgetDef } from "./types";

export function renderWidgetFromWidgetDef(
  widgetDef: WidgetDef | undefined,
  onValueChange?: (id: string, value: any) => void
): ReactNode {
  if (!widgetDef) return null;

  switch (widgetDef.type) {
    case "radio-group":
      return renderRadioGroup(widgetDef, onValueChange);
    default:
      return (
        <div style={{ fontSize: 12 }}>
          Unsupported widget type: <code>{widgetDef.type}</code>
        </div>
      );
  }
}

function renderRadioGroup(
  def: WidgetDef,
  onValueChange?: (id: string, value: any) => void
): ReactNode {
  // your grammar fields:
  // id, title, description, "default-value", items, layout
  const anyDef = def as any;
  const labelId = `${def.id}-label`;
  const items: string[] = anyDef.items ?? [];
  const layout: "horizontal" | "vertical" = anyDef.layout ?? "vertical";
  const defaultValue = anyDef["default-value"];

  return (
    <FormControl style={{ alignItems: "center" }}>
      <FormLabel id={labelId}>{def.title}</FormLabel>
      <RadioGroup
        aria-labelledby={labelId}
        defaultValue={defaultValue}
        name={def.id}
        row={layout === "horizontal"}
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          onValueChange?.(def.id, value);
        }}
      >
        {items.map((item) => (
          <FormControlLabel
            key={item}
            value={item}
            control={
              <Radio
                sx={{
                  color: "#d95f02",
                  "&.Mui-checked": { color: "#d95f02" },
                }}
              />
            }
            label={item}
          />
        ))}
      </RadioGroup>
      {def.description && (
        <FormHelperText
          style={{
            textAlign: "center",
            width: "100%",
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          {def.description}
        </FormHelperText>
      )}
    </FormControl>
  );
}
