// Red de seguridad general: sin esto, CUALQUIER error de render en
// cualquier pantalla desmonta todo el árbol de React y deja una pantalla
// en blanco, sin aviso ni forma de recuperarse salvo cerrar y reabrir la
// app a mano. Ya pasó una vez (SessionView.jsx, revisión final de la
// migración a secuencia) — esto no evita el bug, pero evita que el
// siguiente bug parecido deje a Enzo mirando una pantalla negra.
//
// El detalle del error se MUESTRA, no sólo se loguea: en un celular no hay
// consola, así que un boundary que sólo dice "algo se rompió" no deja forma
// de saber qué se rompió. Pasó de verdad — el crash de la pestaña Rutina
// (subBlocksOf con un turno de descanso) hubo que diagnosticarlo leyendo
// código a ciegas porque el mensaje no llegaba a ningún lado.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: '', copiado: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ stack: info?.componentStack || '' });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary atrapó:', error, info?.componentStack);
  }

  detalle() {
    const e = this.state.error;
    return [
      `${e?.name || 'Error'}: ${e?.message || String(e)}`,
      this.state.stack.trim(),
    ].filter(Boolean).join('\n\n');
  }

  copiar = async () => {
    try {
      await navigator.clipboard.writeText(this.detalle());
      this.setState({ copiado: true });
    } catch {
      // Sin permiso de portapapeles el texto ya está visible en pantalla:
      // se puede seleccionar a mano o sacarle una captura.
      this.setState({ copiado: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ padding: 'calc(var(--s6) * 1.5) var(--s5)', textAlign: 'center' }}>
        <p style={{ margin: '0 0 var(--s4)' }}>
          Algo se rompió en esta pantalla.<br />
          Tus datos siguen guardados — recargá para seguir.
        </p>
        <pre
          className="s text-mut"
          style={{
            margin: '0 auto 16px', maxWidth: 340, textAlign: 'left',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 180, overflow: 'auto', userSelect: 'text',
          }}
        >
          {this.detalle()}
        </pre>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <button type="button" className="btn ghost" onClick={this.copiar}>
            {this.state.copiado ? '✓ Copiado' : 'Copiar detalle'}
          </button>
        </div>
      </div>
    );
  }
}
