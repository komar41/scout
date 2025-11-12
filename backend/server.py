from __future__ import annotations
from copyreg import pickle
import gzip
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import os, sys, signal, shutil
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Polygon
from flask import send_from_directory, abort
from convert_to_raster import convert_raster
import osmnx as ox
import pickle, gzip

app = Flask(__name__)
CORS(app)

DATA_DIR = Path("data")        
OUT_DIR  = Path("data/served")
vector_subdir = Path(OUT_DIR / "vector")
raster_subdir = Path(OUT_DIR / "raster")
OUT_DIR.mkdir(parents=True, exist_ok=True)
vector_subdir.mkdir(parents=True, exist_ok=True)
raster_subdir.mkdir(parents=True, exist_ok=True)

# Remove cached outputs on exit
def cleanup_served():
    try:
        out_resolved = OUT_DIR.resolve()
        data_resolved = DATA_DIR.resolve()
        if data_resolved in out_resolved.parents and out_resolved.name == "served":
            if OUT_DIR.exists():
                shutil.rmtree(OUT_DIR, ignore_errors=True)
                print(f"[CLEANUP] Removed {OUT_DIR}")
        else:
            print(f"[CLEANUP] Refusing to remove unexpected path: {OUT_DIR}")
    except Exception as e:
        app.logger.error(f"[CLEANUP] Failed: {e}")

def register_cleanup_handlers():
    import atexit
    atexit.register(cleanup_served)

    def _handler(sig, frame):
        cleanup_served()
        sys.exit(0)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _handler)
        except Exception:
            pass

if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    register_cleanup_handlers()

# Utility functions
def resolve_feather_path(datafile: str, tag: str) -> Path:
    feather_filename = f"{datafile}/{tag}.feather"
    return DATA_DIR / feather_filename

def load_roi_mask(roi: dict) -> tuple[str, object]:
    rtype = roi.get("type")
    val = roi.get("value")
    if rtype == "bbox":
        xmin, ymin, xmax, ymax = map(float, val)
        return "bbox", (xmin, ymin, xmax, ymax)
    
    elif rtype == "geojson":
        roi_path = Path(val)
        roi_path = DATA_DIR / str(val)

        # Try this later in notebook and then add.. 

        # mask_gdf = gpd.read_file(roi_path)
        # mask = mask_gdf.union_all()
        # return "mask", gpd.GeoDataFrame(geometry=[mask], crs=mask_gdf.crs)

def crop_gdf(gdf: gpd.GeoDataFrame, roi_dict: dict) -> gpd.GeoDataFrame:
    roi_kind, roi = load_roi_mask(roi_dict)

    if roi_kind == "bbox":
        xmin, ymin, xmax, ymax = roi
        return gdf.cx[xmin:xmax, ymin:ymax]
    else:
        mask_gdf = roi  
        if mask_gdf.crs is None:
            mask_gdf = mask_gdf.set_crs(4326, allow_override=True)

        return gpd.clip(gdf, mask_gdf)
    
def select_features(gdf: gpd.GeoDataFrame, features: list[str]) -> gpd.GeoDataFrame:
    existing = [f for f in features if f in gdf.columns]
    cols = existing + (["geometry"] if "geometry" in gdf.columns else [])
    
    return gdf[cols]

@app.get("/generated/<path:filename>")
def serve_generated(filename: str):
    # Only allow .geojson files from OUT_DIR
    if not filename.lower().endswith(".geojson"):
        abort(404)
    return send_from_directory(
        OUT_DIR, filename,
        mimetype="application/geo+json",  # fine if omitted; browsers still parse
        conditional=True                  # enables ETag/If-None-Match
    )

@app.post('/api/ingest-physical-layer')
def ingest_physical_layer():

    payload = request.get_json(silent=True) or {}
    pl = payload
    problems = []
    
    pl_id = pl.get("id")
    datafile = pl.get("datafile")
    roi = pl.get("region_of_interest") or {}

    print(f"Processing physical layer ID: {pl_id} with datafile: {datafile}")

    for lyr in (pl.get("layers") or []):
        print(lyr)
        tag = lyr.get("tag")
        features = lyr.get("features") or []
        try:
            src_path = resolve_feather_path(str(datafile), str(tag))
            if not src_path.is_file():
                raise FileNotFoundError(f"Missing source: {src_path}")
            print(f"    Loading data from: {src_path}")
            gdf = gpd.read_feather(src_path)

            gdf_cut = crop_gdf(gdf, roi)
            gdf_out = select_features(gdf_cut, features)

            out_name = f"vector/{pl_id}_{tag}.geojson"
            out_path = OUT_DIR / out_name
            
            gdf_out.to_file(out_path, driver="GeoJSON")

            if(tag == "roads"):
                roi_kind, roi_ = load_roi_mask(roi)
                if roi_kind == "bbox":
                    xmin, ymin, xmax, ymax = roi_
                    with gzip.open("./data/%s/roads.pkl.gz" % datafile, "rb") as f:
                        G = pickle.load(f)

                    nodes, _ = ox.graph_to_gdfs(G, nodes=True, edges=True, fill_edge_geometry=False)
                    mask = (
                        (nodes["y"] <= ymax) & (nodes["y"] >= ymin) &
                        (nodes["x"] <= xmax) & (nodes["x"] >= xmin)
                    )
                    node_ids = nodes.loc[mask].index
                    G_crop = G.subgraph(node_ids)

                    with gzip.open("%s/vector/%s_roads.pkl.gz" % (OUT_DIR, pl_id), "wb") as f:
                        pickle.dump(G_crop, f, protocol=pickle.HIGHEST_PROTOCOL)

                    print(f"Saved cropped road graph to: {OUT_DIR}/vector/{pl_id}_roads.pkl.gz")

        except Exception as e:
            error_msg = f"[ERROR] Layer {pl_id}:{tag} → {type(e).__name__}: {e}"
            print(error_msg)

            problems.append({
                "physical_layer_id": pl_id,
                "tag": tag,
                "error": str(e)
            })

    return jsonify({
        "status": "success" if not problems else "partial",
        "problems": problems
    }), 200 if not problems else 207  

@app.route("/api/update-physical-layer", methods=["POST"])
def update_physical_layer():
    data = request.get_json()
    print(data)
    pl_id = data["physicalLayerRef"]
    tag = data["tag"]
    geojson = data["geojson"]

    filename = f"vector/{pl_id}_{tag}.geojson"
    filepath = OUT_DIR / filename

    with open(filepath, "w") as f:
        json.dump(geojson, f)

    return jsonify({"status": "success"}), 200

@app.route("/api/convert-to-raster", methods=["POST"])
def convert_to_raster():
    data = request.get_json()
    pl_id = data["physicalLayerRef"]
    tag = data["tag"]
    feature = data["feature"]
    zoom = data["zoom"]
    dir = OUT_DIR

    # convert_raster(dir, pl_id, tag, feature, zoom)

    return jsonify({"status": "success"}), 200


if __name__ == '__main__':
    # remove old served before starting
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR, ignore_errors=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    vector_subdir.mkdir(parents=True, exist_ok=True)
    raster_subdir.mkdir(parents=True, exist_ok=True)

    app.run(host='0.0.0.0', port=5000, debug=True)