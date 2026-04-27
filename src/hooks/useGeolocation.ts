import { useState, useEffect, useCallback, useRef } from 'react';

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const deg2rad = (d: number) => d * (Math.PI / 180);
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export type PermissionStatus = 'unknown' | 'requesting' | 'granted' | 'denied';

type GeolocationState = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  distanceToTarget: number | null;
  isWithinTarget: boolean;
  permissionStatus: PermissionStatus;
};

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

export const useGeolocation = (targetLat?: number, targetLng?: number, thresholdMeters = 70) => {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    distanceToTarget: null,
    isWithinTarget: false,
    permissionStatus: 'unknown',
  });

  const watcherRef = useRef<number | null>(null);
  const permissionGrantedRef = useRef(false);

  // targetLat/targetLng ref'leri — watchPosition callback'i her zaman güncel değerlere erişsin
  const targetLatRef = useRef(targetLat);
  const targetLngRef = useRef(targetLng);

  // Hedef değişince ref'leri güncelle ve mesafeyi sıfırla
  useEffect(() => {
    const targetChanged = targetLatRef.current !== targetLat || targetLngRef.current !== targetLng;
    targetLatRef.current = targetLat;
    targetLngRef.current = targetLng;

    if (targetChanged) {
      // Yeni durağa geçildi → mesafe ve "hedefe ulaştı" sıfırla
      setState(s => ({
        ...s,
        distanceToTarget: null,
        isWithinTarget: false,
      }));
    }
  }, [targetLat, targetLng]);

  // Mevcut GPS konumundan mesafe hesapla — ref'ler kullanılır, her zaman güncel
  const computeFromPos = useCallback((pos: GeolocationPosition) => {
    const currentLat = pos.coords.latitude;
    const currentLng = pos.coords.longitude;
    let distance: number | null = null;
    let within = false;

    const tLat = targetLatRef.current;
    const tLng = targetLngRef.current;

    if (tLat && tLng) {
      distance = getDistance(currentLat, currentLng, tLat, tLng);
      within = distance <= thresholdMeters;
    }
    return { currentLat, currentLng, distance, within, accuracy: pos.coords.accuracy };
  }, [thresholdMeters]);

  // watchPosition başlat — tek seferlik, ref'ler sayesinde hedef değişimini otomatik yakalar
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;

    // Önceki watcher'ı temizle
    if (watcherRef.current !== null) {
      navigator.geolocation.clearWatch(watcherRef.current);
      watcherRef.current = null;
    }

    watcherRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { currentLat, currentLng, distance, within, accuracy } = computeFromPos(pos);
        setState(s => ({
          ...s,
          lat: currentLat,
          lng: currentLng,
          accuracy,
          error: null,
          permissionStatus: 'granted',
          distanceToTarget: distance,
          isWithinTarget: within,
        }));
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState(s => ({ ...s, permissionStatus: 'denied', error: 'Konum izni reddedildi.' }));
          permissionGrantedRef.current = false;
        } else {
          setState(s => ({ ...s, error: `Konum alınamadı: ${err.message}` }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, [computeFromPos]);

  // Kullanıcı butonuna basınca → iOS'ta izin popup'ını açar
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Bu cihaz konum desteklemiyor.', permissionStatus: 'denied' }));
      return;
    }

    setState(s => ({ ...s, permissionStatus: 'requesting', error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { currentLat, currentLng, distance, within, accuracy } = computeFromPos(pos);
        setState(s => ({
          ...s,
          lat: currentLat,
          lng: currentLng,
          accuracy,
          error: null,
          permissionStatus: 'granted',
          distanceToTarget: distance,
          isWithinTarget: within,
        }));
        permissionGrantedRef.current = true;
        startWatching();
      },
      (err) => {
        console.error('Geolocation error:', err.code, err.message);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState(s => ({
            ...s,
            permissionStatus: 'denied',
            error: isIOS()
              ? 'Konum izni reddedildi. Ayarlar → Gizlilik → Konum Servisleri → Safari → "Uygulama Kullanılırken" seçin.'
              : 'Konum izni reddedildi. Tarayıcı ayarlarından konum iznini açın.',
          }));
        } else if (err.code === GeolocationPositionError.TIMEOUT) {
          setState(s => ({ ...s, permissionStatus: 'unknown', error: 'Konum zaman aşımına uğradı. Tekrar deneyin.' }));
        } else {
          setState(s => ({
            ...s,
            permissionStatus: 'unknown',
            error: `Konum alınamadı (${err.code}): ${err.message}`,
          }));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [computeFromPos, startWatching]);

  // iOS Safari Permissions API'yi desteklemiyor — sadece non-iOS'ta kontrol et
  useEffect(() => {
    if (isIOS()) return;
    if (!navigator.permissions) return;

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted' && !permissionGrantedRef.current) {
        setState(s => ({ ...s, permissionStatus: 'granted' }));
        permissionGrantedRef.current = true;
        startWatching();
      } else if (result.state === 'denied') {
        setState(s => ({ ...s, permissionStatus: 'denied' }));
      }

      result.addEventListener('change', () => {
        if (result.state === 'granted' && !permissionGrantedRef.current) {
          setState(s => ({ ...s, permissionStatus: 'granted' }));
          permissionGrantedRef.current = true;
          startWatching();
        } else if (result.state === 'denied') {
          setState(s => ({ ...s, permissionStatus: 'denied' }));
          permissionGrantedRef.current = false;
        }
      });
    }).catch(() => { });
  }, [startWatching]);

  // Uygulama arka plandan ön plana gelince izlemeyi yeniden başlat
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && permissionGrantedRef.current) {
        startWatching();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (watcherRef.current !== null) {
        navigator.geolocation.clearWatch(watcherRef.current);
        watcherRef.current = null;
      }
    };
  }, [startWatching]);

  // Geliştirici bypass — sadece state'i değiştirir, watchPosition çalışmaya devam eder
  const bypassLocationCheck = () => {
    setState(s => ({
      ...s,
      distanceToTarget: 0,
      isWithinTarget: true,
      permissionStatus: 'granted',
    }));
    permissionGrantedRef.current = true;
  };

  return { ...state, requestPermission, bypassLocationCheck };
};
