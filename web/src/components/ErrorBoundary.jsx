// Red de seguridad general: sin esto, CUALQUIER error de render en
// cualquier pantalla desmonta todo el árbol de React y deja una pantalla
// en blanco, sin aviso ni forma de recuperarse salvo cerrar y reabrir la
// app a mano. Ya pasó una vez (SessionView.jsx, revisión final de la
// migración a secuencia) — esto no evita el bug, pero evita que el
// siguiente bug parecido deje a Enzo mirando una pantalla negra.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary atrapó:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 16px' }}>
          Algo se rompió en esta pantalla.<br />
          Tus datos siguen guardados — recargá para seguir.
        </p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
