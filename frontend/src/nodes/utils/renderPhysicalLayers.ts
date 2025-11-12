// src/nodes/utils/renderPhysicalLayers.ts
import * as d3 from "d3";
import L from "leaflet";
import { getPropertyRangeFromGeoJSON, pickInterpolator } from "./helper";
import { applyGeometryInteractions } from "./geomInteractions";
import type { InteractionSpec } from "./geomInteractions";
import type { ParsedView, ParsedInteraction, PhysicalLayerDef } from "./types";

type TagGroup = d3.Selection<SVGGElement, unknown, null, undefined>;

/**
 * Map ParsedInteraction -> InteractionSpec for a given layer.
 */
function buildInteractionSpecsForLayer(opts: {
  interactions: ParsedInteraction[];
  plId: string;
  tag: string;
  attr?: string;
}): InteractionSpec[] {
  const { interactions, plId, tag, attr } = opts;
  const relevant = interactions.filter(
    (i) => i.physicalLayerRef === plId && i.layer.tag === tag
  );

  const specs: InteractionSpec[] = [];

  for (const i of relevant) {
    // HOVER
    if (i.type === "hover") {
      if (i.action === "highlight") {
        specs.push({
          interaction: "hover-highlight",
          action: "highlight",
        });
        continue;
      }

      if (i.action === "highlight+show") {
        const featureKey = i.feature || attr || "height";

        specs.push({
          interaction: "hover-highlight",
          action: "highlight+show",
          tooltipAccessor: (d: any) => {
            const raw = d?.properties?.[featureKey];
            const num = Number(raw);

            if (Number.isFinite(num)) {
              return `${featureKey}: ${num.toFixed(2)}`;
            }
            if (raw != null) {
              return `${featureKey}: ${raw}`;
            }
            return tag;
          },
        });
        continue;
      }
    }

    // CLICK
    if (i.type === "click") {
      if (i.action === "remove") {
        specs.push({
          interaction: "click",
          action: "remove",
        });
        continue;
      }

      if (i.action === "modify_feature") {
        // You can extend InteractionSpec later to carry feature info / UI config.
        specs.push({
          interaction: "click",
          action: "modify_feature",
        } as any);
        continue;
      }
    }
  }

  return specs;
}

/**
 * Render all physical-layer views into the Leaflet+D3 overlay.
 */
export async function renderPhysicalLayersForViews(opts: {
  id: string;
  map: L.Map;
  parsedViews: ParsedView[];
  parsedInteractions: ParsedInteraction[];
  physicalLayers: PhysicalLayerDef[];
  clearAllSvgLayers: () => void;
  makeLeafletPath: (map: L.Map) => d3.GeoPath<any, d3.GeoPermissibleObjects>;
  getOrCreateTagGroup: (tag: string) => TagGroup;
  onDirty?: (args: {
    plId: string;
    tag: string;
    featureCollection: any;
  }) => void;
  shouldHandleClick: () => boolean;
}) {
  const {
    id,
    map,
    parsedViews,
    parsedInteractions,
    physicalLayers,
    clearAllSvgLayers,
    makeLeafletPath,
    getOrCreateTagGroup,
    onDirty,
    shouldHandleClick,
  } = opts;

  const physicalViews = parsedViews.filter((v) => v.physicalLayerRef);

  if (!physicalViews.length) {
    clearAllSvgLayers();
    return;
  }

  clearAllSvgLayers();

  let unionBounds: L.LatLngBounds | null = null;
  const path = makeLeafletPath(map);

  for (const view of physicalViews) {
    const plId = view.physicalLayerRef;

    // If no id → invalid
    if (!plId) continue;

    // Find matching physical layer
    const pl = physicalLayers.find((p) => p.id === plId);

    // Must exist AND must be vector
    if (!pl || pl.type !== "vector" || view.type !== "vector") {
      continue;
    }

    console.log(`[Viewport ${id}] Rendering physical layer ${plId}...`);

    // If you’ve already moved zIndex into ParsedLayer, just sort on a.zIndex / b.zIndex
    const layers = [...(view.layers ?? [])].sort((a: any, b: any) => {
      const za = (a as any).zIndex ?? 0;
      const zb = (b as any).zIndex ?? 0;
      return za - zb;
    });

    for (const lyr of layers) {
      const tag = lyr.tag;
      const url = `http://127.0.0.1:5000/generated/vector/${plId}_${tag}.geojson`;

      let fc: any;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fc = await res.json();
      } catch (err) {
        console.error(`[Viewport ${id}] Failed to fetch ${url}`, err);
        continue;
      }

      // --- styling ---
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

      // --- interactions from parsedInteractions ---
      const interactions = buildInteractionSpecsForLayer({
        interactions: parsedInteractions,
        plId,
        tag,
        attr,
      });
      if (interactions.length) {
        applyGeometryInteractions(
          geomSel,
          interactions,
          {
            tag,
            featureCollection: fc,
            shouldHandleClick,
            onCollectionChange: ({ tag: changedTag, featureCollection }) => {
              if (!onDirty) return;
              onDirty({
                plId,
                tag: changedTag,
                featureCollection,
              });
            },
          },
          strokeWidth
        );
      }

      // --- bounds ---
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
