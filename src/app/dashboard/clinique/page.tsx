'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DisponibilitesService from '@/components/shared/DisponibilitesService'

const CATEGORIES = [
  { id: 'consultation', label: 'Consultations spécialisées', icon: '🩺' },
  { id: 'hospitalisation', label: 'Hospitalisations', icon: '🛏️' },
  { id: 'maternite', label: 'Maternité & gynécologie', icon: '🤱' },
  { id: 'imagerie', label: 'Imagerie médicale', icon: '🔬' },
  { id: 'laboratoire', label: 'Analyses & laboratoire', icon: '🧪' },
  { id: 'chirurgie', label: 'Chirurgie', icon: '⚕️' },
  { id: 'urgences', label: 'Urgences', icon: '🚨' },
]

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

function afficherHeure(heure: string, mode: string) {
  if (mode === 'plage') {
    if (heure === 'matin') return '🌅 Matin'
    if (heure === 'après-midi') return '☀️ Après-midi'
    if (heure === 'soir') return '🌆 Soir'
    return heure
  }
  return heure?.slice(0, 5) || ''
}

export default function DashboardClinique() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024

  const [clinique, setClinique] = useState<any>(null)
  const [page, setPage] = useState('vue')
  const [loading, setLoading] = useState(true)
  const [planActif, setPlanActif] = useState<boolean>(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [msgPatientInitial, setMsgPatientInitial] = useState<any>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: cl } = await supabase.from('cliniques').select('*').eq('admin_id', user.id).single()
      if (!cl) { router.push('/login'); return }
      setClinique(cl)
      setPlanActif(cl.plan_actif === true)
      const { data: n } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      setNotifications(n || [])
      setLoading(false)

      supabase.channel('dashboard-clinique')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications(prev => [payload.new, ...prev])
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cliniques', filter: `admin_id=eq.${user.id}` }, (payload) => {
          const updated = payload.new as any
          setPlanActif(updated.plan_actif === true)
          setClinique((prev: any) => ({ ...prev, ...updated }))
        })
        .subscribe()
    }
    load()
    return () => { supabase.removeAllChannels() }
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [page])

  const logout = async () => { await supabase.auth.signOut(); router.push('/') }

  const marquerToutLu = async () => {
    if (!clinique) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const contacterPatient = (patient: any) => {
    setMsgPatientInitial(patient)
    setPage('messages')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  const nonLues = notifications.filter(n => !n.lu).length
  const notifIcons: Record<string, string> = {
    nouveau_rdv: '📅', rdv_confirme: '✅', rdv_annule: '❌', rdv_termine: '🏥',
    nouveau_message: '💬', message_patient: '💬', rappel_j1: '⏰', resultats_disponibles: '📋',
  }

  const navItems = [
    { id: 'vue', icon: '◎', label: 'Vue d\'ensemble' },
    { id: 'rdvs', icon: '◷', label: 'Réservations' },
    { id: 'services', icon: '⚕', label: 'Nos services' },
    { id: 'messages', icon: '◻', label: 'Messagerie' },
    { id: 'profil', icon: '◈', label: 'Profil clinique' },
  ]

  const pageTitle: Record<string, string> = {
    vue: 'Vue d\'ensemble', rdvs: 'Réservations', services: 'Nos services',
    messages: 'Messagerie', profil: 'Profil clinique',
  }

  return (
    <>
      {/* BANNIÈRE PLAN INACTIF */}
      {!planActif && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, background: 'linear-gradient(90deg, #c8992a, #e6b84a)', padding: isMobile ? '8px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(200,153,42,0.35)', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: isMobile ? '0.75rem' : '0.83rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isMobile ? 'Clinique non visible — aucun plan actif.' : 'Votre clinique n\'est pas visible par les patients — aucun plan actif.'}
            </span>
          </div>
          <div onClick={() => router.push('/upgrade')} style={{ background: '#0d2b22', color: 'white', padding: isMobile ? '5px 12px' : '6px 16px', borderRadius: '8px', fontSize: isMobile ? '0.72rem' : '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
            {isMobile ? 'Choisir →' : 'Choisir un plan →'}
          </div>
        </div>
      )}

      {/* OVERLAY SIDEBAR MOBILE */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
      )}

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', paddingTop: planActif ? 0 : isMobile ? '38px' : '44px' }}>

        {/* SIDEBAR */}
        <nav style={{
          width: '256px', minHeight: '100vh', background: '#0d2b22', display: 'flex', flexDirection: 'column',
          flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)',
          position: isMobile ? 'fixed' : 'relative',
          top: 0, left: 0, bottom: 0,
          zIndex: isMobile ? 160 : 'auto',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s ease',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 0%, rgba(34,129,106,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div onClick={() => setPage('vue')} style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: 'white', letterSpacing: '-0.02em' }}>Dokt<em style={{ color: '#2eb592' }}>éra</em></div>
          </div>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(200,153,42,0.2)', border: '1px solid rgba(200,153,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', overflow: 'hidden', flexShrink: 0 }}>
                {clinique?.logo_url ? <img src={clinique.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '🏥'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clinique?.nom}</div>
                <div style={{ display: 'inline-block', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.07em', border: '1px solid rgba(200,153,42,0.2)' }}>Clinique</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 0', flex: 1 }}>
            {navItems.map(item => (
              <div key={item.id} onClick={() => setPage(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', cursor: 'pointer', borderLeft: `2px solid ${page === item.id ? '#2eb592' : 'transparent'}`, background: page === item.id ? 'rgba(34,129,106,0.18)' : 'none', color: page === item.id ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s' }}>
                <span style={{ width: '18px', textAlign: 'center' }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          {!planActif && (
            <div style={{ margin: '0 16px 12px', padding: '14px', background: 'rgba(200,153,42,0.1)', borderRadius: '12px', border: '1px solid rgba(200,153,42,0.2)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e6b84a', marginBottom: '6px' }}>⚡ Aucun plan actif</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '10px' }}>Activez un plan pour apparaître dans la recherche patients.</div>
              <div onClick={() => router.push('/upgrade')} style={{ background: '#c8992a', color: '#0d2b22', fontSize: '0.7rem', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>Choisir un plan →</div>
            </div>
          )}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              ⇄ Se déconnecter
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* TOPBAR */}
          <div style={{ background: 'white', padding: isMobile ? '12px 16px' : '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ece2', flexShrink: 0, gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {isMobile && (
                <button onClick={() => setSidebarOpen(true)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>☰</button>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pageTitle[page] || page}
                </div>
                {!isMobile && <div style={{ fontSize: '0.78rem', color: '#7a7260', marginTop: '1px' }}>{clinique?.nom}</div>}
              </div>
            </div>
            <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
              <div onClick={() => { setShowNotifs(v => !v); if (!showNotifs && nonLues > 0) marquerToutLu() }}
                style={{ width: '40px', height: '40px', background: nonLues > 0 ? '#fdf8ec' : '#f0ece2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', border: nonLues > 0 ? '1.5px solid rgba(200,153,42,0.3)' : '1.5px solid transparent', position: 'relative' }}>
                🔔
                {nonLues > 0 && (
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', background: '#c0392b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', border: '2px solid white' }}>
                    {nonLues > 9 ? '9+' : nonLues}
                  </div>
                )}
              </div>
              {showNotifs && (
                <div style={{ position: 'absolute', top: '48px', right: 0, width: isMobile ? 'calc(100vw - 32px)' : '360px', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22' }}>
                      Notifications {nonLues > 0 && <span style={{ fontSize: '0.72rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 7px', borderRadius: '50px', marginLeft: '6px' }}>{nonLues} non lues</span>}
                    </div>
                    {notifications.some(n => !n.lu) && <div onClick={marquerToutLu} style={{ fontSize: '0.72rem', color: '#22816a', fontWeight: 600, cursor: 'pointer' }}>Tout lu</div>}
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔔</div>Aucune notification
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f8f5f0', background: n.lu ? 'white' : '#fdf8ec', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '1px' }}>{notifIcons[n.type] || '🔔'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {n.titre && <div style={{ fontSize: '0.82rem', fontWeight: n.lu ? 500 : 700, color: '#0d2b22', marginBottom: '2px' }}>{n.titre}</div>}
                          {n.corps && <div style={{ fontSize: '0.75rem', color: '#7a7260', lineHeight: 1.5 }}>{n.corps}</div>}
                          <div style={{ fontSize: '0.67rem', color: '#a8a090', marginTop: '4px' }}>
                            {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {!n.lu && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22816a', flexShrink: 0, marginTop: '5px' }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px', background: '#faf8f4', paddingBottom: isMobile ? '80px' : undefined }}>
            {page === 'vue' && <VueEnsemble clinique={clinique} supabase={supabase} isMobile={isMobile} />}
            {page === 'rdvs' && <GestionRdvs clinique={clinique} supabase={supabase} onContacterPatient={contacterPatient} isMobile={isMobile} />}
            {page === 'services' && <GestionServices clinique={clinique} supabase={supabase} isMobile={isMobile} />}
            {page === 'messages' && <MessageriesClinique clinique={clinique} supabase={supabase} patientInitial={msgPatientInitial} isMobile={isMobile} />}
            {page === 'profil' && <ProfilClinique clinique={clinique} supabase={supabase} onUpdate={setClinique} isMobile={isMobile} />}
          </div>
        </div>
      </div>

      {/* BOTTOM NAV MOBILE */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 140, background: 'white', borderTop: '1px solid #f0ece2', display: 'flex', justifyContent: 'space-around', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
          {[
            { id: 'vue', icon: '◎', label: 'Accueil' },
            { id: 'rdvs', icon: '◷', label: 'RDV' },
            { id: 'services', icon: '⚕', label: 'Services' },
            { id: 'messages', icon: '◻', label: 'Messages' },
            { id: 'profil', icon: '◈', label: 'Profil' },
          ].map(item => (
            <div key={item.id} onClick={() => setPage(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', padding: '4px 8px', borderRadius: '10px', background: page === item.id ? 'rgba(34,129,106,0.1)' : 'none' }}>
              <span style={{ fontSize: '1.1rem', color: page === item.id ? '#22816a' : '#a8a090' }}>{item.icon}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 600, color: page === item.id ? '#22816a' : '#a8a090' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── VUE D'ENSEMBLE ────────────────────────────────────────────────────────────
function VueEnsemble({ clinique, supabase, isMobile }: any) {
  const [stats, setStats] = useState({ total: 0, attente: 0, confirme: 0, termine: 0 })
  const [rdvsRecents, setRdvsRecents] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('clinique_rdvs').select('*, service:clinique_services(nom, categorie, mode_reservation)').eq('clinique_id', clinique.id).order('created_at', { ascending: false }).limit(50)
      const tous = data || []
      setStats({ total: tous.length, attente: tous.filter((r: any) => r.statut === 'en_attente').length, confirme: tous.filter((r: any) => r.statut === 'confirme').length, termine: tous.filter((r: any) => r.statut === 'termine').length })
      setRdvsRecents(tous.slice(0, 8))
    }
    load()
  }, [clinique.id])

  const statusColors: Record<string, { bg: string, color: string, label: string }> = {
    en_attente: { bg: '#fdf8ec', color: '#c8992a', label: '⏳ En attente' },
    confirme: { bg: '#e8f5f1', color: '#22816a', label: '✅ Confirmé' },
    termine: { bg: '#f0ece2', color: '#7a7260', label: '🏥 Terminé' },
    annule: { bg: '#fdf0ee', color: '#c0392b', label: '❌ Annulé' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px' }}>
        {[
          { label: 'Total', value: stats.total, color: '#0d2b22' },
          { label: 'En attente', value: stats.attente, color: '#c8992a' },
          { label: 'Confirmées', value: stats.confirme, color: '#22816a' },
          { label: 'Terminées', value: stats.termine, color: '#7a7260' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: isMobile ? '14px' : '20px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Réservations récentes</div>
        </div>
        {rdvsRecents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📅</div>Aucune réservation pour le moment
          </div>
        ) : rdvsRecents.map(rdv => {
          const s = statusColors[rdv.statut] || statusColors.en_attente
          const cat = CATEGORIES.find(c => c.id === rdv.service?.categorie)
          const mode = rdv.service?.mode_reservation || 'creneau'
          return (
            <div key={rdv.id} style={{ padding: isMobile ? '12px 16px' : '14px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{cat?.icon || '⚕️'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.service?.nom}</div>
                <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>
                  {new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {afficherHeure(rdv.heure, mode)}
                </div>
              </div>
              <span style={{ padding: '3px 9px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GESTION RDVs ──────────────────────────────────────────────────────────────
function GestionRdvs({ clinique, supabase, onContacterPatient, isMobile }: any) {
  const [rdvs, setRdvs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [rdvActif, setRdvActif] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('clinique_rdvs').select('*, service:clinique_services(nom, categorie, mode_reservation), patient:profils(id, prenom, nom, telephone)').eq('clinique_id', clinique.id).order('date', { ascending: true })
    setRdvs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [clinique.id])

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from('clinique_rdvs').update({ statut }).eq('id', id)
    setRdvs(prev => prev.map(r => r.id === id ? { ...r, statut } : r))
    const rdv = rdvs.find(r => r.id === id)
    if (rdv && (statut === 'confirme' || statut === 'annule')) {
      const typeNotif = statut === 'confirme' ? 'rdv_confirme' : 'rdv_annule'
      const titreNotif = statut === 'confirme' ? 'Réservation confirmée ✅' : 'Réservation annulée ❌'
      const corpsNotif = statut === 'confirme'
        ? `Votre réservation pour ${rdv.service?.nom} le ${new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} a été confirmée.`
        : `Votre réservation pour ${rdv.service?.nom} a été annulée par la clinique.`
      await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: typeNotif, titre: titreNotif, corps: corpsNotif, lu: false })
    }
  }

  const sauvegarderNotes = async (id: string, updates: any) => {
    await supabase.from('clinique_rdvs').update(updates).eq('id', id)
    setRdvs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
    if (rdvActif?.id === id) setRdvActif((prev: any) => ({ ...prev, ...updates }))
    if (updates.date_resultats) {
      const rdv = rdvs.find(r => r.id === id)
      if (rdv) await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'resultats_disponibles', titre: 'Résultats disponibles 📋', corps: `Vos résultats pour ${rdv.service?.nom} seront disponibles à partir du ${new Date(updates.date_resultats + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`, lu: false })
    }
    if (updates.delai_suivi_jours) {
      const rdv = rdvs.find(r => r.id === id)
      if (rdv) await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'suivi_recommande', titre: 'Suivi recommandé 📅', corps: `La clinique recommande un suivi dans ${updates.delai_suivi_jours} jours pour ${rdv.service?.nom}.`, lu: false })
    }
  }

  const rdvsFiltres = filtreStatut === 'tous' ? rdvs : rdvs.filter(r => r.statut === filtreStatut)
  const statusColors: Record<string, { bg: string, color: string, label: string }> = {
    en_attente: { bg: '#fdf8ec', color: '#c8992a', label: '⏳ En attente' },
    confirme: { bg: '#e8f5f1', color: '#22816a', label: '✅ Confirmé' },
    termine: { bg: '#f0ece2', color: '#7a7260', label: '🏥 Terminé' },
    annule: { bg: '#fdf0ee', color: '#c0392b', label: '❌ Annulé' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['tous', 'en_attente', 'confirme', 'termine', 'annule'].map(f => {
          const labels: Record<string, string> = { tous: 'Toutes', en_attente: '⏳ Attente', confirme: '✅ Confirmées', termine: '🏥 Terminées', annule: '❌ Annulées' }
          const count = f === 'tous' ? rdvs.length : rdvs.filter(r => r.statut === f).length
          return (
            <button key={f} onClick={() => setFiltreStatut(f)}
              style={{ padding: isMobile ? '6px 10px' : '7px 16px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: isMobile ? '0.7rem' : '0.78rem', fontWeight: 600, background: filtreStatut === f ? '#0d2b22' : '#f0ece2', color: filtreStatut === f ? 'white' : '#7a7260' }}>
              {labels[f]} ({count})
            </button>
          )
        })}
      </div>
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳ Chargement…</div>
        ) : rdvsFiltres.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📅</div>Aucune réservation
          </div>
        ) : rdvsFiltres.map(rdv => {
          const s = statusColors[rdv.statut] || statusColors.en_attente
          const cat = CATEGORIES.find(c => c.id === rdv.service?.categorie)
          const mode = rdv.service?.mode_reservation || 'creneau'
          return (
            <div key={rdv.id} style={{ padding: isMobile ? '14px 16px' : '16px 22px', borderBottom: '1px solid #f0ece2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isMobile ? '10px' : '0' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{cat?.icon || '⚕️'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.patient?.prenom} {rdv.patient?.nom}</div>
                  <div style={{ fontSize: '0.72rem', color: '#7a7260', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rdv.service?.nom} · {new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {afficherHeure(rdv.heure, mode)}
                  </div>
                </div>
                {!isMobile && <span style={{ padding: '4px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.label}</span>}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', paddingLeft: isMobile ? '50px' : '0', marginTop: isMobile ? '0' : '8px' }}>
                {isMobile && <span style={{ padding: '3px 9px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>}
                {rdv.statut === 'en_attente' && (
                  <>
                    <button onClick={() => updateStatut(rdv.id, 'confirme')} style={{ padding: '5px 10px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>✅ Confirmer</button>
                    <button onClick={() => updateStatut(rdv.id, 'annule')} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>❌ Annuler</button>
                  </>
                )}
                {rdv.statut === 'confirme' && (
                  <button onClick={() => updateStatut(rdv.id, 'termine')} style={{ padding: '5px 10px', borderRadius: '8px', background: '#f0ece2', color: '#7a7260', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>🏥 Terminer</button>
                )}
                <button onClick={() => onContacterPatient(rdv.patient)} style={{ padding: '5px 10px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>💬</button>
                <button onClick={() => setRdvActif(rdv)} style={{ padding: '5px 10px', borderRadius: '8px', background: '#faf8f4', color: '#0d2b22', border: '1px solid #f0ece2', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>Détails →</button>
              </div>
            </div>
          )
        })}
      </div>
      {rdvActif && (
        <ModalConsultation rdv={rdvActif} supabase={supabase} onClose={() => setRdvActif(null)} onSave={(updates: any) => sauvegarderNotes(rdvActif.id, updates)} onContacterPatient={onContacterPatient} isMobile={isMobile} />
      )}
    </div>
  )
}

// ── MODAL CONSULTATION ────────────────────────────────────────────────────────
function ModalConsultation({ rdv, supabase, onClose, onSave, onContacterPatient, isMobile }: any) {
  const mode = rdv.service?.mode_reservation || 'creneau'
  const [form, setForm] = useState({
    praticien_nom: rdv.praticien_nom || '',
    notes_clinique: rdv.notes_clinique || '',
    diagnostic: rdv.diagnostic || '',
    resultats_remis: rdv.resultats_remis || false,
    date_resultats: rdv.date_resultats || '',
    delai_suivi_jours: rdv.delai_suivi_jours || '',
    orientation: rdv.orientation || '',
    support_resultats: rdv.support_resultats || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    const updates: any = { ...form }
    if (updates.delai_suivi_jours) updates.delai_suivi_jours = Number(updates.delai_suivi_jours)
    else delete updates.delai_suivi_jours
    await onSave(updates)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const cat = CATEGORIES.find(c => c.id === rdv.service?.categorie)
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.83rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.4)', zIndex: 200, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed',
        right: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : '500px',
        background: 'white', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        fontFamily: 'Outfit, sans-serif',
      }}>
        <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '20px 24px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{cat?.icon || '⚕️'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.patient?.prenom} {rdv.patient?.nom}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rdv.service?.nom} · {new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · {afficherHeure(rdv.heure, mode)}
            </div>
            {rdv.patient?.telephone && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>📞 {rdv.patient.telephone}</div>}
            <button onClick={() => { onClose(); onContacterPatient(rdv.patient) }}
              style={{ marginTop: '8px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', fontWeight: 600 }}>
              💬 Envoyer un message
            </button>
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {rdv.notes_patient && (
            <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c8992a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Note du patient</div>
              <div style={{ fontSize: '0.82rem', color: '#4a3800', lineHeight: 1.5 }}>{rdv.notes_patient}</div>
            </div>
          )}
          <div><label style={labelStyle}>Praticien assigné</label><input value={form.praticien_nom} onChange={e => setForm({ ...form, praticien_nom: e.target.value })} placeholder="Nom du praticien…" style={inputStyle} /></div>
          <div><label style={labelStyle}>Notes internes</label><textarea value={form.notes_clinique} onChange={e => setForm({ ...form, notes_clinique: e.target.value })} rows={3} placeholder="Observations, remarques…" style={{ ...inputStyle, resize: 'none' }} /></div>
          <div><label style={labelStyle}>Diagnostic / Compte-rendu</label><textarea value={form.diagnostic} onChange={e => setForm({ ...form, diagnostic: e.target.value })} rows={3} placeholder="Résumé de la consultation…" style={{ ...inputStyle, resize: 'none' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Date résultats</label><input type="date" value={form.date_resultats} onChange={e => setForm({ ...form, date_resultats: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Suivi (jours)</label><input type="number" value={form.delai_suivi_jours} onChange={e => setForm({ ...form, delai_suivi_jours: e.target.value })} placeholder="Ex: 30" style={inputStyle} min={1} /></div>
          </div>
          <div><label style={labelStyle}>Orientation</label><input value={form.orientation} onChange={e => setForm({ ...form, orientation: e.target.value })} placeholder="Ex: Cardiologue…" style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Support résultats</label>
            <select value={form.support_resultats} onChange={e => setForm({ ...form, support_resultats: e.target.value })} style={inputStyle}>
              <option value="">Non défini</option>
              <option>Sur place</option><option>Email</option><option>Courrier</option><option>Application</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#faf8f4', borderRadius: '10px', border: '1px solid #f0ece2', cursor: 'pointer' }} onClick={() => setForm({ ...form, resultats_remis: !form.resultats_remis })}>
            <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: form.resultats_remis ? '#22816a' : 'white', border: `2px solid ${form.resultats_remis ? '#22816a' : '#d0c8bc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {form.resultats_remis && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: '0.82rem', color: '#0d2b22', fontWeight: 500 }}>Résultats remis au patient</span>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', gap: '10px' }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem' }}>
            {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : 'Enregistrer'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.88rem' }}>Fermer</button>
        </div>
      </div>
    </>
  )
}

// ── GESTION SERVICES ──────────────────────────────────────────────────────────
function GestionServices({ clinique, supabase, isMobile }: any) {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceSelectionne, setServiceSelectionne] = useState<any>(null)
  const [ongletService, setOngletService] = useState<'infos' | 'dispos'>('infos')
  const [showFormulaire, setShowFormulaire] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('clinique_services').select('*, disponibilites:clinique_disponibilites(*)').eq('clinique_id', clinique.id).order('categorie')
    setServices(data || [])
    if (serviceSelectionne) {
      const updated = data?.find((s: any) => s.id === serviceSelectionne.id)
      if (updated) setServiceSelectionne(updated)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [clinique.id])

  const toggleActif = async (id: string, actif: boolean) => {
    await supabase.from('clinique_services').update({ actif: !actif }).eq('id', id)
    load()
  }

  const supprimerService = async (id: string) => {
    if (!confirm('Supprimer ce service ?')) return
    await supabase.from('clinique_services').delete().eq('id', id)
    if (serviceSelectionne?.id === id) setServiceSelectionne(null)
    load()
  }

  // Sur mobile — si un service est sélectionné, on affiche le détail en plein écran
  if (isMobile && serviceSelectionne) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button onClick={() => setServiceSelectionne(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #f0ece2', borderRadius: '10px', padding: '8px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22', cursor: 'pointer', alignSelf: 'flex-start' }}>
          ← Retour aux services
        </button>
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
          <div style={{ padding: '0 20px', borderBottom: '1px solid #f0ece2', display: 'flex' }}>
            {[{ id: 'infos', label: '📋 Informations' }, { id: 'dispos', label: '📅 Disponibilités' }].map(t => (
              <button key={t.id} onClick={() => setOngletService(t.id as any)}
                style={{ padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: ongletService === t.id ? '#22816a' : '#a8a090', borderBottom: ongletService === t.id ? '2px solid #22816a' : '2px solid transparent', marginBottom: '-1px' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '20px' }}>
            {ongletService === 'infos' ? (
              <FormulaireService clinique={clinique} supabase={supabase} serviceExistant={serviceSelectionne} onSaved={() => load()} onCancel={() => setServiceSelectionne(null)} inline />
            ) : (
              <DisponibilitesService service={serviceSelectionne} supabase={supabase} />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setShowFormulaire(true); setServiceSelectionne(null) }}
          style={{ padding: '9px 20px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
          + Ajouter un service
        </button>
      </div>
      {showFormulaire && <FormulaireService clinique={clinique} supabase={supabase} onSaved={() => { setShowFormulaire(false); load() }} onCancel={() => setShowFormulaire(false)} />}
      <div style={{ display: 'grid', gridTemplateColumns: serviceSelectionne && !isMobile ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>{services.length} service{services.length !== 1 ? 's' : ''}</div>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090' }}>⏳</div>
          ) : services.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚕️</div>Aucun service — ajoutez-en un !
            </div>
          ) : services.map(svc => {
            const cat = CATEGORIES.find(c => c.id === svc.categorie)
            const modePlage = svc.mode_reservation === 'plage'
            const selected = serviceSelectionne?.id === svc.id
            return (
              <div key={svc.id} onClick={() => { setServiceSelectionne(selected ? null : svc); setOngletService('infos') }}
                style={{ padding: '14px 20px', borderBottom: '1px solid #f0ece2', cursor: 'pointer', background: selected && !isMobile ? '#f0f9f6' : 'white', display: 'flex', alignItems: 'center', gap: '12px', opacity: svc.actif ? 1 : 0.55, borderLeft: selected && !isMobile ? '3px solid #22816a' : '3px solid transparent' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{cat?.icon || '⚕️'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.nom}</div>
                  <div style={{ fontSize: '0.72rem', color: '#7a7260', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{cat?.label}</span>
                    {svc.tarif && <span style={{ color: '#c8992a', fontWeight: 600 }}>{Number(svc.tarif).toLocaleString()} Ar</span>}
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '50px', background: modePlage ? '#fdf8ec' : '#e8f5f1', color: modePlage ? '#c8992a' : '#22816a' }}>
                      {modePlage ? '🕐 Libre' : '📅 Créneau'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div onClick={e => { e.stopPropagation(); toggleActif(svc.id, svc.actif) }}
                    style={{ width: '34px', height: '19px', borderRadius: '50px', background: svc.actif ? '#22816a' : '#e0d8cc', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '2.5px', left: svc.actif ? '17px' : '2.5px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); supprimerService(svc.id) }} style={{ padding: '4px 8px', borderRadius: '7px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
        {serviceSelectionne && !isMobile && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px', borderBottom: '1px solid #f0ece2', display: 'flex' }}>
              {[{ id: 'infos', label: '📋 Informations' }, { id: 'dispos', label: '📅 Disponibilités' }].map(t => (
                <button key={t.id} onClick={() => setOngletService(t.id as any)}
                  style={{ padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: ongletService === t.id ? '#22816a' : '#a8a090', borderBottom: ongletService === t.id ? '2px solid #22816a' : '2px solid transparent', marginBottom: '-1px' }}>
                  {t.label}
                </button>
              ))}
              <button onClick={() => setServiceSelectionne(null)} style={{ marginLeft: 'auto', padding: '14px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#a8a090' }}>✕</button>
            </div>
            <div style={{ padding: '20px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              {ongletService === 'infos' ? (
                <FormulaireService clinique={clinique} supabase={supabase} serviceExistant={serviceSelectionne} onSaved={() => load()} onCancel={() => setServiceSelectionne(null)} inline />
              ) : (
                <DisponibilitesService service={serviceSelectionne} supabase={supabase} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── FORMULAIRE SERVICE ────────────────────────────────────────────────────────
function FormulaireService({ clinique, supabase, serviceExistant, onSaved, onCancel, inline }: any) {
  const [form, setForm] = useState({
    nom: serviceExistant?.nom || '',
    categorie: serviceExistant?.categorie || 'consultation',
    description: serviceExistant?.description || '',
    tarif: serviceExistant?.tarif || '',
    duree_minutes: serviceExistant?.duree_minutes || 30,
    mode_reservation: serviceExistant?.mode_reservation || 'creneau',
    actif: serviceExistant?.actif ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload: any = { clinique_id: clinique.id, nom: form.nom.trim(), categorie: form.categorie, description: form.description.trim() || null, tarif: form.tarif ? Number(form.tarif) : null, mode_reservation: form.mode_reservation, actif: form.actif }
    if (form.mode_reservation === 'creneau') payload.duree_minutes = Number(form.duree_minutes)
    if (serviceExistant) { await supabase.from('clinique_services').update(payload).eq('id', serviceExistant.id) }
    else { await supabase.from('clinique_services').insert(payload) }
    setSaving(false)
    if (inline) { setSaved(true); setTimeout(() => setSaved(false), 2000); onSaved() }
    else onSaved()
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.83rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {!inline && <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>{serviceExistant ? 'Modifier le service' : 'Nouveau service'}</div>}
      <div>
        <label style={labelStyle}>Mode de réservation</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { id: 'creneau', icon: '📅', titre: 'Créneaux fixes', desc: 'Horaires précis' },
            { id: 'plage', icon: '🕐', titre: 'Plage horaire', desc: 'Matin / Après-midi / Soir' },
          ].map(m => (
            <div key={m.id} onClick={() => setForm({ ...form, mode_reservation: m.id })}
              style={{ padding: '12px 14px', borderRadius: '12px', border: `2px solid ${form.mode_reservation === m.id ? '#22816a' : '#f0ece2'}`, background: form.mode_reservation === m.id ? '#f0f9f6' : 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{m.icon}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: form.mode_reservation === m.id ? '#22816a' : '#0d2b22', marginBottom: '2px' }}>{m.titre}</div>
              <div style={{ fontSize: '0.7rem', color: '#a8a090', lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div><label style={labelStyle}>Nom du service</label><input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Radio thoracique…" style={inputStyle} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Catégorie</label>
          <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Tarif (Ar)</label><input type="number" value={form.tarif} onChange={e => setForm({ ...form, tarif: e.target.value })} placeholder="Ex: 50000" style={inputStyle} min={0} /></div>
      </div>
      {form.mode_reservation === 'creneau' && (
        <div>
          <label style={labelStyle}>Durée par créneau</label>
          <select value={form.duree_minutes} onChange={e => setForm({ ...form, duree_minutes: Number(e.target.value) })} style={inputStyle}>
            {[15, 20, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
      )}
      <div><label style={labelStyle}>Description (optionnelle)</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Décrivez le service…" style={{ ...inputStyle, resize: 'none' }} /></div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving || !form.nom.trim()}
          style={{ flex: 1, padding: '10px', borderRadius: '10px', background: !form.nom.trim() ? '#cfc5ae' : saved ? '#22816a' : '#0d2b22', color: 'white', border: 'none', cursor: !form.nom.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.85rem' }}>
          {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : serviceExistant ? 'Enregistrer les modifications' : 'Créer le service →'}
        </button>
        {!inline && <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>Annuler</button>}
      </div>
    </div>
  )
}

// ── MESSAGERIE CLINIQUE ───────────────────────────────────────────────────────
function MessageriesClinique({ clinique, supabase, patientInitial, isMobile }: any) {
  const [conversations, setConversations] = useState<any[]>([])
  const [patientActif, setPatientActif] = useState<any>(patientInitial || null)
  const [messages, setMessages] = useState<any[]>([])
  const [nouveauMsg, setNouveauMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showList, setShowList] = useState(!patientInitial)
  const messagesEndRef = useRef<any>(null)

  const fetchConversations = async () => {
    const { data } = await supabase.from('clinique_messages').select('*').eq('clinique_id', clinique.id).order('created_at', { ascending: false })
    if (!data) return
    const patientIds = [...new Set(data.map((m: any) => m.patient_id))]
    if (patientIds.length === 0) { setConversations([]); return }
    const { data: profils } = await supabase.from('profils').select('id, prenom, nom').in('id', patientIds)
    const profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
    const map = new Map()
    for (const msg of data) {
      const pid = msg.patient_id
      if (!map.has(pid)) map.set(pid, { patient: profilMap[pid] || { id: pid, prenom: 'Patient', nom: '' }, dernierMsg: msg, nonLus: 0 })
      if (!msg.lu && msg.expediteur_type === 'patient') map.get(pid).nonLus++
    }
    setConversations(Array.from(map.values()))
  }

  const fetchMessages = async (patientId: string) => {
    const { data } = await supabase.from('clinique_messages').select('*').eq('clinique_id', clinique.id).eq('patient_id', patientId).order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('clinique_messages').update({ lu: true }).eq('clinique_id', clinique.id).eq('patient_id', patientId).eq('expediteur_type', 'patient')
    fetchConversations()
  }

  useEffect(() => { fetchConversations() }, [])
  useEffect(() => { if (patientActif) fetchMessages(patientActif.id) }, [patientActif])
  useEffect(() => { if (patientInitial) { setPatientActif(patientInitial); if (isMobile) setShowList(false) } }, [patientInitial])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const envoyer = async () => {
    if (!nouveauMsg.trim() || !patientActif) return
    setSending(true)
    await supabase.from('clinique_messages').insert({ clinique_id: clinique.id, patient_id: patientActif.id, expediteur_type: 'clinique', contenu: nouveauMsg.trim(), lu: false })
    await supabase.from('notifications').insert({ user_id: patientActif.id, type: 'message_clinique', titre: `Message de ${clinique.nom}`, corps: nouveauMsg.trim().slice(0, 100), lu: false })
    setNouveauMsg('')
    fetchMessages(patientActif.id)
    setSending(false)
  }

  const selectionnerPatient = (patient: any) => {
    setPatientActif(patient)
    if (isMobile) setShowList(false)
  }

  const ListeConversations = () => (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0ece2', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090' }}>
        Patients ({conversations.length})
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: '0.82rem', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>Aucune conversation
          </div>
        ) : conversations.map(conv => (
          <div key={conv.patient?.id} onClick={() => selectionnerPatient(conv.patient)}
            style={{ padding: '12px 16px', borderBottom: '1px solid #f9f7f2', cursor: 'pointer', background: !isMobile && patientActif?.id === conv.patient?.id ? '#f0f9f6' : 'transparent', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#22816a', flexShrink: 0 }}>
              {conv.patient?.prenom?.charAt(0)}{conv.patient?.nom?.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: conv.nonLus > 0 ? 700 : 600, color: '#0d2b22' }}>{conv.patient?.prenom} {conv.patient?.nom}</div>
                {conv.nonLus > 0 && <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#22816a', color: 'white', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{conv.nonLus}</div>}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a8a090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.dernierMsg?.expediteur_type === 'clinique' ? 'Vous: ' : ''}{conv.dernierMsg?.contenu}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const ZoneMessages = () => (
    <>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ece2', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isMobile && (
          <button onClick={() => setShowList(true)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        )}
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#22816a' }}>
          {patientActif?.prenom?.charAt(0)}{patientActif?.nom?.charAt(0)}
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0d2b22' }}>{patientActif?.prenom} {patientActif?.nom}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💬</div>
            <div style={{ fontSize: '0.82rem' }}>Début de votre conversation</div>
          </div>
        )}
        {messages.map(msg => {
          const estClinique = msg.expediteur_type === 'clinique'
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: estClinique ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: estClinique ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: estClinique ? '#0d2b22' : '#f0ece2', color: estClinique ? 'white' : '#1a1512', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {msg.contenu}
                <div style={{ fontSize: '0.65rem', color: estClinique ? 'rgba(255,255,255,0.4)' : '#a8a090', marginTop: '4px', textAlign: 'right' }}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0ece2', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <input value={nouveauMsg} onChange={e => setNouveauMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && envoyer()}
          placeholder="Écrire un message…" style={{ flex: 1, padding: '10px 14px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none' }} />
        <button onClick={envoyer} disabled={sending || !nouveauMsg.trim()} style={{ padding: '10px 16px', borderRadius: '10px', background: !nouveauMsg.trim() ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: !nouveauMsg.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
          {isMobile ? '→' : 'Envoyer'}
        </button>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div style={{ height: 'calc(100vh - 160px)', borderRadius: '16px', border: '1px solid #f0ece2', background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {showList || !patientActif ? <ListeConversations /> : <ZoneMessages />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', borderRadius: '16px', border: '1px solid #f0ece2', background: 'white', overflow: 'hidden' }}>
      <div style={{ width: '280px', borderRight: '1px solid #f0ece2', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <ListeConversations />
      </div>
      {patientActif ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ZoneMessages />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#a8a090' }}>
          <span style={{ fontSize: '2.5rem' }}>💬</span>
          <span style={{ fontSize: '0.85rem' }}>Sélectionnez un patient</span>
        </div>
      )}
    </div>
  )
}

// ── PROFIL CLINIQUE ───────────────────────────────────────────────────────────
function ProfilClinique({ clinique, supabase, onUpdate, isMobile }: any) {
  const [form, setForm] = useState({
    nom: clinique?.nom || '', adresse: clinique?.adresse || '', region: clinique?.region || '',
    telephone: clinique?.telephone || '', email: clinique?.email || '', description: clinique?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.83rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }

  const save = async () => {
    setSaving(true)
    const { data } = await supabase.from('cliniques').update(form).eq('id', clinique.id).select().single()
    if (data) onUpdate(data)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: '560px', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Informations de la clinique</div>
        <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Ces informations sont affichées sur votre page publique</div>
      </div>
      <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div><label style={labelStyle}>Nom de la clinique</label><input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Adresse</label><input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Région</label><input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Téléphone</label><input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Présentez votre établissement…" style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <button onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem', alignSelf: 'flex-start' }}>
          {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  )
}