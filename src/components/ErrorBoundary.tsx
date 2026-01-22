import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 min-h-screen text-red-900 overflow-auto pt-10">
          <h1 className="text-2xl font-bold mb-4">App Crash Detected</h1>
          <p className="font-bold mb-2">Error Details:</p>
          <pre className="bg-white p-4 rounded border border-red-200 text-xs overflow-auto mb-4">
            {this.state.error?.message}
          </pre>
          <p className="text-sm mb-4">Take a screenshot of this and show the developer.</p>
          <button 
            className="w-full bg-red-600 text-white px-4 py-3 rounded-lg font-bold active:scale-95 transition-transform"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;