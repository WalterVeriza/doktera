'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import Avatar from '@/components/shared/Avatar'

const MapComponent = dynamic(
  () => import('@/components/shared/MapComponent'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '100%', background: '#f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a7260', fontFamily: 'Outfit, sans-serif' }}>
        Chargement de la carte…
      </div>
    )
  }
)

const SPECIALITES = [
  'Toutes les spécialités', 'Médecin généraliste', 'Cardiologue', 'Pédiatre',
  'Dentiste', 'Sage-femme', 'Dermatologue', 'Gynécologue', 'Ophtalmologue',
  'Kinésithérapeute', 'ORL', 'Psychiatre', 'Neurologue', 'Urgentiste',
]

const CATEGORIES_CLINIQUE = [
  { id: 'consultation', label: 'Consultations spécialisées', keywords: ['consultation', 'spécialiste', 'spécialité'] },
  { id: 'hospitalisation', label: 'Hospitalisations', keywords: ['hospitalisation', 'hospitaliser', 'séjour', 'lit'] },
  { id: 'maternite', label: 'Maternité gynécologie', keywords: ['maternité', 'maternite', 'gynécologie', 'gynecologie', 'accouchement', 'grossesse', 'obstétrique'] },
  { id: 'imagerie', label: 'Imagerie médicale', keywords: ['imagerie', 'radio', 'radiologie', 'scanner', 'irm', 'échographie', 'echographie', 'rx'] },
  { id: 'laboratoire', label: 'Analyses laboratoire', keywords: ['laboratoire', 'labo', 'analyse', 'analyses', 'prise de sang', 'bilan'] },
  { id: 'chirurgie', label: 'Chirurgie', keywords: ['chirurgie', 'chirurgien', 'opération', 'operation', 'bloc'] },
  { id: 'urgences', label: 'Urgences', keywords: ['urgence', 'urgences'] },
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

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
  const affichés = expanded ? avis : avis.slice(0, 2)
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Avis patients</div>
      {loading ? (
        <div style={{ background: '#faf8f4', borderRadius: '10px', padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: '#a8a090' }}>Chargement des avis…</div>
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
            {affichés.map((a: any) => (
              <div key={a.id} style={{ background: '#faf8f4', borderRadius: '10px', padding: '11px 13px', border: '1px solid #f0ece2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: a.commentaire ? '5px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#22816a', flexShrink: 0 }}>
                      {a.patient?.prenom?.charAt(0)}{a.patient?.nom?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0d2b22' }}>{a.patient?.prenom} {a.patient?.nom?.charAt(0)}.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: '0.65rem', color: i <= a.note ? '#e6b84a' : '#d9d0c4' }}>★</span>)}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.63rem', color: '#b8b0a0', flexShrink: 0 }}>
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {a.commentaire && <p style={{ fontSize: '0.77rem', color: '#4a4035', lineHeight: 1.5, margin: 0, paddingTop: '5px', borderTop: '1px solid #ece8e0' }}>"{a.commentaire}"</p>}
              </div>
            ))}
          </div>
          {avis.length > 2 && (
            <button onClick={() => setExpanded(!expanded)} style={{ marginTop: '10px', width: '100%', padding: '9px', borderRadius: '10px', background: expanded ? '#f0ece2' : '#faf8f4', border: `1px solid ${expanded ? '#e0dbd0' : '#f0ece2'}`, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: '#7a7260' }}>
              {expanded ? 'Réduire' : `Voir tous les avis (${avis.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function PanelClinique({ clinique, onClose, isMobile, router }: any) {
  const panelRef = useRef<HTMLDivElement>(null)
  const ICONS: Record<string, string> = { consultation: '🩺', hospitalisation: '🛏️', maternite: '🤱', imagerie: '🔬', laboratoire: '🧪', chirurgie: '⚕️', urgences: '🚨' }
  const services = clinique._services || []

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.3)', zIndex: 200, backdropFilter: 'blur(3px)' }} />
      <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '420px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.2)', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif', animation: 'slideIn 0.22s ease-out', overflowY: 'auto' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
        <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', background: 'rgba(46,181,146,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>🏥</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{clinique.nom}</div>
            {clinique.region && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{clinique.region}</div>}
            <div style={{ display: 'inline-block', marginTop: '6px', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)' }}>Établissement de santé</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {clinique.adresse && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span>📍</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Adresse</div><div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{clinique.adresse}</div></div></div>)}
            {clinique.telephone && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>📞</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div><a href={`tel:${clinique.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{clinique.telephone}</a></div></div>)}
            {clinique.email && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>✉️</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Email</div><div style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600 }}>{clinique.email}</div></div></div>)}
          </div>
          {clinique.description && (<div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>À propos</div><p style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.65, margin: 0 }}>{clinique.description}</p></div>)}
          {services.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Services ({services.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {services.map((s: any) => (
                  <div key={s.id} style={{ background: '#faf8f4', borderRadius: '10px', padding: '10px 14px', border: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{ICONS[s.categorie] || '⚕️'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nom}</div>
                      <div style={{ fontSize: '0.7rem', color: '#7a7260' }}>{CATEGORIES_CLINIQUE.find(c => c.id === s.categorie)?.label}{s.tarif ? ' · ' + Number(s.tarif).toLocaleString() + ' Ar' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => router.push('/clinique/' + clinique.id)} style={{ padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Voir la page et réserver</button>
          <button onClick={onClose} style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Fermer</button>
        </div>
      </div>
    </>
  )
}

export default function RecherchePage() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024

  const [medecins, setMedecins] = useState<any[]>([])
  const [cliniques, setCliniques] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialite, setSpecialite] = useState('Toutes les spécialités')
  const [userPos, setUserPos] = useState<{ lat: number, lng: number } | null>(null)
  const [rayon, setRayon] = useState(10)
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userProfil, setUserProfil] = useState<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [panel, setPanel] = useState<any>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [cliniquePanel, setCliniquePanel] = useState<any>(null)
  const [typeFiltre, setTypeFiltre] = useState<'tous' | 'medecins' | 'cliniques'>('tous')
  const [showFiltres, setShowFiltres] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: p } = await supabase.from('profils').select('*').eq('id', user.id).single()
        setUserProfil(p)
      }
      await fetchAll()
    }
    init()
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanel(null)
    }
    if (panel) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [panel])

  const fetchAll = async (s = specialite, txt = search) => {
    setLoading(true)
    let query = supabase.from('medecins').select('*, profil:profils(*)').eq('plan_actif', true)
    if (s !== 'Toutes les spécialités') query = query.eq('specialite', s)
    const { data: medecinData } = await query
    let resultsMedecins = (medecinData || []).filter((m: any) => m.specialite !== 'Clinique')

    const { data: cliniqueData } = await supabase.from('cliniques').select('*, services:clinique_services(*)').eq('plan_actif', true)
    let resultsCliniques = cliniqueData || []

    if (txt) {
      const txtLower = txt.toLowerCase()
      const categoriesMatchees = CATEGORIES_CLINIQUE
        .filter(cat => cat.keywords.some(kw => txtLower.includes(kw) || kw.includes(txtLower)))
        .map(cat => cat.id)

      resultsMedecins = resultsMedecins.filter((m: any) =>
        (m.profil?.prenom + ' ' + m.profil?.nom).toLowerCase().includes(txtLower) ||
        m.specialite?.toLowerCase().includes(txtLower) ||
        m.adresse?.toLowerCase().includes(txtLower) ||
        m.region?.toLowerCase().includes(txtLower)
      )

      resultsCliniques = resultsCliniques.filter((c: any) => {
        const matchNom = c.nom?.toLowerCase().includes(txtLower)
        const matchDesc = c.description?.toLowerCase().includes(txtLower)
        const matchAdresse = c.adresse?.toLowerCase().includes(txtLower)
        const matchRegion = c.region?.toLowerCase().includes(txtLower)
        const matchService = (c.services || []).some((sv: any) =>
          sv.nom?.toLowerCase().includes(txtLower) ||
          sv.description?.toLowerCase().includes(txtLower) ||
          categoriesMatchees.includes(sv.categorie)
        )
        return matchNom || matchDesc || matchAdresse || matchRegion || matchService
      })
    }

    setMedecins(resultsMedecins)
    setCliniques(resultsCliniques)
    setLoading(false)
  }

  const geolocalize = () => {
    setLocLoading(true)
    setLocError('')
    if (!navigator.geolocation) { setLocError('Géolocalisation non supportée'); setLocLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); setMapReady(true); setShowMap(true) },
      () => { setLocError("Impossible d'obtenir votre position."); setLocLoading(false) }
    )
  }

  const openPanel = async (med: any) => {
    setPanel({ ...med, _tab: 'profil', _avis: [], _avisLoaded: false })
    setPanelLoading(true)
    const { data: avisData } = await supabase.from('avis').select('id, note, commentaire, created_at, patient_id').eq('medecin_id', med.id).order('created_at', { ascending: false })
    let avisEnrichis: any[] = []
    if (avisData && avisData.length > 0) {
      const patientIds = [...new Set(avisData.map((a: any) => a.patient_id))]
      const { data: profils } = await supabase.from('profils').select('id, prenom, nom').in('id', patientIds)
      const profilMap = Object.fromEntries((profils || []).map((p: any) => [p.id, p]))
      avisEnrichis = avisData.map((a: any) => ({ ...a, patient: profilMap[a.patient_id] || null }))
    }
    setPanel((prev: any) => prev ? { ...prev, _avis: avisEnrichis, _avisLoaded: true } : null)
    setPanelLoading(false)
  }

  const openCliniquePanel = async (clinique: any) => {
    const { data: services } = await supabase.from('clinique_services').select('*').eq('clinique_id', clinique.id).eq('actif', true).order('categorie')
    setCliniquePanel({ ...clinique, _services: services || [] })
  }

  const addDistance = (items: any[]) => {
    if (!userPos) return items
    return items
      .filter((m: any) => m.latitude && m.longitude)
      .map((m: any) => ({ ...m, distance: getDistance(userPos.lat, userPos.lng, m.latitude, m.longitude) }))
      .filter((m: any) => m.distance <= rayon)
      .sort((a: any, b: any) => a.distance - b.distance)
  }

  const medecinsAfiltres = userPos ? addDistance(medecins) : medecins
  const cliniquesAfiltres = userPos ? addDistance(cliniques) : cliniques
  const totalResultats = typeFiltre === 'tous'
    ? medecinsAfiltres.length + cliniquesAfiltres.length
    : typeFiltre === 'medecins' ? medecinsAfiltres.length : cliniquesAfiltres.length

  const selectStyle: React.CSSProperties = { padding: '10px 14px', background: 'white', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }

  const renderPanel = () => {
    if (!panel) return null
    const med = panel
    const tab = panel._tab || 'profil'
    const avis = panel._avis || []
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.3)', zIndex: 200, backdropFilter: 'blur(3px)' }} />
        <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : '420px', background: 'white', zIndex: 201, boxShadow: '-8px 0 40px rgba(13,43,34,0.2)', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif', animation: 'slideIn 0.22s ease-out' }}>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
          <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <button onClick={() => setPanel(null)} style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: 'rgba(46,181,146,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {med.profil?.avatar_url ? <img src={med.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>👨‍⚕️</span>}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>Dr. {med.profil?.prenom} {med.profil?.nom}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{med.specialite}</div>
              {med.tarif && <div style={{ fontSize: '0.78rem', color: '#2eb592', fontWeight: 600, marginTop: '4px' }}>{Number(med.tarif).toLocaleString()} Ar / consultation</div>}
              {med.note_moyenne > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Etoiles note={Math.round(med.note_moyenne)} size="small" />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{med.note_moyenne}/5 ({med.nombre_avis} avis)</span>
                </div>
              )}
              {med.distance !== undefined && (
                <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)' }}>
                  {med.distance < 1 ? Math.round(med.distance * 1000) + 'm' : med.distance.toFixed(1) + 'km'}
                </div>
              )}
            </div>
            {med.verifie && <span style={{ background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)' }}>Médecin vérifié</span>}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '10px', width: '100%' }}>
              {[{ id: 'profil', label: 'Profil' }, { id: 'rdv', label: 'Prendre RDV' }].map(t => (
                <button key={t.id} onClick={() => setPanel((prev: any) => ({ ...prev, _tab: t.id }))} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 700, background: tab === t.id ? 'white' : 'none', color: tab === t.id ? '#0d2b22' : 'rgba(255,255,255,0.5)' }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {tab === 'profil' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {med.adresse && (<div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}><span>📍</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Cabinet</div><div style={{ fontSize: '0.85rem', color: '#1a1512' }}>{med.adresse}</div>{med.region && <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>{med.region}</div>}</div></div>)}
                  {med.profil?.telephone && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>📞</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Téléphone</div><a href={`tel:${med.profil.telephone}`} style={{ fontSize: '0.85rem', color: '#22816a', fontWeight: 600, textDecoration: 'none' }}>{med.profil.telephone}</a></div></div>)}
                  {med.tarif && (<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span>💰</span><div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Consultation</div><div style={{ fontSize: '0.85rem', color: '#1a1512', fontWeight: 600 }}>{Number(med.tarif).toLocaleString()} Ar</div></div></div>)}
                </div>
                {med.presentation && (<div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>À propos</div><p style={{ fontSize: '0.83rem', color: '#4a4035', lineHeight: 1.65, margin: 0 }}>{med.presentation}</p></div>)}
                <AvisSection avis={avis} loading={panelLoading} noteMoyenne={med?.note_moyenne} nombreAvis={med?.nombre_avis} />
              </div>
            ) : (
              <RechercheRdvForm med={med} user={user} userProfil={userProfil} supabase={supabase} router={router} onBooked={() => setTimeout(() => setPanel(null), 1500)} />
            )}
          </div>
          {tab === 'profil' && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setPanel((prev: any) => ({ ...prev, _tab: 'rdv' }))} style={{ padding: '11px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Prendre un rendez-vous</button>
              <button onClick={() => setPanel(null)} style={{ padding: '11px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>Fermer</button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: 'Outfit, sans-serif' }}>
      {renderPanel()}
      {cliniquePanel && <PanelClinique clinique={cliniquePanel} onClose={() => setCliniquePanel(null)} isMobile={isMobile} router={router} />}

      {/* HEADER */}
      <div style={{ background: '#0d2b22', padding: isMobile ? '14px 16px' : '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, gap: '12px' }}>
        <div onClick={() => router.push('/')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 600, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
          Rad<em style={{ color: '#2eb592' }}>oko</em>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {user ? (
            <button onClick={() => router.push('/dashboard/patient')} style={{ padding: isMobile ? '7px 12px' : '8px 18px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>
              {isMobile ? 'Espace' : 'Mon espace'}
            </button>
          ) : (
            <>
              {!isMobile && <button onClick={() => router.push('/login')} style={{ padding: '8px 18px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.2)', background: 'none', color: 'white', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>Se connecter</button>}
              <button onClick={() => router.push('/login')} style={{ padding: isMobile ? '7px 12px' : '8px 18px', borderRadius: '10px', background: '#2eb592', color: '#0d2b22', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem' }}>S'inscrire</button>
            </>
          )}
        </div>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div style={{ background: '#0d2b22', padding: isMobile ? '0 16px 24px' : '0 48px 36px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '8px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px', alignItems: isMobile ? 'stretch' : 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchAll(specialite, search)}
            placeholder={isMobile ? 'Médecin, clinique, spécialité…' : 'Médecin, clinique, imagerie, chirurgie…'}
            style={{ flex: 1, padding: '10px 14px', border: 'none', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', color: '#1a1512', background: 'none', borderRadius: '10px' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <select value={specialite} onChange={e => { setSpecialite(e.target.value); fetchAll(e.target.value, search) }} style={{ ...selectStyle, flex: isMobile ? '1' : 'auto' }}>
              {SPECIALITES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={geolocalize} disabled={locLoading} style={{ padding: '10px 14px', borderRadius: '10px', background: userPos ? '#e8f5f1' : '#fdf8ec', color: userPos ? '#22816a' : '#c8992a', border: `1.5px solid ${userPos ? '#22816a' : '#c8992a'}`, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {locLoading ? '…' : userPos ? '📍 OK' : isMobile ? '📍' : 'Près de moi'}
            </button>
            <button onClick={() => fetchAll(specialite, search)} style={{ padding: '10px 20px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Rechercher
            </button>
          </div>
        </div>
        {locError && <div style={{ marginTop: '10px', background: 'rgba(192,57,43,0.15)', color: '#fdf0ee', padding: '10px 16px', borderRadius: '10px', fontSize: '0.82rem' }}>{locError}</div>}
        {userPos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Rayon :</span>
            {[5, 10, 20, 50].map(r => (
              <button key={r} onClick={() => setRayon(r)} style={{ padding: '4px 12px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: rayon === r ? '#2eb592' : 'rgba(255,255,255,0.1)', color: rayon === r ? '#0d2b22' : 'rgba(255,255,255,0.5)' }}>{r} km</button>
            ))}
            <button onClick={() => setShowMap(!showMap)} style={{ padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: showMap ? 'rgba(255,255,255,0.15)' : 'none', color: 'rgba(255,255,255,0.6)', marginLeft: 'auto' }}>
              {showMap ? 'Masquer carte' : 'Voir carte'}
            </button>
          </div>
        )}
      </div>

      {/* CARTE */}
      {showMap && mapReady && userPos !== null && (
        <div style={{ height: isMobile ? '250px' : '380px', borderBottom: '1px solid #f0ece2' }}>
          <MapComponent userPos={userPos} medecins={medecinsAfiltres} />
        </div>
      )}

      {/* RÉSULTATS */}
      <div style={{ padding: isMobile ? '20px 16px' : isTablet ? '28px 32px' : '32px 48px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 600, color: '#0d2b22' }}>
            {loading ? 'Recherche en cours…' : `${totalResultats} résultat${totalResultats > 1 ? 's' : ''}`}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {([
              { id: 'tous', label: 'Tous', count: medecinsAfiltres.length + cliniquesAfiltres.length },
              { id: 'medecins', label: isMobile ? 'Médecins' : 'Médecins', count: medecinsAfiltres.length },
              { id: 'cliniques', label: 'Cliniques', count: cliniquesAfiltres.length },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setTypeFiltre(f.id)} style={{ padding: '6px 12px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, background: typeFiltre === f.id ? '#0d2b22' : '#f0ece2', color: typeFiltre === f.id ? 'white' : '#7a7260' }}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          {userPos && (
            <button onClick={() => { setUserPos(null); setShowMap(false); setMapReady(false) }} style={{ padding: '6px 12px', borderRadius: '8px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#7a7260' }}>
              {isMobile ? '✕ Géoloc' : 'Désactiver la géolocalisation'}
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>Chargement…
          </div>
        ) : totalResultats === 0 ? (
          <div style={{ textAlign: 'center', padding: isMobile ? '40px 20px' : '60px', background: 'white', borderRadius: '16px', border: '1px solid #f0ece2' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#0d2b22', marginBottom: '8px' }}>
              {userPos ? `Aucun résultat dans un rayon de ${rayon} km` : 'Aucun résultat trouvé'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#a8a090', marginBottom: '16px' }}>Essayez d'autres critères</div>
            {userPos && (
              <button onClick={() => setRayon(50)} style={{ padding: '10px 22px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Élargir à 50 km</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {(typeFiltre === 'tous' || typeFiltre === 'cliniques') && cliniquesAfiltres.length > 0 && (
              <div>
                {typeFiltre === 'tous' && (
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0ece2' }}>
                    Établissements de santé ({cliniquesAfiltres.length})
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {cliniquesAfiltres.map((clin: any) => (
                    <CliniqueCard key={clin.id} clinique={clin} onOpen={() => openCliniquePanel(clin)} />
                  ))}
                </div>
              </div>
            )}
            {(typeFiltre === 'tous' || typeFiltre === 'medecins') && medecinsAfiltres.length > 0 && (
              <div>
                {typeFiltre === 'tous' && (
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0ece2' }}>
                    Médecins ({medecinsAfiltres.length})
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {medecinsAfiltres.map((med: any) => (
                    <MedecinCard key={med.id} med={med} onOpen={() => openPanel(med)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CliniqueCard({ clinique, onOpen }: { clinique: any, onOpen: () => void }) {
  const ICONS: Record<string, string> = { consultation: '🩺', hospitalisation: '🛏️', maternite: '🤱', imagerie: '🔬', laboratoire: '🧪', chirurgie: '⚕️', urgences: '🚨' }
  const services = (clinique.services || []).filter((s: any) => s.actif)
  const categories = [...new Set(services.map((s: any) => s.categorie))] as string[]
  return (
    <div onClick={onOpen} style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(13,43,34,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
      <div style={{ background: 'linear-gradient(135deg, #0d2b22, #1a4535)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(200,153,42,0.2)', border: '2px solid rgba(200,153,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🏥</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clinique.nom}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{clinique.region || 'Établissement de santé'}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)', flexShrink: 0 }}>
          {services.length} svc
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {categories.slice(0, 3).map((cat: string) => (
              <span key={cat} style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '50px', background: '#e8f5f1', color: '#22816a', fontWeight: 600 }}>
                {ICONS[cat] || '⚕️'} {CATEGORIES_CLINIQUE.find(c => c.id === cat)?.label?.split(' ')[0]}
              </span>
            ))}
            {categories.length > 3 && <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '50px', background: '#f0ece2', color: '#7a7260', fontWeight: 600 }}>+{categories.length - 3}</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {clinique.adresse && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#7a7260' }}><span>📍</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clinique.adresse}</span></div>}
          {clinique.distance !== undefined && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22816a', fontWeight: 600 }}><span>📍</span>{clinique.distance < 1 ? Math.round(clinique.distance * 1000) + 'm' : clinique.distance.toFixed(1) + 'km'}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
          <span style={{ fontSize: '0.72rem', color: '#a8a090' }}>Voir et réserver</span>
          <span style={{ fontSize: '1rem', color: '#22816a', fontWeight: 700 }}>→</span>
        </div>
      </div>
    </div>
  )
}

function MedecinCard({ med, onOpen }: { med: any, onOpen: () => void }) {
  return (
    <div onClick={onOpen} style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(13,43,34,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
      <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Avatar url={med.profil?.avatar_url} prenom={med.profil?.prenom} nom={med.profil?.nom} role="medecin" size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Dr. {med.profil?.prenom} {med.profil?.nom}
            </div>
            {med.verifie && <span style={{ background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.3)', flexShrink: 0 }}>✓</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '3px' }}>{med.specialite}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {med.distance !== undefined && (
            <div style={{ background: 'rgba(46,181,146,0.2)', color: '#2eb592', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '50px', border: '1px solid rgba(46,181,146,0.2)', whiteSpace: 'nowrap' }}>
              {med.distance < 1 ? Math.round(med.distance * 1000) + 'm' : med.distance.toFixed(1) + 'km'}
            </div>
          )}
          {med.note_moyenne > 0 && <div style={{ color: '#e6b84a', fontSize: '0.8rem', fontWeight: 700, marginTop: '4px' }}>★ {med.note_moyenne}</div>}
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
          {med.adresse && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#7a7260' }}><span>📍</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.adresse}</span></div>}
          {med.tarif && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#7a7260' }}><span>💰</span>{Number(med.tarif).toLocaleString()} Ar</div>}
        </div>
        {med.presentation && <p style={{ fontSize: '0.78rem', color: '#7a7260', lineHeight: 1.5, margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{med.presentation}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#a8a090' }}>Voir le profil et prendre RDV</span>
          <span style={{ fontSize: '1rem', color: '#22816a', fontWeight: 700 }}>→</span>
        </div>
      </div>
    </div>
  )
}

function RechercheRdvForm({ med, user, userProfil, supabase, router, onBooked }: any) {
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
    if (!user) { router.push('/login'); return }
    if (!selectedDate || !selectedTime) return
    setBooking(true)
    const dateRdvISO = toLocalISO(selectedDate, selectedTime)
    const { data: patient } = await supabase.from('patients').select('id').eq('id', user.id).single()
    if (!patient) await supabase.from('patients').insert({ id: user.id })
    const { error } = await supabase.from('rendez_vous').insert({ medecin_id: med.id, patient_id: user.id, date_rdv: dateRdvISO, motif, statut: 'en_attente' })
    if (!error) {
      const patientNom = userProfil ? userProfil.prenom + ' ' + userProfil.nom : 'Un patient'
      const [annee, mois, jour] = selectedDate.split('-').map(Number)
      const dateFormatee = new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      await supabase.from('notifications').insert({ user_id: med.id, type: 'nouveau_rdv', titre: 'Nouvelle demande de rendez-vous', corps: `${patientNom} souhaite un RDV le ${dateFormatee} à ${selectedTime.replace(':', 'h')}${motif ? ' — Motif : ' + motif : ''}.` })
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
      <div style={{ fontSize: '0.78rem', color: '#22816a', lineHeight: 1.5 }}>Le médecin va confirmer votre RDV.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ background: '#fdf8ec', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c8992a', marginBottom: '2px' }}>Dr. {med?.profil?.prenom} {med?.profil?.nom}</div>
        <div style={{ fontSize: '0.72rem', color: '#a8906a' }}>{med?.specialite}{med?.tarif ? ' · ' + Number(med.tarif).toLocaleString() + ' Ar' : ''}</div>
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
                <button key={c} onClick={() => setSelectedTime(c)} style={{ padding: '6px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: selectedTime === c ? '#22816a' : '#f0ece2', color: selectedTime === c ? 'white' : '#0d2b22' }}>
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
      {!user && (
        <div style={{ background: '#fdf8ec', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)', fontSize: '0.78rem', color: '#c8992a', textAlign: 'center' }}>
          Vous devez être connecté pour réserver.
          <span onClick={() => router.push('/login')} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', marginLeft: '4px' }}>Se connecter</span>
        </div>
      )}
      <button onClick={book} disabled={!selectedDate || !selectedTime || booking}
        style={{ padding: '11px', borderRadius: '10px', border: 'none', cursor: (!selectedDate || !selectedTime || booking) ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem', background: (!selectedDate || !selectedTime) ? '#cfc5ae' : '#0d2b22', color: 'white' }}>
        {booking ? 'Envoi en cours…' : !selectedDate ? 'Choisissez une date' : !selectedTime ? 'Choisissez un créneau' : user ? 'Confirmer le rendez-vous' : 'Se connecter pour réserver'}
      </button>
    </div>
  )
}