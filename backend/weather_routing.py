import osmnx as ox
import networkx as nx

from load_static import DataLoader
from calculate_isochrones import calculate_isochrones
from weight_calculation import GNN_weight_calculations


_data_loader = None

def get_data_loader(time=17):
    """
    Get or create the singleton DataLoader instance.
    """
    global _data_loader
    if _data_loader is None:
        _data_loader = DataLoader(time=time)

    return _data_loader

def calculate_weather_route(datafile, 
                            origin, 
                            destination,
                            bbox,
                            map_view_mode,
                            K_variable_paths,
                            weather_conditions, # List of weather conditions to consider
                            weather_weights, # Corresponding weights for each weather condition (Should be same length as weather_conditions and in the same order)
                            time):
    BASE_PATH = "./data/weather/"

    ymax = bbox[0] 
    ymin = bbox[1]
    xmax = bbox[2]
    xmin = bbox[3]
    
    if (origin[0] < ymin or origin[1] >     ymax or 
        origin[1] < xmin or origin[1] > xmax or
        destination[0] < ymin or destination[0] > ymax or
        destination[1] < xmin or destination[1] > xmax):
            raise ValueError("Origin point is outside the loaded graph bounds.")
    
    data_loader = get_data_loader(time=time)
    
    # Load the dataset
    G = data_loader.load_graph(graph_path=datafile, bbox=bbox)

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
    print("Weather data loaded.")
    # Obtain valid origin and destination points
    orig_node = ox.distance.nearest_nodes(G, X=origin[1], Y=origin[0])
    dest_node = ox.distance.nearest_nodes(G, X=destination[1], Y=destination[0])
    print("Obtained valid origin and destination nodes.")

    # Calculate isochrones

    route = nx.shortest_path(G, orig_node, dest_node, weight="travel_time")
    trip_times_seconds = calculate_isochrones(G, orig_node, route)

    # In the optimized mode we always use the default weights
    if map_view_mode == "Optimized":
        rain_weight = 0.85834
        heat_weight = 0.02850
        humidity_weight = 0.09648
        wind_weight = 0.01657
    # In maps mode we are able to create a (for example) rain + heat aware path, so we need to check that the sum of weights is less than 1.0
    elif map_view_mode == "Maps":
        if sum(weather_weights) > 1.0:
            raise ValueError("In 'Maps' mode, the sum of weather weights must be 1.0")
    # In variable mode we just assign the weights as per user input as long as they are between 0 and 1
    else:
        rain_weight = weather_weights[weather_conditions.index('rain')] if 'rain' in weather_conditions else 0
        heat_weight = weather_weights[weather_conditions.index('heat')] if 'heat' in weather_conditions else 0
        wind_weight = weather_weights[weather_conditions.index('wind')] if 'wind' in weather_conditions else 0
        humidity_weight = weather_weights[weather_conditions.index('humidity')] if 'humidity' in weather_conditions else 0
        
        if (rain_weight < 0 or rain_weight > 1 or
            heat_weight < 0 or heat_weight > 1 or
            wind_weight < 0 or wind_weight > 1 or
            humidity_weight < 0 or humidity_weight > 1):
            raise ValueError("In 'Variable' mode, each weather weight must be between 0 and 1.")
    
    

    print("Weather weights: ", rain_weight, heat_weight, wind_weight, humidity_weight)

    GNN_weight_calculations(G, rain_lats, rain_lons,
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
    
    print(f"Calculating routes for map view mode: {map_view_mode}")
    
    # Single map with single route!! 
    if map_view_mode == "Optimized":
        route_fastest = nx.shortest_path(G, orig_node, dest_node, weight="travel_time")
        route_total = nx.shortest_path(G, orig_node, dest_node, weight="total_weight")
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
                k_paths = list(ox.routing.k_shortest_paths(G, orig_node, dest_node, k=(K_variable_paths), weight=f"{weight}_weight"))
                        
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
                    
        route_fastest = nx.shortest_path(G, orig_node, dest_node, weight="travel_time")
        routes_data.append({
            'route': route_fastest,
            'weight_type': 'quickest_path',
        })

        
    # With this you are able to compare a only rain aware path, a only heat aware path and a heat + rain aware path
    elif map_view_mode == "Maps": 
    
        # For future reference, the k_shortest_paths and shortest_paths are the ones that acually return a list of osm ID's
        for weight in weather_conditions:
            # calculate route optimized for every selected weight
            try:
                print(f"Calculating route optimized for {weight}...")
                # Use Yen's algorithm for k-shortest paths
                route = nx.shortest_path(G, orig_node, dest_node, weight=f"{weight}_weight")
                        
                # Add each route to routes_data which will be processed later
        
                routes_data.append({
                    'route': route,
                    'weight_type': weight,
                })
                
            except Exception as e:
                print(f"Could not calculate route for {weight}: {e}")
                    
        route_fastest = nx.shortest_path(G, orig_node, dest_node, weight="travel_time")
        routes_data.append({
            'route': route_fastest,
            'weight_type': 'fastest',
        })
        
    # instead we will create linestrings and store to geojson. Then fetch it on frontend whenever needed.
    route_coords = []
    index = 0
    for route in routes_data:
        route_data_coords = []
        for node_id in route['route']:
            node = G.nodes[node_id]
            route_data_coords.append((node['y'], node['x']))
        route_coords.append({
            'route_index': index,
            'weight_type': route['weight_type'],
            'coordinates': route_data_coords
        })
        index += 1

    return route_coords