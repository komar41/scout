// src/nodes/utils/renderPhysicalLayers.ts
import * as d3 from "d3";
import L from "leaflet";
import { getPropertyRangeFromGeoJSON, pickInterpolator } from "./helper";
import { applyGeometryInteractions } from "./geomInteractions";
import type { InteractionSpec } from "./geomInteractions";
import type { ParsedView, ParsedInteraction } from "./types";

type TagGroup = d3.Selection<SVGGElement, unknown, null, undefined>;
const rasterOverlays = new Set<L.ImageOverlay>();
/**
 * Map ParsedInteraction -> InteractionSpec for a given layer.
 */

function tileBoundsFromXYZ(x: number, y: number, z: number, map: L.Map) {
  const tileSize = 256;

  const nwPoint = L.point(x * tileSize, y * tileSize);
  const sePoint = L.point((x + 1) * tileSize, (y + 1) * tileSize);

  const nwLatLng = map.unproject(nwPoint, z);
  const seLatLng = map.unproject(sePoint, z);

  return L.latLngBounds(nwLatLng, seLatLng);
}

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

// Helper: render a raster layer (physical or thematic) and update unionBounds.
async function renderRasterForView(opts: {
  map: L.Map;
  view: ParsedView;
  layerId: string;
  unionBounds: L.LatLngBounds | null;
}): Promise<L.LatLngBounds | null> {
  const { map, view, layerId, unionBounds } = opts;
  const z = (view as any).zoom_level ?? 16;

  const tiles: string[] = await fetch(
    `http://127.0.0.1:5000/api/list-rasters/${layerId}`
  ).then((r) => r.json());

  const cacheBust = Date.now();

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const name of tiles) {
    // ignore malformed tiles like "12345_.png"
    if (name.endsWith("_.png")) continue;

    const [xStr, yStr] = name.replace(".png", "").split("_");
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    const url = `http://127.0.0.1:5000/generated/raster/${layerId}/${name}?v=${cacheBust}`;
    // console.log("raster tile url:", url);

    const bounds = tileBoundsFromXYZ(x, y, z, map);

    const overlay = L.imageOverlay(url, bounds, {
      opacity: (view as any).opacity ?? 1,
    });

    overlay.addTo(map);
    rasterOverlays.add(overlay);
  }

  if (minX === Infinity) {
    return unionBounds;
  }

  const tileSize = 256;
  const nwPoint = L.point(minX * tileSize, minY * tileSize);
  const sePoint = L.point((maxX + 1) * tileSize, (maxY + 1) * tileSize);

  const nwLatLng = map.unproject(nwPoint, z);
  const seLatLng = map.unproject(sePoint, z);

  const rasterBounds = L.latLngBounds(nwLatLng, seLatLng);

  return unionBounds ? unionBounds.extend(rasterBounds) : rasterBounds;
}

export async function renderLayers(opts: {
  id: string;
  map: L.Map;
  parsedViews: ParsedView[];
  parsedInteractions: ParsedInteraction[];
  // physicalLayers: PhysicalLayerDef[];
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
    // physicalLayers,
    clearAllSvgLayers,
    makeLeafletPath,
    getOrCreateTagGroup,
    onDirty,
    shouldHandleClick,
  } = opts;

  // Remove old raster overlays from previous renders
  for (const overlay of rasterOverlays) {
    map.removeLayer(overlay);
  }
  rasterOverlays.clear();

  clearAllSvgLayers();

  const physicalViews = parsedViews.filter((v) => v.physicalLayerRef);
  const thematicViews = parsedViews.filter((v) => v.thematicLayerRef);

  // console.log(physicalViews, thematicViews);
  if (!physicalViews.length && !thematicViews.length) {
    return;
  }

  let unionBounds: L.LatLngBounds | null = null;
  const path = makeLeafletPath(map);

  // --- Thematic (non-physical) views ---
  for (const view of thematicViews) {
    const thId = view.thematicLayerRef;
    if (!thId) continue;

    if (view.type === "raster") {
      unionBounds = await renderRasterForView({
        map,
        view,
        layerId: thId,
        unionBounds,
      });
    }
  }

  // --- Physical views ---
  for (const view of physicalViews) {
    const plId = view.physicalLayerRef;
    if (!plId) continue;

    // Physical raster views
    if (view.type === "raster") {
      unionBounds = await renderRasterForView({
        map,
        view,
        layerId: plId,
        unionBounds,
      });
      continue; // skip vector logic for this view
    }

    // Only handle vector physical views here
    if (view.type !== "vector") continue;

    // Find matching physical layer
    // const pl = physicalLayers.find((p) => p.id === plId);

    // console.log(`[Viewport ${id}] Rendering physical layer ${plId}...`);

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
      const geomType = (lyr as any)["geom-type"];

      const isPolygonLayer =
        geomType === "polygon" || geomType === "multipolygon";
      const isLineLayer = geomType === "linestring";
      const isPointLayer = geomType === "point";

      let attr: string | undefined;
      let colormapName: string | undefined;
      let solidFill: string | undefined;

      if ((isPolygonLayer || isPointLayer) && lyr.fill) {
        if (typeof lyr.fill === "string") {
          // solid color fill
          solidFill = lyr.fill;
        } else if ("attribute" in (lyr.fill as any)) {
          attr = (lyr.fill as any).attribute;
          colormapName = (lyr.fill as any).colormap;
        }
      }

      const interp = attr ? pickInterpolator(colormapName) : null;
      const ext = attr ? getPropertyRangeFromGeoJSON(fc, attr) : null;
      const colorScale =
        attr && interp && ext
          ? d3.scaleSequential(interp).domain(ext ?? [0, 1])
          : null;

      const strokeColor = lyr.stroke?.color ?? "#000";
      const strokeWidth = lyr.stroke?.width ?? 1;
      const layerOpacity = lyr.opacity ?? 1;

      // point radius from parser (default 4px)

      if (isPointLayer && typeof (path as any).pointRadius === "function") {
        // d3-geo point rendering uses this
        const pointRadius = (lyr as any).size ?? 4;
        (path as any).pointRadius(pointRadius);
      }

      const nTag = `${plId}::${tag}`;
      const gTag = getOrCreateTagGroup(nTag);

      const configuredRadius = (lyr as any).size ?? 4; // radius in px

      // Store metadata for redrawAll
      (gTag as any)._geomType = geomType;
      (gTag as any)._isPointLayer = isPointLayer;
      (gTag as any)._pointRadius = configuredRadius;

      const keyFn = (d: any, i: number) =>
        d.id ?? d.properties?.id ?? d.properties?.osm_id ?? i;

      const sel = gTag
        .selectAll<SVGPathElement, any>("path.geom")
        .data(fc.features, keyFn);

      sel.exit().remove();

      if (isLineLayer) {
        if (lyr.border) {
          const borderColor = lyr.border?.color ?? "#fff"; // or whatever default
          const borderWidth = lyr.border?.width ?? 0;

          // console.log(
          //   `Rendering borders for line layer ${nTag}:`,
          //   borderColor,
          //   borderWidth
          // );
          const borderSel = gTag
            .selectAll<SVGPathElement, any>("path.geom-border")
            .data(fc.features, keyFn);

          borderSel.exit().remove();

          const borderEnter = borderSel
            .enter()
            .append("path")
            .attr("class", "geom-border");

          borderEnter
            .merge(borderSel as any)
            .attr("d", path as any)
            .style("fill", "none")
            .style("stroke", borderColor)
            .style("stroke-width", borderWidth) // slightly thicker than inner line
            .style("stroke-opacity", layerOpacity)
            .style("vector-effect", "non-scaling-stroke")
            .style("pointer-events", "none"); // so clicks go to the inner path
        }
      }

      const enter = sel.enter().append("path").attr("class", "geom");
      // console.log(strokeColor, strokeWidth);
      const geomSel = enter
        .merge(sel as any)
        .attr("d", path as any)
        .style("fill", (d: any) => {
          const gType = d?.geometry?.type;
          const isLineFeature =
            gType === "LineString" ||
            gType === "MultiLineString" ||
            isLineLayer;

          // Lines: no fill
          if (isLineFeature) return "none";

          // Solid fill from parser (polygons or points)
          if (solidFill) return solidFill;

          // Polygon: attribute-based colormap from parser
          if (attr && colorScale) {
            const v = Number(d?.properties?.[attr]);
            if (Number.isFinite(v)) return colorScale(v);
          }

          // Fallback polygon fill
          return "none";
        })
        .style("fill-opacity", (d: any) => {
          const gType = d?.geometry?.type;
          const isLineFeature =
            gType === "LineString" ||
            gType === "MultiLineString" ||
            isLineLayer;
          return isLineFeature ? 0 : layerOpacity;
        })
        .style("stroke", strokeColor)
        .style("stroke-width", strokeWidth)
        .style("stroke-opacity", layerOpacity)
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
