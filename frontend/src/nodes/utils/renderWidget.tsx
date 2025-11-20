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
  value: any,
  onValueChange?: (id: string, variable: string, value: any) => void
): ReactNode {
  if (!widgetDef) return null;

  switch (widgetDef.type) {
    case "radio-group":
      return renderRadioGroup(widgetDef, value, onValueChange);
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
  value: any,
  onValueChange?: (id: string, variable: string, value: any) => void
): ReactNode {
  const anyDef = def as any;
  const labelId = `${def.id}-label`;
  const items: string[] = anyDef.items ?? [];
  const layout: "horizontal" | "vertical" = anyDef.layout ?? "vertical";
  const defaultValue = anyDef["default-value"];

  const currentValue = value ?? defaultValue;

  return (
    <FormControl style={{ alignItems: "center" }}>
      <FormLabel id={labelId}>{def.title}</FormLabel>

      <RadioGroup
        aria-labelledby={labelId}
        value={currentValue} // controlled
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          onValueChange?.(def.id, def.variable, v);
        }}
        name={def.id}
        row={layout === "horizontal"}
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
