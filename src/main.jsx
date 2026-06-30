import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Capture the URL hash before Supabase initialises and processes it.
// This lets the portal detect recovery/invite links reliably.
if (window.location.hash) {
  sessionStorage.setItem('_initialHash', window.location.hash)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
