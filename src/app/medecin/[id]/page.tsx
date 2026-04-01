// src/app/medecin/[id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
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
  const heuresPrises = new Set<string>((rdvsPris || []).map((r: any) => isoToLocalHHMM(r.date_rdv)))
  const { data: blocagesManuels } = await supabase.from('creneaux_manuels').select('date_creneau').eq('medecin_id', medecinId).gte('date_creneau', debutJour).lte('date_creneau', finJour)
  const heuresBloqueesManuel = new Set<string>((blocagesManuels || []).map((b: any) => isoToLocalHHMM(b.date_creneau)))
  const { data: absences } = await supabase.from('creneaux_bloques').select('date_debut, date_fin').eq('medecin_id', medecinId).lte('date_debut', finJour).gte('date_fin', debutJour)
  if ((absences || []).length > 0) return []
  return creneaux.filter(c => !heuresPrises.has(c) && !heuresBloqueesManuel.has(c))
}

function Etoiles({ note }: { note: number }) {
  return (
    <span style={{ fontSize: '1rem', letterSpacing: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= note ? '#e6b84a' : '#d9d0c4' }}>★</span>
      ))}
    </span>
  )
}

export default function PageMedecin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 768

  const [medecin, setMedecin] = useState<any>(null)
  const [profil, setProfil] = useState<any>(null)
  const [disponibilites, setDisponibilites] = useState<any[]>([])
  const [avis, setAvis] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState<'profil' | 'rdv'>('profil')

  // RDV
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [motif, setMotif] = useState('')
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)

  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      const { data: m } = await supabase.from('medecins').select('*').eq('id', id).single()
      if (!m) { setLoading(false); return }
      setMedecin(m)

      const { data: p } = await supabase.from('profils').select('*').eq('id', id).single()
      setProfil(p)

      const { data: d } = await supabase.from('disponibilites').select('*').eq('medecin_id', id).eq('actif', true).order('jour_semaine')
      setDisponibilites(d || [])

      const { data: avisData } = await supabase.from('avis').select('id, note, commentaire, created_at, patient_id').eq('medecin_id', id).order('created_at', { ascending: false })
      if (avisData && avisData.length > 0) {
        const patientIds = [...new Set(avisData.map((a: any) => a.patient_id))]
        const { data: profils } = await supabase.from('profils').select('id, prenom, nom').in('id', patientIds)
        const profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
        setAvis(avisData.map((a: any) => ({ ...a, patient: profilMap[a.patient_id] || null })))
      }

      setLoading(false)
    }
    load()
  }, [id])

  const onDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedTime('')
    setCreneaux([])
    if (!dateStr) return
    setLoadingCreneaux(true)
    const dispo = await getCreneauxDisponibles(supabase, id, dateStr)
    setCreneaux(dispo)
    setLoadingCreneaux(false)
  }

  const book = async () => {
    if (!user) { router.push('/login'); return }
    if (!selectedDate || !selectedTime) return
    setBooking(true)
    const dateRdvISO = toLocalISO(selectedDate, selectedTime)
    const { data: patient } = await supabase.from('patients').select('id').eq('id', user.id).single()
    if (!patient) await supabase.from('patients').insert({ id: user.id })
    const { error } = await supabase.from('rendez_vous').insert({
      medecin_id: id, patient_id: user.id, date_rdv: dateRdvISO, motif, statut: 'en_attente',
    })
    if (!error) {
      const { data: userProfil } = await supabase.from('profils').select('prenom, nom').eq('id', user.id).single()
      const patientNom = userProfil ? `${userProfil.prenom} ${userProfil.nom}` : 'Un patient'
      const [annee, mois, jour] = selectedDate.split('-').map(Number)
      const dateFormatee = new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      await supabase.from('notifications').insert({
        user_id: id, type: 'nouveau_rdv',
        titre: 'Nouvelle demande de rendez-vous',
        corps: `${patientNom} souhaite un RDV le ${dateFormatee} à ${selectedTime.replace(':', 'h')}${motif ? ' — Motif : ' + motif : ''}.`,
      })
      setBooked(true)
    }
    setBooking(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  if (!medecin) return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '3rem' }}>🔍</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: '#0d2b22' }}>Médecin introuvable</div>
      <button onClick={() => router.push('/recherche')} style={{ padding: '10px 24px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Retour à la recherche</button>
    </div>
  )

  const noteMoyenne = medecin.note_moyenne || 0
  const nombreAvis = medecin.nombre_avis || 0
  const langues = medecin.langues || []
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: 'Outfit, sans-serif' }}>

      {/* NAV */}
      <nav style={{ background: '#0d2b22', padding: isMobile ? '14px 20px' : '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/recherche" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.5rem' : '1.7rem', fontWeight: 600, color: 'white', textDecoration: 'none' }}>
          Rad<em style={{ color: '#2eb592' }}>oko</em>
        </a>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="/recherche" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>← Retour</a>
          {user ? (
            <a href="/dashboard/patient" style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>Mon espace</a>
          ) : (
            <a href="/login" style={{ padding: '8px 16px', borderRadius: '10px', background: '#2eb592', color: 'white', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>Connexion</a>
          )}
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0d2b22 0%, #1a4a35 100%)', padding: isMobile ? '32px 20px' : '52px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(46,181,146,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: isMobile ? 'flex-start' : 'center', position: 'relative' }}>
          <div style={{ width: isMobile ? '80px' : '100px', height: isMobile ? '80px' : '100px', borderRadius: '24px', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {profil?.avatar_url
              ? <img src={profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span style={{ fontSize: '2.5rem' }}>👨‍⚕️</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div style={{ display: 'inline-block', background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(46,181,146,0.3)' }}>
                Professionnel de santé
              </div>
              {medecin.verifie && (
                <div style={{ display: 'inline-block', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)' }}>
                  ✓ Vérifié
                </div>
              )}
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: 600, color: 'white', lineHeight: 1.1, marginBottom: '6px' }}>
              Dr. {profil?.prenom} {profil?.nom}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', marginBottom: '12px' }}>{medecin.specialite}</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              {medecin.adresse && <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>📍 {medecin.adresse}{medecin.region ? ', ' + medecin.region : ''}</span>}
              {profil?.telephone && <a href={`tel:${profil.telephone}`} style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>📞 {profil.telephone}</a>}
              {medecin.tarif && <span style={{ fontSize: '0.88rem', color: '#2eb592', fontWeight: 600 }}>💰 {Number(medecin.tarif).toLocaleString()} Ar</span>}
            </div>
            {noteMoyenne > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Etoiles note={Math.round(noteMoyenne)} />
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{noteMoyenne.toFixed(1)}/5 · {nombreAvis} avis</span>
              </div>
            )}
          </div>
          {!isMobile && (
            <button onClick={() => setOnglet('rdv')} style={{ padding: '12px 28px', borderRadius: '12px', background: '#2eb592', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              📅 Prendre RDV
            </button>
          )}
        </div>
      </div>

      {/* ONGLETS */}
      <div style={{ background: 'white', borderBottom: '1px solid #f0ece2', position: 'sticky', top: isMobile ? '57px' : '65px', zIndex: 90 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px', display: 'flex', gap: '0' }}>
          {[{ id: 'profil', label: '👤 Profil' }, { id: 'rdv', label: '📅 Prendre RDV' }].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id as any)} style={{ padding: isMobile ? '14px 20px' : '16px 28px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: onglet === t.id ? '#22816a' : '#a8a090', borderBottom: onglet === t.id ? '2px solid #22816a' : '2px solid transparent', marginBottom: '-1px' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '24px 16px' : '36px 40px' }}>

        {/* ONGLET PROFIL */}
        {onglet === 'profil' && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

            {/* COLONNE PRINCIPALE */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* À PROPOS */}
              {medecin.presentation && (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '24px 28px' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 600, color: '#0d2b22', marginBottom: '12px' }}>À propos</div>
                  <p style={{ fontSize: '0.88rem', color: '#4a4438', lineHeight: 1.75, margin: 0 }}>{medecin.presentation}</p>
                </div>
              )}

              {/* DISPONIBILITÉS */}
              {disponibilites.length > 0 && (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '24px 28px' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 600, color: '#0d2b22', marginBottom: '16px' }}>Horaires de consultation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {disponibilites.map((d: any) => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#faf8f4', borderRadius: '10px', border: '1px solid #f0ece2' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0d2b22' }}>{JOURS[d.jour_semaine]}</span>
                        <span style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600 }}>
                          {d.heure_debut?.slice(0, 5)} – {d.heure_fin?.slice(0, 5)}
                          {d.duree_creneau && <span style={{ fontSize: '0.72rem', color: '#a8a090', marginLeft: '8px' }}>({d.duree_creneau} min)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AVIS */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '24px 28px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 600, color: '#0d2b22', marginBottom: '16px' }}>
                  Avis patients {nombreAvis > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#a8a090' }}>({nombreAvis})</span>}
                </div>
                {avis.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#a8a090', fontSize: '0.85rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⭐</div>
                    Aucun avis pour le moment
                  </div>
                ) : (
                  <>
                    {noteMoyenne > 0 && (
                      <div style={{ background: 'linear-gradient(135deg, #fdf8ec, #fef9f0)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(200,153,42,0.2)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.8rem', fontWeight: 700, color: '#c8992a', lineHeight: 1 }}>{noteMoyenne.toFixed(1)}</div>
                          <div style={{ fontSize: '0.65rem', color: '#a8906a', marginTop: '2px' }}>/ 5</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          {[5, 4, 3, 2, 1].map(n => {
                            const count = avis.filter(a => a.note === n).length
                            const pct = avis.length > 0 ? (count / avis.length) * 100 : 0
                            return (
                              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.68rem', color: '#a8906a', width: '10px', textAlign: 'right', flexShrink: 0 }}>{n}</span>
                                <span style={{ fontSize: '0.65rem', color: '#e6b84a', flexShrink: 0 }}>★</span>
                                <div style={{ flex: 1, height: '6px', background: '#f0e8d0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: '#e6b84a', borderRadius: '3px' }} />
                                </div>
                                <span style={{ fontSize: '0.65rem', color: '#a8906a', width: '16px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {avis.map((a: any) => (
                        <div key={a.id} style={{ background: '#faf8f4', borderRadius: '12px', padding: '14px 16px', border: '1px solid #f0ece2' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: a.commentaire ? '8px' : '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#22816a', flexShrink: 0 }}>
                                {a.patient?.prenom?.charAt(0)}{a.patient?.nom?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22' }}>{a.patient?.prenom} {a.patient?.nom?.charAt(0)}.</div>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                  {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: '0.7rem', color: i <= a.note ? '#e6b84a' : '#d9d0c4' }}>★</span>)}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: '#b8b0a0' }}>
                              {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {a.commentaire && <p style={{ fontSize: '0.82rem', color: '#4a4035', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{a.commentaire}"</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* COLONNE DROITE — INFOS PRATIQUES */}
            <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22' }}>Informations pratiques</div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {medecin.tarif && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Tarif consultation</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0d2b22' }}>{Number(medecin.tarif).toLocaleString()} Ar</div>
                    </div>
                  )}
                  {medecin.adresse && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Adresse</div>
                      <div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{medecin.adresse}</div>
                      {medecin.region && <div style={{ fontSize: '0.78rem', color: '#7a7260' }}>{medecin.region}</div>}
                    </div>
                  )}
                  {profil?.telephone && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Téléphone</div>
                      <a href={`tel:${profil.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{profil.telephone}</a>
                    </div>
                  )}
                  {langues.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Langues</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {langues.map((l: string) => (
                          <span key={l} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '50px', background: '#e8f5f1', color: '#22816a', fontWeight: 600 }}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {medecin.experience_annees && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Expérience</div>
                      <div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{medecin.experience_annees} ans</div>
                    </div>
                  )}
                  {medecin.formation && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Formation</div>
                      <div style={{ fontSize: '0.82rem', color: '#4a4438', lineHeight: 1.6 }}>{medecin.formation}</div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #f0ece2' }}>
                  <button onClick={() => setOnglet('rdv')} style={{ width: '100%', padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem' }}>
                    📅 Prendre rendez-vous
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET RDV */}
        {onglet === 'rdv' && (
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '20px 24px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Prendre rendez-vous</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginTop: '3px' }}>Dr. {profil?.prenom} {profil?.nom} · {medecin.specialite}</div>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {booked ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>Demande envoyée !</div>
                    <div style={{ fontSize: '0.85rem', color: '#7a7260', lineHeight: 1.6, marginBottom: '24px' }}>
                      Le médecin va confirmer votre RDV. Vous recevrez une notification dans votre espace patient.
                    </div>
                    <button onClick={() => router.push('/dashboard/patient')} style={{ padding: '11px 24px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                      Voir mes rendez-vous →
                    </button>
                  </div>
                ) : (
                  <>
                    {!user && (
                      <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(200,153,42,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#c8992a', fontWeight: 600, marginBottom: '8px' }}>Connexion requise</div>
                        <div style={{ fontSize: '0.78rem', color: '#a8906a', marginBottom: '12px' }}>Vous devez être connecté pour prendre un rendez-vous.</div>
                        <button onClick={() => router.push('/login')} style={{ padding: '8px 20px', borderRadius: '8px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>
                          Se connecter →
                        </button>
                      </div>
                    )}
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
                          <div style={{ padding: '14px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>
                            Aucun créneau disponible ce jour — essayez une autre date
                          </div>
                        )}
                        {!loadingCreneaux && creneaux.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {creneaux.map(c => (
                              <button key={c} onClick={() => setSelectedTime(c)} style={{ padding: '10px 6px', borderRadius: '10px', border: `2px solid ${selectedTime === c ? '#22816a' : '#f0ece2'}`, background: selectedTime === c ? '#e8f5f1' : 'white', color: selectedTime === c ? '#22816a' : '#0d2b22', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {selectedDate && selectedTime && (
                      <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '14px 16px', border: '1px solid #f0ece2' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Récapitulatif</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                          <span style={{ color: '#7a7260' }}>Date</span>
                          <span style={{ fontWeight: 600, color: '#0d2b22' }}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                          <span style={{ color: '#7a7260' }}>Heure</span>
                          <span style={{ fontWeight: 600, color: '#22816a' }}>{selectedTime}</span>
                        </div>
                        {medecin.tarif && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid #f0ece2', paddingTop: '6px', marginTop: '6px' }}>
                            <span style={{ color: '#7a7260' }}>Tarif estimé</span>
                            <span style={{ fontWeight: 700, color: '#c8992a' }}>{Number(medecin.tarif).toLocaleString()} Ar</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Motif (optionnel)</label>
                      <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Douleurs thoraciques, suivi…" style={inputStyle} />
                    </div>
                    <button onClick={book} disabled={!selectedDate || !selectedTime || booking || !user}
                      style={{ padding: '13px', borderRadius: '12px', border: 'none', cursor: (!selectedDate || !selectedTime || !user) ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', background: (!selectedDate || !selectedTime || !user) ? '#cfc5ae' : '#22816a', color: 'white' }}>
                      {booking ? '⏳ Envoi…' : !user ? 'Connectez-vous pour réserver' : !selectedDate ? 'Choisissez une date' : !selectedTime ? 'Choisissez un créneau' : '✓ Confirmer le rendez-vous'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOUTON FLOTTANT MOBILE */}
      {isMobile && onglet === 'profil' && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <button onClick={() => setOnglet('rdv')} style={{ padding: '14px 32px', borderRadius: '50px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 8px 24px rgba(34,129,106,0.4)', whiteSpace: 'nowrap' }}>
            📅 Prendre rendez-vous
          </button>
        </div>
      )}
    </div>
  )
}