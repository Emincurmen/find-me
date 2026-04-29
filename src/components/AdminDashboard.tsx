import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, resetTour } from '../config/firebase';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STORY_STOPS } from '../data/story';

// ── Leaflet icon fix ──────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;

function makeDivIcon(color: string, size = 28) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 28 36">
      <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2.5"/>
      <polygon points="14,36 7,22 21,22" fill="${color}"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

const redIcon = makeDivIcon('#ef4444');
const blueIcon = makeDivIcon('#3b82f6');
const goldIcon = makeDivIcon('#f59e0b');

// ── Types ─────────────────────────────────────────────────────────
type LogEvent = { id: string; tourId: string; eventType: string; details: string; timestamp: any };
type TourProgress = {
  id: string; stage: string; stopIndex: number;
  lastLocation: { lat: number; lng: number } | null;
  audioSeconds?: number; audioStopId?: string; audioUpdatedAt?: any; lastUpdated: any;
};

const TOUR_ID = 'main_tour';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function relTime(ts: any): string {
  if (!ts?.toDate) return 'Şimdi';
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (diff < 60) return `${diff}sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  return ts.toDate().toLocaleTimeString('tr-TR');
}

const STAGE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  NAVIGATING: { label: 'Navigasyon', color: '#2563eb', bg: '#eff6ff', icon: '🧭' },
  VIDEO_STAGE: { label: 'Video İzleniyor', color: '#7c3aed', bg: '#f5f3ff', icon: '🎬' },
  POEM_STAGE: { label: 'Şiir & Müzik', color: '#059669', bg: '#ecfdf5', icon: '🎵' },
};

// ── Login Screen ──────────────────────────────────────────────────
const LoginScreen: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const tryLogin = () => {
    if (pw === '1453') { onAuth(); }
    else { setErr(true); setTimeout(() => setErr(false), 1200); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#1e293b', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 360, border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>🔐</div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Admin Panel</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>FindMe Tour · Canlı Takip</p>
        </div>
        <input
          type="password" placeholder="Şifre" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryLogin()}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 12, border: `1.5px solid ${err ? '#ef4444' : '#334155'}`,
            background: '#0f172a', color: 'white', fontSize: 15, outline: 'none',
            boxSizing: 'border-box', marginBottom: 12,
            transition: 'border-color 0.2s',
          }}
        />
        {err && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, marginTop: -4 }}>Hatalı şifre</p>}
        <button
          onClick={tryLogin}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
          }}
        >
          Giriş Yap
        </button>
      </div>
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color = '#3b82f6' }) => (
  <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px 20px', border: '1px solid #334155', flex: 1, minWidth: 120 }}>
    <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', margin: 0 }}>{label}</p>
    <p style={{ color: color, fontSize: 22, fontWeight: 800, margin: '4px 0 2px', lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>{sub}</p>}
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const [auth, setAuth] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [tours, setTours] = useState<TourProgress[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  useEffect(() => {
    if (!auth) return;
    const q1 = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    const u1 = onSnapshot(q1, s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as LogEvent))));
    const u2 = onSnapshot(query(collection(db, 'tours')), s => setTours(s.docs.map(d => ({ id: d.id, ...d.data() } as TourProgress))));
    return () => { u1(); u2(); };
  }, [auth]);

  if (!auth) return <LoginScreen onAuth={() => setAuth(true)} />;

  const tour = tours.find(t => t.id === TOUR_ID);
  const stop = tour ? STORY_STOPS[tour.stopIndex] : null;
  const stageMeta = tour ? (STAGE_META[tour.stage] || STAGE_META.NAVIGATING) : null;
  // Sadece aynı durağın şarkısıysa göster
  const audioProgress = (tour?.audioSeconds != null && stop && tour.audioStopId === stop.id)
    ? tour.audioSeconds : null;

  const handleReset = async () => {
    if (!confirm('Turu sıfırlamak istediğine emin misin?')) return;
    setResetting(true);
    try {
      await resetTour(TOUR_ID);
      setResetMsg('✅ Tur sıfırlandı.');
    } catch { setResetMsg('❌ Hata oluştu.'); }
    finally { setResetting(false); setTimeout(() => setResetMsg(''), 3000); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        .admin-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
        .admin-map  { width: 100%; height: 42vh; position: relative; flex-shrink: 0; }
        .admin-panel { width: 100%; background: #1e293b; border-top: 1px solid #334155; overflow-y: auto; flex: 1; display: flex; flex-direction: column; }
        @media (min-width: 768px) {
          .admin-body  { flex-direction: row; }
          .admin-map   { flex: 1; height: auto; }
          .admin-panel { width: 340px; border-top: none; border-left: 1px solid #334155; }
        }
        .leaflet-div-icon { background: none !important; border: none !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🗺️</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>FindMe Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ color: '#94a3b8', fontSize: 11 }}>Canlı</span>
        </div>
      </div>

      {/* Body */}
      <div className="admin-body">

        {/* Map */}
        <div className="admin-map">
          <MapContainer
            center={[41.021, 28.956]} zoom={15}
            style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Durak rotası */}
            <Polyline
              positions={STORY_STOPS.map(s => [s.lat, s.lng])}
              pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '6 4', opacity: 0.5 }}
            />

            {/* Hedef duraklar */}
            {STORY_STOPS.map((s, i) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={tour?.stopIndex === i ? goldIcon : redIcon}>
                <Popup>
                  <strong style={{ fontSize: 13 }}>{s.name}</strong><br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{s.theme}</span><br />
                  {tour?.stopIndex === i && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>★ Aktif Durak</span>}
                </Popup>
              </Marker>
            ))}

            {/* Kullanıcı */}
            {tour?.lastLocation && (
              <Marker position={[tour.lastLocation.lat, tour.lastLocation.lng]} icon={blueIcon}>
                <Popup>
                  <strong style={{ fontSize: 13 }}>Kullanıcı</strong><br />
                  <span style={{ fontSize: 11 }}>{stageMeta?.label}</span><br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{stop?.name}</span>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Map legend */}
          <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 10px', border: '1px solid #334155' }}>
            {[['#ef4444', 'Durak'], ['#f59e0b', 'Aktif'], ['#3b82f6', 'Kullanıcı']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1', fontSize: 10 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="admin-panel">

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #334155', flexShrink: 0 }}>
            {(['overview', 'logs'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '12px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                color: activeTab === tab ? '#3b82f6' : '#64748b',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                letterSpacing: '0.5px', textTransform: 'uppercase',
                transition: 'all 0.2s',
              }}>
                {tab === 'overview' ? 'Genel Bakış' : `Loglar (${logs.length})`}
              </button>
            ))}
          </div>

          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>

            {activeTab === 'overview' && (
              <>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <StatCard
                    label="Durak"
                    value={tour ? `${tour.stopIndex + 1}/${STORY_STOPS.length}` : '—'}
                    sub={stop?.name}
                    color="#3b82f6"
                  />
                  <StatCard
                    label="Aşama"
                    value={stageMeta ? stageMeta.label.split(' ')[0] : '—'}
                    sub={tour ? relTime(tour.lastUpdated) : undefined}
                    color={stageMeta?.color || '#64748b'}
                  />
                </div>

                {/* Aşama Kartı */}
                {tour && stageMeta ? (
                  <div style={{
                    background: '#0f172a', borderRadius: 14, padding: '16px',
                    border: `1px solid ${stageMeta.color}33`, marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: stageMeta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        {stageMeta.icon}
                      </div>
                      <div>
                        <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>{stageMeta.label}</p>
                        <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>{stop?.name || 'Bilinmiyor'} · {stop?.theme}</p>
                      </div>
                      <div style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, background: stageMeta.color + '22', color: stageMeta.color, fontSize: 11, fontWeight: 700 }}>
                        CANLI
                      </div>
                    </div>

                    {/* POEM_STAGE detayı */}
                    {tour.stage === 'POEM_STAGE' && stop && (
                      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                        {/* Şarkı + ses pozisyonu */}
                        <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div>
                              <p style={{ color: 'white', fontSize: 12, fontWeight: 700, margin: 0 }}>{stop.audioTitle}</p>
                              <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>{stop.audioArtist}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              {audioProgress != null ? (
                                <>
                                  <p style={{ color: '#22c55e', fontSize: 16, fontWeight: 800, margin: 0 }}>{fmt(audioProgress)}</p>
                                  <p style={{ color: '#64748b', fontSize: 10, margin: '2px 0 0' }}>{relTime(tour.audioUpdatedAt)}</p>
                                </>
                              ) : (
                                <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>Başlamadı</p>
                              )}
                            </div>
                          </div>
                          {/* Progress bar */}
                          {audioProgress != null && (
                            <div style={{ background: '#334155', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 4,
                                background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                                width: `${Math.min(100, (audioProgress / 240) * 100)}%`,
                                transition: 'width 0.5s',
                              }} />
                            </div>
                          )}
                        </div>

                        {/* Şiir */}
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Şiir</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {stop.poem.map((line, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 700, minWidth: 14, marginTop: 2 }}>{i + 1}</span>
                              <span style={{ color: '#cbd5e1', fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>{line}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* VIDEO_STAGE detayı */}
                    {tour.stage === 'VIDEO_STAGE' && (
                      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                        <div style={{ background: '#7c3aed22', borderRadius: 8, padding: '8px 12px', border: '1px solid #7c3aed33' }}>
                          <p style={{ color: '#a78bfa', fontSize: 12, margin: 0, fontWeight: 600 }}>🎬 Video aşamasında</p>
                          <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>{stop?.historicalTeaser}</p>
                        </div>
                      </div>
                    )}

                    {/* NAVIGATING detayı */}
                    {tour.stage === 'NAVIGATING' && tour.lastLocation && (
                      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Konum</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[['Lat', tour.lastLocation.lat.toFixed(5)], ['Lng', tour.lastLocation.lng.toFixed(5)]].map(([k, v]) => (
                            <div key={k} style={{ flex: 1, background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                              <p style={{ color: '#64748b', fontSize: 10, margin: 0 }}>{k}</p>
                              <p style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#0f172a', borderRadius: 14, padding: 20, border: '1px solid #334155', textAlign: 'center', marginBottom: 16 }}>
                    <p style={{ color: '#64748b', fontSize: 13 }}>Tur henüz başlamadı</p>
                  </div>
                )}

                {/* Durak ilerlemesi */}
                <div style={{ background: '#0f172a', borderRadius: 14, padding: '14px 16px', border: '1px solid #334155', marginBottom: 16 }}>
                  <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Tur Rotası</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {STORY_STOPS.map((s, i) => {
                      const done = tour && i < tour.stopIndex;
                      const active = tour?.stopIndex === i;
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: done ? '#22c55e22' : active ? '#3b82f622' : '#1e293b',
                            border: `2px solid ${done ? '#22c55e' : active ? '#3b82f6' : '#334155'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                            color: done ? '#22c55e' : active ? '#3b82f6' : '#475569',
                          }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: active ? 'white' : done ? '#94a3b8' : '#475569', fontSize: 12, fontWeight: active ? 700 : 400, margin: 0 }}>{s.name}</p>
                            <p style={{ color: '#334155', fontSize: 10, margin: '1px 0 0' }}>{s.theme}</p>
                          </div>
                          {active && (
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reset */}
                <button
                  onClick={handleReset} disabled={resetting}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 12,
                    background: resetting ? '#334155' : 'transparent',
                    border: '1.5px solid #ef444466', color: '#ef4444',
                    fontSize: 13, fontWeight: 600, cursor: resetting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {resetting ? '⏳ Sıfırlanıyor...' : '↺ Turu Sıfırla'}
                </button>
                {resetMsg && <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{resetMsg}</p>}
              </>
            )}

            {activeTab === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.length === 0 && (
                  <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Henüz log yok</p>
                )}
                {logs.map(log => {
                  const isAudio = log.eventType?.includes('audio') || log.details?.includes('şarkı') || log.details?.includes('Müzik');
                  const isNav = log.eventType?.includes('nav') || log.details?.includes('Durak') || log.details?.includes('yürü');
                  const accent = isAudio ? '#22c55e' : isNav ? '#3b82f6' : '#64748b';
                  return (
                    <div key={log.id} style={{
                      background: '#0f172a', borderRadius: 10, padding: '10px 12px',
                      borderLeft: `3px solid ${accent}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: accent, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{log.eventType || 'event'}</span>
                        <span style={{ color: '#475569', fontSize: 10 }}>{relTime(log.timestamp)}</span>
                      </div>
                      <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{log.details}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
