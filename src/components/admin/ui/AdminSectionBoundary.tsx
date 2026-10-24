"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./AdminSectionBoundary.module.css";

type Props = { section: string; onBack: () => void; children: ReactNode };
type State = { error: Error | null };

/** Um painel secundário não pode tornar indisponíveis Cozinha e pedidos. */
export class AdminSectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.section !== this.props.section && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[admin/management-recovery]", this.props.section, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className={styles.fallback} role="alert" aria-label="Recuperação do painel administrativo">
        <span className={styles.eyebrow}>SEÇÃO TEMPORARIAMENTE INDISPONÍVEL</span>
        <strong>Não foi possível abrir {this.props.section}.</strong>
        <p>Seus pedidos continuam disponíveis. Uma versão antiga do aplicativo pode estar em cache.</p>
        <div className={styles.actions}>
          <button type="button" onClick={() => { this.setState({ error: null }); this.props.onBack(); }}>Voltar à Cozinha</button>
          <button type="button" onClick={() => this.setState({ error: null })}>Tentar novamente</button>
          <button type="button" onClick={() => window.location.assign("/admin")}>Reabrir Admin atualizado</button>
        </div>
      </section>
    );
  }
}
