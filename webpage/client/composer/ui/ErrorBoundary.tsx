import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Without a boundary, any render error - a malformed share link included -
 * unmounts the whole app and leaves a blank page. This keeps a way out: start
 * over without the fragment that caused it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ComposerError message="The composer ran into a problem." />;
  }
}

export function ComposerError({ message }: { message: string }) {
  return (
    <main role="alert" className="rpp-noscript">
      <h1>Platform Composer</h1>
      <p>{message}</p>
      <p>
        <a href="/composer" target="_top">
          Start over with an empty platform
        </a>{" "}
        ·{" "}
        <a href="/" target="_top">
          Back to Rocket Pad Platforms
        </a>
      </p>
    </main>
  );
}
