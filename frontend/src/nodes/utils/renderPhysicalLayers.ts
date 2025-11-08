// src/nodes/utils/renderPhysicalLayers.ts
import * as d3 from "d3";
import L from "leaflet";
import { getPropertyRangeFromGeoJSON, pickInterpolator } from "./helper";
import { applyGeometryInteractions } from "./geomInteractions";
import type { InteractionSpec } from "./geomInteractions";
import type { ParsedView } from "./types";

/**
 * Render all physical-layer views into the Leaflet+D3 overlay.
 * - Handles multiple ParsedView entries.
 * - Only processes views with `physicalLayerRef` (thematic views are skipped for now).
 * - Respects z-index from `layer.style.zIndex` or `layer.zIndex`.
 */
export async function renderPhysicalLayersForViews(opts: {
  id: string;
  map: L.Map;
  parsedViews: ParsedView[];
  clearAllSvgLayers: () => void;
  makeLeafletPath: (map: L.Map) => d3.GeoPath<any, d3.GeoPermissibleObjects>;
  getOrCreateTagGroup: (
    tag: string
  ) => d3.Selection<SVGGElement, unknown, null, undefined>;
}) {
  const {
    id,
    map,
    parsedViews,
    clearAllSvgLayers,
    makeLeafletPath,
    getOrCreateTagGroup,
  } = opts;

  // Only keep views that reference a physical layer
  const physicalViews = parsedViews.filter((v) => v.physicalLayerRef);

  if (!physicalViews.length) {
    // Only thematic or invalid views -> nothing for now (thematic handler TODO)
    clearAllSvgLayers();
    return;
  }

  // For now: clear everything once, then redraw all physical views
  clearAllSvgLayers();

  let unionBounds: L.LatLngBounds | null = null;
  const path = makeLeafletPath(map);

  for (const view of physicalViews) {
    const plId = view.physicalLayerRef;
    if (!plId) {
      // thematic; will be handled by a different helper later
      continue;
    }

    // Sort layers by z-index if present (style.zIndex or zIndex), default 0
    const layers = [...(view.layers ?? [])].sort((a: any, b: any) => {
      const za = a.style?.zIndex ?? a.zIndex ?? 0;
      const zb = b.style?.zIndex ?? b.zIndex ?? 0;
      return za - zb;
    });

    for (const lyr of layers) {
      const tag = lyr.tag;
      const url = `http://127.0.0.1:5000/generated/${plId}_${tag}.geojson`;

      let fc: any;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fc = await res.json();
      } catch (err) {
        console.error(`[Viewport ${id}] Failed to fetch ${url}`, err);
        continue;
      }

      // --- Styling / color scale ---
      const attr = lyr.fill?.attribute;
      const interp = pickInterpolator(lyr.fill?.colormap);
      const ext = getPropertyRangeFromGeoJSON(fc, attr);
      const colorScale =
        attr && interp
          ? d3.scaleSequential(interp).domain(ext ?? [0, 1])
          : null;

      const strokeColor = lyr.stroke?.color ?? "#222";
      const strokeWidth = lyr.stroke?.width ?? 1;
      const fillOpacity = lyr.opacity ?? 0.7;
      const fallbackFill = "#6aa9ff";

      const gTag = getOrCreateTagGroup(tag);

      // key by stable ids if present
      const keyFn = (d: any, i: number) =>
        d.id ?? d.properties?.id ?? d.properties?.osm_id ?? i;

      const sel = gTag
        .selectAll<SVGPathElement, any>("path.geom")
        .data(fc.features, keyFn);

      sel.exit().remove();

      const enter = sel.enter().append("path").attr("class", "geom");

      const geomSel = enter
        .merge(sel as any)
        .attr("d", path as any)
        .style("fill", (d: any) => {
          const v = attr ? Number(d?.properties?.[attr]) : undefined;
          return attr && colorScale && Number.isFinite(v)
            ? colorScale(v!)
            : fallbackFill;
        })
        .style("fill-opacity", fillOpacity)
        .style("stroke", strokeColor)
        .style("stroke-width", strokeWidth)
        .style("vector-effect", "non-scaling-stroke")
        .style("pointer-events", "all");

      // --- Interactions ---
      const interactions: InteractionSpec[] =
        tag === "buildings"
          ? [
              {
                interaction: "hover-highlight",
                action: "highlight+show",
                tooltipAccessor: (d: any) => {
                  const key = attr || "height";
                  const raw = d?.properties?.[key];
                  const val = Number(raw);
                  if (Number.isFinite(val)) {
                    return `Height: ${val.toFixed(1)} m`;
                  }
                  return `Building${raw != null ? ` (height: ${raw})` : ""}`;
                },
              },
              { interaction: "click", action: "remove" },
            ]
          : [{ interaction: "hover-highlight", action: "highlight" }];

      applyGeometryInteractions(
        geomSel,
        interactions,
        {
          tag,
          onRemoveFeature: (feature, tagName) => {
            console.log(
              `[Viewport ${id}] remove feature via helper`,
              tagName,
              feature
            );
          },
        },
        strokeWidth
      );

      // --- Bounds update ---
      const tmp = L.geoJSON(fc);
      const b = tmp.getBounds();
      if (b.isValid()) {
        unionBounds = unionBounds ? unionBounds.extend(b) : b;
      }
      tmp.remove();
    }
  }

  if (unionBounds && unionBounds.isValid()) {
    map.fitBounds(unionBounds, { padding: [12, 12] });
  }
}
