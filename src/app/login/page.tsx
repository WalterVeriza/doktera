'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function useWindowWidth() {
  const [width, setWidth] = useState(1200)
  useEffect(() => {
    setWidth(window.innerWidth)
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 640

  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  const [role, setRole] = useState<'medecin' | 'patient' | 'clinique' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inscriptionReussie, setInscriptionReussie] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [cguAcceptees, setCguAcceptees] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', prenom: '', nom: '', telephone: '', specialite: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'oubli') {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSuccess('Un email de réinitialisation a été envoyé à ' + form.email)
        setLoading(false)
        return
      }

      if (mode === 'connexion') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        const { data: profil } = await supabase.from('profils').select('role').eq('id', data.user.id).single()
        if (profil?.role === 'medecin') {
          const { data: clinique } = await supabase.from('cliniques').select('id').eq('admin_id', data.user.id).single()
          if (clinique) router.push('/dashboard/clinique')
          else router.push('/dashboard/medecin')
        } else {
          router.push('/dashboard/patient')
        }
      } else {
        if (!role) { setError('Choisissez votre rôle'); setLoading(false); return }
        if (!cguAcceptees) { setError('Vous devez accepter les CGU pour continuer'); setLoading(false); return }
        setError('')

        const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
        if (error) throw error
        if (!data.user) throw new Error('Erreur création compte')

        const profilPayload: any = {
          id: data.user.id,
          role: role === 'clinique' ? 'medecin' : role,
          telephone: form.telephone,
          prenom: form.prenom,
          nom: role === 'clinique' ? '' : form.nom,
        }
        const { error: profilError } = await supabase.from('profils').insert(profilPayload)
        if (profilError) throw new Error('Erreur profil : ' + profilError.message)

        if (role === 'medecin') {
          const { error: medecinError } = await supabase.from('medecins').insert({ id: data.user.id, specialite: form.specialite || 'Médecin généraliste' })
          if (medecinError) throw new Error('Erreur médecin : ' + medecinError.message)
        } else if (role === 'clinique') {
          const { error: medecinError } = await supabase.from('medecins').insert({ id: data.user.id, specialite: 'Clinique' })
          if (medecinError) throw new Error('Erreur clinique medecin : ' + medecinError.message)
          const { error: cliniqueError } = await supabase.from('cliniques').insert({ admin_id: data.user.id, nom: form.prenom, plan_actif: false })
          if (cliniqueError) throw new Error('Erreur clinique : ' + cliniqueError.message)
        } else {
          const { error: patientError } = await supabase.from('patients').insert({ id: data.user.id })
          if (patientError) throw new Error('Erreur patient : ' + patientError.message)
        }

        setInscriptionReussie(true)
        setLoading(false)
        return
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#faf8f4', border: '1.5px solid #f0ece2',
    borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem',
    color: '#1a1512', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  if (inscriptionReussie) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(34,129,106,0.3) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '36px 24px' : '48px 40px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 48px 96px rgba(0,0,0,0.35)', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 20px' }}>✅</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: '#0d2b22', marginBottom: '12px' }}>Compte créé !</div>
        <div style={{ fontSize: '0.88rem', color: '#7a7260', lineHeight: 1.7, marginBottom: '24px' }}>
          Un email de confirmation a été envoyé à <strong>{form.email}</strong>.<br />
          Cliquez sur le lien dans l'email pour activer votre compte.
        </div>
        <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(200,153,42,0.2)', fontSize: '0.82rem', color: '#a8906a', marginBottom: '28px', lineHeight: 1.6 }}>
          ⚠️ Vérifiez aussi vos <strong>spams</strong> si vous ne recevez pas l'email.
        </div>
        <button onClick={() => { setInscriptionReussie(false); setMode('connexion'); setForm({ email: '', password: '', prenom: '', nom: '', telephone: '', specialite: '' }); setCguAcceptees(false) }} style={{ padding: '12px 32px', borderRadius: '12px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', width: '100%' }}>
          Aller à la connexion →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#0d2b22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', fontFamily: 'Outfit, sans-serif',
      padding: isMobile ? '20px 16px' : '40px 24px',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(34,129,106,0.3) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 20% 80%, rgba(200,153,42,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

      <div style={{
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
        borderRadius: isMobile ? '20px' : '28px',
        padding: isMobile ? '32px 24px' : '52px 44px',
        width: '100%', maxWidth: '440px',
        position: 'relative', zIndex: 1,
        boxShadow: '0 48px 96px rgba(0,0,0,0.35)',
      }}>

        {/* LOGO */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2.2rem' : '2.8rem', fontWeight: 600, color: '#0d2b22', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px' }}>
            Rad<em style={{ color: '#22816a' }}>oko</em>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#7a7260' }}>Santé à portée de main — Madagascar 🇲🇬</div>
        </div>

        {/* MODE MOT DE PASSE OUBLIÉ */}
        {mode === 'oubli' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>Mot de passe oublié</div>
              <div style={{ fontSize: '0.82rem', color: '#7a7260', lineHeight: 1.6 }}>Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.</div>
            </div>
            <input name="email" type="email" placeholder="Votre email" value={form.email} onChange={handleChange} style={inputStyle} />
            {error && <div style={{ background: '#fdf0ee', color: '#c0392b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>{error}</div>}
            {success && <div style={{ background: '#e8f5f1', color: '#22816a', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>✅ {success}</div>}
            <button onClick={handleSubmit} disabled={loading || !form.email} style={{ padding: '12px', borderRadius: '10px', background: loading || !form.email ? '#cfc5ae' : '#22816a', color: 'white', border: 'none', cursor: loading || !form.email ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
              {loading ? 'Envoi…' : 'Envoyer le lien →'}
            </button>
            <button onClick={() => { setMode('connexion'); setError(''); setSuccess('') }} style={{ padding: '10px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
              ← Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            {/* TOGGLE CONNEXION / INSCRIPTION */}
            <div style={{ display: 'flex', background: '#f0ece2', borderRadius: '12px', padding: '4px', marginBottom: '24px', gap: '4px' }}>
              {(['connexion', 'inscription'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setRole(null); setError(''); setSuccess('') }} style={{
                  flex: 1, padding: '9px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 600,
                  background: mode === m ? 'white' : 'none',
                  color: mode === m ? '#0d2b22' : '#7a7260',
                  boxShadow: mode === m ? '0 2px 10px rgba(13,43,34,0.1)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {m === 'connexion' ? 'Se connecter' : "S'inscrire"}
                </button>
              ))}
            </div>

            {/* CHOIX DU RÔLE */}
            {mode === 'inscription' && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '10px' }}>Je suis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { val: 'medecin' as const, label: 'Professionnel de santé', desc: 'Médecin, infirmier, sage-femme…', emoji: '🩺', bg: '#e8f5f1' },
                    { val: 'patient' as const, label: 'Patient', desc: 'Trouver un médecin, gérer mes RDV', emoji: '🧑', bg: '#f0ece2' },
                    { val: 'clinique' as const, label: 'Établissement de santé', desc: 'Clinique, cabinet de groupe…', emoji: '🏥', bg: '#fdf8ec' },
                  ].map(r => (
                    <div key={r.val} onClick={() => setRole(r.val)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: isMobile ? '12px 14px' : '14px 16px', borderRadius: '14px',
                      border: `1.5px solid ${role === r.val ? '#22816a' : '#e8e0cc'}`,
                      background: role === r.val ? '#e8f5f1' : 'white',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{r.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0d2b22' }}>{r.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{r.desc}</div>
                      </div>
                      <div style={{ color: role === r.val ? '#22816a' : '#a8a090', flexShrink: 0 }}>→</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORMULAIRE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mode === 'inscription' && (
                <>
                  {role === 'clinique' ? (
                    <input name="prenom" placeholder="Nom de la clinique" value={form.prenom} onChange={handleChange} style={inputStyle} />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input name="prenom" placeholder="Prénom" value={form.prenom} onChange={handleChange} style={inputStyle} />
                      <input name="nom" placeholder="Nom" value={form.nom} onChange={handleChange} style={inputStyle} />
                    </div>
                  )}
                  <input name="telephone" placeholder="Téléphone (034 XX XXX XX)" value={form.telephone} onChange={handleChange} style={inputStyle} />
                  {role === 'medecin' && (
                    <select name="specialite" value={form.specialite} onChange={handleChange} style={{ ...inputStyle, color: form.specialite ? '#1a1512' : '#a8a090' }}>
                      <option value="">— Choisir une spécialité —</option>
                      <optgroup label="Médecine générale"><option>Médecin généraliste</option></optgroup>
                      <optgroup label="Spécialités médicales">
                        <option>Cardiologue</option><option>Pneumologue</option><option>Gastro-entérologue</option>
                        <option>Neurologue</option><option>Endocrinologue</option><option>Rhumatologue</option>
                        <option>Néphrologue</option><option>Hématologue</option><option>Infectiologue</option>
                        <option>Interniste</option><option>Oncologue</option><option>Gériatre</option><option>Urgentiste</option>
                      </optgroup>
                      <optgroup label="Chirurgie">
                        <option>Chirurgien général</option><option>Chirurgien orthopédiste</option><option>Chirurgien cardiaque</option>
                        <option>Chirurgien digestif</option><option>Neurochirurgien</option><option>Chirurgien plasticien</option><option>Urologue</option>
                      </optgroup>
                      <optgroup label="Femme & enfant">
                        <option>Gynécologue</option><option>Obstétricien</option><option>Sage-femme</option><option>Pédiatre</option><option>Néonatologue</option>
                      </optgroup>
                      <optgroup label="Tête & cou">
                        <option>Ophtalmologue</option><option>ORL</option><option>Dentiste</option><option>Stomatologiste</option><option>Orthodontiste</option>
                      </optgroup>
                      <optgroup label="Peau"><option>Dermatologue</option></optgroup>
                      <optgroup label="Santé mentale"><option>Psychiatre</option><option>Psychologue</option></optgroup>
                      <optgroup label="Rééducation & thérapies">
                        <option>Kinésithérapeute</option><option>Physiothérapeute</option><option>Ergothérapeute</option>
                        <option>Orthophoniste</option><option>Ostéopathe</option><option>Podologue</option>
                      </optgroup>
                      <optgroup label="Biologie & imagerie">
                        <option>Radiologue</option><option>Biologiste médical</option><option>Anatomo-pathologiste</option>
                      </optgroup>
                      <optgroup label="Autres">
                        <option>Anesthésiste</option><option>Médecin du travail</option><option>Médecin sportif</option>
                        <option>Nutritionniste / Diététicien</option><option>Infirmier(e)</option><option>Aide-soignant(e)</option>
                      </optgroup>
                    </select>
                  )}
                </>
              )}

              <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} />

              <div style={{ position: 'relative' }}>
                <input name="password" type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe (min. 6 caractères)" value={form.password}
                  onChange={handleChange} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{ ...inputStyle, paddingRight: '44px' }} />
                <button onClick={() => setShowPassword(v => !v)} type="button" style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
                  color: '#a8a090', padding: '0', lineHeight: 1,
                }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {mode === 'connexion' && (
                <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                  <button onClick={() => { setMode('oubli'); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#22816a', fontFamily: 'Outfit, sans-serif', fontWeight: 600, padding: 0 }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              {mode === 'inscription' && (
                <div onClick={() => setCguAcceptees(v => !v)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', background: cguAcceptees ? '#e8f5f1' : '#faf8f4', borderRadius: '10px', border: `1.5px solid ${cguAcceptees ? '#22816a' : '#f0ece2'}`, transition: 'all 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: cguAcceptees ? '#22816a' : 'white', border: `2px solid ${cguAcceptees ? '#22816a' : '#d0c8bc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    {cguAcceptees && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4a4035', lineHeight: 1.5 }}>
                    J'ai lu et j'accepte les{' '}
                    <a href="/cgu" target="_blank" onClick={e => e.stopPropagation()} style={{ color: '#22816a', fontWeight: 700, textDecoration: 'underline' }}>
                      Conditions Générales d'Utilisation
                    </a>
                    {' '}de Radoko.
                  </div>
                </div>
              )}

              {error && <div style={{ background: '#fdf0ee', color: '#c0392b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>{error}</div>}
              {success && <div style={{ background: '#e8f5f1', color: '#22816a', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>✅ {success}</div>}

              <button onClick={handleSubmit} disabled={loading} style={{
                padding: '12px', borderRadius: '10px',
                background: loading ? '#cfc5ae' : '#22816a',
                color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem',
                transition: 'all 0.15s', marginTop: '4px',
              }}>
                {loading ? 'Chargement…' : mode === 'connexion' ? 'Se connecter →' : 'Créer mon compte →'}
              </button>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="/" style={{ fontSize: '0.78rem', color: '#a8a090', textDecoration: 'none' }}>← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  )
}