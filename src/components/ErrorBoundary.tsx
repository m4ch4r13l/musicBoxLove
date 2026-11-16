import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application ErrorBoundary:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#120d0b] px-6 text-center text-[#f7efe6]">
          <div className="max-w-md rounded-2xl border border-[#ffe0bd]/15 bg-[#1b1411] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-semibold text-[#e89f65]">
              Algo salió mal
            </h2>
            <p className="mt-2 text-xs text-[#b8a898] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 rounded-lg bg-[#e89f65] text-[#1c120c] text-xs font-semibold cursor-pointer hover:bg-[#f2b07b]"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
