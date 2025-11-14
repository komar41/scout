import osmnx as ox
import networkx as nx

from load_static import DataLoader
from calculate_isochrones import calculate_isochrones
from weight_calculation import GNN_weight_calculations

def calculate_weather_route(datafile, 
                            origin, 
                            destination,
                            bbox,
                            map_view_mode,
                            K_variable_paths,
                            weather_conditions,
                            weather_weights,
                            time):
    BASE_PATH = "./data/weather/"
    
    rain_weight = 0.85834
    heat_weight = 0.01
    wind_weight = 0.01
    humidity_weight = 0.01
    
    
    
    ymax = bbox[0] 
    ymin = bbox[1]
    xmax = bbox[2]
    xmin = bbox[3]
    
    data_loader = DataLoader()
    
    # Load the dataset
    G_total = data_loader.load_graph(graph_path=datafile)
   
    
    # Crop the dataset
    
    nodes, _ = ox.graph_to_gdfs(G_total, nodes=True, edges=True, fill_edge_geometry=False)
    mask = (
        (nodes["y"] <= ymax) & (nodes["y"] >= ymin) &
        (nodes["x"] <= xmax) & (nodes["x"] >= xmin)
    )
    node_ids = nodes.loc[mask].index
    G_crop = G_total.subgraph(node_ids)

    
    # Load the weather
    
    rain_data, rain_lats, rain_lons, rain_ds = data_loader.load_rain_data(
        rain_data_path= BASE_PATH + "RAIN.nc"
    )
        
    heat_data, heat_lats, heat_lons, heat_ds = data_loader.load_heat_index_data(
        heat_index_path= BASE_PATH + "T2.nc"
    )
    wind_speed_data, wind_dir_data, wind_lats, wind_lons, wind_speed_ds, wind_dir_ds = data_loader.load_wind_data(
        wind_speed_path= BASE_PATH + "WSPD10.nc",
        wind_direction_path= BASE_PATH + "WDIR10.nc"
    )
    humidity_data, hum_lats, hum_lons, humidity_ds = data_loader.load_relative_humidity_data(
        rh_data_path= BASE_PATH + "RH2.nc"
    )
    
    # Obtain valid origin and destination points
    orig_node = ox.distance.nearest_nodes(G_crop, X=origin[1], Y=origin[0])
    dest_node = ox.distance.nearest_nodes(G_crop, X=destination[1], Y=destination[0])

    # Calculate isochrones

    route = nx.shortest_path(G_crop, orig_node, dest_node, weight="travel_time")
    trip_times_seconds = calculate_isochrones(G_crop, orig_node, route)

    GNN_weight_calculations(G_crop, rain_lats, rain_lons,
                            rain_ds=rain_ds,
                            heat_ds=heat_ds,
                            wind_speed_ds=wind_speed_ds,
                            wind_dir_ds=wind_dir_ds,
                            humidity_ds=humidity_ds,
                            rain_data=rain_data,
                            heat_data=heat_data,
                            wind_speed_data=wind_speed_data,
                            wind_dir_data=wind_dir_data,
                            humidity_data=humidity_data,
                            time=time,
                            trip_time_seconds=trip_times_seconds,
                            rain_weight=rain_weight,
                            heat_weight=heat_weight,
                            wind_weight=wind_weight,
                            humidity_weight=humidity_weight)
    
    routes_data = []
    
    if map_view_mode == "Optimized":
        route_fastest = nx.shortest_path(G_crop, orig_node, dest_node, weight="travel_time")
        route_total = nx.shortest_path(G_crop, orig_node, dest_node, weight="total_weight")
        routes_data.append({
                        'route': route_fastest,
                        'weight_type': "quickest_path",
                        'route_index': 0
                    })
        routes_data.append({
                        'route': route_total,
                        'weight_type': "total_weight",
                        'route_index': 1
                    })
    
    elif map_view_mode == "Variable":

        # For future reference, the k_shortest_paths and shortest_paths are the ones that acually return a list of osm ID's
        for weight in weather_conditions:
            # calculate route optimized for every selected weight
            try:
                print(f"Calculating route optimized for {weight}...")
                # Use Yen's algorithm for k-shortest paths
                k_paths = list(ox.routing.k_shortest_paths(G_crop, orig_node, dest_node, k=(K_variable_paths), weight=f"{weight}_weight"))
                        
                # Add each route to routes_data which will be processed later
                for i in range(K_variable_paths):
                    route = k_paths[i]
                    routes_data.append({
                        'route': route,
                        'weight_type': weight,
                        'route_index': i
                    })
                    
            except Exception as e:
                print(f"Could not calculate route for {weight}: {e}")
                    
        route_fastest = nx.shortest_path(G_crop, orig_node, dest_node, weight="travel_time")
        routes_data.append({
            'route': route_fastest,
            'weight_type': 'fastest',
        })

        print(route_fastest)

    elif map_view_mode == "Maps": 
    
        # For future reference, the k_shortest_paths and shortest_paths are the ones that acually return a list of osm ID's
        for weight in weather_conditions:
            # calculate route optimized for every selected weight
            try:
                print(f"Calculating route optimized for {weight}...")
                # Use Yen's algorithm for k-shortest paths
                route = nx.shortest_path(G_crop, orig_node, dest_node, weight=f"{weight}_weight")
                        
                # Add each route to routes_data which will be processed later
        
                routes_data.append({
                    'route': route,
                    'weight_type': weight,
                })
                
            except Exception as e:
                print(f"Could not calculate route for {weight}: {e}")
                    
        route_fastest = nx.shortest_path(G_crop, orig_node, dest_node, weight="travel_time")
        routes_data.append({
            'route': route_fastest,
            'weight_type': 'fastest',
        })
        
        
    route_coords = []
    index = 0
    for route in routes_data:
        route_data_coords = []
        for node_id in route['route']:
            node = G_crop.nodes[node_id]
            route_data_coords.append((node['y'], node['x']))
        route_coords.append({
            'route_index': index,
            'weight_type': route['weight_type'],
            'coordinates': route_data_coords
        })
        index += 1

    return route_coords