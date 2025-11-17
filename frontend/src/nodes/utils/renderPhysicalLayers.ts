// src/nodes/utils/renderPhysicalLayers.ts
import * as d3 from "d3";
import L from "leaflet";
import { getPropertyRangeFromGeoJSON, pickInterpolator } from "./helper";
import { applyGeometryInteractions } from "./geomInteractions";
import type { InteractionSpec } from "./geomInteractions";
import type { ParsedView, ParsedInteraction, PhysicalLayerDef } from "./types";

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

  // Remove old raster overlays from previous renders
  for (const overlay of rasterOverlays) {
    map.removeLayer(overlay);
  }
  rasterOverlays.clear();

  const physicalViews = parsedViews.filter((v) => v.physicalLayerRef);
  const thematicViews = parsedViews.filter((v) => v.thematicLayerRef);

  if (!physicalViews.length && !thematicViews.length) {
    clearAllSvgLayers();
    return;
  }

  clearAllSvgLayers();

  let unionBounds: L.LatLngBounds | null = null;
  const path = makeLeafletPath(map);

  for (const view of thematicViews) {
    const thId = view.thematicLayerRef;
    if (!thId) continue;
    if (view.type === "raster") {
      const z = view.zoom_level ?? 16;

      const tiles = await fetch(
        `http://127.0.0.1:5000/api/list-rasters/${thId}`
      ).then((r) => r.json());

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const name of tiles) {
        const [xStr, yStr] = name.replace(".png", "").split("_");
        const x = Number(xStr);
        const y = Number(yStr);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        // collect extents
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const url = `http://127.0.0.1:5000/generated/raster/${thId}/${name}`;

        const bounds = tileBoundsFromXYZ(x, y, z, map);

        // include opacity from view definition
        const overlay = L.imageOverlay(url, bounds, {
          opacity: (view as any).opacity ?? 1,
        });

        overlay.addTo(map);
        rasterOverlays.add(overlay);
      }

      // final union bounds (handles missing tiles!)
      if (minX !== Infinity) {
        const tileSize = 256;
        const nwPoint = L.point(minX * tileSize, minY * tileSize);
        const sePoint = L.point((maxX + 1) * tileSize, (maxY + 1) * tileSize);

        const nwLatLng = map.unproject(nwPoint, z);
        const seLatLng = map.unproject(sePoint, z);

        const rasterBounds = L.latLngBounds(nwLatLng, seLatLng);

        unionBounds = unionBounds
          ? unionBounds.extend(rasterBounds)
          : rasterBounds;
      }
    }
  }

  for (const view of physicalViews) {
    const plId = view.physicalLayerRef;
    if (!plId) continue;
    // ----- RASTER VIEWS -----
    if (view.type === "raster") {
      const z = view.zoom_level ?? 16;

      const tiles = await fetch(
        `http://127.0.0.1:5000/api/list-rasters/${plId}`
      ).then((r) => r.json()); // [ "16812_24353.png", ... ]

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      const filtered = tiles.filter((n) => n.endsWith("_.png"));

      for (const name of filtered) {
        const [xStr, yStr] = name.replace(".png", "").split("_");
        const x = Number(xStr);
        const y = Number(yStr);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        // collect extents
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        const url = `http://127.0.0.1:5000/generated/raster/${plId}/${name}`;

        // compute bounds for this tile at zoom z
        const bounds = tileBoundsFromXYZ(x, y, z, map); // you implement this

        // include opacity from view definition
        const overlay = L.imageOverlay(url, bounds, {
          opacity: (view as any).opacity ?? 1,
        });

        // L.rectangle(bounds, {
        //   weight: 1,
        //   fillOpacity: 0,
        // }).addTo(map);

        overlay.addTo(map);
        rasterOverlays.add(overlay);
        if (minX !== Infinity) {
          const tileSize = 256;
          const nwPoint = L.point(minX * tileSize, minY * tileSize);
          const sePoint = L.point((maxX + 1) * tileSize, (maxY + 1) * tileSize);

          const nwLatLng = map.unproject(nwPoint, z);
          const seLatLng = map.unproject(sePoint, z);

          const rasterBounds = L.latLngBounds(nwLatLng, seLatLng);

          unionBounds = unionBounds
            ? unionBounds.extend(rasterBounds)
            : rasterBounds;
        }
      }

      continue; // skip vector logic for this view
    }
    if (view.type !== "vector") continue;

    console.log(view);
    // If no id → invalid
    if (!plId) continue;

    // Find matching physical layer
    // const pl = physicalLayers.find((p) => p.id === plId);

    // Must exist AND must be vector
    if (view.type !== "vector") {
      continue;
    }

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
      const attr = lyr.fill?.attribute;
      const interp = pickInterpolator(lyr.fill?.colormap);
      const ext = getPropertyRangeFromGeoJSON(fc, attr);
      const colorScale =
        attr && interp
          ? d3.scaleSequential(interp).domain(ext ?? [0, 1])
          : null;

      const strokeColor = lyr.stroke?.color ?? "#222";
      const strokeWidth = lyr.stroke?.width ?? 1;
      const fillOpacity = lyr.opacity ?? 1;
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
