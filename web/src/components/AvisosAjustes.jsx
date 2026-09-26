// Bloque "Avisos" de Ajustes (vive fuera de sheets/ porque no es una hoja:
// es un pedazo de la de Ajustes): qué notificaciones manda la app, una por una,
// y el recordatorio diario de peso (lib/push.js).
//
// Lista agrupada (.group + .grouprow) y no un .seg por aviso: son tres
// interruptores del mismo tipo, y tres barras de "Sí | No" apiladas se leían
// como un formulario, no como ajustes.
import { useEffect, useState } from 'react';
import { S, saveCfg, bump } from '../lib/state.js';
import { avisoActivo, cerrarNotificacion, TAG_DESCANSO, TAG_SESION } from '../lib/notify.js';
import {
  estadoRecordatorio, activarRecordatorio, apagarRecordatorio, suscripcionActual,
} from '../lib/push.js';
import { toast } from '../lib/toast.js';
import { enModoPrueba } from '../lib/modoPrueba.js';

const TIPOS = [
  { k: 'descanso', t: 'Fin del descanso', s: 'En la barra del teléfono. El sonido y la vibración siguen igual.', tag: TAG_DESCANSO },
  { k: 'sesion', t: 'Sesión en curso', s: 'Tiempo y ejercicios mientras entrenás.', tag: TAG_SESION },
];

/** Lo que dice la fila del recordatorio según el estado real. */
const ETIQUETA = {
  'cargando': '…',
  'activo': '4:00',
  'apagado': 'No',
  'desconectado': 'Revisar',
  'bloqueado': 'Bloqueado',
  'sin-soporte': 'No disponible',
};

function setAviso(k, on, tag) {
  const prev = S.cfg.avisos && typeof S.cfg.avisos === 'object' ? S.cfg.avisos : {};
  S.cfg.avisos = { ...prev, [k]: on };
  if (!on) cerrarNotificacion(tag);
  saveCfg();
  bump();
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

export default function AvisosAjustes() {
  const [estado, setEstado] = useState('cargando');
  const [codigo, setCodigo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoRecordatorio().then(e => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);

  async function activar() {
    setOcupado(true);
    try {
      const json = await activarRecordatorio();
      setCodigo(json);
      setEstado('activo');
      toast(await copiar(json) ? 'Código copiado' : 'Copiá el código de abajo');
    } catch (e) {
      toast(e.message || 'No se pudo activar');
      setEstado(await estadoRecordatorio());
    } finally { setOcupado(false); }
  }

  async function volverACopiar() {
    const json = await suscripcionActual();
    if (!json) { setEstado(await estadoRecordatorio()); return; }
    setCodigo(json);
    toast(await copiar(json) ? 'Código copiado' : 'Copiá el código de abajo');
  }

  async function apagar() {
    setOcupado(true);
    await apagarRecordatorio();
    setCodigo(null);
    setEstado('apagado');
    setOcupado(false);
  }

  return (
    <>
      <div className="group">
        {TIPOS.map(({ k, t, s, tag }) => {
          const on = avisoActivo(k);
          return (
            <button key={k} type="button" className="grouprow" role="switch" aria-checked={on} onClick={() => setAviso(k, !on, tag)}>
              <span className="grouprow-grow">
                <span className="grouprow-t">{t}</span>
                <span className="grouprow-s">{s}</span>
              </span>
              <span className="grouprow-v">{on ? 'Sí' : 'No'}</span>
            </button>
          );
        })}
        <div className="grouprow" style={{ cursor: 'default' }}>
          <span className="grouprow-grow">
            <span className="grouprow-t">Recordatorio de peso</span>
            <span className="grouprow-s">Todos los días a las 4:00, aunque la app esté cerrada.</span>
          </span>
          <span className="grouprow-v">{ETIQUETA[estado]}</span>
        </div>
      </div>

      <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, margin: 'var(--s3) 0 var(--s3)' }}>
        {estado === 'apagado' && <>Lo manda una tarea diaria de GitHub. Al activarlo se copia un código que hay que pegar una sola vez en el repo como secreto <b>PUSH_SUBSCRIPTION</b> (o pasárselo a Claude).</>}
        {estado === 'activo' && !codigo && <>✓ Activo en este teléfono. Si cambiaste de teléfono o reinstalaste la app, volvé a copiar el código y actualizá el secreto.</>}
        {estado === 'desconectado' && <b className="txt-warn">⚠ El navegador perdió la suscripción: el recordatorio ya no llega. Activalo de nuevo y actualizá el secreto PUSH_SUBSCRIPTION con el código nuevo.</b>}
        {estado === 'bloqueado' && <>Las notificaciones de FIERRO están bloqueadas. Se habilitan en la configuración del sitio del navegador (Notificaciones → Permitir).</>}
        {estado === 'sin-soporte' && <>Este navegador no recibe notificaciones push. En iPhone sólo funcionan con la app instalada desde Safari.</>}
      </div>

      {codigo && (
        <>
          <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 'var(--s2)' }}>
            Pegá esto en GitHub → gymapp → Settings → Secrets and variables → Actions → <b>PUSH_SUBSCRIPTION</b>:
          </div>
          <textarea readOnly value={codigo} rows={4} aria-label="Código de suscripción" onFocus={e => e.target.select()}
            className="w-full rounded-[var(--radius-r)] border border-line2 bg-card2 p-3 text-micro text-mut outline-none"
            style={{ marginBottom: 'var(--s3)', wordBreak: 'break-all', fontFamily: 'monospace' }} />
        </>
      )}

      {/* La suscripción push es del navegador, no de la base: apagarla o
          renovarla desde la copia de prueba le cortaría el recordatorio a
          la app real. */}
      {enModoPrueba() && (
        <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          En modo prueba el recordatorio no se puede cambiar: se maneja desde tu app real.
        </div>
      )}
      {!enModoPrueba() && (estado === 'apagado' || estado === 'desconectado') && (
        <button type="button" className="btn" style={{ marginBottom: 10 }} onClick={activar} disabled={ocupado}>
          {ocupado ? 'Activando…' : estado === 'desconectado' ? 'Volver a activar' : 'Activar recordatorio de peso'}
        </button>
      )}
      {!enModoPrueba() && estado === 'activo' && (
        <>
          <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={volverACopiar}>Copiar el código otra vez</button>
          <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={apagar} disabled={ocupado}>Apagar el recordatorio</button>
        </>
      )}
    </>
  );
}
