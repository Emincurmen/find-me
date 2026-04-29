import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true, // tüm host'lara izin ver (cloudflare/localtunnel tünelleri için)
    headers: {
      // Spotify iframe embed'ine izin ver
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.openstreetmap.org https://*.tile.openstreetmap.org",
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://router.project-osrm.org",
        "frame-src https://open.spotify.com",
        "media-src 'self' blob: https:",
      ].join('; '),
    },
  },
})

