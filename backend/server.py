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
from deep_umbra import run_shadow_model
from download_data import download_osm_data, extract_roads, extract_buildings
import osmnx as ox
import pickle, gzip

from weather_routing import *
import subprocess
import tempfile

import threading
import json as jsonlib

worker_proc = None
worker_lock = threading.Lock()
worker_python_exe = None


app = Flask(__name__)
CORS(app)

DATA_DIR = Path("data")        
OUT_DIR  = Path("data/served")
vector_subdir = Path(OUT_DIR / "vector")
raster_subdir = Path(OUT_DIR / "raster")
OUT_DIR.mkdir(parents=True, exist_ok=True)
vector_subdir.mkdir(parents=True, exist_ok=True)
raster_subdir.mkdir(parents=True, exist_ok=True)

def start_worker():
    global worker_proc, worker_python_exe

    if worker_proc is not None and worker_proc.poll() is None:
        # already running
        return

    project_dir = Path(__file__).parent
    python_exe = project_dir / "envs" / ("python.exe" if os.name == "nt" else "bin/python")

    if not python_exe.exists():
        raise RuntimeError(f"Python interpreter not found at: {python_exe}")

    worker_python_exe = python_exe

    # -u for unbuffered so we can get output immediately
    worker_proc = subprocess.Popen(
        [str(python_exe), "-u", "python_worker.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(project_dir),
        env={**os.environ, "PYTHONPATH": str(project_dir) + os.pathsep + os.environ.get("PYTHONPATH", "")},
        bufsize=1,  # line-buffered
    )

    print("[WORKER] Started python_worker process PID:", worker_proc.pid)

def send_code_to_worker(code: str) -> dict:
    """
    Sends code to the persistent worker and returns a dict:
    { "ok": bool, "stdout": str, "stderr": str }
    """
    global worker_proc

    if worker_proc is None or worker_proc.poll() is not None:
        start_worker()

    # Ensure only one thread talks to the worker at a time
    with worker_lock:
        req = {"code": code}
        line = jsonlib.dumps(req) + "\n"

        # send
        assert worker_proc.stdin is not None
        worker_proc.stdin.write(line)
        worker_proc.stdin.flush()

        # receive one line
        assert worker_proc.stdout is not None
        resp_line = worker_proc.stdout.readline()
        if not resp_line:
            # worker died unexpectedly
            raise RuntimeError("Worker process terminated unexpectedly")

    resp = jsonlib.loads(resp_line)
    return resp

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

@app.get("/api/list-rasters/<plId>")
def list_rasters(plId: str):
    """
    Return a JSON list of PNG raster tiles inside:
    data/served/raster/<plId>/
    """
    # Resolve folder safely
    folder = raster_subdir / plId

    # Security: ensure path is inside raster_subdir
    try:
        folder.resolve().relative_to(raster_subdir.resolve())
    except Exception:
        return jsonify({"error": "Invalid raster folder"}), 403

    # Check folder exists
    if not folder.exists() or not folder.is_dir():
        return jsonify([]), 200   # return empty list

    # Collect *.png files
    files = [
        f.name
        for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() == ".png"
    ]

    return jsonify(files), 200

@app.get("/generated/raster/<path:filename>")
def serve_raster(filename: str):
    # works: http://127.0.0.1:5000/generated/raster/rasters-baselayer-0/16812_24353.png
    if not filename.lower().endswith(".png"):
        abort(404)

    # Resolve safe absolute path (prevents directory traversal)
    full_path = raster_subdir / filename
    try:
        full_path.resolve().relative_to(raster_subdir.resolve())
    except Exception:
        abort(403)  # Forbidden

    # parent directory + file name
    directory = full_path.parent
    file = full_path.name

    return send_from_directory(
        directory,
        file,
        mimetype="image/png",
        conditional=True
    )

@app.get("/generated/vector/<path:filename>")
def serve_vector(filename: str):
    if not filename.lower().endswith(".geojson"):
        abort(404)

    return send_from_directory(
        vector_subdir,
        filename,
        mimetype="application/geo+json",
        conditional=True
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

            # if(tag == "roads"):
            #     roi_kind, roi_ = load_roi_mask(roi)
            #     if roi_kind == "bbox":
            #         xmin, ymin, xmax, ymax = roi_
            #         with gzip.open("./data/%s/roads.pkl.gz" % datafile, "rb") as f:
            #             G = pickle.load(f)

            #         nodes, _ = ox.graph_to_gdfs(G, nodes=True, edges=True, fill_edge_geometry=False)
            #         mask = (
            #             (nodes["y"] <= ymax) & (nodes["y"] >= ymin) &
            #             (nodes["x"] <= xmax) & (nodes["x"] >= xmin)
            #         )
            #         node_ids = nodes.loc[mask].index
            #         G_crop = G.subgraph(node_ids).copy()

            #         with gzip.open("%s/vector/%s_roads.pkl.gz" % (OUT_DIR, pl_id), "wb") as f:
            #             pickle.dump(G_crop, f, protocol=pickle.HIGHEST_PROTOCOL)

            #         print(f"Saved cropped road graph to: {OUT_DIR}/vector/{pl_id}_roads.pkl.gz")

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
    # Using code node instead of using this api from grammar!
    data = request.get_json()
    pl_id = data["physical_layer"]["ref"]
    id = data["id"]
    tag = data["layer"]["tag"]
    feature = data["layer"]["feature"]
    zoom = data["zoom"]

    convert_raster(pl_id, tag, feature, zoom, id)

    return jsonify({"status": "success"}), 200

@app.route('/weather', methods=["POST"])
def calculate_weather_aware_route():
    data = request.get_json()
    datafile = data["city"]
    origin = data["origin"]
    destination = data["destination"]
    bbox = data["bbox"] # Bounding box, assuming its sent as [ymax, ymin, xmax, xmin]
    map_view_mode = data["map_view_mode"]
    K_variable_paths = data["paths"]
    weather_conditions = data["weather"]
    weather_weights = data["weights"]
    time = data["time"]
    
    
    route_coords = calculate_weather_route(datafile, 
                            origin, 
                            destination,
                            bbox, 
                            map_view_mode,
                            K_variable_paths,
                            weather_conditions,
                            weather_weights,
                            time)


    return jsonify({"route_coords": route_coords}), 200

@app.post("/api/run-python")
def run_python():
    payload = request.get_json() or {}
    code = payload.get("code", "")

    print("Received code to run:\n", code)

    try:
        resp = send_code_to_worker(code)
        # resp: {"ok": bool, "stdout": "...", "stderr": "..."}

        return jsonify({
            "stdout": resp.get("stdout", ""),
            "stderr": resp.get("stderr", ""),
            "returncode": 0 if resp.get("ok") else 1,
        }), 200

    except Exception as e:
        # If something goes really wrong (worker dead, etc.)
        return jsonify({
            "stdout": "",
            "stderr": f"Worker error: {e}",
            "returncode": -1,
        }), 200


if __name__ == '__main__':
    # remove old served before starting
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR, ignore_errors=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    vector_subdir.mkdir(parents=True, exist_ok=True)
    raster_subdir.mkdir(parents=True, exist_ok=True)

    # Start the worker up-front (or you can let send_code_to_worker lazily do it)
    try:
        start_worker()
    except Exception as e:
        print("[WORKER] Failed to start:", e)

    app.run(host='0.0.0.0', port=5000, debug=True)