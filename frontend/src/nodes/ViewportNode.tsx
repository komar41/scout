import { memo, useCallback, useEffect, useRef } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./ViewportNode.css";
import restartPng from "../assets/restart.png";

export type ViewportNodeData = {
  /** optional initial center/zoom if you want to override later */
  center?: [number, number];
  zoom?: number;
  onClose?: (id: string) => void;
  onRun?: (id: string) => void;

  // Have to add that physical layer data here optional
  // and view spec also optional
};

export type ViewportNode = Node<ViewportNodeData, "viewportNode">;

const ViewportNode = memo(function ViewportNode({
  id,
  data,
  selected,
}: NodeProps<ViewportNode>) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const rf = useReactFlow();

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

  const onClose = useCallback(() => {
    if (data?.onClose) return data.onClose(id);
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [data, id, rf]);

  const onRun = useCallback(() => {
    if (data?.onRun) return data.onRun(id);
    console.log(data);
    leafletRef.current?.invalidateSize();
    console.log(`[ViewportNode] re-run map refresh`, id);
  }, [data, id]);

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
          onPointerDown={(e) => e.stopPropagation()} // ⬅️ block node drag start
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

      {/* connectors if you want to wire it up later */}
      <Handle
        type="target"
        position={Position.Left}
        className="vpnode__handle vpnode__handle--left"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="vpnode__handle vpnode__handle--right"
      />
    </div>
  );
});

export default ViewportNode;
