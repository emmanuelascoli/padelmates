import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LEVEL_OPTIONS } from '../lib/constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import PasswordInput from '../components/PasswordInput'

const LEVELS = LEVEL_OPTIONS

// ── Google logo SVG ──────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ── Divider ──────────────────────────────────────────────────
function Divider({ label = 'ou' }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// ── Step indicator ───────────────────────────────────────────
function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2 flex-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
            n < step  ? 'bg-green-100 text-green-600' :
            n === step ? 'bg-blue-600 text-white' :
                         'bg-gray-100 text-gray-400'
          }`}>
            {n < step ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : n}
          </div>
          {n < 2 && (
            <div className={`flex-1 h-1 rounded-full transition-colors ${n < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
      <span className="text-xs text-gray-500 font-medium ml-1 shrink-0">Étape {step} / 2</span>
    </div>
  )
}

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const joinSessionId = searchParams.get('join')
  const initialMode   = searchParams.get('mode') === 'register' ? 'register' : 'login'

  const [mode, setMode]         = useState(initialMode)
  const [regStep, setRegStep]   = useState(1)          // 1 | 2 — for register flow
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [form, setForm] = useState({
    email: '', password: '',
    name: '', phone: '', level: '3',
  })
  const [cguAccepted, setCguAccepted] = useState(false)

  const [joinSession, setJoinSession] = useState(null)

  useEffect(() => {
    if (joinSessionId) fetchJoinSession()
  }, [joinSessionId])

  async function fetchJoinSession() {
    const { data } = await supabase
      .from('sessions')
      .select('id, title, date, time, location, max_players, cost_per_player, session_participants(id)')
      .eq('id', joinSessionId)
      .single()
    if (data) setJoinSession({ ...data, _count: data.session_participants?.length ?? 0 })
  }

  function saveRememberPreference() {
    if (rememberMe) {
      localStorage.removeItem('padelmates_session_only')
      sessionStorage.removeItem('padelmates_active')
    } else {
      localStorage.setItem('padelmates_session_only', '1')
      sessionStorage.setItem('padelmates_active', '1')
    }
  }

  function redirectAfterAuth() {
    saveRememberPreference()
    navigate(joinSessionId ? `/sessions/${joinSessionId}` : '/')
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  // ── Google OAuth ────────────────────────────────────────────
  async function handleGoogleAuth() {
    setGoogleLoading(true)
    saveRememberPreference()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: joinSessionId
          ? `${window.location.origin}/sessions/${joinSessionId}`
          : window.location.origin,
      },
    })
    if (error) {
      setError('Erreur Google : ' + error.message)
      setGoogleLoading(false)
    }
    // On success, the browser redirects to Google — no more code runs here
  }

  // ── Email login ─────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })
    if (error) { setError('Email ou mot de passe incorrect.') }
    else        { redirectAfterAuth() }
    setLoading(false)
  }

  // ── Forgot password ─────────────────────────────────────────
  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!form.email.trim()) { setError('Entre ton adresse email.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setError('Erreur lors de l\'envoi. Vérifie ton adresse email.') }
    else        { setSuccess('Un lien de réinitialisation a été envoyé à ton adresse email.') }
    setLoading(false)
  }

  // ── Register step 1 : create auth user ─────────────────────
  async function handleRegisterStep1(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      setRegStep(2)
    } else {
      setSuccess('Vérifiez votre email pour confirmer votre compte.')
    }
    setLoading(false)
  }

  // ── Register step 2 : create profile ───────────────────────
  async function handleRegisterStep2(e) {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Le prénom et nom sont obligatoires (minimum 2 caractères).')
      return
    }
    if (!cguAccepted) {
      setError('Tu dois accepter les CGU et la politique de confidentialité pour continuer.')
      return
    }
    setLoading(true); setError('')

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) { setError('Session expirée, recommence.'); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id:    currentUser.id,
      name:  form.name.trim(),
      phone: form.phone.trim() || null,
      level: form.level,
    })
    if (profileError) { setError(profileError.message); setLoading(false); return }

    redirectAfterAuth()
  }

  const formatSessionDate = (s) =>
    s ? format(new Date(`${s.date}T${s.time}`), 'EEEE d MMMM à HH:mm', { locale: fr }) : ''
  const spotsLeft = joinSession ? joinSession.max_players - joinSession._count : 0

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 -mt-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">

        {/* Session join context banner */}
        {joinSession && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Tu veux rejoindre</p>
            <p className="font-bold text-gray-900">{joinSession.title}</p>
            <p className="text-sm text-gray-500 capitalize mt-0.5">{formatSessionDate(joinSession)}</p>
            <p className="text-sm text-gray-500">📍 {joinSession.location}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {spotsLeft > 0 ? `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} dispo` : 'Liste d\'attente'}
              </span>
              {joinSession.cost_per_player > 0 && (
                <span className="text-xs text-gray-500">{joinSession.cost_per_player} CHF / joueur</span>
              )}
            </div>
          </div>
        )}

        {/* Brand */}
        {!joinSession && (
          <div className="text-center mb-7">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">🎾</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PadelMates</h1>
            <p className="text-gray-500 text-sm mt-1">Gérez vos parties de padel entre amis</p>
          </div>
        )}
        {joinSession && (
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🎾</span>
            <span className="font-bold text-gray-900">PadelMates</span>
          </div>
        )}

        {/* Mode tabs (only login/register, not forgot, not step 2) */}
        {mode !== 'forgot' && !(mode === 'register' && regStep === 2) && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {[
              { key: 'login',    label: 'Connexion' },
              { key: 'register', label: 'Inscription' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setRegStep(1); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Step indicator (register step 2) */}
        {mode === 'register' && regStep === 2 && (
          <StepIndicator step={2} />
        )}

        {/* Forgot password header */}
        {mode === 'forgot' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Mot de passe oublié</h2>
            <p className="text-sm text-gray-500 mt-1">Entre ton email pour recevoir un lien de réinitialisation.</p>
          </div>
        )}

        {/* Error / Success */}
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">{success}</div>}

        {/* ── Google button (login + register step 1 only) ── */}
        {mode !== 'forgot' && !(mode === 'register' && regStep === 2) && (
          <>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50"
            >
              <GoogleLogo />
              {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
            </button>
            <Divider />
          </>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required className="input" placeholder="marie@exemple.ch" />
            </div>
            <div>
              <label className="label">Mot de passe *</label>
              <PasswordInput name="password" value={form.password} onChange={handleChange} required minLength={6} placeholder="Minimum 6 caractères" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div onClick={() => setRememberMe(v => !v)} className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm text-gray-600">Rester connecté</span>
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Chargement…' : joinSession ? 'Me connecter et rejoindre la partie' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* ── Register step 1 : email + password ── */}
        {mode === 'register' && regStep === 1 && (
          <form onSubmit={handleRegisterStep1} className="space-y-4">
            <StepIndicator step={1} />
            <div>
              <label className="label">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required className="input" placeholder="marie@exemple.ch" />
            </div>
            <div>
              <label className="label">Mot de passe *</label>
              <PasswordInput name="password" value={form.password} onChange={handleChange} required minLength={6} placeholder="Minimum 6 caractères" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div onClick={() => setRememberMe(v => !v)} className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm text-gray-600">Rester connecté</span>
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Vérification…' : 'Continuer →'}
            </button>
          </form>
        )}

        {/* ── Register step 2 : name + phone + level ── */}
        {mode === 'register' && regStep === 2 && (
          <form onSubmit={handleRegisterStep2} className="space-y-4">
            <div>
              <label className="label">
                Prénom et Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text" name="name" value={form.name} onChange={handleChange}
                required minLength={2} autoFocus
                className={`input ${!form.name.trim() && form.name !== '' ? 'border-red-300 focus:ring-red-300' : ''}`}
                placeholder="Marie Dupont"
              />
            </div>
            <div>
              <label className="label">Téléphone <span className="text-gray-400 font-normal">(facultatif)</span></label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="input" placeholder="+41 79 123 45 67" />
              <p className="text-xs text-gray-400 mt-1">Visible des autres joueurs (WhatsApp, appels).</p>
            </div>
            <div>
              <label className="label">Niveau de jeu</label>
              <select name="level" value={form.level} onChange={handleChange} className="input">
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            {/* Case CGU obligatoire */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div
                onClick={() => setCguAccepted(v => !v)}
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 mt-0.5 ${cguAccepted ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
              >
                {cguAccepted && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600 leading-snug">
                J'accepte les{' '}
                <a href="/cgu" target="_blank" className="text-blue-600 hover:underline font-medium">CGU</a>
                {' '}et la{' '}
                <a href="/confidentialite" target="_blank" className="text-blue-600 hover:underline font-medium">politique de confidentialité</a>
                {' '}<span className="text-red-500">*</span>
              </span>
            </label>

            <button type="submit" disabled={loading || !cguAccepted} className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Création…' : joinSession ? 'Créer mon compte et rejoindre la partie' : 'Créer mon compte →'}
            </button>
          </form>
        )}

        {/* ── Forgot password form ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required className="input" placeholder="marie@exemple.ch" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        {/* ── Footer links ── */}
        {mode === 'login' && (
          <div className="mt-4 space-y-2 text-center">
            <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} className="text-sm text-blue-600 hover:underline block w-full">
              Mot de passe oublié ?
            </button>
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{' '}
              <button onClick={() => { setMode('register'); setRegStep(1); setError('') }} className="text-blue-700 font-medium hover:underline">
                S'inscrire
              </button>
            </p>
          </div>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} className="text-sm text-gray-500 hover:text-gray-700 mt-4 block w-full text-center">
            ← Retour à la connexion
          </button>
        )}
        {mode === 'register' && regStep === 2 && (
          <button onClick={() => { setRegStep(1); setError('') }} className="text-sm text-gray-400 hover:text-gray-600 mt-4 block w-full text-center">
            ← Modifier l'email / mot de passe
          </button>
        )}
        {!joinSession && mode !== 'forgot' && !(mode === 'register' && regStep === 2) && (
          <div className="mt-4 text-center">
            <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-600">
              ← Retour à l'accueil
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
