// src/components/search/SearchResultsMap.tsx
// Carte des résultats de recherche (chargée en lazy depuis SearchPage, comme
// LocationMap : leaflet pèse ~50 Ko compressés et n'est utile qu'ici).
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { MapPoint } from '@/lib/searchMap'

// Pins aux couleurs de la marque : orange = praticien, vert = cabinet. (divIcon
// plutôt que l'icône par défaut de Leaflet, dont les images ne se résolvent
// pas avec Vite — voir LocationMap.)
const pin = (color: string) => L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="5.5" fill="white"/></svg>`,
  iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36],
})
const ICONS = { doctor: pin('#f2820f'), clinic: pin('#4d7c0f') }

// Recadre la carte sur l'ensemble des points à chaque changement de résultats.
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 13); return }
    map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 })
  }, [map, points])
  return null
}

export default function SearchResultsMap({ points }: { points: MapPoint[] }) {
  return (
    // isolate : même raison que LocationMap (z-index internes de Leaflet qui
    // passaient au-dessus du menu sticky).
    <div className="h-[28rem] md:h-[34rem] rounded-2xl overflow-hidden isolate relative border border-gray-100">
      <MapContainer center={[46.6, 2.5]} zoom={5} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />
        {points.map(p => (
          <Marker key={p.key} position={[p.lat, p.lng]} icon={ICONS[p.kind]}>
            <Popup>
              <p className="font-semibold text-sm m-0">{p.title}</p>
              {p.subtitle && <p className="text-xs text-gray-500 m-0 mt-0.5">{p.subtitle}</p>}
              <Link to={p.href} className="text-xs text-sage-600 font-medium mt-1 inline-block">
                Voir la fiche →
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
