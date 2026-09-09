import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback UI to render when an error is caught */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * React Error Boundary — menangkap semua uncaught runtime error
 * dari child components dan menampilkan fallback UI alih-alih white screen.
 *
 * Harus menggunakan Class Component karena React hooks tidak bisa
 * menangkap error dari children (getDerivedStateFromError + componentDidCatch).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    // Log error for debugging (visible in browser DevTools console)
    console.error('[KaiwaDojo ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    // Clear any stale cached state that might be causing the error
    try {
      sessionStorage.removeItem('kaiwa_custom_profile')
      sessionStorage.removeItem('kaiwa_session_active')
      sessionStorage.removeItem('kaiwa_client_session_id')
    } catch { /* ignore storage errors */ }
    window.location.reload()
  }

  handleGoHome = () => {
    try {
      sessionStorage.removeItem('kaiwa_custom_profile')
      sessionStorage.removeItem('kaiwa_session_active')
      sessionStorage.removeItem('kaiwa_client_session_id')
    } catch { /* ignore storage errors */ }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default friendly error UI
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            fontFamily: "'Inter', 'Outfit', system-ui, -apple-system, sans-serif",
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '40px 28px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '28px',
                border: '1px solid #fecaca',
              }}
            >
              ⚠️
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#1e293b',
                margin: '0 0 8px',
                lineHeight: 1.3,
              }}
            >
              Oops! Terjadi Kesalahan
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: '13px',
                color: '#64748b',
                margin: '0 0 24px',
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              Halaman mengalami masalah dan tidak bisa ditampilkan.
              Coba muat ulang halaman atau kembali ke beranda.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#B91C1C',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                🔄 Muat Ulang Halaman
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                🏠 Kembali ke Beranda
              </button>
            </div>

            {/* Error Details (collapsed by default, for debugging) */}
            {this.state.error && (
              <details
                style={{
                  marginTop: '20px',
                  textAlign: 'left',
                  backgroundColor: '#fef2f2',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #fecaca',
                }}
              >
                <summary
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#991b1b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  🔍 Detail Error (untuk Admin / Developer)
                </summary>
                <pre
                  style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    color: '#7f1d1d',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                    maxHeight: '150px',
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack
                    ? `\n\nComponent Stack:${this.state.errorInfo.componentStack}`
                    : ''}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
