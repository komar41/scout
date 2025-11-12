import { ParsedView } from "./types";
import type { InteractionDef } from "./types";

export function parseView(raw: any): ParsedView[] {
  if (!raw?.view || !Array.isArray(raw.view)) return [];

  console.log(raw, "<<< raw view");
  return raw.view.map((v: any) => {
    const base: ParsedView = {
      physicalLayerRef: v.physical_layer?.ref,
      thematicLayerRef: v.thematic_layer?.ref,
      type: v.type,
      projection: v.projection,
      zoom_pan: v.zoom_pan,
      layers: [],
    };

    if (Array.isArray(v.layers)) {
      base.layers = v.layers.map((lyr: any) => {
        const style = lyr.style || {};
        return {
          tag: lyr.tag,
          fill: style.fill
            ? {
                attribute: style.fill.attribute || style.fill.feature,
                colormap: style.fill.colormap || "viridis",
              }
            : undefined,
          stroke: style.stroke_color
            ? { color: style.stroke_color, width: style.stroke_width || 1.2 }
            : undefined,
          opacity: style.opacity ?? 1,

          zIndex:
            style.zIndex ??
            style["z-index"] ??
            style.z_index ??
            lyr.zIndex ??
            0,
        };
      });
    }

    return base;
  });
}

export function parseInteraction(raw: any): InteractionDef[] {
  // console.log(raw, "<<< raw interaction");
  if (!raw?.interaction || !Array.isArray(raw.interaction)) return [];

  return raw.interaction
    .map((it: any): InteractionDef | null => {
      if (!it) return null;

      const layer = it.layer ?? {};

      const def: InteractionDef = {
        id: String(it.id ?? ""),
        type: String(it.type ?? ""),
        action: String(it.action ?? ""),
        physicalLayerRef: String(it.physicalLayerRef ?? ""),
        layer: {
          tag: String(layer.tag ?? ""),
          ...(layer.feature != null ? { feature: String(layer.feature) } : {}),
        },
      };

      return def;
    })
    .filter(
      (d): d is InteractionDef =>
        !!d &&
        !!d.id &&
        !!d.type &&
        !!d.action &&
        !!d.physicalLayerRef &&
        !!d.layer?.tag
    );
}
