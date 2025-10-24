// types/physical-layer.ts
export type PhysicalLayer = {
  physical_layer: {
    id: string;
    region_of_interest: {
      type: string; // "bbox"  // have to include geojson later and value accordingly
      value: number[]; // [minLon, minLat, maxLon, maxLat]
    };
    layers: Array<{
      name: string; // "buildings" | ...
      schema: {
        id: string; // "numeric"
        geometry: string; // "multipolygons" | ... // not required. remove later.
        features: {
          height: string; // "numeric" // This has to be generic to support different types nd optional fields
        };
      };
    }>;
  };
};
