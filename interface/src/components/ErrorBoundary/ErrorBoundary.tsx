import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback to help identify which boundary caught the error. */
  name?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleReload = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className={styles.errorContainer}>
        <strong className={styles.errorHeading}>
          Something went wrong{this.props.name ? ` in ${this.props.name}` : ""}
        </strong>
        <pre className={styles.errorTrace}>
          {error.message}
        </pre>
        {componentStack && (
          <pre className={styles.errorTrace} style={{ fontSize: 10, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", textAlign: "left", marginTop: 8 }}>
            {componentStack}
          </pre>
        )}
        {error.stack && (
          <pre className={styles.errorTrace} style={{ fontSize: 9, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", textAlign: "left", marginTop: 8, opacity: 0.7 }}>
            {error.stack}
          </pre>
        )}
        <button onClick={this.handleReload} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }
}
