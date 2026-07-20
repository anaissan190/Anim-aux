// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const errorFallback = (
  <div className="min-h-screen flex items-center justify-center bg-sage-50 px-4">
    <div className="card p-8 text-center max-w-md">
      <div className="text-4xl mb-3">😿</div>
      <h1 className="text-lg font-bold text-gray-900 mb-2">Une erreur est survenue</h1>
      <p className="text-sm text-gray-500 mb-6">
        Le problème a été signalé automatiquement. Essayez de rafraîchir la page.
      </p>
      <button onClick={() => window.location.reload()} className="btn-primary">
        Rafraîchir la page
      </button>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={errorFallback}>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
