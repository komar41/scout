import type { ReactNode } from "react";
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  FormHelperText,
  Radio,
  TextField,
  Slider,
  Autocomplete,
  Checkbox,
} from "@mui/material";
import type { WidgetDef } from "./types";
import { AddressAutofill } from "@mapbox/search-js-react";

import dayjs, { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import MNumberField from "../../components/MNumberField";

import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export function renderWidgetFromWidgetDef(
  widgetDef: WidgetDef | undefined,
  value: any,
  onValueChange?: (id: string, variable: string, value: any) => void
): ReactNode {
  if (!widgetDef) return null;

  switch (widgetDef.type) {
    case "radio-group":
      return renderRadioGroup(widgetDef, value, onValueChange);

    case "datetime-picker":
      return renderDateTimePickerWidget(widgetDef, value, onValueChange);

    case "slider":
      return renderSliderWidget(widgetDef, value, onValueChange);

    case "number-input":
      return renderNumberInputWidget(widgetDef, value, onValueChange);

    case "location-input":
      return renderLocationFieldWidget(widgetDef, value, onValueChange);

    case "dropdown":
      return renderDropdownWidget(widgetDef, value, onValueChange);

    default:
      return (
        <div style={{ fontSize: 12 }}>
          Unsupported widget type: <code>{widgetDef.type}</code>
        </div>
      );
  }
}

export function renderDropdownWidget(
  widget: WidgetDef,
  value: any,
  onValueChange?: (id: string, variable: string, value: any) => void
) {
  const variable = widget.variable ?? widget.id;

  const items: string[] = Array.isArray(widget.items) ? widget.items : [];
  const multiple = widget["multi-select"] === true;
  const basePlaceholder = widget.placeholder;
  const hasDescription = !!widget.description;

  // current value(s)
  let currentVal: any = multiple ? [] : null;

  if (multiple) {
    currentVal = Array.isArray(value)
      ? value
      : Array.isArray(widget["default-value"])
      ? widget["default-value"]
      : [];
  } else {
    currentVal =
      typeof value === "string"
        ? value
        : typeof widget["default-value"] === "string"
        ? widget["default-value"]
        : null;
  }

  // dynamic placeholder: "N selected" for multi, normal placeholder otherwise
  let placeholder = basePlaceholder;
  if (multiple) {
    const count = Array.isArray(currentVal) ? currentVal.length : 0;
    if (count > 0) {
      placeholder = `${count} selected`;
    }
  }

  return (
    <div
      className="nodrag"
      style={{ width: "100%", marginTop: "8px" }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <Autocomplete
        options={items}
        multiple={multiple}
        disableCloseOnSelect={multiple}
        value={currentVal}
        onChange={(_, newValue) => {
          onValueChange?.(widget.id, variable, newValue);
        }}
        renderOption={(props, option, state) => {
          if (!multiple) {
            // single-select: default rendering
            return (
              <li {...props} key={option}>
                {option}
              </li>
            );
          }

          const { selected } = state;
          const { key, ...optionProps } = props;
          return (
            <li key={key} {...optionProps}>
              <Checkbox
                icon={icon}
                checkedIcon={checkedIcon}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              {option}
            </li>
          );
        }}
        // searchable by default
        filterSelectedOptions={false}
        renderInput={(params) => (
          <TextField
            {...params}
            label={widget.title ?? variable}
            placeholder={placeholder}
            size="small"
            helperText={widget.description || undefined}
            slotProps={{
              formHelperText: hasDescription
                ? {
                    sx: {
                      display: "flex",
                      justifyContent: "center",
                      m: 0,
                      mt: "2px",
                    },
                  }
                : undefined,
            }}
          />
        )}
        sx={{
          mt: 1,
          // 🔑 Hide the chips so the input stays a single line
          "& .MuiAutocomplete-tag": {
            display: "none",
          },
        }}
      />
    </div>
  );
}

export function renderLocationFieldWidget(
  widget: WidgetDef,
  value: any,
  onValueChange?: (widgetId: string, variable: string, value: any) => void
): React.ReactNode {
  const variable = widget.variable ?? widget.id;

  const initialVal: string =
    typeof widget["default-value"] === "string" ? widget["default-value"] : "";

  const placeholder = widget.placeholder;
  const hasDescription = !!widget.description;

  return (
    <div style={{ width: "100%", marginTop: "4px" }}>
      <form onSubmit={(e) => e.preventDefault()}>
        <AddressAutofill
          accessToken="pk.eyJ1IjoicXNoYWhydWtoNDEiLCJhIjoiY20yeXhpd2tkMDVtZjJsb29tcW13dHJjMiJ9.uLUf8R7TESQ97G55AbAifw"
          onRetrieve={(res) => {
            const feat = res.features?.[0];
            if (!feat) return;

            // Extract Mapbox-provided coordinates
            const [lon, lat] = feat.geometry.coordinates;

            // Commit ONLY coordinates to widget state
            onValueChange?.(widget.id, variable, { lat, lon });
          }}
        >
          <TextField
            label={widget.title ?? variable}
            fullWidth
            size="small"
            defaultValue={initialVal}
            placeholder={placeholder}
            sx={{ mt: 1 }}
            helperText={widget.description || undefined}
            slotProps={{
              htmlInput: {
                autoComplete: "street-address",
                maxLength:
                  typeof widget["max-length"] === "number"
                    ? widget["max-length"]
                    : undefined,
              },
              formHelperText: hasDescription
                ? {
                    sx: {
                      display: "flex",
                      justifyContent: "center",
                      m: 0,
                    },
                  }
                : undefined,
            }}
          />
        </AddressAutofill>
      </form>
    </div>
  );
}

export function renderNumberInputWidget(
  widget: WidgetDef,
  value: any,
  onValueChange?: (widgetId: string, variable: string, value: any) => void
) {
  const variable = widget.variable ?? widget.id;

  const min = widget.min;
  const max = widget.max;
  const step = widget.step ?? 1;

  const currentVal =
    typeof value === "number"
      ? value
      : typeof widget["default-value"] === "number"
      ? widget["default-value"]
      : null;

  return (
    <div style={{ width: "100%", marginTop: "8px" }}>
      <MNumberField
        label={widget.title}
        helperText={widget.description}
        min={min}
        max={max}
        step={step}
        value={currentVal}
        placeholder={widget.placeholder}
        onChange={(v) => onValueChange?.(widget.id, variable, v)}
      />
    </div>
  );
}

export function renderSliderWidget(
  widget: WidgetDef,
  value: any,
  onValueChange?: (widgetId: string, variable: string, value: any) => void
): React.ReactNode {
  const variable = widget.variable ?? widget.id;

  const currentVal =
    typeof value === "number"
      ? value
      : typeof widget["default-value"] === "number"
      ? widget["default-value"]
      : widget.min; // safe fallback

  const min = widget.min;
  const max = widget.max;
  const step = widget.step ?? 1;

  const showValue = widget["show-value"] === true;
  const orientation =
    widget.orientation === "vertical" ? "vertical" : "horizontal";

  return (
    <div className="nodrag" style={{ width: "100%" }}>
      {/* Title */}
      <div
        style={{
          marginBottom: "4px",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        {widget.title ?? variable}
      </div>

      <Slider
        value={currentVal}
        min={min}
        max={max}
        step={step}
        orientation={orientation}
        valueLabelDisplay={showValue ? "on" : "off"}
        onChange={(_, v) => {
          if (typeof v === "number") {
            onValueChange?.(widget.id, variable, v);
          }
        }}
        sx={{
          mt: 1,
        }}
      />

      {/* Optional centered description */}
      {widget.description && (
        <div
          style={{
            marginTop: "-25px",
            fontSize: "0.75rem",
            color: "#666",
            textAlign: "center",
          }}
        >
          {widget.description}
        </div>
      )}
    </div>
  );
}

function renderDateTimePickerWidget(
  widget: WidgetDef,
  value: any,
  onValueChange?: (widgetId: string, variable: string, value: any) => void
): React.ReactNode {
  const variable = widget.variable ?? widget.id;

  // parse current value or default-value
  let currentVal: Dayjs | null = null;
  if (typeof value === "string" && value) {
    const p = dayjs(value);
    currentVal = p.isValid() ? p : null;
  } else if (widget["default-value"]) {
    const p = dayjs(widget["default-value"]);
    currentVal = p.isValid() ? p : null;
  }

  const fmt = widget["display-format"] ?? "YYYY-MM-DD HH:mm";

  // Build textField props safely
  const textFieldProps: any = {
    fullWidth: true,
    size: "small",
    sx: { mt: 1 },
  };

  // Add helper text only if it exists
  if (widget.description) {
    textFieldProps.helperText = widget.description;
    textFieldProps.FormHelperTextProps = {
      sx: {
        display: "flex",
        justifyContent: "center",
        m: 0,
      },
    };
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        label={widget.title ?? variable}
        value={currentVal}
        onChange={(newVal: Dayjs | null) => {
          const iso = newVal ? newVal.toISOString() : null;
          onValueChange?.(widget.id, variable, iso);
        }}
        format={fmt}
        slotProps={{
          textField: textFieldProps,
        }}
      />
    </LocalizationProvider>
  );
}

function renderRadioGroup(
  def: WidgetDef,
  value: any,
  onValueChange?: (id: string, variable: string, value: any) => void
): ReactNode {
  const anyDef = def as any;
  const labelId = `${def.id}-label`;
  const items: string[] = anyDef.items ?? [];
  const orientation: "horizontal" | "vertical" =
    anyDef.orientation ?? "vertical";
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
        row={orientation === "horizontal"}
      >
        {items.map((item) => (
          <FormControlLabel
            key={item}
            value={item}
            control={<Radio />}
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
