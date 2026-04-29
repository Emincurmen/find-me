import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default icon fix for Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface NavigationMapProps {
  userLat: number | null;
  userLng: number | null;
  destLat: number;
  destLng: number;
  destName: string;
  distanceToTarget: number | null;
}

// OSRM üzerinden yürüyüş rotası çeker (ücretsiz, API key yok)
async function fetchRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      // GeoJSON coords: [lng, lat] → Leaflet: [lat, lng]
      return data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      );
    }
  } catch {
    // OSRM erişilemezse düz çizgi kullan
  }
  return null;
}

export const NavigationMap: React.FC<NavigationMapProps> = ({
  userLat,
  userLng,
  destLat,
  destLng,
  destName,
  distanceToTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeFetchedRef = useRef(false);
  const [routeReady, setRouteReady] = useState(false);

  // Özel ikonlar
  const userIcon = L.divIcon({
    className: '',
    html: `<div style="
      width: 18px; height: 18px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(59,130,246,0.6);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  const destIcon = L.divIcon({
    className: '',
    html: `<div style="
      display: flex; flex-direction: column; align-items: center;
    ">
      <div style="
        background: #1d2a44; color: white;
        padding: 4px 8px; border-radius: 8px;
        font-size: 11px; font-weight: 600;
        white-space: nowrap; max-width: 120px;
        overflow: hidden; text-overflow: ellipsis;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        margin-bottom: 4px;
      ">${destName}</div>
      <div style="
        width: 14px; height: 14px;
        background: #1d2a44;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    </div>`,
    iconSize: [14, 40],
    iconAnchor: [7, 40],
  });

  // Haritayı bir kere başlat
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = userLat ?? destLat;
    const initialLng = userLng ?? destLng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Küçük attribution
    L.control.attribution({ prefix: '© OSM' }).addTo(map);

    // Hedef marker
    L.marker([destLat, destLng], { icon: destIcon }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      routeFetchedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kullanıcı konumu değişince marker + rota güncelle
  useEffect(() => {
    if (!mapRef.current || userLat === null || userLng === null) return;

    // Kullanıcı marker'ını taşı / oluştur
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLat, userLng]);
    } else {
      userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(mapRef.current);
    }

    // Haritayı kullanıcı + hedef arasını kapsayacak şekilde fit et
    const bounds = L.latLngBounds([[userLat, userLng], [destLat, destLng]]);
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });

    // Rotayı sadece bir kere çek
    if (!routeFetchedRef.current) {
      routeFetchedRef.current = true;
      fetchRoute(userLat, userLng, destLat, destLng).then(coords => {
        if (!mapRef.current) return;
        if (coords) {
          routePolylineRef.current = L.polyline(coords, {
            color: '#1d2a44',
            weight: 5,
            opacity: 0.85,
            dashArray: undefined,
          }).addTo(mapRef.current);
        } else {
          // Fallback: düz çizgi
          routePolylineRef.current = L.polyline([[userLat, userLng], [destLat, destLng]], {
            color: '#1d2a44',
            weight: 4,
            opacity: 0.6,
            dashArray: '8 6',
          }).addTo(mapRef.current);
        }
        setRouteReady(true);
      });
    } else if (routePolylineRef.current) {
      // Rota çizildiyse sadece başlangıç noktasını güncelle
      const latlngs = routePolylineRef.current.getLatLngs() as L.LatLng[];
      if (latlngs.length > 0) {
        latlngs[0] = L.latLng(userLat, userLng);
        routePolylineRef.current.setLatLngs(latlngs);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLat, userLng]);

  const etaMinutes = distanceToTarget !== null
    ? Math.ceil(distanceToTarget / 80) // ~80m/dk yürüyüş
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid #e5e7eb' }}>
      {/* Üst bilgi şeridi */}
      <div style={{
        background: '#1d2a44', color: 'white',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: 11, opacity: 0.7, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Hedefe Mesafe</p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {distanceToTarget !== null ? `${Math.round(distanceToTarget)} m` : '—'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, opacity: 0.7, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Tahmini Süre</p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {etaMinutes !== null ? `~${etaMinutes} dk` : '—'}
          </p>
        </div>
      </div>

      {/* Harita */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '320px', position: 'relative' }}
      />

      {/* Rota yükleniyor göstergesi */}
      {!routeReady && userLat !== null && (
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'white', borderRadius: 20, padding: '6px 14px',
          fontSize: 12, color: '#6b7280', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 6,
          pointerEvents: 'none',
        }}>
          <span style={{ width: 10, height: 10, border: '2px solid #1d2a44', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          Rota hesaplanıyor...
        </div>
      )}
    </div>
  );
};
