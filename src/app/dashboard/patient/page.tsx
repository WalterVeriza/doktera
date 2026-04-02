'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profil, RendezVous } from '@/lib/types'
import Messagerie from '@/components/shared/Messagerie'
import AvatarUpload from '@/components/shared/AvatarUpload'
import Avatar from '@/components/shared/Avatar'
import DossierMedical from '@/components/shared/DossierMedical'

const CATEGORIES_CLINIQUE = [
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

function Etoiles({ note, size = 'normal' }: { note: number, size?: 'normal' | 'small' }) {
  const s = size === 'small' ? '0.85rem' : '1.1rem'
  return (
    <span style={{ fontSize: s, letterSpacing: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= note ? '#e6b84a' : '#d9d0c4' }}>★</span>
      ))}
    </span>
  )
}

function AvisSection({ avis, loading, noteMoyenne, nombreAvis }: { avis: any[], loading: boolean, noteMoyenne?: number, nombreAvis?: number }) {
  const [expanded, setExpanded] = useState(false)
  const affiches = expanded ? avis : avis.slice(0, 2)
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Avis patients</div>
      {loading ? (
        <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: '#a8a090' }}>⏳ Chargement des avis…</div>
      ) : avis.length === 0 ? (
        <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: '#a8a090' }}>Aucun avis pour le moment</div>
      ) : (
        <>
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
                      <div style={{ height: '100%', width: `${pct}%`, background: '#e6b84a', borderRadius: '3px' }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {affiches.map((a: any) => (
              <div key={a.id} style={{ background: '#faf8f4', borderRadius: '10px', padding: '11px 13px', border: '1px solid #f0ece2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: a.commentaire ? '5px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#22816a', flexShrink: 0 }}>
                      {a.patient?.prenom?.charAt(0)}{a.patient?.nom?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0d2b22' }}>{a.patient?.prenom} {a.patient?.nom?.charAt(0)}.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: '0.65rem', color: i <= a.note ? '#e6b84a' : '#d9d0c4' }}>★</span>)}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.63rem', color: '#b8b0a0' }}>
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
            <button onClick={() => setExpanded(!expanded)} style={{ marginTop: '10px', width: '100%', padding: '9px', borderRadius: '10px', background: expanded ? '#f0ece2' : '#faf8f4', border: `1px solid ${expanded ? '#e0dbd0' : '#f0ece2'}`, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: '#7a7260' }}>
              {expanded ? '↑ Réduire' : `↓ Voir tous les avis (${avis.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

async function fetchAvisMedecin(supabase: any, medecinId: string) {
  const { data: avisData } = await supabase.from('avis').select('id, note, commentaire, created_at, patient_id').eq('medecin_id', medecinId).order('created_at', { ascending: false })
  if (!avisData || avisData.length === 0) return []
  const patientIds = [...new Set(avisData.map((a: any) => a.patient_id))]
  const { data: profils } = await supabase.from('profils').select('id, prenom, nom').in('id', patientIds)
  const profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
  return avisData.map((a: any) => ({ ...a, patient: profilMap[a.patient_id] || null }))
}

function MessageriesCliniques({ profil, supabase, cliniqueInitiale, isMobile }: any) {
  const [conversations, setConversations] = useState<any[]>([])
  const [cliniqueSelectionnee, setCliniqueSelectionnee] = useState<any>(cliniqueInitiale || null)
  const [messages, setMessages] = useState<any[]>([])
  const [nouveauMsg, setNouveauMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showNouvelle, setShowNouvelle] = useState(false)
  const [cliniquesDisponibles, setCliniquesDisponibles] = useState<any[]>([])
  const [rechercheClinique, setRechercheClinique] = useState('')
  const [loadingCliniques, setLoadingCliniques] = useState(false)
  const [showList, setShowList] = useState(!cliniqueInitiale)
  const messagesEndRef = useRef<any>(null)

  const fetchConversations = async () => {
    const { data } = await supabase.from('clinique_messages').select('*').eq('patient_id', profil.id).order('created_at', { ascending: false })
    if (!data) return
    const cliniqueIds = [...new Set(data.map((m: any) => m.clinique_id))]
    if (cliniqueIds.length === 0) { setConversations([]); return }
    const { data: cliniques } = await supabase.from('cliniques').select('id, nom').in('id', cliniqueIds)
    const cliniqueMap = Object.fromEntries((cliniques || []).map((c: any) => [c.id, c]))
    const map = new Map()
    for (const msg of data) {
      const cid = msg.clinique_id
      if (!map.has(cid)) map.set(cid, { clinique: cliniqueMap[cid] || { id: cid, nom: 'Clinique' }, dernierMsg: msg, nonLus: 0 })
      if (!msg.lu && msg.expediteur_type === 'clinique') map.get(cid).nonLus++
    }
    setConversations(Array.from(map.values()))
  }

  const fetchMessages = async (cliniqueId: string) => {
    const { data } = await supabase.from('clinique_messages').select('*').eq('clinique_id', cliniqueId).eq('patient_id', profil.id).order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('clinique_messages').update({ lu: true }).eq('clinique_id', cliniqueId).eq('patient_id', profil.id).eq('expediteur_type', 'clinique')
    fetchConversations()
  }

  const rechercherCliniques = async (q: string) => {
    setRechercheClinique(q)
    if (q.length < 2) { setCliniquesDisponibles([]); return }
    setLoadingCliniques(true)
    const { data } = await supabase.from('cliniques').select('id, nom, region').ilike('nom', `%${q}%`).limit(8)
    setCliniquesDisponibles(data || [])
    setLoadingCliniques(false)
  }

  const initierConversation = async (clinique: any) => {
    setShowNouvelle(false)
    setRechercheClinique('')
    setCliniquesDisponibles([])
    setCliniqueSelectionnee(clinique)
    setMessages([])
    if (isMobile) setShowList(false)
  }

  const selectionnerConversation = (clinique: any) => {
    setShowNouvelle(false)
    setCliniqueSelectionnee(clinique)
    if (isMobile) setShowList(false)
  }

  useEffect(() => { fetchConversations() }, [])
  useEffect(() => { if (cliniqueSelectionnee) fetchMessages(cliniqueSelectionnee.id) }, [cliniqueSelectionnee])
  useEffect(() => { if (cliniqueInitiale) { setCliniqueSelectionnee(cliniqueInitiale); if (isMobile) setShowList(false) } }, [cliniqueInitiale])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const envoyer = async () => {
    if (!nouveauMsg.trim() || !cliniqueSelectionnee) return
    setSending(true)
    await supabase.from('clinique_messages').insert({ clinique_id: cliniqueSelectionnee.id, patient_id: profil.id, expediteur_type: 'patient', contenu: nouveauMsg.trim(), lu: false })
    const { data: cl } = await supabase.from('cliniques').select('admin_id').eq('id', cliniqueSelectionnee.id).single()
    if (cl) await supabase.from('notifications').insert({ user_id: cl.admin_id, type: 'message_patient', titre: 'Nouveau message patient', corps: `${profil.prenom} ${profil.nom} vous a envoyé un message.`, lu: false })
    setNouveauMsg('')
    fetchMessages(cliniqueSelectionnee.id)
    setSending(false)
  }

  const ListeConversations = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090' }}>Cliniques ({conversations.length})</div>
        <button onClick={() => setShowNouvelle(v => !v)} style={{ width: '28px', height: '28px', borderRadius: '8px', background: showNouvelle ? '#0d2b22' : '#e8f5f1', border: 'none', cursor: 'pointer', fontSize: '1rem', color: showNouvelle ? 'white' : '#22816a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          {showNouvelle ? '✕' : '+'}
        </button>
      </div>
      {showNouvelle && (
        <div style={{ padding: '12px', borderBottom: '1px solid #f0ece2', background: '#faf8f4' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d2b22', marginBottom: '8px' }}>Contacter une clinique</div>
          <input value={rechercheClinique} onChange={e => rechercherCliniques(e.target.value)} placeholder="Nom de la clinique…" style={{ width: '100%', padding: '8px 10px', background: 'white', border: '1.5px solid #f0ece2', borderRadius: '8px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' as const }} />
          {loadingCliniques && <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '6px', textAlign: 'center' }}>⏳ Recherche…</div>}
          {cliniquesDisponibles.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {cliniquesDisponibles.map((cl: any) => (
                <div key={cl.id} onClick={() => initierConversation(cl)} style={{ padding: '8px 10px', borderRadius: '8px', background: 'white', border: '1px solid #f0ece2', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>🏥</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0d2b22' }}>{cl.nom}</div>
                    {cl.region && <div style={{ fontSize: '0.68rem', color: '#a8a090' }}>{cl.region}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {rechercheClinique.length >= 2 && !loadingCliniques && cliniquesDisponibles.length === 0 && (
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '6px', textAlign: 'center' }}>Aucune clinique trouvée</div>
          )}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 && !showNouvelle ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: '0.82rem', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏥</div>
            Aucune conversation<br />
            <span style={{ fontSize: '0.72rem' }}>Cliquez sur + pour contacter une clinique</span>
          </div>
        ) : conversations.map(conv => (
          <div key={conv.clinique?.id} onClick={() => selectionnerConversation(conv.clinique)}
            style={{ padding: '14px 16px', borderBottom: '1px solid #f9f7f2', cursor: 'pointer', background: !isMobile && cliniqueSelectionnee?.id === conv.clinique?.id ? '#f0f9f6' : 'transparent', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: conv.nonLus > 0 ? 700 : 600, color: '#0d2b22' }}>{conv.clinique?.nom}</div>
                {conv.nonLus > 0 && <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#22816a', color: 'white', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{conv.nonLus}</div>}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a8a090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.dernierMsg?.expediteur_type === 'patient' ? 'Vous: ' : ''}{conv.dernierMsg?.contenu}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const ZoneMessages = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ece2', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isMobile && (
          <button onClick={() => setShowList(true)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        )}
        <div style={{ fontSize: '1.3rem' }}>🏥</div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d2b22' }}>{cliniqueSelectionnee?.nom}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💬</div>
            <div style={{ fontSize: '0.82rem' }}>Début de votre conversation avec {cliniqueSelectionnee?.nom}</div>
          </div>
        )}
        {messages.map(msg => {
          const estPatient = msg.expediteur_type === 'patient'
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: estPatient ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: estPatient ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: estPatient ? '#0d2b22' : '#f0ece2', color: estPatient ? 'white' : '#1a1512', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {msg.contenu}
                <div style={{ fontSize: '0.65rem', color: estPatient ? 'rgba(255,255,255,0.4)' : '#a8a090', marginTop: '4px', textAlign: 'right' }}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0ece2', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <input value={nouveauMsg} onChange={e => setNouveauMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && envoyer()} placeholder="Écrire un message…" style={{ flex: 1, padding: '10px 14px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', outline: 'none' }} />
        <button onClick={envoyer} disabled={sending || !nouveauMsg.trim()} style={{ padding: '10px 16px', borderRadius: '10px', background: !nouveauMsg.trim() ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: !nouveauMsg.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
          {isMobile ? '→' : 'Envoyer'}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ height: 'calc(100vh - 160px)', borderRadius: '16px', border: '1px solid #f0ece2', background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {showList || !cliniqueSelectionnee ? <ListeConversations /> : <ZoneMessages />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 160px)', borderRadius: '16px', border: '1px solid #f0ece2', background: 'white', overflow: 'hidden' }}>
      <div style={{ width: '280px', borderRight: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ListeConversations />
      </div>
      {cliniqueSelectionnee ? <ZoneMessages /> : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#a8a090' }}>
          <span style={{ fontSize: '2.5rem' }}>🏥</span>
          <span style={{ fontSize: '0.85rem' }}>Sélectionnez une clinique</span>
        </div>
      )}
    </div>
  )
}

export default function DashboardPatient() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024

  const [profil, setProfil] = useState<Profil | null>(null)
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [rdvsClinique, setRdvsClinique] = useState<any[]>([])
  const [page, setPage] = useState('rdvs')
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profilePanel, setProfilePanel] = useState<any>(null)
  const [panelAvisLoading, setPanelAvisLoading] = useState(false)
  const [avisExistants, setAvisExistants] = useState<Record<string, number>>({})
  const [modalAvis, setModalAvis] = useState<any>(null)
  const [suiviLances, setSuiviLances] = useState<Set<string>>(new Set())
  const [cliniquePanel, setCliniquePanel] = useState<any>(null)
  const [modalAnnulation, setModalAnnulation] = useState<any>(null)
  const [filtreHistorique, setFiltreHistorique] = useState<'tous' | 'termine' | 'annule'>('tous')
  const [cliniquePanelLoading, setCliniquePanelLoading] = useState(false)
  const [msgCliniqueInitiale, setMsgCliniqueInitiale] = useState<any>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cliniquePanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profils').select('*').eq('id', user.id).single()
      if (p?.role === 'medecin') { router.push('/dashboard/medecin'); return }
      const { data: r } = await supabase.from('rendez_vous').select('*, medecin:medecins(*, profil:profils(*))').eq('patient_id', user.id).order('date_rdv', { ascending: true })
      const { data: rc } = await supabase.from('clinique_rdvs').select('*, service:clinique_services(nom, categorie, duree_minutes, tarif), clinique:cliniques(id, nom, adresse, logo_url)').eq('patient_id', user.id).order('date', { ascending: true })
      const { data: n } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      const { data: avis } = await supabase.from('avis').select('rdv_id, note').eq('patient_id', user.id)
      const avisMap: Record<string, number> = {}
      ;(avis || []).forEach((a: any) => { avisMap[a.rdv_id] = a.note })
      const rdvsTermines = (rc || []).filter((r: any) => r.statut === 'termine' && r.delai_suivi_jours)
      const suiviDejaReserves = new Set<string>()
      for (const rdvT of rdvsTermines) {
        const rdvDate = new Date(rdvT.date + 'T12:00:00')
        const rdvSuivant = (rc || []).find((r: any) => r.service_id === rdvT.service_id && r.clinique?.id === rdvT.clinique?.id && r.id !== rdvT.id && ['en_attente', 'confirme'].includes(r.statut) && new Date(r.date + 'T12:00:00') > rdvDate)
        if (rdvSuivant) suiviDejaReserves.add(rdvT.id)
      }
      setProfil(p); setRdvs(r || []); setRdvsClinique(rc || []); setNotifications(n || []); setAvisExistants(avisMap); setSuiviLances(suiviDejaReserves); setLoading(false)
      supabase.channel('notifs-patient').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => { setNotifications(prev => [payload.new, ...prev]) }).subscribe()
    }
    load()
    return () => { supabase.removeAllChannels() }
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setProfilePanel(null) }
    if (profilePanel) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [profilePanel])

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (cliniquePanelRef.current && !cliniquePanelRef.current.contains(e.target as Node)) setCliniquePanel(null) }
    if (cliniquePanel) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [cliniquePanel])

  useEffect(() => { setSidebarOpen(false) }, [page])

  const logout = async () => { await supabase.auth.signOut(); router.push('/') }

  const annulerRdv = async (rdv: any) => {
    await supabase.from('rendez_vous').update({ statut: 'annule' }).eq('id', rdv.id)
    setRdvs(prev => prev.map(r => r.id === rdv.id ? { ...r, statut: 'annule' as any } : r))
    await supabase.from('notifications').insert({ user_id: rdv.medecin.id, type: 'rdv_annule', titre: 'Rendez-vous annulé par le patient', corps: `${profil?.prenom} ${profil?.nom} a annulé son RDV du ${new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.` })
  }

  const annulerRdvClinique = async (rdv: any) => {
    await supabase.from('clinique_rdvs').update({ statut: 'annule' }).eq('id', rdv.id)
    setRdvsClinique(prev => prev.map(r => r.id === rdv.id ? { ...r, statut: 'annule' } : r))
    const { data: cl } = await supabase.from('cliniques').select('admin_id').eq('id', rdv.clinique?.id).single()
    if (cl) await supabase.from('notifications').insert({ user_id: cl.admin_id, type: 'rdv_annule', titre: 'Réservation annulée', corps: `Un patient a annulé sa réservation pour ${rdv.service?.nom || 'un service'}.`, lu: false })
  }

  const soumettreAvis = async (rdvId: string, medecinId: string, note: number, commentaire: string) => {
    if (!profil) return
    await supabase.from('avis').insert({ rdv_id: rdvId, medecin_id: medecinId, patient_id: profil.id, note, commentaire: commentaire.trim() || null })
    const { data: tousAvis } = await supabase.from('avis').select('note').eq('medecin_id', medecinId)
    if (tousAvis && tousAvis.length > 0) {
      const moyenne = tousAvis.reduce((s: number, a: any) => s + a.note, 0) / tousAvis.length
      await supabase.from('medecins').update({ note_moyenne: Math.round(moyenne * 10) / 10, nombre_avis: tousAvis.length }).eq('id', medecinId)
    }
    setAvisExistants(prev => ({ ...prev, [rdvId]: note }))
    setModalAvis(null)
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

  const openMedecinPanel = async (med: any) => {
    setProfilePanel({ ...med, _loading: true, _tab: 'profil', avis: [] })
    setPanelAvisLoading(true)
    const { data: medData } = await supabase.from('medecins').select('*, profil:profils(*)').eq('id', med.id).single()
    const avis = await fetchAvisMedecin(supabase, med.id)
    setProfilePanel({ ...med, medecin: medData, avis, _loading: false, _tab: 'profil' })
    setPanelAvisLoading(false)
  }

  const openCliniquePanel = async (cliniqueId: string) => {
    setProfilePanel(null)
    setCliniquePanel({ _loading: true, id: cliniqueId })
    setCliniquePanelLoading(true)
    const { data: cl } = await supabase.from('cliniques').select('*').eq('id', cliniqueId).single()
    const { data: services } = await supabase.from('clinique_services').select('*').eq('clinique_id', cliniqueId).eq('actif', true).order('categorie', { ascending: true })
    setCliniquePanel({ ...cl, _loading: false, _services: services || [] })
    setCliniquePanelLoading(false)
  }

  const contacterDepuisPanel = (clinique: any) => {
    setCliniquePanel(null)
    setMsgCliniqueInitiale(clinique)
    setPage('messages_clinique')
  }

  const lancerSuivi = (rdvId: string, cliniqueId: string) => {
    setSuiviLances(prev => new Set([...prev, rdvId]))
    router.push(`/clinique/${cliniqueId}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  const nonLues = notifications.filter(n => !n.lu).length

  const notifIcons: Record<string, string> = {
    nouveau_rdv: '📅', rdv_confirme: '✅', rdv_annule: '❌', rdv_termine: '🏥', nouveau_message: '💬',
    message_clinique: '🏥', rappel_j1: '⏰', resultats_disponibles: '📋', suivi_recommande: '📅',
  }

  const statusColors: Record<string, { bg: string, color: string, label: string }> = {
    en_attente: { bg: '#fdf8ec', color: '#c8992a', label: '⏳ En attente' },
    confirme: { bg: '#e8f5f1', color: '#22816a', label: '✅ Confirmé' },
    termine: { bg: '#f0ece2', color: '#7a7260', label: '🏥 Terminé' },
    annule: { bg: '#fdf0ee', color: '#c0392b', label: '❌ Annulé' },
  }

  const rdvsAVenir = rdvs.filter(r => r.statut !== 'annule' && r.statut !== 'termine' && new Date(r.date_rdv) >= new Date())
  const rdvsPasses = rdvs.filter(r => r.statut === 'termine' || (r.statut !== 'annule' && new Date(r.date_rdv) < new Date()))
  const rdvsAnnules = rdvs.filter(r => r.statut === 'annule')
  const rdvsCliniqueAVenir = rdvsClinique.filter(r => r.statut !== 'annule' && r.statut !== 'termine' && new Date(r.date) >= new Date())
  const rdvsCliniqueHistorique = rdvsClinique.filter(r => r.statut === 'termine' || r.statut === 'annule' || new Date(r.date) < new Date())

  const navItems = [
    { id: 'rdvs', icon: '◷', label: 'Mes rendez-vous' },
    { id: 'cliniques', icon: '🏥', label: 'RDV cliniques', badge: rdvsCliniqueAVenir.filter(r => r.statut === 'en_attente').length },
    { id: 'chercher', icon: '◎', label: 'Trouver un médecin' },
    { id: 'dossier', icon: '◱', label: 'Mon dossier' },
    { id: 'messages', icon: '◻', label: 'Messagerie médecins' },
    { id: 'messages_clinique', icon: '💬', label: 'Messagerie cliniques' },
    { id: 'profil', icon: '◈', label: 'Mon profil' },
  ]

  const pageTitle: Record<string, string> = {
    rdvs: 'Mes rendez-vous', cliniques: 'RDV cliniques', chercher: 'Trouver un médecin',
    dossier: 'Mon dossier médical', messages: 'Messagerie médecins',
    messages_clinique: 'Messagerie cliniques', profil: 'Mon profil',
  }

  const NomMedecin = ({ rdv, size = 'normal' }: { rdv: any, size?: 'normal' | 'small' }) => {
    const med = (rdv as any).medecin
    const isSmall = size === 'small'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '10px' : '14px', flex: 1, minWidth: 0 }}>
        <div onClick={() => openMedecinPanel({ id: med.id, ...med })} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <Avatar url={med?.profil?.avatar_url} prenom={med?.profil?.prenom} nom={med?.profil?.nom} role="medecin" size={isSmall ? 36 : 44} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={() => openMedecinPanel({ id: med.id, ...med })} style={{ fontWeight: 600, fontSize: isSmall ? '0.82rem' : '0.88rem', color: '#0d2b22', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Dr. {med?.profil?.prenom} {med?.profil?.nom}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#7a7260', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med?.specialite}</div>
        </div>
      </div>
    )
  }

  const NomClinique = ({ rdv }: { rdv: any }) => {
    const cl = rdv.clinique
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <div onClick={() => openCliniquePanel(cl?.id)} style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', fontSize: '1.2rem', cursor: 'pointer' }}>
          {cl?.logo_url ? <img src={cl.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '🏥'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={() => openCliniquePanel(cl?.id)} style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d2b22', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl?.nom}</div>
          <div style={{ fontSize: '0.72rem', color: '#7a7260', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.service?.nom}</div>
        </div>
      </div>
    )
  }

  const renderPanel = () => {
    if (!profilePanel) return null
    const med = profilePanel.medecin
    const tab = profilePanel._tab || 'profil'
    const avis = profilePanel.avis || []
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.25)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
        <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '420px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif' }}>
          <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <button onClick={() => setProfilePanel(null)} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: 'rgba(46,181,146,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {med?.profil?.avatar_url ? <img src={med.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>👨‍⚕️</span>}
            </div>
            {profilePanel._loading ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Chargement…</div>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>Dr. {med?.profil?.prenom} {med?.profil?.nom}</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{med?.specialite}</div>
                  {med?.tarif && <div style={{ fontSize: '0.78rem', color: '#2eb592', fontWeight: 600, marginTop: '4px' }}>{Number(med.tarif).toLocaleString()} Ar / consultation</div>}
                  {med?.note_moyenne > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Etoiles note={Math.round(med.note_moyenne)} size="small" />
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{med.note_moyenne}/5 ({med.nombre_avis} avis)</span>
                    </div>
                  )}
                </div>
                {med?.verifie && <span style={{ background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)' }}>✓ Médecin vérifié</span>}
              </>
            )}
            {!profilePanel._loading && (
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '10px', width: '100%' }}>
                {[{ id: 'profil', label: '👤 Profil' }, { id: 'rdv', label: '📅 Prendre RDV' }].map(t => (
                  <button key={t.id} onClick={() => setProfilePanel((prev: any) => ({ ...prev, _tab: t.id }))}
                    style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 700, background: tab === t.id ? 'white' : 'none', color: tab === t.id ? '#0d2b22' : 'rgba(255,255,255,0.5)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {profilePanel._loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#a8a090' }}>⏳</div>
            ) : tab === 'profil' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {med?.adresse && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span>📍</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Cabinet</div><div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{med.adresse}</div>{med.region && <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{med.region}</div>}</div></div>)}
                  {med?.profil?.telephone && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>📞</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div><a href={`tel:${med.profil.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{med.profil.telephone}</a></div></div>)}
                  {med?.tarif && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>💰</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Consultation</div><div style={{ fontSize: '0.85rem', color: '#1a1512', fontWeight: 600 }}>{Number(med.tarif).toLocaleString()} Ar</div></div></div>)}
                </div>
                {med?.presentation && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>À propos</div>
                    <p style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.65, margin: 0 }}>{med.presentation}</p>
                  </div>
                )}
                <AvisSection avis={avis} loading={panelAvisLoading} noteMoyenne={med?.note_moyenne} nombreAvis={med?.nombre_avis} />
              </div>
            ) : (
              <PanelRdvForm med={med} profil={profil} supabase={supabase} onBooked={(newRdv: any) => { setRdvs(prev => [...prev, newRdv]); setProfilePanel(null) }} />
            )}
          </div>
          {!profilePanel._loading && tab === 'profil' && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setProfilePanel((prev: any) => ({ ...prev, _tab: 'rdv' }))} style={{ padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>📅 Prendre un rendez-vous</button>
              <button onClick={() => setProfilePanel(null)} style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Fermer</button>
            </div>
          )}
        </div>
      </>
    )
  }

  const renderCliniquePanel = () => {
    if (!cliniquePanel) return null
    const cl = cliniquePanel
    const services = cl._services || []
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.25)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
        <div ref={cliniquePanelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '420px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif', animation: 'slideIn 0.22s ease-out' }}>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
          <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <button onClick={() => setCliniquePanel(null)} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: 'rgba(200,153,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {cl.logo_url ? <img src={cl.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2.2rem' }}>🏥</span>}
            </div>
            {cl._loading ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Chargement…</div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{cl.nom}</div>
                {cl.region && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{cl.region}</div>}
                <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)' }}>Établissement de santé</div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cl._loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#a8a090' }}>⏳</div>
            ) : (
              <>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cl.adresse && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span>📍</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Adresse</div><div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{cl.adresse}</div>{cl.region && <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{cl.region}</div>}</div></div>)}
                  {cl.telephone && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>📞</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div><a href={`tel:${cl.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{cl.telephone}</a></div></div>)}
                  {cl.email && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>✉️</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Email</div><a href={`mailto:${cl.email}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{cl.email}</a></div></div>)}
                </div>
                {cl.description && (<div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>À propos</div><p style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.65, margin: 0 }}>{cl.description}</p></div>)}
                {services.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Services disponibles ({services.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {services.map((svc: any) => {
                        const cat = CATEGORIES_CLINIQUE.find(c => c.id === svc.categorie)
                        const modePlage = svc.mode_reservation === 'plage'
                        return (
                          <div key={svc.id} style={{ background: '#faf8f4', borderRadius: '10px', padding: '11px 14px', border: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{cat?.icon || '⚕️'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0d2b22' }}>{svc.nom}</div>
                              <div style={{ fontSize: '0.7rem', color: '#7a7260', marginTop: '2px' }}>{cat?.label}{svc.tarif ? ` · ${Number(svc.tarif).toLocaleString()} Ar` : ''}</div>
                            </div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px', background: modePlage ? '#fdf8ec' : '#e8f5f1', color: modePlage ? '#c8992a' : '#22816a', border: `1px solid ${modePlage ? 'rgba(200,153,42,0.2)' : 'rgba(34,129,106,0.2)'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {modePlage ? '🕐 Libre' : '📅 Créneau'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {!cl._loading && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => router.push(`/clinique/${cl.id}`)} style={{ padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Voir la page de la clinique →</button>
              <button onClick={() => contacterDepuisPanel(cl)} style={{ padding: '11px', borderRadius: '10px', background: '#faf8f4', color: '#0d2b22', border: '1px solid #f0ece2', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>💬 Contacter la clinique</button>
              <button onClick={() => setCliniquePanel(null)} style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Fermer</button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {renderPanel()}
      {renderCliniquePanel()}
      {modalAnnulation && (
        <>
          <div onClick={() => setModalAnnulation(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.4)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: isMobile ? 'calc(100% - 32px)' : '400px', background: 'white', borderRadius: '20px', zIndex: 301, overflow: 'hidden', boxShadow: '0 24px 80px rgba(13,43,34,0.25)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ background: 'linear-gradient(135deg, #c0392b, #e74c3c)', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>❌</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Annuler ce rendez-vous ?</div>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', border: '1px solid #f0ece2' }}>
                {modalAnnulation.type === 'medecin' ? (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0d2b22', marginBottom: '4px' }}>
                      Dr. {modalAnnulation.rdv.medecin?.profil?.prenom} {modalAnnulation.rdv.medecin?.profil?.nom}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#7a7260' }}>
                      {new Date(modalAnnulation.rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(modalAnnulation.rdv.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0d2b22', marginBottom: '4px' }}>{modalAnnulation.rdv.clinique?.nom}</div>
                    <div style={{ fontSize: '0.78rem', color: '#7a7260' }}>{modalAnnulation.rdv.service?.nom} · {new Date(modalAnnulation.rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#7a7260', marginBottom: '20px', textAlign: 'center', lineHeight: 1.6 }}>
                Cette action est irréversible. Le médecin{modalAnnulation.type === 'clinique' ? '/la clinique' : ''} sera notifié(e).
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setModalAnnulation(null)} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.88rem' }}>
                  Garder le RDV
                </button>
                <button onClick={async () => {
                  if (modalAnnulation.type === 'medecin') await annulerRdv(modalAnnulation.rdv)
                  else await annulerRdvClinique(modalAnnulation.rdv)
                  setModalAnnulation(null)
                }} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#c0392b', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem' }}>
                  Confirmer l'annulation
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {modalAvis && <ModalAvis rdv={modalAvis} onClose={() => setModalAvis(null)} onSubmit={(note: number, commentaire: string) => soumettreAvis(modalAvis.id, modalAvis.medecin.id, note, commentaire)} isMobile={isMobile} />}

      {/* OVERLAY SIDEBAR MOBILE */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
      )}

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Outfit, sans-serif' }}>

        {/* SIDEBAR */}
        <nav style={{
          width: '256px', minHeight: '100vh', background: '#0d2b22', display: 'flex', flexDirection: 'column',
          flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', position: isMobile ? 'fixed' : 'relative',
          top: 0, left: 0, bottom: 0, zIndex: isMobile ? 160 : 'auto',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s ease',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 0%, rgba(34,129,106,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div onClick={() => setPage('rdvs')} style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: 'white', letterSpacing: '-0.02em' }}>Rad<em style={{ color: '#2eb592' }}>oko</em></div>
          </div>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar url={profil?.avatar_url} prenom={profil?.prenom} nom={profil?.nom} role="patient" size={40} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{profil?.prenom} {profil?.nom}</div>
              <div style={{ display: 'inline-block', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '3px', border: '1px solid rgba(200,153,42,0.2)' }}>Patient</div>
            </div>
          </div>
          <div style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
            {navItems.map(item => (
              <div key={item.id} onClick={() => setPage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', cursor: 'pointer', borderLeft: `2px solid ${page === item.id ? '#2eb592' : 'transparent'}`, background: page === item.id ? 'rgba(34,129,106,0.18)' : 'none', color: page === item.id ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s' }}>
                <span style={{ width: '18px', textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {(item as any).badge > 0 && <span style={{ background: '#c8992a', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px' }}>{(item as any).badge}</span>}
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>⇄ Se déconnecter</div>
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
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageTitle[page]}</div>
                {!isMobile && <div style={{ fontSize: '0.78rem', color: '#7a7260', marginTop: '1px' }}>Bienvenue, {profil?.prenom} 👋</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {!isMobile && (
                <button onClick={() => setPage('chercher')} style={{ padding: '8px 16px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Nouveau RDV</button>
              )}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <div onClick={() => { setShowNotifs(v => !v); if (!showNotifs && nonLues > 0) marquerToutLu() }} style={{ width: '40px', height: '40px', background: nonLues > 0 ? '#fdf8ec' : '#f0ece2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', border: nonLues > 0 ? '1.5px solid rgba(200,153,42,0.3)' : '1.5px solid transparent', position: 'relative' }}>
                  🔔
                  {nonLues > 0 && (<div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', background: '#c0392b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', border: '2px solid white' }}>{nonLues > 9 ? '9+' : nonLues}</div>)}
                </div>
                {showNotifs && (
                  <div style={{ position: 'absolute', top: '48px', right: 0, width: isMobile ? 'calc(100vw - 32px)' : '360px', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
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
                            {(n.titre || n.message) && <div style={{ fontSize: '0.83rem', fontWeight: n.lu ? 500 : 700, color: '#0d2b22', marginBottom: '3px' }}>{n.titre || n.message}</div>}
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
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px', background: '#faf8f4', paddingBottom: isMobile ? '80px' : undefined }}>

            {page === 'rdvs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                  {[
                    { label: 'À venir', value: rdvsAVenir.length, color: '#22816a' },
                    { label: 'Passés', value: rdvsPasses.length, color: '#7a7260' },
                    { label: 'Annulés', value: rdvsAnnules.length, color: '#c0392b' },
                    { label: 'Total', value: rdvs.length, color: '#0d2b22' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: isMobile ? '14px' : '20px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 600, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>RDV à venir ({rdvsAVenir.length})</div>
                  </div>
                  {rdvsAVenir.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📅</div>
                      <div style={{ color: '#a8a090', fontSize: '0.85rem', marginBottom: '16px' }}>Aucun rendez-vous à venir</div>
                      <button onClick={() => setPage('chercher')} style={{ padding: '10px 22px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Trouver un médecin →</button>
                    </div>
                  ) : rdvsAVenir.map(rdv => {
                    const s = statusColors[rdv.statut] || statusColors.en_attente
                    return (
                      <div key={rdv.id} style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '10px' : '0', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                          <NomMedecin rdv={rdv} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0d2b22' }}>{new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                              <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{new Date(rdv.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <span style={{ padding: '3px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                            {(rdv.statut === 'en_attente' || rdv.statut === 'confirme') && (
                              <button onClick={() => setModalAnnulation({ rdv, type: 'medecin' })} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Annuler</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {(rdvsPasses.length > 0 || rdvsAnnules.length > 0) && (
                  <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>
                        Historique ({rdvsPasses.length + rdvsAnnules.length})
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {([
                          { id: 'tous', label: 'Tous' },
                          { id: 'termine', label: '✅ Terminés' },
                          { id: 'annule', label: '❌ Annulés' },
                        ] as const).map(f => (
                          <button key={f.id} onClick={() => setFiltreHistorique(f.id)}
                            style={{ padding: '5px 10px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, background: filtreHistorique === f.id ? '#0d2b22' : '#f0ece2', color: filtreHistorique === f.id ? 'white' : '#7a7260' }}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {[...rdvsPasses, ...rdvsAnnules]
                      .filter(rdv => filtreHistorique === 'tous' || rdv.statut === filtreHistorique)
                      .sort((a: any, b: any) => new Date(b.date_rdv).getTime() - new Date(a.date_rdv).getTime())
                      .map(rdv => {
                        const s = statusColors[rdv.statut] || statusColors.termine
                        const dejaNote = avisExistants[rdv.id]
                        const peutNoter = rdv.statut === 'termine' && !dejaNote
                        return (
                          <div key={rdv.id} style={{ padding: isMobile ? '12px 16px' : '16px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <NomMedecin rdv={rdv} size="small" />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <div style={{ fontSize: '0.75rem', color: '#7a7260', whiteSpace: 'nowrap' }}>{new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              <span style={{ padding: '3px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                              {dejaNote && <Etoiles note={dejaNote} size="small" />}
                              {peutNoter && (
                                <button onClick={() => setModalAvis(rdv)} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fdf8ec', color: '#c8992a', border: '1px solid rgba(200,153,42,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>⭐ Avis</button>
                              )}
                            </div>
                          </div>
                        )
                    })}
                  </div>
                )}
              </div>
            )}

            {page === 'cliniques' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                  {[
                    { label: 'À venir', value: rdvsCliniqueAVenir.length, color: '#22816a' },
                    { label: 'En attente', value: rdvsClinique.filter(r => r.statut === 'en_attente').length, color: '#c8992a' },
                    { label: 'Total', value: rdvsClinique.length, color: '#0d2b22' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: isMobile ? '14px' : '20px', border: '1px solid #f0ece2', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: s.color }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 600, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Réservations à venir ({rdvsCliniqueAVenir.length})</div>
                  </div>
                  {rdvsCliniqueAVenir.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏥</div>
                      <div style={{ color: '#a8a090', fontSize: '0.85rem', marginBottom: '16px' }}>Aucune réservation clinique à venir</div>
                      <button onClick={() => router.push('/recherche')} style={{ padding: '10px 22px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Trouver une clinique →</button>
                    </div>
                  ) : rdvsCliniqueAVenir.map(rdv => {
                    const s = statusColors[rdv.statut] || statusColors.en_attente
                    return (
                      <div key={rdv.id} style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                          <NomClinique rdv={rdv} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0d2b22' }}>{new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                              <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>{rdv.heure?.slice(0, 5)}</div>
                            </div>
                            <span style={{ padding: '3px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                            {(rdv.statut === 'en_attente' || rdv.statut === 'confirme') && (
                              <button onClick={() => setModalAnnulation({ rdv, type: 'clinique' })} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Annuler</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {rdvsCliniqueHistorique.length > 0 && (
                  <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Historique ({rdvsCliniqueHistorique.length})</div>
                    </div>
                    {rdvsCliniqueHistorique.map(rdv => {
                      const s = statusColors[rdv.statut] || statusColors.termine
                      const cat = CATEGORIES_CLINIQUE.find(c => c.id === rdv.service?.categorie)
                      return (
                        <div key={rdv.id} style={{ padding: isMobile ? '12px 16px' : '16px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '10px', opacity: rdv.statut === 'annule' ? 0.5 : 1, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{cat?.icon || '🏥'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.service?.nom}</div>
                            <div style={{ fontSize: '0.72rem', color: '#7a7260', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdv.clinique?.nom}</div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#7a7260', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          <span style={{ padding: '3px 10px', borderRadius: '50px', background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {page === 'chercher' && (
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: isMobile ? '40px 20px' : '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔍</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#0d2b22', marginBottom: '8px', fontWeight: 600 }}>Trouver un médecin ou une clinique</div>
                <div style={{ fontSize: '0.85rem', color: '#a8a090', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>Consultez les médecins et cliniques disponibles près de chez vous.</div>
                <button onClick={() => router.push('/recherche')} style={{ padding: '12px 28px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>Accéder à la recherche →</button>
              </div>
            )}

            {page === 'dossier' && profil && <DossierMedical patientId={profil.id} supabase={supabase} isMedecin={false} />}
            {page === 'messages' && profil && <Messagerie currentUserId={profil.id} supabase={supabase} role="patient" />}
            {page === 'messages_clinique' && profil && <MessageriesCliniques profil={profil} supabase={supabase} cliniqueInitiale={msgCliniqueInitiale} isMobile={isMobile} />}

            {page === 'profil' && profil && (
              <div style={{ maxWidth: '500px' }}>
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Mes informations</div>
                  </div>
                  <ProfilPatientForm profil={profil} supabase={supabase} onSaved={(updated: any) => setProfil(updated)} />
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
            { id: 'rdvs', icon: '◷', label: 'RDV' },
            { id: 'cliniques', icon: '🏥', label: 'Cliniques' },
            { id: 'chercher', icon: '🔍', label: 'Chercher' },
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

// ── MODAL AVIS ────────────────────────────────────────────────────────────────
function ModalAvis({ rdv, onClose, onSubmit, isMobile }: any) {
  const [note, setNote] = useState(0)
  const [hover, setHover] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const med = rdv.medecin

  const handleSubmit = async () => {
    if (note === 0) return
    setSubmitting(true)
    await onSubmit(note, commentaire)
    setSubmitting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : '20px', width: '100%', maxWidth: isMobile ? '100%' : '460px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(13,43,34,0.25)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '16px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(46,181,146,0.2)', border: '2px solid rgba(46,181,146,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {med?.profil?.avatar_url ? <img src={med.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '1.4rem' }}>👨‍⚕️</span>}
          </div>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Laisser un avis</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>Dr. {med?.profil?.prenom} {med?.profil?.nom} · {med?.specialite}</div>
          </div>
        </div>
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '12px' }}>
              Votre note {note > 0 && <span style={{ color: '#e6b84a', textTransform: 'none', letterSpacing: 0 }}> — {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'][note]}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} onClick={() => setNote(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} style={{ fontSize: '2.4rem', cursor: 'pointer', color: i <= (hover || note) ? '#e6b84a' : '#d9d0c4' }}>★</span>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '6px' }}>Commentaire <span style={{ fontWeight: 400, textTransform: 'none', color: '#c8c0b4' }}>(optionnel)</span></label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3} placeholder="Décrivez votre expérience…" style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }} />
          </div>
        </div>
        <div style={{ padding: '0 28px 24px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} disabled={note === 0 || submitting} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: note === 0 ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: note === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>
            {submitting ? '⏳ Envoi…' : '⭐ Publier mon avis'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: '12px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.9rem' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── PANEL RDV FORM ────────────────────────────────────────────────────────────
function PanelRdvForm({ med, profil, supabase, onBooked }: any) {
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [motif, setMotif] = useState('')
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)

  const onDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr); setSelectedTime(''); setCreneaux([])
    if (!dateStr) return
    setLoadingCreneaux(true)
    const dispo = await getCreneauxDisponibles(supabase, med.id, dateStr)
    setCreneaux(dispo); setLoadingCreneaux(false)
  }

  const book = async () => {
    if (!selectedDate || !selectedTime) return
    setBooking(true)
    const dateRdvISO = toLocalISO(selectedDate, selectedTime)
    const { data: patient } = await supabase.from('patients').select('id').eq('id', profil.id).single()
    if (!patient) await supabase.from('patients').insert({ id: profil.id })
    const { data: newRdv, error } = await supabase.from('rendez_vous').insert({ medecin_id: med.id, patient_id: profil.id, date_rdv: dateRdvISO, motif, statut: 'en_attente' }).select('*, medecin:medecins(*, profil:profils(*))').single()
    if (!error) {
      const patientNom = `${profil.prenom} ${profil.nom}`
      const [annee, mois, jour] = selectedDate.split('-').map(Number)
      const dateFormatee = new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      await supabase.from('notifications').insert({ user_id: med.id, type: 'nouveau_rdv', titre: 'Nouvelle demande de rendez-vous 📅', corps: `${patientNom} souhaite un RDV le ${dateFormatee} à ${selectedTime.replace(':', 'h')}${motif ? ` — Motif : ${motif}` : ''}.` })
      setBooked(true); setBooking(false)
      setTimeout(() => { onBooked(newRdv) }, 1500)
    } else { setBooking(false) }
  }

  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' as const }

  if (booked) return (
    <div style={{ background: '#e8f5f1', borderRadius: '16px', padding: '32px', textAlign: 'center', marginTop: '8px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>Demande envoyée !</div>
      <div style={{ fontSize: '0.78rem', color: '#22816a', lineHeight: 1.5 }}>Le médecin va confirmer votre RDV.</div>
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
          <label style={labelStyle}>Créneaux disponibles {loadingCreneaux && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '8px', color: '#a8a090' }}>chargement…</span>}</label>
          {!loadingCreneaux && creneaux.length === 0 && <div style={{ padding: '12px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>Aucun créneau disponible ce jour</div>}
          {!loadingCreneaux && creneaux.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {creneaux.map(c => (
                <button key={c} onClick={() => setSelectedTime(c)} style={{ padding: '6px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: selectedTime === c ? '#22816a' : '#f0ece2', color: selectedTime === c ? 'white' : '#0d2b22' }}>{c.replace(':', 'h')}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <label style={labelStyle}>Motif (optionnel)</label>
        <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Douleurs thoraciques, suivi…" style={inputStyle} />
      </div>
      <button onClick={book} disabled={!selectedDate || !selectedTime || booking} style={{ padding: '11px', borderRadius: '10px', border: 'none', cursor: (!selectedDate || !selectedTime || booking) ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', background: (!selectedDate || !selectedTime) ? '#cfc5ae' : '#0d2b22', color: 'white' }}>
        {booking ? '⏳ Envoi en cours…' : !selectedDate ? 'Choisissez une date' : !selectedTime ? 'Choisissez un créneau' : 'Confirmer le rendez-vous →'}
      </button>
    </div>
  )
}

// ── PROFIL PATIENT FORM ───────────────────────────────────────────────────────
function ProfilPatientForm({ profil, supabase, onSaved }: any) {
  const [form, setForm] = useState({ prenom: profil?.prenom || '', nom: profil?.nom || '', telephone: profil?.telephone || '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profil?.avatar_url || null)

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px' }

  const save = async () => {
    setSaving(true)
    await supabase.from('profils').update({ prenom: form.prenom, nom: form.nom, telephone: form.telephone }).eq('id', profil.id)
    onSaved?.({ ...profil, ...form, avatar_url: avatarUrl })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={labelStyle}>Photo de profil</label>
        <AvatarUpload userId={profil.id} currentUrl={avatarUrl} supabase={supabase} role="patient" onUpload={(url: string) => { setAvatarUrl(url); onSaved?.({ ...profil, avatar_url: url }) }} />
      </div>
      <div style={{ height: '1px', background: '#f0ece2' }} />
      {[{ label: 'Prénom', key: 'prenom' }, { label: 'Nom', key: 'nom' }, { label: 'Téléphone', key: 'telephone' }].map(f => (
        <div key={f.key}>
          <label style={labelStyle}>{f.label}</label>
          <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputStyle} />
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
        {saving ? '⏳ Enregistrement…' : saved ? '✅ Sauvegardé !' : 'Enregistrer les modifications'}
      </button>
    </div>
  )
}