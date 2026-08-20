import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// NOTE: the recovery/invite hash is captured inside lib/authRecovery.jsx, which
// runs at import time (i.e. before this line) — doing it here was too late.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
