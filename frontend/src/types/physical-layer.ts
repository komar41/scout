// types/physical-layer.ts
export type PhysicalLayer = {
  physical_layer: {
    id: string;
    region_of_interest: {
      type: string; // "bbox"  // have to include geojson later and value accordingly
      value: number[]; // [minLon, minLat, maxLon, maxLat]
    };
    layers: Array<{
      tag: string; // "buildings" | ...

      features: Array<{
        height: string; // "numeric" // This has to be generic to support different types nd optional fields
      }>;
    }>;
  };
};
