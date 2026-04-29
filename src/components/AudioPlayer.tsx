import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioPlayerProps {
  src: string;
  title: string;
  artist: string;
  onTimeUpdate?: (seconds: number) => void; // Her 5sn Firebase'e bildir
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, title, artist, onTimeUpdate }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const lastReportedRef = useRef<number>(-5); // son raporlanan saniye

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<'+5' | '-5' | null>(null);

  // Yeni src gelince sıfırla
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
  }, [src]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !isDragging) {
      const t = audioRef.current.currentTime;
      setCurrentTime(t);
      // Her 5 saniyede bir Firebase'e bildir
      if (onTimeUpdate && t - lastReportedRef.current >= 5) {
        lastReportedRef.current = t;
        onTimeUpdate(t);
      }
    }
  }, [isDragging, onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current || isLoading) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, isLoading]);

  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    const next = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = next;
    setCurrentTime(next);
    setSkipFeedback(seconds > 0 ? '+5' : '-5');
    setTimeout(() => setSkipFeedback(null), 600);
  }, [duration]);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Animasyonlu müzik çubukları
  const bars = [1, 2, 3, 4, 5];

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #1d2a44 0%, #12213b 60%, #0d1a2f 100%)',
        borderRadius: 24,
        padding: '28px 24px 24px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(13,26,47,0.45), 0 4px 16px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Arka plan dekor */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -40,
        width: 180, height: 180,
        background: 'radial-gradient(circle, rgba(99,179,237,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Şarkı bilgisi + animasyonlu barlar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {/* Animasyonlu müzik ikonu */}
        <div style={{
          width: 52, height: 52, flexShrink: 0,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 14,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 3, paddingBottom: 12, paddingTop: 12,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {bars.map((b) => (
            <motion.div
              key={b}
              style={{
                width: 4, borderRadius: 2,
                background: isPlaying
                  ? `rgba(99,179,237,${0.5 + b * 0.1})`
                  : 'rgba(255,255,255,0.25)',
                minHeight: 4,
              }}
              animate={isPlaying ? {
                height: [8, 20 + b * 4, 6, 24 - b * 2, 12],
              } : { height: 6 }}
              transition={isPlaying ? {
                duration: 0.6 + b * 0.1,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
                delay: b * 0.08,
              } : { duration: 0.3 }}
            />
          ))}
        </div>

        {/* Başlık */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 18,
            fontWeight: 600,
            color: 'white',
            margin: 0,
            lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            margin: '4px 0 0',
            letterSpacing: '0.5px',
          }}>
            {artist}
          </p>
        </div>

        {/* Yükleniyor spinner */}
        {isLoading && (
          <div style={{
            width: 20, height: 20, flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.15)',
            borderTopColor: 'rgba(99,179,237,0.8)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 10, position: 'relative' }}>
        {/* Track arka planı */}
        <div style={{
          position: 'relative', height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.12)',
          marginBottom: 0,
        }}>
          {/* Dolum */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #4299e1, #63b3ed)',
            borderRadius: 2,
            transition: isDragging ? 'none' : 'width 0.1s linear',
          }} />
          {/* Thumb görsel */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: `calc(${progress}% - 7px)`,
            width: 14, height: 14,
            background: 'white',
            borderRadius: '50%',
            boxShadow: '0 0 0 3px rgba(99,179,237,0.4)',
            transition: isDragging ? 'none' : 'left 0.1s linear',
            pointerEvents: 'none',
          }} />
          {/* Invisible range input üstte */}
          <input
            ref={progressRef}
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchEnd={() => setIsDragging(false)}
            style={{
              position: 'absolute', top: '50%', left: 0, right: 0,
              transform: 'translateY(-50%)',
              width: '100%', height: 28,
              opacity: 0, cursor: 'pointer',
              margin: 0, padding: 0,
              WebkitAppearance: 'none',
            }}
          />
        </div>

        {/* Zaman göstergesi */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.5px',
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Kontroller */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 20, marginTop: 4,
      }}>
        {/* -5 saniye */}
        <button
          onClick={() => skip(-5)}
          aria-label="5 saniye geri"
          style={{
            position: 'relative',
            width: 52, height: 52,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 1,
            transition: 'background 0.15s, transform 0.1s',
          }}
          onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.79"/>
          </svg>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.3px' }}>5s</span>
          <AnimatePresence>
            {skipFeedback === '-5' && (
              <motion.span
                key="skip-back"
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -16 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute', top: -2, left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 12, color: '#63b3ed', fontWeight: 700, pointerEvents: 'none',
                }}
              >
                -5
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Play / Pause */}
        <motion.button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Duraklat' : 'Oynat'}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 72, height: 72,
            borderRadius: '50%',
            background: isLoading
              ? 'rgba(255,255,255,0.15)'
              : 'linear-gradient(145deg, #4299e1, #2b6cb0)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: isPlaying
              ? '0 0 0 8px rgba(66,153,225,0.2), 0 8px 24px rgba(43,108,176,0.5)'
              : '0 8px 24px rgba(43,108,176,0.4)',
            transition: 'box-shadow 0.3s, background 0.3s',
          }}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  width: 22, height: 22,
                  border: '2.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : isPlaying ? (
              <motion.svg
                key="pause"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
                width="26" height="26" viewBox="0 0 24 24"
                fill="white"
              >
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </motion.svg>
            ) : (
              <motion.svg
                key="play"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
                width="26" height="26" viewBox="0 0 24 24"
                fill="white"
                style={{ marginLeft: 3 }}
              >
                <path d="M5 3l14 9-14 9V3z"/>
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        {/* +5 saniye */}
        <button
          onClick={() => skip(5)}
          aria-label="5 saniye ileri"
          style={{
            position: 'relative',
            width: 52, height: 52,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 1,
            transition: 'background 0.15s',
          }}
          onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.79"/>
          </svg>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.3px' }}>5s</span>
          <AnimatePresence>
            {skipFeedback === '+5' && (
              <motion.span
                key="skip-fwd"
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -16 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute', top: -2, left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 12, color: '#63b3ed', fontWeight: 700, pointerEvents: 'none',
                }}
              >
                +5
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Gizli audio elementi */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
        onWaiting={() => setIsLoading(true)}
        preload="metadata"
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
