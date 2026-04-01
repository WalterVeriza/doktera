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

const SPECIALITES = [
  // Médecine générale
  'Médecin généraliste',
  // Spécialités médicales
  'Cardiologue', 'Pneumologue', 'Gastro-entérologue', 'Neurologue', 'Endocrinologue',
  'Rhumatologue', 'Néphrologue', 'Hématologue', 'Infectiologue', 'Interniste',
  'Oncologue', 'Gériatre', 'Urgentiste',
  // Chirurgie
  'Chirurgien général', 'Chirurgien orthopédiste', 'Chirurgien cardiaque',
  'Chirurgien digestif', 'Neurochirurgien', 'Chirurgien plasticien', 'Urologie',
  // Femme & enfant
  'Gynécologue', 'Obstétricien', 'Sage-femme', 'Pédiatre', 'Néonatologue',
  // Tête & cou
  'Ophtalmologue', 'ORL', 'Dentiste', 'Stomatologiste', 'Orthodontiste',
  // Peau & dermatologie
  'Dermatologue',
  // Santé mentale
  'Psychiatre', 'Psychologue',
  // Rééducation & thérapies
  'Kinésithérapeute', 'Physiothérapeute', 'Ergothérapeute', 'Orthophoniste',
  'Ostéopathe', 'Podologue',
  // Biologie & imagerie
  'Radiologue', 'Biologiste médical', 'Anatomo-pathologiste',
  // Autres
  'Anesthésiste', 'Médecin du travail', 'Médecin sportif', 'Nutritionniste / Diététicien',
  'Infirmier(e)', 'Aide-soignant(e)',
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 640

  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [role, setRole] = useState<'medecin' | 'patient' | 'clinique' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '', password: '', prenom: '', nom: '', telephone: '', specialite: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
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
          router.push('/dashboard/medecin')
        } else if (role === 'clinique') {
          const { error: medecinError } = await supabase.from('medecins').insert({ id: data.user.id, specialite: 'Clinique' })
          if (medecinError) throw new Error('Erreur clinique : ' + medecinError.message)
          router.push('/dashboard/clinique')
        } else {
          const { error: patientError } = await supabase.from('patients').insert({ id: data.user.id })
          if (patientError) throw new Error('Erreur patient : ' + patientError.message)
          router.push('/dashboard/patient')
        }
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
            Dokt<em style={{ color: '#22816a' }}>éra</em>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#7a7260' }}>Santé à portée de main — Madagascar 🇲🇬</div>
        </div>

        {/* TOGGLE CONNEXION / INSCRIPTION */}
        <div style={{ display: 'flex', background: '#f0ece2', borderRadius: '12px', padding: '4px', marginBottom: '24px', gap: '4px' }}>
          {(['connexion', 'inscription'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setRole(null); setError('') }} style={{
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
                  <optgroup label="Médecine générale">
                    <option>Médecin généraliste</option>
                  </optgroup>
                  <optgroup label="Spécialités médicales">
                    <option>Cardiologue</option>
                    <option>Pneumologue</option>
                    <option>Gastro-entérologue</option>
                    <option>Neurologue</option>
                    <option>Endocrinologue</option>
                    <option>Rhumatologue</option>
                    <option>Néphrologue</option>
                    <option>Hématologue</option>
                    <option>Infectiologue</option>
                    <option>Interniste</option>
                    <option>Oncologue</option>
                    <option>Gériatre</option>
                    <option>Urgentiste</option>
                  </optgroup>
                  <optgroup label="Chirurgie">
                    <option>Chirurgien général</option>
                    <option>Chirurgien orthopédiste</option>
                    <option>Chirurgien cardiaque</option>
                    <option>Chirurgien digestif</option>
                    <option>Neurochirurgien</option>
                    <option>Chirurgien plasticien</option>
                    <option>Urologue</option>
                  </optgroup>
                  <optgroup label="Femme & enfant">
                    <option>Gynécologue</option>
                    <option>Obstétricien</option>
                    <option>Sage-femme</option>
                    <option>Pédiatre</option>
                    <option>Néonatologue</option>
                  </optgroup>
                  <optgroup label="Tête & cou">
                    <option>Ophtalmologue</option>
                    <option>ORL</option>
                    <option>Dentiste</option>
                    <option>Stomatologiste</option>
                    <option>Orthodontiste</option>
                  </optgroup>
                  <optgroup label="Peau">
                    <option>Dermatologue</option>
                  </optgroup>
                  <optgroup label="Santé mentale">
                    <option>Psychiatre</option>
                    <option>Psychologue</option>
                  </optgroup>
                  <optgroup label="Rééducation & thérapies">
                    <option>Kinésithérapeute</option>
                    <option>Physiothérapeute</option>
                    <option>Ergothérapeute</option>
                    <option>Orthophoniste</option>
                    <option>Ostéopathe</option>
                    <option>Podologue</option>
                  </optgroup>
                  <optgroup label="Biologie & imagerie">
                    <option>Radiologue</option>
                    <option>Biologiste médical</option>
                    <option>Anatomo-pathologiste</option>
                  </optgroup>
                  <optgroup label="Autres">
                    <option>Anesthésiste</option>
                    <option>Médecin du travail</option>
                    <option>Médecin sportif</option>
                    <option>Nutritionniste / Diététicien</option>
                    <option>Infirmier(e)</option>
                    <option>Aide-soignant(e)</option>
                  </optgroup>
                </select>
              )}
            </>
          )}

          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} />
          <input name="password" type="password" placeholder="Mot de passe (min. 6 caractères)" value={form.password} onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle} />

          {error && (
            <div style={{ background: '#fdf0ee', color: '#c0392b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

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

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="/" style={{ fontSize: '0.78rem', color: '#a8a090', textDecoration: 'none' }}>← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  )
}