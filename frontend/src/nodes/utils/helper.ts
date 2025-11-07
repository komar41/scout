import * as d3 from "d3";

// ---- tiny helpers ----
export function pickInterpolator(name?: string) {
  const key = `interpolate${(name || "Greys")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())}`; // capitalize first letter

  const interpolator = (d3 as any)[key];
  return typeof interpolator === "function"
    ? interpolator
    : d3.interpolateGreys;
}

export function getPropertyRangeFromGeoJSON(
  fc: any,
  attr?: string
): [number, number] | null {
  if (!attr) return null;
  const vals: number[] = [];
  for (const f of fc?.features ?? []) {
    const v = Number(f?.properties?.[attr]);
    if (!Number.isNaN(v)) vals.push(v);
  }
  if (!vals.length) return null;
  const [min, max] = d3.extent(vals) as [number, number];
  return min == null || max == null ? null : [min, max];
}
