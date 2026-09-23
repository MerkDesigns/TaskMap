import { Component, type ErrorInfo, type ReactNode } from "react";
import type { ApplicationErrorReporter } from "./applicationErrorReporter";

export interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode;
  readonly reporter: ApplicationErrorReporter;
  readonly fallback?: ReactNode;
}

interface ApplicationErrorBoundaryState {
  readonly failed: boolean;
}

export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  public state: ApplicationErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): ApplicationErrorBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.reporter.report({
      source: "new-architecture",
      error,
      componentStack: info.componentStack ?? null,
    });
  }

  public render() {
    if (this.state.failed) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <main role="alert">
          <h1>TaskMap could not open this part of the application.</h1>
          <p>Please close TaskMap and try again.</p>
        </main>
      );
    }

    return this.props.children;
  }
}
