// src/components/doctor/LocationMap.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Marqueur aux couleurs de la marque (sage-500) plutôt que le pin bleu par
// défaut de Leaflet — évite au passage le bug connu des icônes par défaut
// dont les chemins d'images relatifs ne sont pas résolus par Vite.
const markerIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#f2820f"/>
    <circle cx="15" cy="15" r="5.5" fill="white"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
})

export default function LocationMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <div className="h-56 rounded-xl overflow-hidden">
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} icon={markerIcon}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
