import { memo, useEffect, useRef } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./RenderNode.css";
import restartPng from "../assets/restart.png";

export type RenderNodeData = {
  /** optional initial center/zoom if you want to override later */
  center?: [number, number];
  zoom?: number;
};

export type RenderNode = Node<RenderNodeData, "renderNode">;

const RenderNode = memo(function RenderNode({
  id,
  data,
  selected,
}: NodeProps<RenderNode>) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    // Create a *blank* map: no tile layer, no controls
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      // keep gestures available; adjust if you want to lock it down
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    });

    // Default center Chicago loop. But later has to be set via the data!
    const center: [number, number] = data?.center ?? [41.881, -87.63];
    const zoom = data?.zoom ?? 14;
    map.setView(center, zoom);

    // ✅ Add a visible tile layer (pick one)
    L.tileLayer(
      "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }
    ).addTo(map);

    // Keep a ref for cleanup
    leafletRef.current = map;

    return () => {
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      leafletRef.current = null;
    };
  }, [data?.center, data?.zoom]);

  useEffect(() => {
    if (!leafletRef.current) return;

    const observer = new ResizeObserver(() => {
      leafletRef.current?.invalidateSize();
    });

    if (mapRef.current) observer.observe(mapRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="rnode">
      <NodeResizer isVisible={!!selected} />

      <div className="rnode__header">
        <div className="rnode__title">Render</div>
        <button
          type="button"
          className="rnode__iconBtn rnode__iconBtn--close"
          //   onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="rnode__body">
        <div
          ref={mapRef}
          className="rnode__map nodrag nowheel"
          aria-label={`Leaflet map for ${id}`}
          onPointerDown={(e) => e.stopPropagation()} // ⬅️ block node drag start
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>

      <div className="rnode__footer">
        <button
          type="button"
          //   onClick={onRun}
          title="Re-run"
          aria-label="Re-run"
          className="rnode__actionBtn"
        >
          <img src={restartPng} alt="Re-run" className="rnode__actionIcon" />
        </button>
      </div>

      {/* connectors if you want to wire it up later */}
      <Handle
        type="target"
        position={Position.Left}
        className="rnode__handle rnode__handle--left"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="rnode__handle rnode__handle--right"
      />
    </div>
  );
});

export default RenderNode;
