// types/physical-layer.ts
export type PhysicalLayer = {
  physical_layer: {
    id: string;
    region_of_interest: {
      type: string; // "bbox"
      value: number[]; // [minLon, minLat, maxLon, maxLat]
    };
    layers: Array<{
      name: string; // "buildings" | ...
      schema: {
        id: string; // "numeric"
        geometry: string; // "multipolygons" | ...
        features: {
          height: string; // "numeric"
        };
      };
    }>;
  };
};
