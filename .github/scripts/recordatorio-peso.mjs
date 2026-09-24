// Manda el push del recordatorio diario de peso. Lo corre
// .github/workflows/recordatorio-peso.yml; del lado del teléfono lo recibe
// web/public/sw-notif.js y lo abre en el formulario de peso.
//
// Los estados de salida importan porque GitHub avisa por mail cuando un
// workflow falla:
//   - sin secretos todavía       → sale bien, con una nota (la app no se
//                                   configuró; no es un error diario)
//   - 404/410 del servicio push   → sale bien, con una advertencia: la
//                                   suscripción se dio de baja (apagaste el
//                                   recordatorio en Ajustes, o el navegador
//                                   la tiró). Ajustes → Avisos lo muestra.
//   - cualquier otra cosa         → falla, y te llega el mail
import webpush from 'web-push';

// trim(): pegar el secreto desde PowerShell o la web suele sumarle un salto de
// línea, y web-push rechaza la clave si no decodifica a 32 bytes exactos.
const env = k => (process.env[k] || '').trim();
const VAPID_PRIVATE_KEY = env('VAPID_PRIVATE_KEY'), VAPID_PUBLIC_KEY = env('VAPID_PUBLIC_KEY');
const PUSH_SUBSCRIPTION = env('PUSH_SUBSCRIPTION'), VAPID_SUBJECT = env('VAPID_SUBJECT');

if (!VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
  console.log('::notice::Faltan los secretos VAPID_PRIVATE_KEY y/o PUSH_SUBSCRIPTION: el recordatorio todavía no está configurado.');
  process.exit(0);
}

let sub;
try {
  sub = JSON.parse(PUSH_SUBSCRIPTION);
} catch {
  console.log('::error::PUSH_SUBSCRIPTION no es un JSON válido. Volvé a copiarlo desde Ajustes → Avisos.');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT || 'https://exorplion.github.io/gymapp/', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const payload = JSON.stringify({
  title: '¿Ya te pesaste?',
  body: 'Registrá tu peso de hoy. En ayunas y después del baño es el dato más comparable.',
  tag: 'fierro-peso',
  accion: 'peso',
  url: './?accion=peso',
});

try {
  // TTL de 6 horas: si el teléfono estuvo apagado toda la mañana, un "¿ya te
  // pesaste?" a mediodía ya no sirve — mejor que no llegue.
  const r = await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' });
  console.log(`Enviado (${r.statusCode}).`);
} catch (e) {
  if (e.statusCode === 404 || e.statusCode === 410) {
    console.log(`::warning::La suscripción ya no existe (${e.statusCode}). Si no apagaste el recordatorio a propósito, activalo de nuevo en Ajustes → Avisos y actualizá el secreto PUSH_SUBSCRIPTION.`);
    process.exit(0);
  }
  console.log(`::error::No se pudo enviar el push: ${e.statusCode || ''} ${e.body || e.message}`);
  process.exit(1);
}
