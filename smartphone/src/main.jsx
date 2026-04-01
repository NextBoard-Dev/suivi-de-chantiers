import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || 'Erreur inattendue') }
  }
  componentDidCatch(error) {
    try { console.error('[smartphone-ui-error]', error) } catch (_) {}
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Erreur d&apos;affichage smartphone</h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35 }}>
          {this.state.message || 'Un problème est survenu.'}
        </p>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
)
