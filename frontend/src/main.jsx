import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { DemoTimeProvider } from './context/DemoTimeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DemoTimeProvider>
        <App />
      </DemoTimeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
