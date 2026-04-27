import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeolocation } from '../hooks/useGeolocation';
import { STORY_STOPS } from '../data/story';
import { logEventToAdmin, updateTourProgress, getTourProgress } from '../config/firebase';
import { MapPin, Headphones, ChevronRight, Unlock, Navigation, AlertTriangle } from 'lucide-react';

type Stage = 'NAVIGATING' | 'VIDEO_STAGE' | 'POEM_STAGE';

interface ExperienceViewProps {
  tourId: string;
}

export const ExperienceView: React.FC<ExperienceViewProps> = ({ tourId }) => {
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('NAVIGATING');
  const [videoStarted, setVideoStarted] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);

  const currentStop = STORY_STOPS[currentStopIndex];

  const {
    lat, lng, accuracy,
    distanceToTarget, isWithinTarget,
    error: geoError,
    permissionStatus,
    requestPermission,
    bypassLocationCheck,
  } = useGeolocation(currentStop?.lat, currentStop?.lng, 70);

  // Sayfa yenilenince kaldığı yerden devam
  useEffect(() => {
    const loadProgress = async () => {
      const saved = await getTourProgress(tourId);
      if (saved) {
        setCurrentStopIndex(typeof saved.stopIndex === 'number' ? saved.stopIndex : 0);
        setStage((saved.stage as Stage) || 'NAVIGATING');
      }
      setProgressLoaded(true);
    };
    loadProgress();
  }, [tourId]);

  // Konum Firebase'e yaz — sadece gerçek değer gelince
  const saveProgress = useCallback((st: Stage, idx: number, loc: { lat: number; lng: number } | null) => {
    updateTourProgress(tourId, st, idx, loc);
  }, [tourId]);

  useEffect(() => {
    if (!progressLoaded) return;
    const location = lat !== null && lng !== null ? { lat, lng } : null;
    saveProgress(stage, currentStopIndex, location);
  }, [stage, currentStopIndex, lat, lng, progressLoaded, saveProgress]);

  // Hedefe ulaşıldığında sahne geçişi
  useEffect(() => {
    if (stage === 'NAVIGATING' && isWithinTarget) {
      setStage('VIDEO_STAGE');
      logEventToAdmin(tourId, 'REACHED_STOP', `Reached ${currentStop?.name}`);
    }
  }, [isWithinTarget, stage, tourId, currentStop?.name]);

  const handleVideoEnd = () => {
    setStage('POEM_STAGE');
    logEventToAdmin(tourId, 'COMPLETED_VIDEO', `Finished video at ${currentStop?.name}`);
  };

  const handleNextStop = () => {
    if (currentStopIndex < STORY_STOPS.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
      setStage('NAVIGATING');
      setVideoStarted(false);
    } else {
      logEventToAdmin(tourId, 'COMPLETED_TOUR', 'Finished the entire tour!');
    }
  };

  if (!progressLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfbf9]">
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  if (!currentStop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1d2a44] text-white">
        <h1 className="font-serif text-3xl">Yolculuk Tamamlandı 🎉</h1>
      </div>
    );
  }

  // ── KONUM İZNİ EKRANI ──────────────────────────────────────────────────────
  if (permissionStatus === 'unknown' || permissionStatus === 'requesting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfbf9] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full text-center"
        >
          {/* İkon */}
          <div className="w-24 h-24 bg-[#1d2a44] rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
            <Navigation size={40} className="text-white" />
          </div>

          <h1 className="font-serif text-3xl text-[#1d2a44] mb-3">Konum Gerekli</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">
            Hikayenin durağa olan mesafeni hesaplayabilmem için konumuna ihtiyacım var.
            Konumun yalnızca bu uygulama tarafından kullanılır.
          </p>

          <button
            onClick={requestPermission}
            disabled={permissionStatus === 'requesting'}
            className="w-full bg-[#1d2a44] text-white py-5 rounded-2xl font-medium text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {permissionStatus === 'requesting' ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Konum alınıyor...
              </>
            ) : (
              <>
                <Navigation size={20} />
                Konumu Etkinleştir
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Butona bastıktan sonra tarayıcının izin sorusuna "İzin Ver" de.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── KONUM REDDEDİLDİ EKRANI ────────────────────────────────────────────────
  if (permissionStatus === 'denied') {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfbf9] p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center"
        >
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertTriangle size={40} className="text-amber-500" />
          </div>

          <h1 className="font-serif text-2xl text-[#1d2a44] mb-3">Konum İzni Gerekli</h1>

          {geoError && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-4 py-2 mb-4 text-left">
              {geoError}
            </p>
          )}

          {isIOS ? (
            <div className="bg-blue-50 rounded-xl p-4 text-left text-sm text-gray-700 mb-6 space-y-3">
              <p className="font-semibold text-blue-800">📱 iPhone / Safari Adımları:</p>
              <ol className="space-y-2 list-decimal list-inside">
                <li><strong>Ayarlar</strong> uygulamasını aç</li>
                <li><strong>Gizlilik ve Güvenlik</strong> → <strong>Konum Servisleri</strong></li>
                <li>Konum Servisleri'nin <strong>Açık</strong> olduğunu doğrula</li>
                <li>Aşağı kaydır → <strong>Safari Web Siteleri</strong></li>
                <li>"<strong>Uygulama Kullanılırken</strong>" seçeneğini seç</li>
                <li>Bu sayfaya geri dön ve <strong>Tekrar Dene</strong>'ye bas</li>
              </ol>
              <p className="text-xs text-blue-600 border-t border-blue-200 pt-3 mt-2">
                💡 Safari adres çubuğunun solundaki <strong>AA</strong> → <strong>Web Sitesi Ayarları</strong> → Konum → İzin Ver'i de deneyebilirsin.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600 mb-6 space-y-2">
              <p className="font-medium text-gray-800">🤖 Android / Chrome:</p>
              <p>Adres çubuğundaki kilit ikonuna bas → Konum → İzin Ver</p>
            </div>
          )}

          <button
            onClick={requestPermission}
            className="w-full bg-[#1d2a44] text-white py-4 rounded-xl font-medium active:scale-95 transition-transform mb-4 flex items-center justify-center gap-2"
          >
            <Navigation size={18} />
            Tekrar Dene
          </button>

          {/* Dev bypass */}
          <button
            onClick={bypassLocationCheck}
            className="text-xs text-gray-300 underline"
          >
            Konumu atla (geliştirici)
          </button>
        </motion.div>
      </div>
    );
  }

  // ── ANA DENEYİM ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-gray-900 font-sans overflow-hidden flex flex-col items-center">

      {/* Dev bypass butonu — direkt VIDEO_STAGE'e geç */}
      <button
        onClick={() => {
          bypassLocationCheck();
          setStage('VIDEO_STAGE');
          logEventToAdmin(tourId, 'REACHED_STOP', `[DEV BYPASS] ${currentStop?.name}`);
        }}
        className="absolute top-4 right-4 opacity-10 p-2 z-50"
        title="Dev: Konumu Atla"
      >
        <Unlock size={16} />
      </button>

      <AnimatePresence mode="wait">

        {/* NAVIGATING */}
        {stage === 'NAVIGATING' && (
          <motion.div
            key="navigating"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex flex-col items-center justify-center flex-1 w-full p-8 max-w-md text-center min-h-screen"
          >
            <MapPin size={48} className="text-[#1d2a44] mb-6" />
            <span className="text-sm uppercase tracking-widest text-gray-400 font-semibold mb-2">Sıradaki Durak</span>
            <h2 className="font-serif text-4xl text-[#1d2a44] mb-8">{currentStop.name}</h2>

            <p className="text-gray-600 mb-12 italic text-lg leading-relaxed">
              "{currentStop.historicalTeaser}"
            </p>

            {/* Mesafe kutusu */}
            <div className="bg-white px-8 py-6 rounded-2xl shadow-sm border border-gray-100 w-full mb-4">
              <p className="text-sm text-gray-500 mb-1">Kalan Mesafe</p>
              <p className="text-3xl font-mono text-[#1d2a44] font-bold">
                {distanceToTarget !== null
                  ? `${Math.round(distanceToTarget)}m`
                  : lat !== null
                    ? 'Hesaplanıyor...'
                    : (
                      <span className="flex items-center justify-center gap-2 text-2xl">
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-[#1d2a44] rounded-full animate-spin inline-block" />
                        GPS bağlanıyor
                      </span>
                    )
                }
              </p>
              {accuracy !== null && (
                <p className="text-xs text-gray-400 mt-1">±{Math.round(accuracy)}m doğruluk</p>
              )}
            </div>

            {geoError && (
              <p className="text-xs text-amber-600 mb-4 bg-amber-50 rounded-lg px-4 py-2 w-full text-left">
                ⚠️ {geoError}
              </p>
            )}

            <button
              onClick={() => window.location.href = currentStop.externalMapLink}
              className="w-full bg-[#1d2a44] text-white py-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-transform"
            >
              <span>Haritada Aç</span>
              <ChevronRight size={18} />
            </button>
          </motion.div>
        )}

        {/* VIDEO_STAGE */}
        {stage === 'VIDEO_STAGE' && (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center flex-1 w-full bg-black text-white p-4 min-h-screen"
          >
            {!videoStarted ? (
              <div className="flex flex-col items-center text-center">
                <h2 className="font-serif text-3xl mb-4">{currentStop.name}'ne Ulaştın</h2>
                <p className="text-gray-300 mb-8 max-w-xs leading-relaxed">Hikayeyi dinlemeye hazır olduğunda başlat.</p>
                <button
                  onClick={() => setVideoStarted(true)}
                  className="bg-white text-black px-10 py-4 rounded-full font-medium tracking-wide shadow-xl active:scale-95 transition"
                >
                  Hikayeyi Başlat
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-center items-center relative">
                <video
                  src={currentStop.videoUrl}
                  autoPlay
                  playsInline
                  onEnded={handleVideoEnd}
                  className="w-full max-w-sm rounded-lg object-cover shadow-2xl"
                  controls={false}
                />
                <button onClick={handleVideoEnd} className="absolute top-8 right-8 text-white/40 text-xs">
                  Atla
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* POEM_STAGE */}
        {stage === 'POEM_STAGE' && (
          <motion.div
            key="poem"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-start flex-1 w-full p-8 max-w-md pt-16 min-h-screen"
          >
            <div className="flex flex-col items-center justify-center text-gray-400 mb-10 w-full">
              <Headphones size={24} className="mb-2 animate-pulse" />
              <span className="text-xs tracking-widest uppercase">Kulaklıklarını Tak</span>
            </div>

            <div className="w-full mb-10 overflow-hidden rounded-xl shadow-sm border border-gray-100">
              <iframe
                src={`https://open.spotify.com/embed/track/${currentStop.trackId}?utm_source=generator&theme=0`}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>

            <div className="text-center mb-16 space-y-6">
              {currentStop.poem.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 1.5 + 1, duration: 1.2 }}
                  className="font-serif text-xl md:text-2xl text-[#1d2a44] leading-relaxed"
                >
                  {line}
                </motion.p>
              ))}
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: currentStop.poem.length * 1.5 + 3, duration: 2 }}
              onClick={handleNextStop}
              className="mt-auto mb-8 w-full border border-[#1d2a44] text-[#1d2a44] py-4 rounded-xl flex items-center justify-center active:bg-gray-50 transition-colors"
            >
              <span>{currentStopIndex < STORY_STOPS.length - 1 ? 'Sonraki Durağa İlerle' : 'Yolculuğu Bitir'}</span>
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
