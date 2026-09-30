// Import dinámico que, si el módulo no llega, devuelve un respaldo en vez de
// rechazar. Para usar con React.lazy en módulos DECORATIVOS: sin esto, un
// import que falla llega al ErrorBoundary y se lleva la pantalla entera.
//
// Caso real (2026-09-29): tras una publicación, el estallido de récord
// (PrBurst) no se pudo bajar y la vista de la sesión recién guardada quedó en
// "Algo se rompió en esta pantalla" — por una animación de 44×44. Ver también
// scripts/publicaciones.mjs, que ataca la causa (el archivo ya no estaba).
export function importarConRespaldo(importar, Respaldo) {
  return importar().catch(() => ({ default: Respaldo }));
}
