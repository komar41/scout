// types/physical-layer.ts
export type PhysicalLayer = {
  physical_layer: {
    id: string;
    region_of_interest: {
      type: string; // "bbox"  // have to include geojson later and value accordingly
      value: number[]; // [minLon, minLat, maxLon, maxLat] // if bbox have to restrict to 4 numbers
      // if geojson, value has to be '.geojson' file
    };
    layers: Array<{
      tag: string; // "buildings" | ...

      features: Array<{
        height: string; // "numeric" // This has to be generic to support different types nd optional fields
      }>;
    }>;
  };
};
