import React from 'react'
import ReactDOM from 'react-dom/client'
import posthog from 'posthog-js'
import App from './App.jsx'
import './index.css'

// Initialisation Posthog (uniquement si la clé est définie)
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: 'https://eu.i.posthog.com', // serveurs EU
    capture_pageview: true,               // pages vues automatiques
    capture_pageleave: true,              // durée des visites
    person_profiles: 'identified_only',   // profils seulement pour les connectés
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
