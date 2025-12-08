import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

// Fix default marker icons (ensure they render correctly)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type RouteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  from?: { lat: number; lng: number } | null;
  to: { lat: number; lng: number };
  title?: string;
};

export function RouteModal({ isOpen, onClose, from, to, title }: RouteModalProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const center = from ?? to;

  function MapInitializer({ onMap }: { onMap: (m: L.Map) => void }) {
    const map = useMap();
    useEffect(() => {
      if (map) onMap(map);
      // only run once when map is available
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);
    return null;
  }

  useEffect(() => {
    if (!map || !isOpen) return;
    if (!from) return; // don't attempt to route if origin is not available

    // Add routing control
    const control = (L as any).Routing.control({
      waypoints: [
        L.latLng(from?.lat ?? to.lat, from?.lng ?? to.lng),
        L.latLng(to.lat, to.lng),
      ],
      showAlternatives: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoute: true,
      createMarker: () => null, // Don't create default markers, we handle them ourselves
      lineOptions: {
        styles: [{ color: '#1f7a4d', weight: 6, opacity: 0.8 }],
      },
      show: false, // Hide the routing instructions panel
      collapsible: false, // Don't allow collapsing
    }).addTo(map);

    return () => {
      try {
        control?.remove();
      } catch (e) {
        // ignore
      }
    };
  }, [map, isOpen, from, to]);

  if (!isOpen) return null;

  return (
    <div className="location-selector-modal">
      <div className="location-selector-overlay" onClick={onClose}></div>
      <div className="location-selector-content" style={{ maxWidth: '820px' }}>
        <div className="location-selector-header">
          <h3>{title ? `Route to: ${title}` : 'Route'}</h3>
          <button className="location-selector-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '1rem' }}>
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={13}
            style={{ height: '480px', width: '100%' }}
          >
            {/* Initialize map instance for imperative routing control */}
            <MapInitializer onMap={(m: L.Map) => setMap(m)} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            {from && (
              <Marker position={[from.lat, from.lng]}>
                <Popup>Your location</Popup>
              </Marker>
            )}
            <Marker position={[to.lat, to.lng]}>
              <Popup>{title ?? 'Destination'}</Popup>
            </Marker>
          </MapContainer>
        </div>

        <div className="location-selector-footer">
          <button className="location-selector-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default RouteModal;
