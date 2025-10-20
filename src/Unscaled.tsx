// Unscaled.tsx (same as before, with the added style var)
import React, { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@xyflow/react";

export default function Unscaled({ children }: { children: React.ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <div
        style={{
          // inverse the RF zoom to keep pointer math correct
          position: "absolute",
          inset: 0,
          transform: `scale(${1 / zoom})`,
          transformOrigin: "top left",
          width: size.w * zoom,
          height: size.h * zoom,
          // expose zoom for inner CSS
          ["--rfz" as any]: String(zoom),
        }}
      >
        {children}
      </div>
    </div>
  );
}
