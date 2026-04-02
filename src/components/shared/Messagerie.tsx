'use client'

import { useEffect, useState, useRef } from 'react'

function toLocalISO(dateStr: string, heure: string): string {
  const [annee, mois, jour] = dateStr.split('-').map(Number)
  const [h, m] = heure.split(':').map(Number)
  const d = new Date(annee, mois - 1, jour, h, m, 0, 0)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hOff = Math.floor(Math.abs(off) / 60).toString().padStart(2, '0')
  const mOff = (Math.abs(off) % 60).toString().padStart(2, '0')
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${annee}-${pad(mois)}-${pad(jour)}T${pad(h)}:${pad(m)}:00${sign}${hOff}:${mOff}`
}

function isoToLocalHHMM(isoStr: string): string {
  const d = new Date(isoStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function getCreneauxDisponibles(supabase: any, medecinId: string, dateStr: string): Promise<string[]> {
  const date = new Date(dateStr + 'T12:00:00')
  const jourJS = date.getDay()
  const jourSemaine = jourJS === 0 ? 6 : jourJS - 1
  const { data: dispo } = await supabase.from('disponibilites').select('*').eq('medecin_id', medecinId).eq('jour_semaine', jourSemaine).eq('actif', true).single()
  if (!dispo) return []
  const creneaux: string[] = []
  const [hd, md] = dispo.heure_debut.split(':').map(Number)
  const [hf, mf] = dispo.heure_fin.split(':').map(Number)
  let total = hd * 60 + md
  const finMin = hf * 60 + mf
  while (total + dispo.duree_creneau <= finMin) {
    const h = Math.floor(total / 60).toString().padStart(2, '0')
    const m = (total % 60).toString().padStart(2, '0')
    creneaux.push(`${h}:${m}`)
    total += dispo.duree_creneau
  }
  const debutJour = toLocalISO(dateStr, '00:00')
  const finJour = toLocalISO(dateStr, '23:59')
  const { data: rdvsPris } = await supabase.from('rendez_vous').select('date_rdv').eq('medecin_id', medecinId).gte('date_rdv', debutJour).lte('date_rdv', finJour).in('statut', ['en_attente', 'confirme'])
  const heuresPrises = new Set((rdvsPris || []).map((r: any) => isoToLocalHHMM(r.date_rdv)))
  const { data: blocagesManuels } = await supabase.from('creneaux_manuels').select('date_creneau').eq('medecin_id', medecinId).gte('date_creneau', debutJour).lte('date_creneau', finJour)
  const heuresBloqueesManuel = new Set((blocagesManuels || []).map((b: any) => isoToLocalHHMM(b.date_creneau)))
  const { data: absences } = await supabase.from('creneaux_bloques').select('date_debut, date_fin').eq('medecin_id', medecinId).lte('date_debut', finJour).gte('date_fin', debutJour)
  if ((absences || []).length > 0) return []
  return creneaux.filter(c => !heuresPrises.has(c) && !heuresBloqueesManuel.has(c))
}

// ── ÉTOILES ──
function Etoiles({ note, size = 'normal' }: { note: number, size?: 'normal' | 'small' }) {
  return (
    <span style={{ fontSize: size === 'small' ? '0.85rem' : '1.1rem', letterSpacing: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= note ? '#e6b84a' : '#d9d0c4' }}>★</span>
      ))}
    </span>
  )
}

// ── AVIS SECTION ──
function AvisSection({ avis, loading, noteMoyenne, nombreAvis }: {
  avis: any[], loading: boolean, noteMoyenne?: number, nombreAvis?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const affichés = expanded ? avis : avis.slice(0, 2)

  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Avis patients
      </div>
      {loading ? (
        <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: '#a8a090' }}>⏳ Chargement des avis…</div>
      ) : avis.length === 0 ? (
        <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: '#a8a090' }}>Aucun avis pour le moment</div>
      ) : (
        <>
          {/* Carte résumé */}
          <div style={{ background: 'linear-gradient(135deg, #fdf8ec, #fef9f0)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(200,153,42,0.2)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 700, color: '#c8992a', lineHeight: 1 }}>{noteMoyenne?.toFixed(1)}</div>
              <div style={{ fontSize: '0.62rem', color: '#a8906a', marginTop: '2px' }}>/ 5</div>
            </div>
            <div style={{ flex: 1 }}>
              {[5, 4, 3, 2, 1].map(n => {
                const count = avis.filter(a => a.note === n).length
                const pct = avis.length > 0 ? (count / avis.length) * 100 : 0
                return (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.65rem', color: '#a8906a', width: '8px', textAlign: 'right', flexShrink: 0 }}>{n}</span>
                    <span style={{ fontSize: '0.6rem', color: '#e6b84a', flexShrink: 0 }}>★</span>
                    <div style={{ flex: 1, height: '5px', background: '#f0e8d0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#e6b84a', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.62rem', color: '#a8906a', width: '14px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '0.65rem', color: '#a8906a', fontWeight: 600 }}>{nombreAvis} avis</div>
              <div style={{ marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} style={{ fontSize: '0.75rem', color: i <= Math.round(noteMoyenne || 0) ? '#e6b84a' : '#d9d0c4' }}>★</span>
                ))}
              </div>
            </div>
          </div>

          {/* Liste avis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {affichés.map((a: any) => (
              <div key={a.id} style={{ background: '#faf8f4', borderRadius: '10px', padding: '11px 13px', border: '1px solid #f0ece2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: a.commentaire ? '5px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#22816a', flexShrink: 0 }}>
                      {a.patient?.prenom?.charAt(0)}{a.patient?.nom?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0d2b22', lineHeight: 1 }}>{a.patient?.prenom} {a.patient?.nom?.charAt(0)}.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: '0.65rem', color: i <= a.note ? '#e6b84a' : '#d9d0c4' }}>★</span>)}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.63rem', color: '#b8b0a0', flexShrink: 0 }}>
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {a.commentaire && (
                  <p style={{ fontSize: '0.77rem', color: '#4a4035', lineHeight: 1.5, margin: 0, paddingTop: '5px', borderTop: '1px solid #ece8e0' }}>"{a.commentaire}"</p>
                )}
              </div>
            ))}
          </div>

          {avis.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ marginTop: '10px', width: '100%', padding: '9px', borderRadius: '10px', background: expanded ? '#f0ece2' : '#faf8f4', border: `1px solid ${expanded ? '#e0dbd0' : '#f0ece2'}`, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: '#7a7260', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {expanded ? '↑ Réduire' : `↓ Voir tous les avis (${avis.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

async function loadAvisForMedecin(supabase: any, medecinId: string) {
  const { data: avisData } = await supabase
    .from('avis')
    .select('id, note, commentaire, created_at, patient_id')
    .eq('medecin_id', medecinId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (!avisData || avisData.length === 0) return []
  const patientIds = [...new Set(avisData.map((a: any) => a.patient_id))]
  const { data: profils } = await supabase.from('profils').select('id, prenom, nom').in('id', patientIds)
  const profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
  return avisData.map((a: any) => ({ ...a, patient: profilMap[a.patient_id] || null }))
}

export default function Messagerie({ currentUserId, supabase, role = 'patient', planMedecin = 'essentiel' }: {
  currentUserId: string
  supabase: any
  role?: 'medecin' | 'patient'
  planMedecin?: string
}) {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConv, setSelectedConv] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentProfil, setCurrentProfil] = useState<any>(null)
  const [profilePanel, setProfilePanel] = useState<any>(null)
  const [panelAvisLoading, setPanelAvisLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadProfil = async () => {
      const { data } = await supabase.from('profils').select('*').eq('id', currentUserId).single()
      setCurrentProfil(data)
    }
    loadProfil()
    loadConversations()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setProfilePanel(null)
    }
    if (profilePanel) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profilePanel])

  useEffect(() => {
    if (!selectedConv) return
    loadMessages(selectedConv.id)
    const channel = supabase
      .channel(`messages-${currentUserId}-${selectedConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `expediteur_id=eq.${selectedConv.id}`,
      }, (payload: any) => {
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedConv])

  useEffect(() => { scrollToBottom() }, [messages])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const openProfile = async (conv: any) => {
    setProfilePanel({ ...conv, _loading: true, _tab: 'profil', _avis: [] })
    if (conv.role === 'medecin') {
      setPanelAvisLoading(true)
      const { data: med } = await supabase.from('medecins').select('*, profil:profils(*)').eq('id', conv.id).single()
      const avis = await loadAvisForMedecin(supabase, conv.id)
      setProfilePanel({ ...conv, medecin: med, _loading: false, _tab: 'profil', _avis: avis })
      setPanelAvisLoading(false)
    } else {
      const { data: profil } = await supabase.from('profils').select('*').eq('id', conv.id).single()
      const { data: patient } = await supabase.from('patients').select('*').eq('id', conv.id).single()
      const { data: avisPatient } = await supabase
        .from('avis')
        .select('id, note, commentaire, created_at')
        .eq('medecin_id', currentUserId)
        .eq('patient_id', conv.id)
        .order('created_at', { ascending: false })
      setProfilePanel({ ...conv, profil, patient, _loading: false, _tab: 'profil', _avisPatient: avisPatient || [] })
    }
  }

  const loadConversations = async () => {
    setLoading(true)
    if (role === 'patient') {
      const { data: rdvs } = await supabase
        .from('rendez_vous')
        .select('medecin_id, statut, medecin:medecins(*, profil:profils(*))')
        .eq('patient_id', currentUserId)
        .in('statut', ['confirme', 'termine'])
      if (!rdvs || rdvs.length === 0) { setConversations([]); setLoading(false); return }
      const medecinMap = new Map()
      rdvs.forEach((r: any) => {
        if (!medecinMap.has(r.medecin_id)) {
          medecinMap.set(r.medecin_id, {
            id: r.medecin_id,
            prenom: r.medecin?.profil?.prenom,
            nom: r.medecin?.profil?.nom,
            avatar_url: r.medecin?.profil?.avatar_url,
            role: 'medecin',
            specialite: r.medecin?.specialite,
          })
        }
      })
      setConversations(Array.from(medecinMap.values()))
    } else {
      const { data: sent } = await supabase.from('messages').select('destinataire_id').eq('expediteur_id', currentUserId)
      const { data: received } = await supabase.from('messages').select('expediteur_id').eq('destinataire_id', currentUserId)
      const allIds = new Set<string>()
      sent?.forEach((m: any) => allIds.add(m.destinataire_id))
      received?.forEach((m: any) => allIds.add(m.expediteur_id))
      if (allIds.size === 0) { setConversations([]); setLoading(false); return }
      const { data: profils } = await supabase.from('profils').select('*').in('id', Array.from(allIds))
      setConversations((profils || []).map((p: any) => ({ ...p, role: 'patient' })))
    }
    setLoading(false)
  }

  const loadMessages = async (otherId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(expediteur_id.eq.${currentUserId},destinataire_id.eq.${otherId}),and(expediteur_id.eq.${otherId},destinataire_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('messages').update({ lu: true }).eq('expediteur_id', otherId).eq('destinataire_id', currentUserId).eq('lu', false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return
    setSending(true)
    const contenu = newMessage.trim()
    const { data } = await supabase.from('messages').insert({
      expediteur_id: currentUserId,
      destinataire_id: selectedConv.id,
      contenu, lu: false,
    }).select().single()
    if (data) setMessages(prev => [...prev, data])
    setNewMessage('')
    const expediteurNom = currentProfil
      ? `${role === 'medecin' ? 'Dr. ' : ''}${currentProfil.prenom} ${currentProfil.nom}`
      : 'Un utilisateur'
    await supabase.from('notifications').insert({
      user_id: selectedConv.id,
      type: 'nouveau_message',
      titre: `Nouveau message de ${expediteurNom} 💬`,
      corps: contenu.length > 60 ? contenu.slice(0, 60) + '…' : contenu,
    })
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const hasPro = ['pro', 'clinic'].includes(planMedecin?.toLowerCase())

  const renderProfilePanel = () => {
    if (!profilePanel) return null
    const p = profilePanel
    const med = p.medecin
    const isMedecinPanel = p.role === 'medecin'
    const tab = p._tab || 'profil'
    const avis = p._avis || []
    const avisPatient = p._avisPatient || []

    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.25)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
        <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.15)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.22s ease-out', fontFamily: 'Outfit, sans-serif' }}>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <button onClick={() => setProfilePanel(null)} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            {(() => {
              const avatarUrl = isMedecinPanel ? med?.profil?.avatar_url : p.profil?.avatar_url
              return (
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: 'rgba(46,181,146,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>{isMedecinPanel ? '👨‍⚕️' : '🧑'}</span>}
                </div>
              )
            })()}

            {p._loading ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Chargement…</div>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>
                    {isMedecinPanel ? 'Dr. ' : ''}{isMedecinPanel ? med?.profil?.prenom : p.prenom} {isMedecinPanel ? med?.profil?.nom : p.nom}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>
                    {isMedecinPanel ? med?.specialite : 'Patient'}
                  </div>
                  {isMedecinPanel && med?.tarif && (
                    <div style={{ fontSize: '0.78rem', color: '#2eb592', fontWeight: 600, marginTop: '4px' }}>{Number(med.tarif).toLocaleString()} Ar / consultation</div>
                  )}
                  {isMedecinPanel && med?.note_moyenne > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Etoiles note={Math.round(med.note_moyenne)} size="small" />
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{med.note_moyenne}/5 ({med.nombre_avis} avis)</span>
                    </div>
                  )}
                  {!isMedecinPanel && avisPatient.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Etoiles note={avisPatient[0].note} size="small" />
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>avis laissé</span>
                    </div>
                  )}
                </div>
                {isMedecinPanel && med?.verifie && (
                  <span style={{ background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)' }}>✓ Médecin vérifié</span>
                )}
              </>
            )}

            {!p._loading && isMedecinPanel && role === 'patient' && (
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '10px', width: '100%' }}>
                {[{ id: 'profil', label: '👤 Profil' }, { id: 'rdv', label: '📅 Prendre RDV' }].map(t => (
                  <button key={t.id} onClick={() => setProfilePanel((prev: any) => ({ ...prev, _tab: t.id }))}
                    style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 700, background: tab === t.id ? 'white' : 'none', color: tab === t.id ? '#0d2b22' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s' }}
                  >{t.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Corps */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {p._loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#a8a090' }}>⏳</div>
            ) : isMedecinPanel && tab === 'rdv' && role === 'patient' ? (
              <PanelRdvForm med={med} currentUserId={currentUserId} currentProfil={currentProfil} supabase={supabase} onBooked={() => setTimeout(() => setProfilePanel(null), 1500)} />
            ) : isMedecinPanel ? (
              // ── PANEL MÉDECIN (vu par patient) ──
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {med?.adresse && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span>📍</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Cabinet</div>
                        <div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{med.adresse}</div>
                        {med.region && <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{med.region}</div>}
                      </div>
                    </div>
                  )}
                  {med?.tarif && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>💰</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Consultation</div>
                        <div style={{ fontSize: '0.85rem', color: '#1a1512', fontWeight: 600 }}>{Number(med.tarif).toLocaleString()} Ar</div>
                      </div>
                    </div>
                  )}
                  {med?.profil?.telephone && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>📞</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div>
                        <a href={`tel:${med.profil.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{med.profil.telephone}</a>
                      </div>
                    </div>
                  )}
                </div>
                {med?.presentation && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>À propos</div>
                    <p style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.65, margin: 0 }}>{med.presentation}</p>
                  </div>
                )}
                {/* ── AVIS SECTION ── */}
                <AvisSection
                  avis={avis}
                  loading={panelAvisLoading}
                  noteMoyenne={med?.note_moyenne}
                  nombreAvis={med?.nombre_avis}
                />
              </div>
            ) : (
              // ── PANEL PATIENT (vu par médecin) ──
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {p.profil?.email && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>✉️</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Email</div>
                        <div style={{ fontSize: '0.83rem', color: '#1a1512' }}>{p.profil.email}</div>
                      </div>
                    </div>
                  )}
                  {p.profil?.telephone && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>📞</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div>
                        <a href={`tel:${p.profil.telephone}`} style={{ fontSize: '0.83rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{p.profil.telephone}</a>
                      </div>
                    </div>
                  )}
                  {p.patient?.date_naissance && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>🎂</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Date de naissance</div>
                        <div style={{ fontSize: '0.83rem', color: '#1a1512' }}>{new Date(p.patient.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>
                  )}
                  {p.patient?.groupe_sanguin && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>🩸</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Groupe sanguin</div>
                        <div style={{ fontSize: '0.83rem', color: '#1a1512', fontWeight: 600 }}>{p.patient.groupe_sanguin}</div>
                      </div>
                    </div>
                  )}
                  {p.patient?.allergies && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ marginTop: '1px' }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Allergies</div>
                        <div style={{ fontSize: '0.83rem', color: '#c0392b' }}>{p.patient.allergies}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── AVIS DU PATIENT (visible par le médecin) — fond doré ── */}
                {avisPatient.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Avis laissé par ce patient</div>
                    {avisPatient.map((a: any) => (
                      <div key={a.id} style={{ background: '#fdf8ec', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: a.commentaire ? '6px' : '0' }}>
                          <Etoiles note={a.note} size="small" />
                          <span style={{ fontSize: '0.65rem', color: '#a8a090' }}>{new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {a.commentaire && <p style={{ fontSize: '0.78rem', color: '#4a4035', lineHeight: 1.5, margin: 0 }}>{a.commentaire}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {!hasPro && (
                  <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '14px 16px', border: '1px solid #f0e4b8' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c8992a', marginBottom: '4px' }}>🔒 Plan Pro requis</div>
                    <div style={{ fontSize: '0.75rem', color: '#a8906a', lineHeight: 1.5 }}>Passez au plan Pro pour accéder au dossier médical complet de vos patients.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!p._loading && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isMedecinPanel && role === 'patient' && tab === 'profil' && (
                <button onClick={() => setProfilePanel((prev: any) => ({ ...prev, _tab: 'rdv' }))}
                  style={{ padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                  📅 Prendre un rendez-vous
                </button>
              )}
              {isMedecinPanel && role === 'patient' && (
                <button onClick={() => window.open(`/medecin/${p.id}`, '_self')}
                  style={{ padding: '11px', borderRadius: '10px', background: '#faf8f4', color: '#0d2b22', border: '1px solid #f0ece2', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                  Voir la page complète →
                </button>
              )}
              {!isMedecinPanel && hasPro && (
                <button
                  onClick={() => {
                    setProfilePanel(null)
                    window.dispatchEvent(new CustomEvent('openDossierPatient', { detail: { patientId: p.id, patientNom: `${p.prenom} ${p.nom}` } }))
                  }}
                  style={{ padding: '11px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                  📋 Voir le dossier médical
                </button>
              )}
              <button onClick={() => setProfilePanel(null)}
                style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
                Retour à la conversation
              </button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {renderProfilePanel()}
      <div style={{ display: 'flex', height: 'calc(100vh - 130px)', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ width: '280px', borderRight: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0ece2' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Messages</div>
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '2px' }}>{conversations.length} conversation{conversations.length > 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>⏳ Chargement…</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#a8a090' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>💬</div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {role === 'patient' ? 'Vous pourrez contacter un médecin après un RDV confirmé ou terminé.' : 'Aucune conversation pour le moment.'}
                </div>
              </div>
            ) : conversations.map(conv => (
              <div key={conv.id} onClick={() => setSelectedConv(conv)}
                style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid #f0ece2', background: selectedConv?.id === conv.id ? '#e8f5f1' : 'white', borderLeft: `3px solid ${selectedConv?.id === conv.id ? '#22816a' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: conv.role === 'medecin' ? '#0d2b22' : '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, overflow: 'hidden' }}>
                    {conv.avatar_url ? <img src={conv.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : conv.role === 'medecin' ? '👨‍⚕️' : '🧑'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d2b22', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.role === 'medecin' ? 'Dr. ' : ''}{conv.prenom} {conv.nom}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#a8a090', marginTop: '1px' }}>
                      {conv.role === 'medecin' ? conv.specialite || 'Médecin' : 'Patient'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedConv ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div onClick={() => openProfile(selectedConv)}
              style={{ padding: '16px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '12px', background: 'white', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f7f5f0')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: selectedConv.role === 'medecin' ? '#0d2b22' : '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', overflow: 'hidden', flexShrink: 0 }}>
                {selectedConv.avatar_url ? <img src={selectedConv.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : selectedConv.role === 'medecin' ? '👨‍⚕️' : '🧑'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0d2b22', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedConv.role === 'medecin' ? 'Dr. ' : ''}{selectedConv.prenom} {selectedConv.nom}
                  <span style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 400 }}>— cliquer pour voir le profil</span>
                </div>
                {selectedConv.specialite && <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{selectedConv.specialite}</div>}
              </div>
              <div style={{ color: '#a8a090', fontSize: '0.9rem' }}>›</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#faf8f4' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#a8a090', fontSize: '0.82rem', marginTop: '40px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👋</div>Démarrez la conversation !
                </div>
              ) : messages.map(msg => {
                const isMe = msg.expediteur_id === currentUserId
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '68%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isMe ? '#0d2b22' : 'white', color: isMe ? 'white' : '#1a1512', fontSize: '0.85rem', lineHeight: 1.5, boxShadow: '0 2px 8px rgba(13,43,34,0.08)', border: isMe ? 'none' : '1px solid #f0ece2' }}>
                      <div>{msg.contenu}</div>
                      <div style={{ fontSize: '0.62rem', color: isMe ? 'rgba(255,255,255,0.45)' : '#a8a090', marginTop: '4px', textAlign: 'right' }}>
                        {formatTime(msg.created_at)}{isMe && <span style={{ marginLeft: '4px' }}>{msg.lu ? ' ✓✓' : ' ✓'}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #f0ece2', background: 'white', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Écrivez votre message… (Entrée pour envoyer)" rows={1}
                style={{ flex: 1, padding: '10px 14px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
              <button onClick={sendMessage} disabled={!newMessage.trim() || sending}
                style={{ width: '42px', height: '42px', borderRadius: '12px', background: !newMessage.trim() ? '#f0ece2' : '#22816a', border: 'none', cursor: !newMessage.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', transition: 'all 0.15s', flexShrink: 0, color: !newMessage.trim() ? '#a8a090' : 'white' }}>
                {sending ? '⏳' : '→'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#a8a090', background: '#faf8f4' }}>
            <div style={{ fontSize: '3rem' }}>💬</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#0d2b22' }}>Sélectionnez une conversation</div>
            <div style={{ fontSize: '0.82rem' }}>Choisissez un contact à gauche pour démarrer</div>
          </div>
        )}
      </div>
    </>
  )
}

function PanelRdvForm({ med, currentUserId, currentProfil, supabase, onBooked }: any) {
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [motif, setMotif] = useState('')
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)

  const onDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedTime('')
    setCreneaux([])
    if (!dateStr) return
    setLoadingCreneaux(true)
    const dispo = await getCreneauxDisponibles(supabase, med.id, dateStr)
    setCreneaux(dispo)
    setLoadingCreneaux(false)
  }

  const book = async () => {
    if (!selectedDate || !selectedTime) return
    setBooking(true)
    const dateRdvISO = toLocalISO(selectedDate, selectedTime)
    const { data: patient } = await supabase.from('patients').select('id').eq('id', currentUserId).single()
    if (!patient) await supabase.from('patients').insert({ id: currentUserId })
    const { error } = await supabase.from('rendez_vous').insert({
      medecin_id: med.id, patient_id: currentUserId, date_rdv: dateRdvISO, motif, statut: 'en_attente',
    })
    if (!error) {
      const patientNom = currentProfil ? `${currentProfil.prenom} ${currentProfil.nom}` : 'Un patient'
      const [annee, mois, jour] = selectedDate.split('-').map(Number)
      const dateFormatee = new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      await supabase.from('notifications').insert({
        user_id: med.id, type: 'nouveau_rdv',
        titre: 'Nouvelle demande de rendez-vous 📅',
        corps: `${patientNom} souhaite un RDV le ${dateFormatee} à ${selectedTime.replace(':', 'h')}${motif ? ` — Motif : ${motif}` : ''}.`,
      })
      setBooked(true)
      setTimeout(() => onBooked(), 1500)
    }
    setBooking(false)
  }

  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' as const }

  if (booked) return (
    <div style={{ background: '#e8f5f1', borderRadius: '16px', padding: '32px', textAlign: 'center', marginTop: '8px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>Demande envoyée !</div>
      <div style={{ fontSize: '0.78rem', color: '#22816a', lineHeight: 1.5 }}>Le médecin va confirmer votre RDV. Vous recevrez une notification dès la confirmation.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c8992a', marginBottom: '2px' }}>Dr. {med?.profil?.prenom} {med?.profil?.nom}</div>
        <div style={{ fontSize: '0.72rem', color: '#a8906a' }}>{med?.specialite}{med?.tarif ? ` · ${Number(med.tarif).toLocaleString()} Ar` : ''}</div>
      </div>
      <div>
        <label style={labelStyle}>Date souhaitée</label>
        <input type="date" value={selectedDate} min={new Date().toISOString().split('T')[0]} onChange={e => onDateChange(e.target.value)} style={inputStyle} />
      </div>
      {selectedDate && (
        <div>
          <label style={labelStyle}>
            Créneaux disponibles
            {loadingCreneaux && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '8px', color: '#a8a090' }}>chargement…</span>}
          </label>
          {!loadingCreneaux && creneaux.length === 0 && (
            <div style={{ padding: '12px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>Aucun créneau disponible ce jour — essayez une autre date</div>
          )}
          {!loadingCreneaux && creneaux.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {creneaux.map(c => (
                <button key={c} onClick={() => setSelectedTime(c)} style={{ padding: '6px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: selectedTime === c ? '#22816a' : '#f0ece2', color: selectedTime === c ? 'white' : '#0d2b22', transition: 'all 0.12s' }}>
                  {c.replace(':', 'h')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <label style={labelStyle}>Motif (optionnel)</label>
        <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Douleurs thoraciques, suivi…" style={inputStyle} />
      </div>
      <button onClick={book} disabled={!selectedDate || !selectedTime || booking}
        style={{ padding: '11px', borderRadius: '10px', border: 'none', cursor: (!selectedDate || !selectedTime || booking) ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', background: (!selectedDate || !selectedTime) ? '#cfc5ae' : '#0d2b22', color: 'white', transition: 'all 0.15s' }}>
        {booking ? '⏳ Envoi en cours…' : !selectedDate ? 'Choisissez une date' : !selectedTime ? 'Choisissez un créneau' : 'Confirmer le rendez-vous →'}
      </button>
    </div>
  )
}