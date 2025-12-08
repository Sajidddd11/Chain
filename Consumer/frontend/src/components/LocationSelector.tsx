import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom icon for better visibility
const customIcon = new Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});

interface LocationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
}

function LocationMarker({ position, onLocationSelect }: { position: LatLng | null; onLocationSelect: (lat: number, lng: number) => void }) {
  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(position);

  const map = useMapEvents({
    click(e) {
      setMarkerPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (position) {
      setMarkerPosition(position);
      map.setView(position, map.getZoom());
    }
  }, [position, map]);

  return markerPosition === null ? null : (
    <Marker position={markerPosition} icon={customIcon}>
      <Popup>
        Selected location: {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
      </Popup>
    </Marker>
  );
}

export function LocationSelector({ isOpen, onClose, onLocationSelect, initialLocation }: LocationSelectorProps) {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(
    initialLocation ? new LatLng(initialLocation.lat, initialLocation.lng) : null
  );

  const handleLocationSelect = (lat: number, lng: number) => {
    setCurrentLocation(new LatLng(lat, lng));
  };

  const handleConfirm = () => {
    if (currentLocation) {
      onLocationSelect(currentLocation.lat, currentLocation.lng);
      onClose();
    }
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latLng = new LatLng(pos.coords.latitude, pos.coords.longitude);
          setCurrentLocation(latLng);
          onLocationSelect(latLng.lat, latLng.lng);
        },
        (err) => {
          console.error('Error getting location:', err);
          alert('Unable to get your current location. Please click on the map to select a location.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  if (!isOpen) return null;

  // Default to a central location if no initial location
  const defaultCenter = currentLocation || new LatLng(23.8103, 90.4125); // Dhaka, Bangladesh as default

  return (
    <div className="location-selector-modal">
      <div className="location-selector-overlay" onClick={onClose}></div>
      <div className="location-selector-content">
        <div className="location-selector-header">
          <h3>Select Location</h3>
          <button className="location-selector-close" onClick={onClose}>×</button>
        </div>

        <div className="location-selector-instructions">
          <p>Click on the map to select your pickup location, or use your current location.</p>
        </div>

        <div className="location-selector-actions">
          <button
            type="button"
            className="location-selector-current-btn"
            onClick={handleUseCurrentLocation}
          >
            📍 Use Current Location
          </button>
        </div>

        <div className="location-selector-map">
          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ height: '400px', width: '100%', borderRadius: '8px', minHeight: '300px' }}
            whenReady={() => console.log('Map is ready')}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker
              position={currentLocation}
              onLocationSelect={handleLocationSelect}
            />
          </MapContainer>
        </div>

        <div className="location-selector-footer">
          <button className="location-selector-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="location-selector-confirm"
            onClick={handleConfirm}
            disabled={!currentLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}