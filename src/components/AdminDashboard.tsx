import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, resetTour } from '../config/firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STORY_STOPS } from '../data/story';
import { Lock, RotateCcw } from 'lucide-react';

// Leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type LogEvent = {
  id: string;
  tourId: string;
  eventType: string;
  details: string;
  timestamp: any;
};

type TourProgress = {
  id: string;
  stage: string;
  stopIndex: number;
  lastLocation: { lat: number; lng: number } | null;
  lastUpdated: any;
};

const TOUR_ID = 'main_tour';

export const AdminDashboard: React.FC = () => {
  const [auth, setAuth] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [tours, setTours] = useState<TourProgress[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (!auth) return;

    const logsQuery = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogEvent)));
    });

    const toursQuery = query(collection(db, 'tours'));
    const unsubTours = onSnapshot(toursQuery, (snap) => {
      setTours(snap.docs.map(d => ({ id: d.id, ...d.data() } as TourProgress)));
    });

    return () => { unsubLogs(); unsubTours(); };
  }, [auth]);

  const handleReset = async () => {
    if (!confirm('Turu sıfırlamak istediğine emin misin? Bu işlem geri alınamaz.')) return;
    setResetting(true);
    setResetMsg('');
    try {
      await resetTour(TOUR_ID);
      // localStorage'daki "started" bayrağını da temizle
      // (kullanıcı sayfayı yenilediğinde başlangıç ekranına döner)
      setResetMsg('✅ Tur başarıyla sıfırlandı. Kullanıcı sayfayı yenileyince başlangıca döner.');
    } catch {
      setResetMsg('❌ Sıfırlama başarısız. Tekrar dene.');
    } finally {
      setResetting(false);
    }
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-sm w-full text-center">
          <Lock size={48} className="mx-auto text-gray-400 mb-6" />
          <h2 className="text-xl font-medium text-gray-900 mb-6">Admin Panel</h2>
          <input
            type="password"
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && passcode === '1453') setAuth(true); }}
            className="w-full border p-3 rounded mb-4"
          />
          <button
            onClick={() => { if (passcode === '1453') setAuth(true); }}
            className="w-full bg-[#1d2a44] text-white py-3 rounded hover:bg-[#121c2d]"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  const activeTour = tours.find(t => t.id === TOUR_ID);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">

      {/* Harita */}
      <div className="w-full md:w-2/3 h-[50vh] md:h-screen sticky top-0 relative z-0">
        <MapContainer center={[41.018, 28.956]} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Hedef duraklar */}
          {STORY_STOPS.map((stop) => (
            <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={redIcon}>
              <Popup>
                <strong className="block text-sm">{stop.name}</strong>
                <span className="text-xs text-gray-500">Hedef Durak</span>
              </Popup>
            </Marker>
          ))}

          {/* Kullanıcı konumu */}
          {activeTour?.lastLocation && (
            <Marker position={[activeTour.lastLocation.lat, activeTour.lastLocation.lng]}>
              <Popup>
                <strong>Kullanıcı</strong><br />
                Sahne: {activeTour.stage}<br />
                Durak: {STORY_STOPS[activeTour.stopIndex]?.name || 'Son'}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Sağ panel */}
      <div className="w-full md:w-1/3 bg-white border-l p-6 h-[50vh] md:h-screen overflow-y-auto">
        <h1 className="text-2xl font-serif text-[#1d2a44] mb-8">Canlı Takip</h1>

        {/* Tur Durumu */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tur Durumu</h2>
          {activeTour ? (
            <div className="p-4 bg-gray-50 rounded-lg border text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-xs text-gray-500">{TOUR_ID}</span>
                <span className="text-xs bg-[#1d2a44] text-white px-2 py-0.5 rounded-full">{activeTour.stage}</span>
              </div>
              <p className="text-gray-600">
                Durak: {activeTour.stopIndex + 1} / {STORY_STOPS.length}
                {' '}({STORY_STOPS[activeTour.stopIndex]?.name || 'Tamamlandı'})
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Konum: {activeTour.lastLocation
                  ? `${activeTour.lastLocation.lat.toFixed(5)}, ${activeTour.lastLocation.lng.toFixed(5)}`
                  : 'Henüz alınmadı'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Tur başlamadı veya sıfırlandı.</p>
          )}
        </div>

        {/* Turu Sıfırla */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Yönetim</h2>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 py-3 rounded-xl hover:bg-red-50 active:scale-95 transition disabled:opacity-50"
          >
            <RotateCcw size={16} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Sıfırlanıyor...' : 'Turu Sıfırla'}
          </button>
          {resetMsg && (
            <p className="text-xs mt-2 text-gray-600">{resetMsg}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Sıfırladıktan sonra kullanıcının sayfayı yenilemesi gerekir.
          </p>
        </div>

        {/* Sistem Logları */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Sistem Logları</h2>
          <div className="space-y-3">
            {logs.length === 0 && <p className="text-sm text-gray-500">Henüz log yok.</p>}
            {logs.map(log => (
              <div key={log.id} className="border-l-2 border-[#1d2a44] pl-3 py-1">
                <p className="text-xs text-gray-400 mb-0.5">
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('tr-TR') : 'Şimdi'}
                  <span className="ml-2 font-mono">{log.tourId}</span>
                </p>
                <p className="text-sm text-gray-800">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
