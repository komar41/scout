export type TemplateKey =
  | "physical_layer"
  | "view"
  | "interaction"
  | "transformation";
// | "choice"
// | "join"

// for manhattan area
// "value": [
//   -73.995,
//   40.749,
//   -73.980,
//   40.757
// ]

export const physicalLayerTemplate = {
  physical_layer: {
    id: "baselayer-0",
    type: "vector",
    datafile: "chicago",
    region_of_interest: {
      type: "bbox",
      value: [-87.64, 41.88, -87.625, 41.89],
    },
    layers: [
      {
        tag: "buildings",
        features: ["height"],
      },
      {
        tag: "roads",
      },
    ],
  },
};

export const viewTemplate = {
  view: [
    {
      physical_layer: { ref: "baselayer-0" },
      type: "vector",
      zoom_pan: true,
      layers: [
        {
          tag: "buildings",
          style: {
            fill: { feature: "height", colormap: "greys" },
            stroke_color: "#333333",
            opacity: 0.8,
            "z-index": 1,
          },
        },
        {
          tag: "roads",
          style: { "z-index": 2, stroke_color: "#444444" },
        },
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

export const transformationTemplate = {
  transformation: {
    id: "rasters-baselayer-0",
    physical_layer: { ref: "baselayer-0" },
    operation: "rasterize",
    zoom: 16,
    layer: {
      tag: "buildings",
      feature: "height",
    },
  },
};

export const interactionTemplate = {
  interaction: {
    id: "interaction-0",
    physicalLayerRef: "baselayer-0",
    type: "click",
    action: "remove",
    layer: {
      tag: "buildings",
    },
  },
};

export const TEMPLATES: Record<TemplateKey, any> = {
  physical_layer: physicalLayerTemplate,
  view: viewTemplate,
  // choice: choiceTemplate,
  // join: joinTemplate,
  transformation: transformationTemplate,
  interaction: interactionTemplate,
};

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  physical_layer: "physical_layer",
  view: "view",
  // choice: "choice",
  // join: "join",
  transformation: "transformation",
  interaction: "interaction",
};

// -------------------------------------------
// Conversion to raster:
// -------------------------------------------

// from convert_to_raster import convert_raster

// input = "baselayer-0"
// tag = "buildings"
// feature = "height"
// zoom = 16
// output = "rasters-baselayer-0"

// convert_raster(input, tag, feature, zoom, output)

// -------------------------------------------
// Run shadow model:
// -------------------------------------------

// from deep_umbra import run_shadow_model

// input = 'rasters-baselayer-0'
// season = 'summer'
// colormap = 'Reds'
// output = 'acc-shadow-baselayer-0'

// run_shadow_model(input, season, colormap, output)
