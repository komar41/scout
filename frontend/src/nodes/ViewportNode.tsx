import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Position, NodeResizer, useReactFlow, Handle } from "@xyflow/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./ViewportNode.css";
import restartPng from "../assets/restart.png";
import * as d3 from "d3";
import { PhysicalLayerDef, ViewDef, ParsedView } from "./utils/types";
import { parseView } from "./utils/parser";
import { getPropertyRangeFromGeoJSON, pickInterpolator } from "./utils/helper";
import { applyGeometryInteractions } from "./utils/geomInteractions";
import type { InteractionSpec } from "./utils/geomInteractions";

export type ViewportNodeData = {
  center?: [number, number];
  zoom?: number;
  onClose?: (id: string) => void;
  onRun?: (id: string) => void;
  physical_layers?: PhysicalLayerDef[];
  view?: ViewDef[];
};

export type ViewportNode = Node<ViewportNodeData, "viewportNode">;

const ViewportNode = memo(function ViewportNode({
  id,
  data,
  selected,
}: NodeProps<ViewportNode>) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);

  // ---- D3 / SVG overlay refs ----
  const svgLayerRef = useRef<L.SVG | null>(null);
  const overlaySvgRef = useRef<d3.Selection<
    SVGSVGElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const gRootRef = useRef<d3.Selection<
    SVGGElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const gByTagRef = useRef<
    Map<string, d3.Selection<SVGGElement, unknown, null, undefined>>
  >(new Map());

  const rf = useReactFlow();

  // Leaflet-aware D3 path generator
  const makeLeafletPath = useCallback((map: L.Map) => {
    const projectPoint = function (this: any, x: number, y: number) {
      const point = map.latLngToLayerPoint([y, x]); // [lat, lon] -> layer point
      this.stream.point(point.x, point.y);
    };
    const transform = d3.geoTransform({ point: projectPoint as any });
    return d3.geoPath(transform as any);
  }, []);

  const getOrCreateTagGroup = useCallback((tag: string) => {
    const m = gByTagRef.current;
    if (m.has(tag)) return m.get(tag)!;
    const gRoot = gRootRef.current!;
    const g = gRoot.append("g").attr("class", `tag-${tag}`);
    m.set(tag, g);
    return g;
  }, []);

  const clearAllSvgLayers = useCallback(() => {
    gByTagRef.current.forEach((g) => g.remove());
    gByTagRef.current.clear();
  }, []);

  // Redraw all feature paths when the map moves/zooms
  const redrawAll = useCallback(() => {
    const map = leafletRef.current;
    if (!map) return;
    const path = makeLeafletPath(map);
    gByTagRef.current.forEach((g) => {
      g.selectAll<SVGPathElement, any>("path.geom").attr("d", path as any);
    });
  }, [makeLeafletPath]);

  const loadFromView = useCallback(
    async (nodeData?: ViewportNodeData) => {
      const map = leafletRef.current;

      // If map not ready OR no spec -> clear drawings and bail
      if (!map || !nodeData?.view?.length || !nodeData.physical_layers) {
        if (map) clearAllSvgLayers();
        return;
      }

      // parse only first view for now
      const parsed = parseView({ view: nodeData.view });
      const view = parsed[0];
      if (!view) return;

      const plId = view.physicalLayerRef;
      if (!plId) return; // (thematic layer TODO)

      // simplest: clear previous drawings (you can optimize later with per-tag diff)
      clearAllSvgLayers();

      let unionBounds: L.LatLngBounds | null = null;
      const path = makeLeafletPath(map);

      for (const lyr of view.layers ?? []) {
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

        // color scale (optional)
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

        // key by common ids if present
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

        // Decide interactions based on tag
        const interactions: InteractionSpec[] =
          tag === "buildings"
            ? [
                {
                  interaction: "hover-highlight",
                  action: "highlight+show",
                  tooltipAccessor: (d: any) => {
                    // Prefer whatever attribute is configured, fallback to "height"
                    const key = attr || "height";
                    const raw = d?.properties?.[key];

                    const val = Number(raw);
                    if (Number.isFinite(val)) {
                      return `Height: ${val.toFixed(1)} m`;
                    }

                    // fallback label if no numeric height
                    return `Building${raw != null ? ` (height: ${raw})` : ""}`;
                  },
                },
                {
                  interaction: "click",
                  action: "remove",
                },
              ]
            : [
                {
                  interaction: "hover-highlight",
                  action: "highlight",
                },
              ];

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

        // compute bounds quickly using Leaflet's helper
        const tmp = L.geoJSON(fc);
        const b = tmp.getBounds();
        if (b.isValid()) unionBounds = unionBounds ? unionBounds.extend(b) : b;
        tmp.remove();
      }

      if (unionBounds && unionBounds.isValid()) {
        map.fitBounds(unionBounds, { padding: [12, 12] });
      }

      map.invalidateSize();
      // paths will auto-reproject because we listen for map move/zoom in init
    },
    [clearAllSvgLayers, getOrCreateTagGroup, id, makeLeafletPath]
  );

  // Init Leaflet + SVG overlay once
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const map = L.map(mapRef.current, {
      attributionControl: false,
      preferCanvas: true,
    });

    const center: [number, number] = data?.center ?? [41.881, -87.63];
    const zoom = data?.zoom ?? 14;
    map.setView(center, zoom);

    // white background (tile hidden via opacity: 0)
    L.tileLayer(
      "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        opacity: 0,
      }
    ).addTo(map);

    // SVG overlay
    const svgLayer = L.svg().addTo(map);
    const overlaySvg = d3.select(svgLayer._container as SVGSVGElement);
    const gRoot = overlaySvg.append("g").attr("class", "d3-layer");

    leafletRef.current = map;
    svgLayerRef.current = svgLayer;
    overlaySvgRef.current = overlaySvg;
    gRootRef.current = gRoot;

    // reproject on pan/zoom
    const onMove = () => redrawAll();
    map.on("zoom viewreset move", onMove);

    return () => {
      try {
        map.off("zoom viewreset move", onMove);
        clearAllSvgLayers();
        // remove the appended root
        gRootRef.current?.remove();
        gRootRef.current = null;
        overlaySvgRef.current = null;

        if (svgLayerRef.current) {
          map.removeLayer(svgLayerRef.current);
          svgLayerRef.current = null;
        }
        map.remove();
      } catch {
        /* ignore */
      } finally {
        leafletRef.current = null;
      }
    };
  }, [data?.center, data?.zoom, clearAllSvgLayers, redrawAll]);

  // Keep map sized
  useEffect(() => {
    if (!leafletRef.current) return;
    const observer = new ResizeObserver(() =>
      leafletRef.current?.invalidateSize()
    );
    if (mapRef.current) observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-run when `data` changes (any change)
  useEffect(() => {
    if (!leafletRef.current) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        await loadFromView(data);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error(e);
      }
    })();

    return () => ctrl.abort();
  }, [data, loadFromView]);

  const onClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  const onRun = useCallback(() => {
    if (data?.onRun) return data.onRun(id);
    // manual refresh if needed
    loadFromView(data);
  }, [data, loadFromView]);

  return (
    <div className="vpnode">
      <NodeResizer isVisible={!!selected} />

      <div className="vpnode__header">
        <div className="vpnode__title">Viewport</div>
        <button
          type="button"
          className="vpnode__iconBtn vpnode__iconBtn--close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="vpnode__body">
        <div
          ref={mapRef}
          className="vpnode__map nodrag nowheel"
          aria-label={`Leaflet map for ${id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>

      <div className="vpnode__footer">
        <button
          type="button"
          onClick={onRun}
          title="Re-run"
          aria-label="Re-run"
          className="vpnode__actionBtn"
        >
          <img src={restartPng} alt="Re-run" className="vpnode__actionIcon" />
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="left-handle"
        className="vpnode__handle vpnode__handle--left"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-handle"
        className="vpnode__handle vpnode__handle--right"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="top-handle"
        className="vpnode__handle vpnode__handle--bottom"
      />
    </div>
  );
});

export default ViewportNode;
