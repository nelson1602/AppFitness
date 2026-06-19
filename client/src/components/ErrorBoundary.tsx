import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    const isDev = import.meta.env.DEV

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-4">

            <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-error" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-text-primary mb-2">Algo salió mal</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                Se produjo un error inesperado. Intenta recargar la página o vuelve al inicio.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-black font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-primary-hover transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar página
              </button>
              <button
                onClick={() => { this.reset(); window.location.href = '/' }}
                className="flex-1 inline-flex items-center justify-center gap-2 border border-border text-text-secondary hover:text-text-primary text-sm font-medium px-4 py-2.5 rounded-xl transition-colors hover:bg-surface-2"
              >
                <Home className="w-4 h-4" />
                Volver al inicio
              </button>
            </div>

            {isDev && (
              <details className="w-full text-left">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none">
                  Ver detalle del error
                </summary>
                <pre className="mt-2 p-3 bg-surface-2 rounded-lg text-xs text-error overflow-x-auto whitespace-pre-wrap break-words">
                  {error.message}
                  {error.stack ? `\n\n${error.stack}` : ''}
                </pre>
              </details>
            )}

          </div>
        </div>
      </div>
    )
  }
}
