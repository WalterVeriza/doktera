'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'radoko.mg@gmail.com'
const ADMIN_PASSWORD = 'RadokoAdmin2025!'

const SUPABASE_URL = 'https://ihgiatyybqghkjbpbumy.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ── MODAL ACTIVATION ──────────────────────────────────────────────────────────
function ModalActivation({ item, type, supabase, onClose, onDone }: any) {
  const [mois, setMois] = useState(1)
  const [nouveauPlan, setNouveauPlan] = useState(
    type === 'medecin' ? (item.plan || 'essentiel') : 'clinic'
  )
  const [etape, setEtape] = useState<'choix' | 'confirmation'>('choix')
  const [loading, setLoading] = useState(false)

  const nom = type === 'medecin'
    ? `Dr. ${item.profil?.prenom || '?'} ${item.profil?.nom || '?'}`
    : item.nom

  const planActuelExpire = item.plan_expire_at ? new Date(item.plan_expire_at) : null
  const now = new Date()
  const baseDate = planActuelExpire && planActuelExpire > now ? planActuelExpire : now
  const dateExpiration = new Date(baseDate)
  dateExpiration.setMonth(dateExpiration.getMonth() + mois)

  const planOptions = type === 'medecin'
    ? [
        { id: 'essentiel', label: 'Essentiel', prix: '15 000 Ar/mois', color: '#22816a' },
        { id: 'pro', label: 'Pro', prix: '30 000 Ar/mois', color: '#c8992a' },
      ]
    : [
        { id: 'clinic', label: 'Clinique', prix: '80 000 Ar/mois', color: '#0d2b22' },
      ]

  const planInfo = planOptions.find(p => p.id === nouveauPlan) || planOptions[0]

  const confirmer = async () => {
    setLoading(true)
    const expireAt = dateExpiration.toISOString()
    if (type === 'medecin') {
      const { error } = await supabase
        .from('medecins')
        .update({ plan: nouveauPlan, plan_actif: true, plan_expire_at: expireAt })
        .eq('id', item.id)
      if (error) console.error('erreur activation medecin:', error)
    } else {
      // ── Pour clinique : on update par id ET par admin_id pour être sûr ──
      const { error } = await supabase
        .from('cliniques')
        .update({ plan_actif: true, plan_expire_at: expireAt })
        .eq('id', item.id)
      if (error) {
        console.error('erreur activation clinique par id:', error)
        // Fallback sur admin_id
        const { error: error2 } = await supabase
          .from('cliniques')
          .update({ plan_actif: true, plan_expire_at: expireAt })
          .eq('admin_id', item.admin_id)
        if (error2) console.error('erreur activation clinique par admin_id:', error2)
      }
    }
    await supabase.from('notifications').insert({
      user_id: type === 'medecin' ? item.id : item.admin_id,
      type: 'rdv_confirme',
      titre: '🎉 Plan activé !',
      corps: `Votre plan ${planInfo?.label} est actif jusqu'au ${dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      lu: false,
    })
    setLoading(false)
    await onDone()
    onClose()
  }

  const desactiver = async () => {
    setLoading(true)
    if (type === 'medecin') {
      await supabase.from('medecins').update({ plan_actif: false, plan_expire_at: null }).eq('id', item.id)
    } else {
      const { error } = await supabase
        .from('cliniques')
        .update({ plan_actif: false, plan_expire_at: null })
        .eq('id', item.id)
      if (error) {
        await supabase
          .from('cliniques')
          .update({ plan_actif: false, plan_expire_at: null })
          .eq('admin_id', item.admin_id)
      }
    }
    setLoading(false)
    await onDone()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', zIndex: 301, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '24px 28px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '16px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
            {item.plan_actif ? 'Gérer l\'abonnement' : 'Activer l\'abonnement'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{nom}</div>
          {item.plan_actif && planActuelExpire && (
            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(46,181,146,0.2)', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)' }}>
              <span style={{ fontSize: '0.68rem', color: '#2eb592', fontWeight: 700 }}>
                ✅ Actif jusqu'au {planActuelExpire.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        {etape === 'choix' ? (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: planOptions.length === 1 ? '1fr' : '1fr 1fr', gap: '10px' }}>
                {planOptions.map(p => (
                  <div key={p.id} onClick={() => setNouveauPlan(p.id)}
                    style={{ padding: '14px', borderRadius: '12px', border: `2px solid ${nouveauPlan === p.id ? p.color : '#f0ece2'}`, background: nouveauPlan === p.id ? `${p.color}10` : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: nouveauPlan === p.id ? p.color : '#0d2b22', marginBottom: '3px' }}>{p.label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#a8a090' }}>{p.prix}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Durée {planActuelExpire && planActuelExpire > now ? '(prolongation depuis expiration actuelle)' : '(à partir d\'aujourd\'hui)'}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 6, 12].map(m => (
                  <button key={m} onClick={() => setMois(m)}
                    style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, background: mois === m ? '#0d2b22' : '#f0ece2', color: mois === m ? 'white' : '#7a7260', transition: 'all 0.15s' }}>
                    {m} mois
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', border: '1px solid #f0ece2' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Résumé</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Utilisateur', value: nom },
                  { label: 'Plan', value: planInfo?.label || nouveauPlan },
                  { label: 'Durée', value: `${mois} mois` },
                  { label: 'Activation', value: (planActuelExpire && planActuelExpire > now ? planActuelExpire : now).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  { label: 'Expiration', value: dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#7a7260' }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: '#0d2b22' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEtape('confirmation')}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
                Continuer →
              </button>
              {item.plan_actif && (
                <button onClick={desactiver} disabled={loading}
                  style={{ padding: '12px 16px', borderRadius: '10px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  {loading ? '⏳' : '🔴 Désactiver'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>
                Confirmer l'activation
              </div>
              <div style={{ fontSize: '0.82rem', color: '#7a7260', lineHeight: 1.6 }}>
                Vous allez activer le plan <strong style={{ color: planInfo?.color }}>{planInfo?.label}</strong> pour <strong>{nom}</strong> jusqu'au <strong>{dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </div>
            </div>
            <div style={{ background: '#e8f5f1', borderRadius: '12px', padding: '16px', border: '1px solid rgba(34,129,106,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Plan', value: planInfo?.label || nouveauPlan },
                  { label: 'Durée', value: `${mois} mois` },
                  { label: 'Expiration', value: dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#22816a' }}>{r.label}</span>
                    <span style={{ fontWeight: 700, color: '#0d2b22' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEtape('choix')}
                style={{ padding: '12px 20px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                ← Modifier
              </button>
              <button onClick={confirmer} disabled={loading}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: loading ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
                {loading ? '⏳ Activation…' : '✅ Confirmer l\'activation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState<'paiements' | 'medecins' | 'cliniques' | 'stats'>('paiements')
  const supabase = createAdminClient()

  const login = () => {
    const e = loginForm.email.trim()
    const p = loginForm.password.trim()
    if (e === ADMIN_EMAIL && p === ADMIN_PASSWORD) {
      setAuthed(true)
      setLoginError('')
    } else {
      setLoginError(`Email ou mot de passe incorrect (email: ${e === ADMIN_EMAIL ? '✓' : '✗'}, mdp: ${p === ADMIN_PASSWORD ? '✓' : '✗'})`)
    }
  }

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: '#0d2b22', marginBottom: '4px' }}>
          Dokt<em style={{ color: '#2eb592' }}>éra</em>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#a8a090', marginBottom: '28px' }}>Dashboard Administrateur</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }}>Email</label>
            <input type="text" value={loginForm.email}
              onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="admin@doktera.mg"
              style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }}>Mot de passe</label>
            <input type="password" value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {loginError && <div style={{ fontSize: '0.78rem', color: '#c0392b', background: '#fdf0ee', padding: '8px 12px', borderRadius: '8px' }}>{loginError}</div>}
          <button onClick={login}
            style={{ padding: '12px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', marginTop: '4px' }}>
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Outfit, sans-serif' }}>
      <nav style={{ width: '240px', minHeight: '100vh', background: '#0d2b22', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: 'white' }}>Dokt<em style={{ color: '#2eb592' }}>éra</em></div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Super Admin</div>
        </div>
        <div style={{ padding: '12px 0', flex: 1 }}>
          {[
            { id: 'paiements', icon: '💳', label: 'Paiements' },
            { id: 'medecins', icon: '👨‍⚕️', label: 'Médecins' },
            { id: 'cliniques', icon: '🏥', label: 'Cliniques' },
            { id: 'stats', icon: '📊', label: 'Statistiques' },
          ].map(item => (
            <div key={item.id} onClick={() => setPage(item.id as any)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', cursor: 'pointer', borderLeft: `2px solid ${page === item.id ? '#2eb592' : 'transparent'}`, background: page === item.id ? 'rgba(34,129,106,0.18)' : 'none', color: page === item.id ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div onClick={() => setAuthed(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
            ⇄ Se déconnecter
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf8f4' }}>
        <div style={{ background: 'white', padding: '18px 32px', borderBottom: '1px solid #f0ece2' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: '#0d2b22' }}>
            {page === 'paiements' && 'Gestion des paiements'}
            {page === 'medecins' && 'Gestion des médecins'}
            {page === 'cliniques' && 'Gestion des cliniques'}
            {page === 'stats' && 'Statistiques globales'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7a7260', marginTop: '2px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {page === 'paiements' && <GestionPaiements supabase={supabase} />}
          {page === 'medecins' && <GestionMedecins supabase={supabase} />}
          {page === 'cliniques' && <GestionCliniques supabase={supabase} />}
          {page === 'stats' && <Stats supabase={supabase} />}
        </div>
      </div>
    </div>
  )
}

// ── GESTION PAIEMENTS ─────────────────────────────────────────────────────────
function GestionPaiements({ supabase }: any) {
  const [paiements, setPaiements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('en_attente')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: paiementsData, error: pErr } = await supabase.from('paiements').select('*').order('created_at', { ascending: false })
    if (pErr) { console.log('paiements error:', pErr); setLoading(false); return }
    const userIds = [...new Set((paiementsData || []).map((p: any) => p.user_id))]
    let profilMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profils } = await supabase.from('profils').select('id, prenom, nom, email').in('id', userIds)
      profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
    }
    setPaiements((paiementsData || []).map((p: any) => ({ ...p, user: profilMap[p.user_id] || null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const validerPaiement = async (paiement: any) => {
    setActionLoading(paiement.id)
    await supabase.from('paiements').update({ statut: 'valide' }).eq('id', paiement.id)
    const now = new Date()
    let baseDate = now
    if (paiement.role === 'medecin') {
      const { data: med } = await supabase.from('medecins').select('plan_expire_at').eq('id', paiement.user_id).single()
      if (med?.plan_expire_at && new Date(med.plan_expire_at) > now) baseDate = new Date(med.plan_expire_at)
      const expireAt = new Date(baseDate); expireAt.setDate(expireAt.getDate() + 30)
      await supabase.from('medecins').update({ plan: paiement.plan, plan_actif: true, plan_expire_at: expireAt.toISOString() }).eq('id', paiement.user_id)
    } else if (paiement.role === 'clinique') {
      const { data: cl } = await supabase.from('cliniques').select('plan_expire_at').eq('admin_id', paiement.user_id).single()
      if (cl?.plan_expire_at && new Date(cl.plan_expire_at) > now) baseDate = new Date(cl.plan_expire_at)
      const expireAt = new Date(baseDate); expireAt.setDate(expireAt.getDate() + 30)
      await supabase.from('cliniques').update({ plan_actif: true, plan_expire_at: expireAt.toISOString() }).eq('admin_id', paiement.user_id)
    }
    await supabase.from('notifications').insert({
      user_id: paiement.user_id, type: 'rdv_confirme',
      titre: '🎉 Plan activé !',
      corps: `Votre paiement a été validé. Votre plan ${paiement.plan} est actif pour 30 jours.`,
      lu: false,
    })
    load(); setActionLoading(null)
  }

  const refuserPaiement = async (paiement: any) => {
    setActionLoading(paiement.id + '_refuse')
    await supabase.from('paiements').update({ statut: 'refuse' }).eq('id', paiement.id)
    await supabase.from('notifications').insert({
      user_id: paiement.user_id, type: 'rdv_annule',
      titre: '❌ Paiement refusé',
      corps: `Votre demande de paiement pour le plan ${paiement.plan} n'a pas pu être validée. Contactez-nous à radoko.mg@gmail.com.`,
      lu: false,
    })
    load(); setActionLoading(null)
  }

  const paiementsFiltres = filtre === 'tous' ? paiements : paiements.filter(p => p.statut === filtre)
  const statutColors: Record<string, { bg: string, color: string, label: string }> = {
    en_attente: { bg: '#fdf8ec', color: '#c8992a', label: '⏳ En attente' },
    valide: { bg: '#e8f5f1', color: '#22816a', label: '✅ Validé' },
    refuse: { bg: '#fdf0ee', color: '#c0392b', label: '❌ Refusé' },
  }
  const moyenLabels: Record<string, string> = { mvola: '📱 MVola', orange_money: '🟠 Orange Money' }
  const planLabels: Record<string, { label: string, color: string }> = {
    essentiel: { label: 'Essentiel', color: '#22816a' },
    pro: { label: 'Pro', color: '#c8992a' },
    clinic: { label: 'Clinique', color: '#0d2b22' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'En attente', value: paiements.filter(p => p.statut === 'en_attente').length, color: '#c8992a' },
          { label: 'Validés', value: paiements.filter(p => p.statut === 'valide').length, color: '#22816a' },
          { label: 'Refusés', value: paiements.filter(p => p.statut === 'refuse').length, color: '#c0392b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {['tous', 'en_attente', 'valide', 'refuse'].map(f => {
          const labels: Record<string, string> = { tous: 'Tous', en_attente: '⏳ En attente', valide: '✅ Validés', refuse: '❌ Refusés' }
          const count = f === 'tous' ? paiements.length : paiements.filter(p => p.statut === f).length
          return (
            <button key={f} onClick={() => setFiltre(f)}
              style={{ padding: '7px 16px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: filtre === f ? '#0d2b22' : '#f0ece2', color: filtre === f ? 'white' : '#7a7260' }}>
              {labels[f]} ({count})
            </button>
          )
        })}
      </div>
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳ Chargement…</div>
        ) : paiementsFiltres.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💳</div>Aucun paiement
          </div>
        ) : paiementsFiltres.map(p => {
          const s = statutColors[p.statut] || statutColors.en_attente
          const planInfo = planLabels[p.plan] || { label: p.plan, color: '#7a7260' }
          return (
            <div key={p.id} style={{ padding: '18px 24px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d2b22' }}>{p.user?.prenom} {p.user?.nom}</div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: p.role === 'clinique' ? 'rgba(200,153,42,0.15)' : 'rgba(34,129,106,0.15)', color: p.role === 'clinique' ? '#c8992a' : '#22816a' }}>
                    {p.role === 'clinique' ? '🏥 Clinique' : '👨‍⚕️ Médecin'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{p.user?.email}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: planInfo.color }}>Plan {planInfo.label}</span>
                  <span style={{ fontSize: '0.72rem', color: '#7a7260' }}>{moyenLabels[p.moyen] || p.moyen}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d2b22' }}>{p.montant?.toLocaleString()} Ar</span>
                  <span style={{ fontSize: '0.72rem', color: '#a8a090' }}>
                    {new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '10px 14px', minWidth: '200px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Transaction</div>
                <div style={{ fontSize: '0.78rem', color: '#0d2b22', marginBottom: '3px' }}><span style={{ color: '#a8a090' }}>Numéro : </span><strong>{p.numero_envoi}</strong></div>
                <div style={{ fontSize: '0.78rem', color: '#0d2b22' }}><span style={{ color: '#a8a090' }}>Réf : </span><strong style={{ fontFamily: 'monospace' }}>{p.reference}</strong></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '140px' }}>
                <span style={{ padding: '4px 12px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                {p.statut === 'en_attente' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => validerPaiement(p)} disabled={actionLoading === p.id}
                      style={{ padding: '6px 14px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                      {actionLoading === p.id ? '⏳' : '✅ Valider'}
                    </button>
                    <button onClick={() => refuserPaiement(p)} disabled={actionLoading === p.id + '_refuse'}
                      style={{ padding: '6px 10px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                      {actionLoading === p.id + '_refuse' ? '⏳' : '❌'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GESTION MÉDECINS ──────────────────────────────────────────────────────────
function GestionMedecins({ supabase }: any) {
  const [medecins, setMedecins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalActivation, setModalActivation] = useState<any>(null)
  const [resetModal, setResetModal] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const { data: medsData, error } = await supabase.from('medecins').select('*')
    if (error) { console.log('medecins error:', error); setLoading(false); return }
    const ids = (medsData || []).map((m: any) => m.id)
    let profilMap: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: profils } = await supabase.from('profils').select('id, prenom, nom, email').in('id', ids)
      profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
    }
    setMedecins(
      (medsData || [])
        .filter((m: any) => m.specialite !== 'Clinique')
        .map((m: any) => ({ ...m, profil: profilMap[m.id] || null }))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const supprimerMedecin = async (med: any) => {
    if (!confirm(`Supprimer définitivement Dr. ${med.profil?.prenom} ${med.profil?.nom} ? Cette action est irréversible.`)) return
    await supabase.from('medecins').delete().eq('id', med.id)
    await supabase.from('profils').delete().eq('id', med.id)
    load()
  }

  const filtres = medecins.filter(m =>
    !search || `${m.profil?.prenom} ${m.profil?.nom} ${m.profil?.email} ${m.specialite}`.toLowerCase().includes(search.toLowerCase())
  )

  const planColors: Record<string, string> = { essentiel: '#22816a', pro: '#c8992a', clinic: '#0d2b22' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {modalActivation && (
        <ModalActivation item={modalActivation} type="medecin" supabase={supabase}
          onClose={() => setModalActivation(null)} onDone={load} />
      )}
      {resetModal && <ResetPasswordModal user={resetModal} supabase={supabase} onClose={() => setResetModal(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total médecins', value: medecins.length, color: '#0d2b22' },
          { label: 'Plans actifs', value: medecins.filter(m => m.plan_actif).length, color: '#22816a' },
          { label: 'Plans inactifs', value: medecins.filter(m => !m.plan_actif).length, color: '#c8992a' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un médecin…"
        style={{ padding: '10px 16px', background: 'white', border: '1.5px solid #f0ece2', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none' }}
      />

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳ Chargement…</div>
        ) : filtres.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>Aucun médecin trouvé</div>
        ) : filtres.map(med => {
          const planColor = planColors[med.plan] || '#7a7260'
          const expireAt = med.plan_expire_at ? new Date(med.plan_expire_at) : null
          const joursRestants = expireAt ? Math.ceil((expireAt.getTime() - Date.now()) / 86400000) : null
          return (
            <div key={med.id} style={{ padding: '16px 24px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0d2b22' }}>Dr. {med.profil?.prenom || '?'} {med.profil?.nom || '?'}</div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: `${planColor}18`, color: planColor }}>{med.plan || 'essentiel'}</span>
                  {med.plan_actif
                    ? <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: '#e8f5f1', color: '#22816a' }}>✅ Actif</span>
                    : <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: '#fdf0ee', color: '#c0392b' }}>❌ Inactif</span>
                  }
                  {expireAt && joursRestants !== null && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: joursRestants <= 5 ? '#fdf0ee' : '#faf8f4', color: joursRestants <= 5 ? '#c0392b' : '#7a7260' }}>
                      {joursRestants > 0 ? `⏱ J-${joursRestants}` : '⚠️ Expiré'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{med.profil?.email} · {med.specialite}</div>
                {expireAt && <div style={{ fontSize: '0.68rem', color: '#a8a090', marginTop: '2px' }}>Expire le {expireAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setModalActivation(med)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', border: '1.5px solid rgba(34,129,106,0.3)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {med.plan_actif ? '⚙️ Abonnement' : '🟢 Activer'}
                </button>
                <button onClick={() => setResetModal(med.profil)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#faf8f4', color: '#7a7260', border: '1px solid #f0ece2', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  🔑
                </button>
                <button onClick={() => supprimerMedecin(med)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GESTION CLINIQUES ─────────────────────────────────────────────────────────
function GestionCliniques({ supabase }: any) {
  const [cliniques, setCliniques] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalActivation, setModalActivation] = useState<any>(null)
  const [resetModal, setResetModal] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const { data: clData, error } = await supabase.from('cliniques').select('*')
    if (error) { console.log('cliniques error:', error); setLoading(false); return }
    const adminIds = (clData || []).map((c: any) => c.admin_id).filter(Boolean)
    let profilMap: Record<string, any> = {}
    if (adminIds.length > 0) {
      const { data: profils } = await supabase.from('profils').select('id, prenom, nom, email').in('id', adminIds)
      profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
    }
    setCliniques((clData || []).map((c: any) => ({ ...c, admin: profilMap[c.admin_id] || null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const supprimerClinique = async (cl: any) => {
    if (!confirm(`Supprimer définitivement la clinique ${cl.nom} ? Cette action est irréversible.`)) return
    await supabase.from('cliniques').delete().eq('id', cl.id)
    await supabase.from('profils').delete().eq('id', cl.admin_id)
    load()
  }

  const filtres = cliniques.filter(cl =>
    !search || `${cl.nom} ${cl.admin?.email} ${cl.region}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {modalActivation && (
        <ModalActivation item={modalActivation} type="clinique" supabase={supabase}
          onClose={() => setModalActivation(null)} onDone={load} />
      )}
      {resetModal && <ResetPasswordModal user={resetModal} supabase={supabase} onClose={() => setResetModal(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total cliniques', value: cliniques.length, color: '#0d2b22' },
          { label: 'Plans actifs', value: cliniques.filter(c => c.plan_actif).length, color: '#22816a' },
          { label: 'Plans inactifs', value: cliniques.filter(c => !c.plan_actif).length, color: '#c8992a' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher une clinique…"
        style={{ padding: '10px 16px', background: 'white', border: '1.5px solid #f0ece2', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none' }}
      />

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳ Chargement…</div>
        ) : filtres.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>Aucune clinique trouvée</div>
        ) : filtres.map(cl => {
          const expireAt = cl.plan_expire_at ? new Date(cl.plan_expire_at) : null
          const joursRestants = expireAt ? Math.ceil((expireAt.getTime() - Date.now()) / 86400000) : null
          return (
            <div key={cl.id} style={{ padding: '16px 24px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0d2b22' }}>{cl.nom}</div>
                  {cl.plan_actif
                    ? <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: '#e8f5f1', color: '#22816a' }}>✅ Actif</span>
                    : <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: '#fdf0ee', color: '#c0392b' }}>❌ Inactif</span>
                  }
                  {expireAt && joursRestants !== null && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: joursRestants <= 5 ? '#fdf0ee' : '#faf8f4', color: joursRestants <= 5 ? '#c0392b' : '#7a7260' }}>
                      {joursRestants > 0 ? `⏱ J-${joursRestants}` : '⚠️ Expiré'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>
                  Admin : {cl.admin?.prenom || '?'} {cl.admin?.nom || '?'} · {cl.admin?.email}
                </div>
                {expireAt && <div style={{ fontSize: '0.68rem', color: '#a8a090', marginTop: '2px' }}>Expire le {expireAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setModalActivation(cl)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', border: '1.5px solid rgba(34,129,106,0.3)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cl.plan_actif ? '⚙️ Abonnement' : '🟢 Activer'}
                </button>
                <button onClick={() => setResetModal(cl.admin)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#faf8f4', color: '#7a7260', border: '1px solid #f0ece2', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  🔑
                </button>
                <button onClick={() => supprimerClinique(cl)}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── RESET PASSWORD MODAL ──────────────────────────────────────────────────────
function ResetPasswordModal({ user, supabase, onClose }: any) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const resetPassword = async () => {
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(user?.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSuccess(true); setLoading(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.4)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', zIndex: 301, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>Réinitialiser le mot de passe</div>
        <div style={{ fontSize: '0.78rem', color: '#7a7260', marginBottom: '20px' }}>{user?.prenom} {user?.nom} · {user?.email}</div>
        {success ? (
          <div style={{ background: '#e8f5f1', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600 }}>Email de réinitialisation envoyé !</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fdf8ec', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)', fontSize: '0.75rem', color: '#a8906a', lineHeight: 1.5 }}>
              ℹ️ Un email de réinitialisation sera envoyé à <strong>{user?.email}</strong>.
            </div>
            {error && <div style={{ fontSize: '0.78rem', color: '#c0392b', background: '#fdf0ee', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={resetPassword} disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', background: loading ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem' }}>
                {loading ? '⏳ Envoi…' : '📧 Envoyer l\'email'}
              </button>
              <button onClick={onClose}
                style={{ padding: '11px 18px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function Stats({ supabase }: any) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [
        { count: totalMedecins },
        { count: totalCliniques },
        { count: totalPatients },
        { count: totalRdvs },
        { count: totalRdvsClinique },
        { count: totalPaiementsValides },
        { data: paiementsValides },
      ] = await Promise.all([
        supabase.from('medecins').select('*', { count: 'exact', head: true }).neq('specialite', 'Clinique'),
        supabase.from('cliniques').select('*', { count: 'exact', head: true }),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('rendez_vous').select('*', { count: 'exact', head: true }),
        supabase.from('clinique_rdvs').select('*', { count: 'exact', head: true }),
        supabase.from('paiements').select('*', { count: 'exact', head: true }).eq('statut', 'valide'),
        supabase.from('paiements').select('montant').eq('statut', 'valide'),
      ])
      const revenuTotal = (paiementsValides || []).reduce((s: number, p: any) => s + (p.montant || 0), 0)
      setStats({ totalMedecins, totalCliniques, totalPatients, totalRdvs, totalRdvsClinique, totalPaiementsValides, revenuTotal })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳ Chargement…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Médecins inscrits', value: stats.totalMedecins, color: '#22816a', icon: '👨‍⚕️' },
          { label: 'Cliniques', value: stats.totalCliniques, color: '#c8992a', icon: '🏥' },
          { label: 'Patients', value: stats.totalPatients, color: '#0d2b22', icon: '🧑' },
          { label: 'RDV médecins', value: stats.totalRdvs, color: '#2eb592', icon: '📅' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '22px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.4rem', fontWeight: 600, color: s.color }}>{s.value ?? '—'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'RDV cliniques', value: stats.totalRdvsClinique, color: '#22816a', icon: '🏥' },
          { label: 'Paiements validés', value: stats.totalPaiementsValides, color: '#c8992a', icon: '💳' },
          { label: 'Revenu total validé', value: `${stats.revenuTotal?.toLocaleString()} Ar`, color: '#0d2b22', icon: '💰' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '22px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: s.label === 'Revenu total validé' ? '1.6rem' : '2.4rem', fontWeight: 600, color: s.color }}>{s.value ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}