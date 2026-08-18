import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Limpieza única del service worker de la app vainilla. Esa versión cacheaba
// su propio index.html con estrategia cache-first bajo el nombre 'fierro-vNN'
// (ver legacy/sw.js). El service worker nuevo lo reemplaza solo — el navegador
// compara sw.js byte a byte y skipWaiting/clientsClaim lo activan enseguida —
// pero el caché viejo queda huérfano ocupando espacio con una copia completa
// de la app anterior, así que lo borramos explícitamente.
//
// El patrón /^fierro-v\d+$/ es deliberadamente estrecho: los cachés de workbox
// se llaman 'workbox-precache-*', así que esto no puede tocarlos.
if ('caches' in window) {
  caches.keys()
    .then(names => Promise.all(
      names.filter(n => /^fierro-v\d+$/.test(n)).map(n => caches.delete(n))
    ))
    .catch(() => { /* sin permisos de Cache Storage: no pasa nada */ });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
