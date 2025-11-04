export type TemplateKey = "physical_layer" | "view";
// | "choice"
// | "join"
// | "transformation"
// | "interaction";

export const physicalLayerTemplate = {
  physical_layer: {
    id: "baselayer-0",
    datafile: "chicago",
    region_of_interest: {
      type: "bbox",
      value: [-87.645, 41.875, -87.62, 41.895],
    },
    layers: [
      {
        tag: "buildings",
        features: ["height"],
      },
    ],
  },
};

export const viewTemplate = {
  view: [
    {
      physical_layer: { ref: "baselayer-0" },
      type: "vector",
      projection: "mercator",
      zoom_pan: true,
      layers: [
        {
          tag: "buildings",
          style: {
            fill: { feature: "height", colormap: "greys" },
            stroke_color: "#333333",
            opacity: 0.8,
          },
        },
        // {
        //   tag: "roads",
        //   style: { stroke_color: "#444444", width: 1.2 },
        // },
      ],
    },
    // {
    //   thematic_layer: { ref: "S1" },
    //   type: "raster",
    //   style: { colormap: "reds", legend: true, opacity: 0.7 },
    // },
  ],
};

export const choiceTemplate = { choice: {} };
export const joinTemplate = { join: {} };
export const transformationTemplate = { transformation: {} };
export const interactionTemplate = { interaction: {} };

export const TEMPLATES: Record<TemplateKey, any> = {
  physical_layer: physicalLayerTemplate,
  view: viewTemplate,
  // choice: choiceTemplate,
  // join: joinTemplate,
  // transformation: transformationTemplate,
  // interaction: interactionTemplate,
};

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  physical_layer: "physical_layer",
  view: "view",
  // choice: "choice",
  // join: "join",
  // transformation: "transformation",
  // interaction: "interaction",
};
