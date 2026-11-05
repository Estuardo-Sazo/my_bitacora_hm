import type { ReactNode } from 'react';
import { Component } from 'react';
import styles from './Splash.module.css';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.splash} role="alert">
        <div>
          <p>Algo salió mal al mostrar esta pantalla. Tus datos guardados no se perdieron.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              location.reload();
            }}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
