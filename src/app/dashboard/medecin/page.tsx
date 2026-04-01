'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profil, Medecin, RendezVous } from '@/lib/types'
import Messagerie from '@/components/shared/Messagerie'
import AvatarUpload from '@/components/shared/AvatarUpload'
import Avatar from '@/components/shared/Avatar'
import DossierMedical from '@/components/shared/DossierMedical'
import Disponibilites from '@/components/shared/Disponibilites'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

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

export default function DashboardMedecin() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024

  const [profil, setProfil] = useState<Profil | null>(null)
  const [medecin, setMedecin] = useState<Medecin | null>(null)
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [page, setPage] = useState('dash')
  const [loading, setLoading] = useState(true)
  const [planActif, setPlanActif] = useState<boolean>(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dossierPatientId, setDossierPatientId] = useState<string | null>(null)
  const [patientPanel, setPatientPanel] = useState<any>(null)
  const [modalTermine, setModalTermine] = useState<any>(null)
  const [avisMap, setAvisMap] = useState<Record<string, any>>({})
  const notifRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase.from('profils').select('*').eq('id', user.id).single()
      const { data: m } = await supabase.from('medecins').select('*').eq('id', user.id).single()
      const { data: r } = await supabase
        .from('rendez_vous')
        .select('*, patient:patients(*, profil:profils(*))')
        .eq('medecin_id', user.id)
        .order('date_rdv', { ascending: true })
      const { data: n } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      const { data: avisData } = await supabase
        .from('avis')
        .select('id, rdv_id, note, commentaire, created_at')
        .eq('medecin_id', user.id)

      const map: Record<string, any> = {}
      ;(avisData || []).forEach((a: any) => { map[a.rdv_id] = a })

      setProfil(p)
      setMedecin(m)
      setPlanActif((m as any)?.plan_actif === true)
      setRdvs(r || [])
      setNotifications(n || [])
      setAvisMap(map)
      setLoading(false)

      supabase.channel('dashboard-medecin')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
          setNotifications(prev => [payload.new, ...prev])
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'medecins', filter: `id=eq.${user.id}` }, (payload: any) => {
          const updated = payload.new as any
          setPlanActif(updated.plan_actif === true)
          setMedecin((prev: any) => ({ ...prev, ...updated }))
        })
        .subscribe()
    }
    load()
    return () => { supabase.removeAllChannels() }
  }, [])

  useEffect(() => {
    const handler = (e: any) => { setDossierPatientId(e.detail.patientId); setPage('dossiers') }
    window.addEventListener('openDossierPatient', handler)
    return () => window.removeEventListener('openDossierPatient', handler)
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPatientPanel(null)
    }
    if (patientPanel) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [patientPanel])

  // Fermer sidebar mobile quand on change de page
  useEffect(() => { setSidebarOpen(false) }, [page])

  const logout = async () => { await supabase.auth.signOut(); router.push('/') }

  const updateRdvStatus = async (id: string, statut: string) => {
    await supabase.from('rendez_vous').update({ statut }).eq('id', id)
    setRdvs(prev => prev.map(r => r.id === id ? { ...r, statut: statut as any } : r))
  }

  const marquerToutLu = async () => {
    if (!profil) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', profil.id)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const marquerLu = async (id: string) => {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const openPatientPanel = async (rdv: any) => {
    if (!['confirme', 'termine'].includes(rdv.statut)) return
    setPatientPanel({ id: rdv.patient_id, rdvStatut: rdv.statut, _loading: true })
    const { data: profilData } = await supabase.from('profils').select('*').eq('id', rdv.patient_id).single()
    const { data: patientData } = await supabase.from('patients').select('*').eq('id', rdv.patient_id).single()
    setPatientPanel({ id: rdv.patient_id, profil: profilData, patient: patientData, rdvStatut: rdv.statut, _loading: false })
  }

  const soumettreConsultation = async (rdvId: string, data: any) => {
    await supabase.from('rendez_vous').update({
      statut: 'termine', diagnostic: data.diagnostic, notes_medecin: data.notes,
      ordonnance: data.ordonnance, examens: data.examens, analyses: data.analyses,
    }).eq('id', rdvId)
    setRdvs(prev => prev.map(r => r.id === rdvId ? { ...r, statut: 'termine' as any, diagnostic: data.diagnostic, notes_medecin: data.notes, ordonnance: data.ordonnance, examens: data.examens, analyses: data.analyses } : r))
    setModalTermine(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  const plan = (medecin as any)?.plan || 'essentiel'
  const isPro = plan === 'pro' || plan === 'clinic'
  const tarif = Number((medecin as any)?.tarif) || 0
  const nonLues = notifications.filter(n => !n.lu).length

  const notifIcons: Record<string, string> = {
    nouveau_rdv: '📅', rdv_confirme: '✅', rdv_annule: '❌', rdv_termine: '🏥', nouveau_message: '💬',
  }

  const statusColors: Record<string, { bg: string, color: string, label: string }> = {
    en_attente: { bg: '#fdf8ec', color: '#c8992a', label: '⏳ En attente' },
    confirme: { bg: '#e8f5f1', color: '#22816a', label: '✅ Confirmé' },
    termine: { bg: '#f0ece2', color: '#7a7260', label: '🏥 Terminé' },
    annule: { bg: '#fdf0ee', color: '#c0392b', label: '❌ Annulé' },
  }

  const navItems = [
    { id: 'dash', icon: '◈', label: 'Dashboard', locked: false },
    { id: 'rdvs', icon: '◷', label: 'Rendez-vous', locked: false },
    { id: 'messages', icon: '◻', label: 'Messagerie', locked: !isPro },
    { id: 'dossiers', icon: '◱', label: 'Dossiers', locked: !isPro },
    { id: 'analytics', icon: '▦', label: 'Analytiques', locked: !isPro },
    { id: 'dispo', icon: '⊡', label: 'Disponibilités', locked: false },
    { id: 'profil', icon: '◎', label: 'Mon profil', locked: false },
  ]

  const UpgradeWall = ({ feature }: { feature: string }) => (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: isMobile ? '40px 20px' : '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔒</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>{feature} — Plan Pro</div>
      <div style={{ fontSize: '0.85rem', color: '#7a7260', maxWidth: '400px', margin: '0 auto 24px' }}>
        Cette fonctionnalité est disponible à partir du plan Pro à <strong>30 000 Ar/mois</strong>.
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div onClick={() => router.push('/upgrade')} style={{ background: '#0d2b22', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>Passer au Plan Pro →</div>
      </div>
    </div>
  )

  const renderModalTermine = () => {
    if (!modalTermine) return null
    return <ModalConsultation rdv={modalTermine} onClose={() => setModalTermine(null)} onSubmit={(data: any) => soumettreConsultation(modalTermine.id, data)} isMobile={isMobile} />
  }

  const renderPatientPanel = () => {
    if (!patientPanel) return null
    const p = patientPanel
    const canSeeDossier = isPro
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.25)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
        <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '380px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif', animation: 'slideIn 0.22s ease-out' }}>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
          <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <button onClick={() => setPatientPanel(null)} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: 'rgba(46,181,146,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.profil?.avatar_url ? <img src={p.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>🧑</span>}
            </div>
            {p._loading ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Chargement…</div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{p.profil?.prenom} {p.profil?.nom}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>Patient</div>
                <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: p.rdvStatut === 'confirme' ? 'rgba(34,129,106,0.25)' : 'rgba(255,255,255,0.1)', color: p.rdvStatut === 'confirme' ? '#2eb592' : 'rgba(255,255,255,0.5)', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: `1px solid ${p.rdvStatut === 'confirme' ? 'rgba(46,181,146,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                  {p.rdvStatut === 'confirme' ? '✅ RDV confirmé' : '🏥 Consultation terminée'}
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {p._loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#a8a090' }}>⏳</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {p.profil?.email && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>✉️</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Email</div><div style={{ fontSize: '0.83rem', color: '#1a1512' }}>{p.profil.email}</div></div></div>)}
                  {p.profil?.telephone && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>📞</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div><a href={`tel:${p.profil.telephone}`} style={{ fontSize: '0.83rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{p.profil.telephone}</a></div></div>)}
                  {p.patient?.date_naissance && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>🎂</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Date de naissance</div><div style={{ fontSize: '0.83rem', color: '#1a1512' }}>{new Date(p.patient.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div></div>)}
                  {p.patient?.groupe_sanguin && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>🩸</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Groupe sanguin</div><div style={{ fontSize: '0.83rem', color: '#c0392b', fontWeight: 700 }}>{p.patient.groupe_sanguin}</div></div></div>)}
                  {p.patient?.allergies && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span style={{ marginTop: '1px' }}>⚠️</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Allergies</div><div style={{ fontSize: '0.83rem', color: '#c0392b' }}>{p.patient.allergies}</div></div></div>)}
                  {p.patient?.antecedents && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span style={{ marginTop: '1px' }}>📋</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Antécédents</div><div style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.5 }}>{p.patient.antecedents}</div></div></div>)}
                </div>
                {(p.patient?.poids || p.patient?.taille) && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {p.patient?.poids && (<div style={{ flex: 1, textAlign: 'center', background: '#faf8f4', padding: '12px', borderRadius: '12px', border: '1px solid #f0ece2' }}><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: '#0d2b22' }}>{p.patient.poids}</div><div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600 }}>kg</div></div>)}
                    {p.patient?.taille && (<div style={{ flex: 1, textAlign: 'center', background: '#faf8f4', padding: '12px', borderRadius: '12px', border: '1px solid #f0ece2' }}><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: '#0d2b22' }}>{p.patient.taille}</div><div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600 }}>cm</div></div>)}
                  </div>
                )}
                {!canSeeDossier && (
                  <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '14px 16px', border: '1px solid #f0e4b8' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c8992a', marginBottom: '4px' }}>🔒 Plan Pro requis</div>
                    <div style={{ fontSize: '0.75rem', color: '#a8906a', lineHeight: 1.5 }}>Passez au plan Pro pour accéder au dossier médical complet.</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {!p._loading && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {canSeeDossier && (
                <button onClick={() => { setPatientPanel(null); setDossierPatientId(p.id); setPage('dossiers') }}
                  style={{ padding: '11px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                  📋 Voir le dossier médical
                </button>
              )}
              <button onClick={() => setPatientPanel(null)}
                style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </>
    )
  }

  const pageTitle: Record<string, string> = {
    dash: 'Tableau de bord', rdvs: 'Mes rendez-vous', messages: 'Messagerie',
    dossiers: 'Dossiers patients', dispo: 'Disponibilités', profil: 'Mon profil', analytics: 'Analytiques',
  }

  return (
    <>
      {renderPatientPanel()}
      {renderModalTermine()}

      {/* BANNIÈRE PLAN INACTIF */}
      {!planActif && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, background: 'linear-gradient(90deg, #c8992a, #e6b84a)', padding: isMobile ? '8px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(200,153,42,0.35)', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: isMobile ? '0.75rem' : '0.83rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {isMobile ? 'Profil non visible — aucun plan actif.' : 'Votre profil n\'est pas visible par les patients — aucun plan actif.'}
            </span>
          </div>
          <div onClick={() => router.push('/upgrade')} style={{ background: '#0d2b22', color: 'white', padding: isMobile ? '5px 12px' : '6px 16px', borderRadius: '8px', fontSize: isMobile ? '0.72rem' : '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
            {isMobile ? 'Choisir →' : 'Choisir un plan →'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', paddingTop: planActif ? 0 : isMobile ? '38px' : '44px' }}>

        {/* OVERLAY SIDEBAR MOBILE */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
        )}

        {/* SIDEBAR */}
        <nav style={{
          width: '256px',
          minHeight: '100vh',
          background: '#0d2b22',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: isMobile ? 'fixed' : 'relative',
          top: 0, left: 0, bottom: 0,
          zIndex: isMobile ? 160 : 'auto',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s ease',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 0%, rgba(34,129,106,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div onClick={() => setPage('dash')} style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: 'white', letterSpacing: '-0.02em' }}>Dokt<em style={{ color: '#2eb592' }}>éra</em></div>
          </div>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar url={profil?.avatar_url} prenom={profil?.prenom} nom={profil?.nom} role="medecin" size={40} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Dr. {profil?.prenom} {profil?.nom}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-block', background: 'rgba(34,129,106,0.25)', color: '#2eb592', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.07em', border: '1px solid rgba(46,181,146,0.2)' }}>{medecin?.specialite || 'Médecin'}</div>
                <div style={{ display: 'inline-block', background: isPro ? 'rgba(200,153,42,0.2)' : 'rgba(255,255,255,0.08)', color: isPro ? '#e6b84a' : 'rgba(255,255,255,0.3)', fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.07em', border: `1px solid ${isPro ? 'rgba(200,153,42,0.2)' : 'rgba(255,255,255,0.1)'}` }}>
                  {planActif ? plan : 'inactif'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
            {navItems.map(item => (
              <div key={item.id} onClick={() => setPage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', cursor: 'pointer', borderLeft: `2px solid ${page === item.id ? '#2eb592' : 'transparent'}`, background: page === item.id ? 'rgba(34,129,106,0.18)' : 'none', color: page === item.id ? 'white' : item.locked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s' }}>
                <span style={{ width: '18px', textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.locked && <span style={{ fontSize: '0.65rem', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>PRO</span>}
              </div>
            ))}
          </div>
          {!isPro && (
            <div style={{ margin: '0 16px 12px', padding: '14px', background: 'rgba(200,153,42,0.1)', borderRadius: '12px', border: '1px solid rgba(200,153,42,0.2)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e6b84a', marginBottom: '6px' }}>⚡ Plan Essentiel</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '10px' }}>Passez au Pro pour débloquer messagerie, stats et dossiers patients.</div>
              <div onClick={() => router.push('/upgrade')} style={{ background: '#c8992a', color: '#0d2b22', fontSize: '0.7rem', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>Passer au Pro →</div>
            </div>
          )}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>⇄ Se déconnecter</div>
          </div>
        </nav>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* TOPBAR */}
          <div style={{ background: 'white', padding: isMobile ? '12px 16px' : '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ece2', flexShrink: 0, gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              {isMobile && (
                <button onClick={() => setSidebarOpen(true)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>☰</button>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pageTitle[page] || page}
                </div>
                {!isMobile && <div style={{ fontSize: '0.78rem', color: '#7a7260', marginTop: '1px' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>}
              </div>
            </div>
            <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
              <div onClick={() => { setShowNotifs(v => !v); if (!showNotifs && nonLues > 0) marquerToutLu() }} style={{ width: '40px', height: '40px', background: nonLues > 0 ? '#fdf8ec' : '#f0ece2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', border: nonLues > 0 ? '1.5px solid rgba(200,153,42,0.3)' : '1.5px solid transparent', position: 'relative' }}>
                🔔
                {nonLues > 0 && (<div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', background: '#c0392b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', border: '2px solid white' }}>{nonLues > 9 ? '9+' : nonLues}</div>)}
              </div>
              {showNotifs && (
                <div style={{ position: 'absolute', top: '48px', right: 0, width: isMobile ? 'calc(100vw - 32px)' : '340px', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22' }}>Notifications {nonLues > 0 && <span style={{ fontSize: '0.72rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 7px', borderRadius: '50px', marginLeft: '6px' }}>{nonLues} non lues</span>}</div>
                    {notifications.some(n => !n.lu) && <div onClick={marquerToutLu} style={{ fontSize: '0.72rem', color: '#22816a', fontWeight: 600, cursor: 'pointer' }}>Tout lu</div>}
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}><div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔔</div>Aucune notification</div>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={() => marquerLu(n.id)} style={{ padding: '13px 18px', borderBottom: '1px solid #f8f5f0', background: n.lu ? 'white' : '#fdf8ec', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: '1px' }}>{notifIcons[n.type] || '🔔'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.83rem', fontWeight: n.lu ? 500 : 700, color: '#0d2b22', marginBottom: '3px' }}>{n.titre}</div>
                          {n.corps && <div style={{ fontSize: '0.75rem', color: '#7a7260', lineHeight: 1.5, marginBottom: '4px' }}>{n.corps}</div>}
                          <div style={{ fontSize: '0.68rem', color: '#a8a090' }}>{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {!n.lu && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22816a', flexShrink: 0, marginTop: '6px' }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px', background: '#faf8f4' }}>

            {page === 'dash' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
                  {[
                    { label: "RDV aujourd'hui", value: rdvs.filter(r => new Date(r.date_rdv).toDateString() === new Date().toDateString()).length, sub: 'consultations prévues', color: '#22816a' },
                    { label: 'RDV ce mois', value: rdvs.filter(r => new Date(r.date_rdv).getMonth() === new Date().getMonth()).length, sub: 'ce mois-ci', color: '#0d2b22' },
                    { label: 'Note moyenne', value: (medecin as any)?.note_moyenne || '—', sub: `${(medecin as any)?.nombre_avis || 0} avis`, color: '#c8992a' },
                    { label: 'Total RDV', value: rdvs.length, sub: 'depuis le début', color: '#0d2b22' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: 'white', borderRadius: '16px', padding: isMobile ? '14px' : '22px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: stat.color }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '8px' }}>{stat.label}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 600, color: '#0d2b22', lineHeight: 1 }}>{stat.value}</div>
                      {!isMobile && <div style={{ fontSize: '0.72rem', color: '#7a7260', marginTop: '5px' }}>{stat.sub}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>RDV à venir</div>
                    <button onClick={() => setPage('rdvs')} style={{ padding: '6px 14px', borderRadius: '8px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#0d2b22' }}>Voir tout</button>
                  </div>
                  {rdvs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.85rem' }}>Aucun rendez-vous pour le moment</div>
                  ) : isMobile ? (
                    <RdvCards rdvs={rdvs.slice(0, 5)} statusColors={statusColors} updateRdvStatus={updateRdvStatus} profil={profil} supabase={supabase} onPatientClick={openPatientPanel} onTerminerClick={(rdv: any) => setModalTermine(rdv)} avisMap={avisMap} />
                  ) : (
                    <RdvTable rdvs={rdvs.slice(0, 5)} statusColors={statusColors} updateRdvStatus={updateRdvStatus} profil={profil} supabase={supabase} onPatientClick={openPatientPanel} onTerminerClick={(rdv: any) => setModalTermine(rdv)} avisMap={avisMap} />
                  )}
                </div>
              </div>
            )}

            {page === 'rdvs' && (
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Tous les rendez-vous ({rdvs.length})</div>
                </div>
                {rdvs.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#a8a090' }}>Aucun rendez-vous</div>
                ) : isMobile ? (
                  <RdvCards rdvs={rdvs} statusColors={statusColors} updateRdvStatus={updateRdvStatus} profil={profil} supabase={supabase} onPatientClick={openPatientPanel} onTerminerClick={(rdv: any) => setModalTermine(rdv)} avisMap={avisMap} />
                ) : (
                  <RdvTable rdvs={rdvs} statusColors={statusColors} updateRdvStatus={updateRdvStatus} profil={profil} supabase={supabase} onPatientClick={openPatientPanel} onTerminerClick={(rdv: any) => setModalTermine(rdv)} avisMap={avisMap} />
                )}
              </div>
            )}

            {page === 'messages' && (isPro && profil ? <Messagerie currentUserId={profil.id} supabase={supabase} role="medecin" planMedecin={plan} /> : <UpgradeWall feature="Messagerie" />)}
            {page === 'dossiers' && (isPro ? <DossiersPatients supabase={supabase} rdvs={rdvs} medecinId={profil?.id} preselectedPatientId={dossierPatientId} onPatientSelected={() => setDossierPatientId(null)} isMobile={isMobile} /> : <UpgradeWall feature="Dossiers patients" />)}
            {page === 'analytics' && (isPro ? <Analytics rdvs={rdvs} tarif={tarif} onGoToProfil={() => setPage('profil')} isMobile={isMobile} isTablet={isTablet} /> : <UpgradeWall feature="Analytiques" />)}
            {page === 'dispo' && profil && <Disponibilites medecinId={profil.id} supabase={supabase} />}
            {page === 'profil' && (
              <div style={{ maxWidth: '600px' }}>
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Informations du cabinet</div>
                    <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '3px' }}>Ces informations sont visibles par les patients</div>
                  </div>
                  <div style={{ padding: '22px' }}>
                    <ProfilForm profil={profil} medecin={medecin} supabase={supabase} onSaved={(newTarif: number) => setMedecin((m: any) => ({ ...m, tarif: newTarif }))} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM NAV MOBILE */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 140, background: 'white', borderTop: '1px solid #f0ece2', display: 'flex', justifyContent: 'space-around', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
          {[
            { id: 'dash', icon: '◈', label: 'Accueil' },
            { id: 'rdvs', icon: '◷', label: 'RDV' },
            { id: 'messages', icon: '◻', label: 'Messages' },
            { id: 'dispo', icon: '⊡', label: 'Dispos' },
            { id: 'profil', icon: '◎', label: 'Profil' },
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

// ═══════════════════════════════════════════════════════
// RDV CARDS (mobile)
// ═══════════════════════════════════════════════════════
function RdvCards({ rdvs, statusColors, updateRdvStatus, profil, supabase, onPatientClick, onTerminerClick, avisMap }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {rdvs.map((rdv: any) => {
        const s = statusColors[rdv.statut] || statusColors.en_attente
        const patient = rdv.patient
        const isClickable = ['confirme', 'termine'].includes(rdv.statut)
        return (
          <div key={rdv.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f0ece2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {patient?.profil?.avatar_url ? <img src={patient.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span>🧑</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div onClick={() => isClickable && onPatientClick(rdv)} style={{ fontWeight: 600, fontSize: '0.88rem', color: isClickable ? '#22816a' : '#0d2b22', cursor: isClickable ? 'pointer' : 'default' }}>
                  {patient?.profil?.prenom} {patient?.profil?.nom}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>
                  {new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {new Date(rdv.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ padding: '3px 9px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {rdv.motif && <div style={{ fontSize: '0.75rem', color: '#7a7260', marginBottom: '10px', paddingLeft: '46px' }}>📋 {rdv.motif}</div>}
            <div style={{ display: 'flex', gap: '6px', paddingLeft: '46px', flexWrap: 'wrap' }}>
              {rdv.statut === 'en_attente' && (
                <button onClick={async () => {
                  await updateRdvStatus(rdv.id, 'confirme')
                  await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'rdv_confirme', titre: 'Rendez-vous confirmé ✅', corps: `Dr. ${profil?.prenom} ${profil?.nom} a confirmé votre RDV.` })
                }} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: '#e8f5f1', color: '#22816a' }}>Confirmer</button>
              )}
              {rdv.statut === 'confirme' && (
                <button onClick={() => onTerminerClick(rdv)} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: '#f0ece2', color: '#7a7260' }}>Terminé</button>
              )}
              {rdv.statut !== 'annule' && rdv.statut !== 'termine' && (
                <button onClick={async () => {
                  await updateRdvStatus(rdv.id, 'annule')
                  await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'rdv_annule', titre: 'Rendez-vous annulé ❌', corps: `Votre RDV a été annulé par le médecin.` })
                }} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: '#fdf0ee', color: '#c0392b' }}>Annuler</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// RDV TABLE (desktop/tablet)
// ═══════════════════════════════════════════════════════
function RdvTable({ rdvs, statusColors, updateRdvStatus, profil, supabase, onPatientClick, onTerminerClick, avisMap }: any) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#faf8f4' }}>
          {['Patient', 'Date & Heure', 'Motif', 'Statut', 'Avis', 'Actions'].map(h => (
            <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rdvs.map((rdv: any) => {
          const s = statusColors[rdv.statut] || statusColors.en_attente
          const patient = rdv.patient
          const isClickable = ['confirme', 'termine'].includes(rdv.statut)
          const avis = avisMap?.[rdv.id] || null
          return (
            <tr key={rdv.id} style={{ borderBottom: '1px solid #f0ece2' }}>
              <td style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isClickable ? 'pointer' : 'default' }} onClick={() => isClickable && onPatientClick(rdv)}>
                  <Avatar url={patient?.profil?.avatar_url} prenom={patient?.profil?.prenom} nom={patient?.profil?.nom} role="patient" size={36} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isClickable ? '#22816a' : '#0d2b22' }}>
                      {patient?.profil?.prenom} {patient?.profil?.nom}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{patient?.profil?.telephone}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '14px 18px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0d2b22' }}>{new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{new Date(rdv.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </td>
              <td style={{ padding: '14px 18px', fontSize: '0.82rem', color: '#7a7260' }}>{rdv.motif || '—'}</td>
              <td style={{ padding: '14px 18px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700 }}>{s.label}</span>
              </td>
              <td style={{ padding: '14px 18px' }}>
                {rdv.statut === 'termine' ? (
                  avis ? <span style={{ color: '#e6b84a', fontSize: '0.8rem' }}>{'★'.repeat(avis.note)}</span> : <span style={{ fontSize: '0.72rem', color: '#c8c0b4', fontStyle: 'italic' }}>— non noté</span>
                ) : <span style={{ fontSize: '0.72rem', color: '#e0dbd0' }}>—</span>}
              </td>
              <td style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {rdv.statut === 'en_attente' && (
                    <button onClick={async () => {
                      await updateRdvStatus(rdv.id, 'confirme')
                      await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'rdv_confirme', titre: 'Rendez-vous confirmé ✅', corps: `Dr. ${profil?.prenom} ${profil?.nom} a confirmé votre RDV du ${new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.` })
                    }} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, background: '#e8f5f1', color: '#22816a' }}>Confirmer</button>
                  )}
                  {rdv.statut === 'confirme' && (
                    <button onClick={() => onTerminerClick(rdv)} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, background: '#f0ece2', color: '#7a7260' }}>Terminé</button>
                  )}
                  {rdv.statut !== 'annule' && rdv.statut !== 'termine' && (
                    <button onClick={async () => {
                      await updateRdvStatus(rdv.id, 'annule')
                      await supabase.from('notifications').insert({ user_id: rdv.patient_id, type: 'rdv_annule', titre: 'Rendez-vous annulé ❌', corps: `Votre RDV du ${new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} a été annulé.` })
                    }} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, background: '#fdf0ee', color: '#c0392b' }}>Annuler</button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════
// MODAL FIN DE CONSULTATION
// ═══════════════════════════════════════════════════════
function ModalConsultation({ rdv, onClose, onSubmit, isMobile }: any) {
  const [form, setForm] = useState({ diagnostic: rdv.diagnostic || '', notes: rdv.notes_medecin || '', ordonnance: rdv.ordonnance || '', examens: rdv.examens || '', analyses: rdv.analyses || '' })
  const [submitting, setSubmitting] = useState(false)
  const patient = rdv.patient
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }
  const handleSubmit = async () => { setSubmitting(true); await onSubmit(form); setSubmitting(false) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : '20px', width: '100%', maxWidth: isMobile ? '100%' : '560px', maxHeight: isMobile ? '90vh' : '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(13,43,34,0.25)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '16px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Clôturer la consultation</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>{patient?.profil?.prenom} {patient?.profil?.nom}</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={labelStyle}>🩺 Diagnostic</label><textarea value={form.diagnostic} onChange={e => setForm({ ...form, diagnostic: e.target.value })} rows={2} placeholder="Diagnostic final ou provisoire…" style={inputStyle} /></div>
          <div><label style={labelStyle}>📝 Notes du médecin</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Observations, évolution…" style={inputStyle} /></div>
          <div><label style={labelStyle}>💊 Ordonnance</label><textarea value={form.ordonnance} onChange={e => setForm({ ...form, ordonnance: e.target.value })} rows={3} placeholder="Médicaments prescrits…" style={inputStyle} /></div>
          <div><label style={labelStyle}>🔬 Examens</label><textarea value={form.examens} onChange={e => setForm({ ...form, examens: e.target.value })} rows={2} placeholder="Ex: Radiographie, ECG…" style={inputStyle} /></div>
          <div><label style={labelStyle}>🧪 Analyses</label><textarea value={form.analyses} onChange={e => setForm({ ...form, analyses: e.target.value })} rows={2} placeholder="Ex: NFS, glycémie…" style={inputStyle} /></div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: submitting ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>
            {submitting ? '⏳ Enregistrement…' : '✅ Terminer la consultation'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: '12px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.9rem' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════
function Analytics({ rdvs, tarif, onGoToProfil, isMobile, isTablet }: { rdvs: any[], tarif: number, onGoToProfil: () => void, isMobile: boolean, isTablet: boolean }) {
  const [periode, setPeriode] = useState<'3m' | '6m' | '12m'>('6m')
  const now = new Date()
  const moisCount = periode === '3m' ? 3 : periode === '6m' ? 6 : 12
  const mois = Array.from({ length: moisCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (moisCount - 1 - i), 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) }
  })
  const rdvTermines = rdvs.filter(r => r.statut === 'termine')
  const statsMois = mois.map(m => {
    const rdvDuMois = rdvs.filter(r => { const d = new Date(r.date_rdv); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === m.key })
    const terminesDuMois = rdvDuMois.filter(r => r.statut === 'termine')
    return { mois: m.label, rdvs: rdvDuMois.length, termines: terminesDuMois.length, annules: rdvDuMois.filter(r => r.statut === 'annule').length, revenus: terminesDuMois.length * tarif }
  })
  const moisActuelKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const rdvCeMois = rdvs.filter(r => { const d = new Date(r.date_rdv); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === moisActuelKey })
  const revenuCeMois = rdvCeMois.filter(r => r.statut === 'termine').length * tarif
  const revenuTotal = rdvTermines.length * tarif
  const tauxAnnulation = rdvs.length > 0 ? Math.round(rdvs.filter(r => r.statut === 'annule').length / rdvs.length * 100) : 0
  const tauxCompletion = rdvs.length > 0 ? Math.round(rdvTermines.length / rdvs.length * 100) : 0
  const motifsMap = new Map<string, number>()
  rdvs.forEach(r => { if (r.motif) { const m = r.motif.trim(); motifsMap.set(m, (motifsMap.get(m) || 0) + 1) } })
  const topMotifs = Array.from(motifsMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const pieData = [
    { name: 'Terminés', value: rdvs.filter(r => r.statut === 'termine').length, color: '#22816a' },
    { name: 'Confirmés', value: rdvs.filter(r => r.statut === 'confirme').length, color: '#2eb592' },
    { name: 'En attente', value: rdvs.filter(r => r.statut === 'en_attente').length, color: '#c8992a' },
    { name: 'Annulés', value: rdvs.filter(r => r.statut === 'annule').length, color: '#c0392b' },
  ].filter(d => d.value > 0)

  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: isMobile ? '16px' : '22px', border: '1px solid #f0ece2' }
  const titleStyle: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '16px' }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }

  if (tarif === 0) return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: isMobile ? '40px 20px' : '60px', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#0d2b22', marginBottom: '8px' }}>Tarif non défini</div>
      <div style={{ fontSize: '0.85rem', color: '#7a7260', marginBottom: '20px' }}>Définissez votre tarif dans votre profil.</div>
      <div onClick={onGoToProfil} style={{ display: 'inline-block', background: '#0d2b22', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Aller dans Mon profil →</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.1rem' : '1.2rem', fontWeight: 600, color: '#0d2b22' }}>Vue d'ensemble — {tarif.toLocaleString()} Ar / consultation</div>
        <div style={{ display: 'flex', gap: '6px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #f0ece2' }}>
          {(['3m', '6m', '12m'] as const).map(p => (
            <button key={p} onClick={() => setPeriode(p)} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, background: periode === p ? '#0d2b22' : 'none', color: periode === p ? 'white' : '#7a7260' }}>
              {p === '3m' ? '3 mois' : p === '6m' ? '6 mois' : '12 mois'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px' }}>
        {[
          { label: 'Revenus ce mois', value: `${revenuCeMois.toLocaleString()} Ar`, sub: `${rdvCeMois.filter(r => r.statut === 'termine').length} consultations`, color: '#22816a' },
          { label: 'Revenus total', value: `${revenuTotal.toLocaleString()} Ar`, sub: `${rdvTermines.length} terminées`, color: '#0d2b22' },
          { label: 'Complétion', value: `${tauxCompletion}%`, sub: 'RDV terminés / total', color: '#2eb592' },
          { label: 'Annulation', value: `${tauxAnnulation}%`, sub: 'RDV annulés / total', color: tauxAnnulation > 20 ? '#c0392b' : '#c8992a' },
        ].map(stat => (
          <div key={stat.label} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: stat.color }} />
            <div style={labelStyle}>{stat.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 600, color: '#0d2b22', lineHeight: 1.2 }}>{stat.value}</div>
            {!isMobile && <div style={{ fontSize: '0.72rem', color: '#7a7260', marginTop: '4px' }}>{stat.sub}</div>}
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <div style={titleStyle}>💰 Revenus par mois (Ar)</div>
        <ResponsiveContainer width="100%" height={isMobile ? 160 : 220}>
          <BarChart data={statsMois} margin={{ top: 0, right: 0, left: isMobile ? 0 : 10, bottom: 0 }}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fontFamily: 'Outfit, sans-serif', fill: '#a8a090' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'Outfit, sans-serif', fill: '#a8a090' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} width={isMobile ? 30 : 40} />
            <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} Ar`, 'Revenus']} contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', borderRadius: '10px', border: '1px solid #f0ece2' }} />
            <Bar dataKey="revenus" fill="#22816a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px' }}>
        <div style={cardStyle}>
          <div style={titleStyle}>📅 Rendez-vous par mois</div>
          <ResponsiveContainer width="100%" height={isMobile ? 140 : 200}>
            <LineChart data={statsMois} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="mois" tick={{ fontSize: 10, fontFamily: 'Outfit, sans-serif', fill: '#a8a090' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'Outfit, sans-serif', fill: '#a8a090' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', borderRadius: '10px', border: '1px solid #f0ece2' }} />
              <Line type="monotone" dataKey="termines" stroke="#22816a" strokeWidth={2.5} dot={{ fill: '#22816a', r: 4 }} name="Terminés" />
              <Line type="monotone" dataKey="annules" stroke="#c0392b" strokeWidth={2} dot={{ fill: '#c0392b', r: 3 }} strokeDasharray="4 2" name="Annulés" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <div style={titleStyle}>🥧 Répartition</div>
          {pieData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#a8a090', fontSize: '0.82rem', padding: '20px 0' }}>Aucun RDV encore</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', borderRadius: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                    <span style={{ color: '#7a7260', flex: 1 }}>{d.name}</span>
                    <span style={{ fontWeight: 700, color: '#0d2b22' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {topMotifs.length > 0 && (
        <div style={cardStyle}>
          <div style={titleStyle}>🩺 Top motifs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topMotifs.map(([motif, count], i) => {
              const max = topMotifs[0][1]
              const pct = Math.round(count / max * 100)
              return (
                <div key={motif}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#0d2b22', fontWeight: 500 }}>{motif}</span>
                    <span style={{ fontSize: '0.78rem', color: '#7a7260', fontWeight: 600 }}>{count} RDV</span>
                  </div>
                  <div style={{ height: '6px', background: '#f0ece2', borderRadius: '50px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? '#22816a' : '#2eb592', borderRadius: '50px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// DOSSIERS PATIENTS
// ═══════════════════════════════════════════════════════
function DossiersPatients({ supabase, rdvs, medecinId, preselectedPatientId, onPatientSelected, isMobile }: any) {
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const patientsMap = new Map()
  rdvs.filter((r: any) => r.statut === 'termine').forEach((r: any) => {
    if (!patientsMap.has(r.patient_id)) patientsMap.set(r.patient_id, r.patient)
  })
  const patients = Array.from(patientsMap.entries())

  useEffect(() => {
    if (preselectedPatientId && patients.length > 0) {
      const found = patients.find(([id]: any) => id === preselectedPatientId)
      if (found) { setSelectedPatient({ id: found[0], patient: found[1] }); onPatientSelected?.() }
    }
  }, [preselectedPatientId, patients.length])

  if (patients.length === 0) return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#0d2b22', marginBottom: '8px' }}>Aucun dossier disponible</div>
      <div style={{ fontSize: '0.85rem' }}>Les dossiers apparaîtront après les consultations terminées.</div>
    </div>
  )

  if (isMobile && selectedPatient) {
    return (
      <div>
        <button onClick={() => setSelectedPatient(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #f0ece2', borderRadius: '10px', padding: '8px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22', cursor: 'pointer', marginBottom: '16px' }}>
          ← Retour aux patients
        </button>
        <DossierMedical patientId={selectedPatient.id} supabase={supabase} isMedecin={true} medecinId={medecinId} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '20px', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ width: isMobile ? '100%' : '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '4px' }}>{patients.length} patient{patients.length > 1 ? 's' : ''}</div>
        {patients.map(([id, patient]: any) => (
          <div key={id} onClick={() => setSelectedPatient({ id, patient })} style={{ background: selectedPatient?.id === id ? '#e8f5f1' : 'white', borderRadius: '12px', padding: '14px 16px', border: `1.5px solid ${selectedPatient?.id === id ? '#22816a' : '#f0ece2'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {patient?.profil?.avatar_url ? <img src={patient.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span>🧑</span>}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d2b22' }}>{patient?.profil?.prenom} {patient?.profil?.nom}</div>
              <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{patient?.profil?.telephone}</div>
            </div>
          </div>
        ))}
      </div>
      {!isMobile && (
        <div style={{ flex: 1 }}>
          {selectedPatient ? (
            <DossierMedical patientId={selectedPatient.id} supabase={supabase} isMedecin={true} medecinId={medecinId} />
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#0d2b22' }}>Sélectionnez un patient</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// PROFIL FORM
// ═══════════════════════════════════════════════════════
function ProfilForm({ profil, medecin, supabase, onSaved }: any) {
  const [form, setForm] = useState({
    prenom: profil?.prenom || '', nom: profil?.nom || '', telephone: profil?.telephone || '',
    specialite: medecin?.specialite || '', adresse: medecin?.adresse || '',
    region: medecin?.region || '', tarif: medecin?.tarif ?? '', presentation: medecin?.presentation || '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [geoStatus, setGeoStatus] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(profil?.avatar_url || null)

  useEffect(() => {
    if (!medecin) return
    setForm(prev => ({ ...prev, specialite: medecin.specialite || prev.specialite, adresse: medecin.adresse || prev.adresse, region: medecin.region || prev.region, tarif: medecin.tarif != null ? medecin.tarif : prev.tarif, presentation: medecin.presentation || prev.presentation }))
  }, [medecin?.id])

  useEffect(() => {
    if (!profil) return
    setForm(prev => ({ ...prev, prenom: profil.prenom || prev.prenom, nom: profil.nom || prev.nom, telephone: profil.telephone || prev.telephone }))
    setAvatarUrl(profil.avatar_url || null)
  }, [profil?.id])

  const SPECIALITES = ['Médecin généraliste', 'Cardiologue', 'Pédiatre', 'Dentiste', 'Sage-femme', 'Dermatologue', 'Gynécologue', 'Ophtalmologue']
  const REGIONS = ['Antananarivo', 'Toamasina', 'Mahajanga', 'Fianarantsoa', 'Toliara', 'Antsiranana', 'Antsirabe', 'Ambositra']
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value })

  const save = async () => {
    setSaving(true)
    await supabase.from('profils').update({ prenom: form.prenom, nom: form.nom, telephone: form.telephone }).eq('id', profil.id)
    await supabase.from('medecins').update({ specialite: form.specialite, adresse: form.adresse, region: form.region, tarif: Number(form.tarif), presentation: form.presentation }).eq('id', profil.id)
    onSaved?.(Number(form.tarif))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    if (form.adresse) {
      setGeoStatus('Géolocalisation en cours…')
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${form.adresse}, ${form.region}, Madagascar`)}&format=json&limit=1`, { headers: { 'Accept-Language': 'fr', 'User-Agent': 'Radoko/1.0' } })
        const data = await res.json()
        if (data.length > 0) {
          await supabase.from('medecins').update({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }).eq('id', profil.id)
          setGeoStatus(`✅ Position trouvée : ${data[0].display_name.slice(0, 60)}…`)
        } else { setGeoStatus('⚠ Adresse introuvable sur la carte') }
      } catch { setGeoStatus('⚠ Erreur de géolocalisation') }
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div><label style={labelStyle}>Photo de profil</label><AvatarUpload userId={profil.id} currentUrl={avatarUrl} supabase={supabase} role="medecin" onUpload={(url: string) => setAvatarUrl(url)} /></div>
      <div style={{ height: '1px', background: '#f0ece2' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={labelStyle}>Prénom</label><input name="prenom" value={form.prenom} onChange={handleChange} style={inputStyle} /></div>
        <div><label style={labelStyle}>Nom</label><input name="nom" value={form.nom} onChange={handleChange} style={inputStyle} /></div>
      </div>
      <div><label style={labelStyle}>Téléphone</label><input name="telephone" value={form.telephone} onChange={handleChange} placeholder="038 08 162 55" style={inputStyle} /></div>
      <div><label style={labelStyle}>Spécialité</label><select name="specialite" value={form.specialite} onChange={handleChange} style={inputStyle}><option value="">Choisir une spécialité</option>{SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      <div><label style={labelStyle}>Ville / Région</label><select name="region" value={form.region} onChange={handleChange} style={inputStyle}><option value="">Choisir une ville</option>{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
      <div>
        <label style={labelStyle}>Adresse exacte du cabinet</label>
        <input name="adresse" value={form.adresse} onChange={handleChange} placeholder="Ex: Rue Pasteur, Faravohitra" style={inputStyle} />
        <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '5px' }}>Plus l'adresse est précise, mieux les patients vous trouveront</div>
      </div>
      <div><label style={labelStyle}>Tarif consultation (Ar)</label><input name="tarif" type="number" value={form.tarif} onChange={handleChange} placeholder="Ex: 40000" style={inputStyle} /></div>
      <div>
        <label style={labelStyle}>Présentation du cabinet</label>
        <textarea name="presentation" value={form.presentation} onChange={handleChange} rows={4} placeholder="Décrivez votre cabinet, votre expérience…" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <button onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
        {saving ? '⏳ Enregistrement…' : saved ? '✅ Sauvegardé !' : 'Enregistrer les modifications'}
      </button>
      {geoStatus && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 500, background: geoStatus.startsWith('✅') ? '#e8f5f1' : '#fdf8ec', color: geoStatus.startsWith('✅') ? '#22816a' : '#c8992a', border: `1px solid ${geoStatus.startsWith('✅') ? 'rgba(34,129,106,0.2)' : 'rgba(200,153,42,0.2)'}` }}>
          {geoStatus}
        </div>
      )}
    </div>
  )
}