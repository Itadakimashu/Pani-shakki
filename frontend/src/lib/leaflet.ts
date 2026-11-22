// leaflet.markercluster expects a global `L`; this module must be imported before it.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

(window as unknown as { L: typeof L }).L = L;
export default L;
