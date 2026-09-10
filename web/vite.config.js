import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas en el build. El sitio se sirve desde la raíz del repo
  // (GitHub Pages con .nojekyll), y la app vainilla ya usaba './' en todos
  // lados: con base '/' el build sólo funcionaría en un dominio propio.
  base: './',
  // Sello del build, visible en Ajustes. Existe porque la app se instala como
  // PWA y el service worker puede seguir sirviendo una versión vieja del caché:
  // sin un número a la vista no hay forma de distinguir "el cambio no se
  // publicó" de "tu teléfono todavía tiene el anterior".
  define: {
    __BUILD__: JSON.stringify(
      new Date().toLocaleString('es-PE', {
        timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FIERRO — Gym Tracker',
        short_name: 'FIERRO',
        description: 'Registro personal de entrenamiento, nutrición y progreso',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#04070F',
        theme_color: '#04070F',
        lang: 'es',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /* Los 4 PNG de ícono (324 KB, más de un tercio del precache) SALEN del
           precache: la app nunca los dibuja. Son para el instalador del
           sistema operativo y para la pantalla de inicio del teléfono, que
           los pide una vez al instalar y se los queda él. Precargarlos hacía
           que cada arranque en frío del service worker se trajera un tercio
           de más en imágenes que ninguna pantalla usa.
           Siguen en dist/ (viven en public/) y el manifest los sigue
           declarando: lo único que cambia es que no se bajan por adelantado. */
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        // El navegador ya tiene registrado el service worker de la app
        // vainilla (caché 'fierro-vNN', cache-first). Estas tres opciones son
        // las que hacen que el nuevo lo reemplace sin que el usuario tenga que
        // desinstalar la PWA: activar sin esperar a que cierre las pestañas
        // viejas, tomar control de las que ya están abiertas, y limpiar
        // precachés de workbox obsoletos entre despliegues.
        // (El caché legacy 'fierro-vNN' no lo borra workbox — eso lo hace
        // main.jsx al arrancar; ver el comentario allá.)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // generateSW no deja escribir código propio dentro del service worker;
        // esto es la vía oficial para sumarle uno. sw-notif.js hace que tocar
        // la notificación de sesión en curso abra la app — sin él no hay nadie
        // escuchando el evento y el toque no hace nada.
        importScripts: ['sw-notif.js'],
      },
    }),
  ],
})
