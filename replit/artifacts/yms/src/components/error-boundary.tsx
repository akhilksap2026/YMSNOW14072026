/**
 * App-wide React error boundary.
 *
 * Catches any uncaught render/lifecycle error inside its subtree and shows a
 * friendly fallback instead of a blank screen. Provides two escape hatches:
 *   • "Try again" — resets local error state (useful if the error was transient)
 *   • "Reload page" — full hard reload
 *
 * This component does NOT alter any normal rendering path — it is purely an
 * additive safety net that only activates on an uncaught exception.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so developers can see the trace; no analytics/remote logging.
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-5 p-10 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              An unexpected error occurred in this part of the application.
              You can try again or reload the page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
