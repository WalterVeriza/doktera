'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const CATEGORIES = [
  { id: 'consultation', label: 'Consultations spécialisées', icon: '🩺' },
  { id: 'hospitalisation', label: 'Hospitalisations', icon: '🛏️' },
  { id: 'maternite', label: 'Maternité & gynécologie', icon: '🤱' },
  { id: 'imagerie', label: 'Imagerie médicale', icon: '🔬' },
  { id: 'laboratoire', label: 'Analyses & laboratoire', icon: '🧪' },
  { id: 'chirurgie', label: 'Chirurgie', icon: '⚕️' },
  { id: 'urgences', label: 'Urgences', icon: '🚨' },
  { id: 'pediatrie', label: 'Pédiatrie', icon: '👶' },
  { id: 'cardiologie', label: 'Cardiologie', icon: '❤️' },
  { id: 'neurologie', label: 'Neurologie', icon: '🧠' },
  { id: 'ophtalmologie', label: 'Ophtalmologie', icon: '👁️' },
  { id: 'orl', label: 'ORL', icon: '👂' },
  { id: 'dermatologie', label: 'Dermatologie', icon: '🫧' },
  { id: 'dentaire', label: 'Soins dentaires', icon: '🦷' },
  { id: 'orthopedie', label: 'Orthopédie', icon: '🦴' },
  { id: 'kinesitherapie', label: 'Kinésithérapie', icon: '💪' },
  { id: 'psychiatrie', label: 'Psychiatrie & santé mentale', icon: '🧘' },
  { id: 'nutrition', label: 'Nutrition & diététique', icon: '🥗' },
  { id: 'dialyse', label: 'Dialyse & néphrologie', icon: '💧' },
  { id: 'oncologie', label: 'Oncologie', icon: '🎗️' },
  { id: 'readaptation', label: 'Réadaptation & rééducation', icon: '🏃' },
  { id: 'vaccination', label: 'Vaccination & prévention', icon: '💉' },
  { id: 'pharmacie', label: 'Pharmacie & dispensation', icon: '💊' },
  { id: 'soins_infirmiers', label: 'Soins infirmiers', icon: '🩹' },
  { id: 'bloc_operatoire', label: 'Bloc opératoire', icon: '🔧' },
  { id: 'reanimation', label: 'Réanimation & soins intensifs', icon: '🫀' },
]

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

async function genererCreneauxDisponibles(
  supabase: any,
  service: any,
  dateStr: string
): Promise<{ slots: string[], heuresPrises: Set<string> }> {
  const date = new Date(dateStr + 'T12:00:00')
  const jourSemaine = (date.getDay() + 6) % 7

  const dispos = (service.disponibilites || []).filter(
    (d: any) => d.jour_semaine === jourSemaine
  )
  if (dispos.length === 0) return { slots: [], heuresPrises: new Set() }

  // Vérifier congés
  const debutJour = new Date(dateStr + 'T00:00:00').toISOString()
  const finJour = new Date(dateStr + 'T23:59:59').toISOString()
  const { data: conges } = await supabase
    .from('clinique_creneaux_bloques')
    .select('id')
    .eq('service_id', service.id)
    .lte('date_debut', finJour)
    .gte('date_fin', debutJour)
  if ((conges || []).length > 0) return { slots: [], heuresPrises: new Set() }

  const slotsSet = new Set<string>()
  for (const dispo of dispos) {
    const [hDebH, hDebM] = dispo.heure_debut.split(':').map(Number)
    const [hFinH, hFinM] = dispo.heure_fin.split(':').map(Number)
    let current = hDebH * 60 + hDebM
    const fin = hFinH * 60 + hFinM
    const duree = service.duree_minutes || 30
    while (current + duree <= fin) {
      const h = Math.floor(current / 60).toString().padStart(2, '0')
      const m = (current % 60).toString().padStart(2, '0')
      slotsSet.add(`${h}:${m}`)
      current += duree
    }
  }

  const { data: rdvsPris } = await supabase
    .from('clinique_rdvs')
    .select('heure')
    .eq('service_id', service.id)
    .eq('date', dateStr)
    .in('statut', ['en_attente', 'confirme'])

  // Blocages manuels
  const { data: blocagesManuels } = await supabase
    .from('clinique_creneaux_manuels')
    .select('date_creneau')
    .eq('service_id', service.id)
    .gte('date_creneau', debutJour)
    .lte('date_creneau', finJour)

  const heuresPrises = new Set<string>((rdvsPris || []).map((r: any) => r.heure?.slice(0, 5) as string))
  const heuresBloqueesManuel = new Set<string>(
    (blocagesManuels || []).map((b: any) => {
      const d = new Date(b.date_creneau)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    })
  )

  const slots = Array.from(slotsSet).sort().filter(s =>
    !heuresPrises.has(s) && !heuresBloqueesManuel.has(s)
  )
  return { slots, heuresPrises }
}

async function compterCreneauxParJour(
  supabase: any,
  service: any,
  dates: string[]
): Promise<Record<string, { total: number, restants: number }>> {
  if (dates.length === 0) return {}

  const { data: rdvsPris } = await supabase
    .from('clinique_rdvs')
    .select('date, heure')
    .eq('service_id', service.id)
    .in('date', dates)
    .in('statut', ['en_attente', 'confirme'])

  const prisPar: Record<string, number> = {}
  for (const r of rdvsPris || []) {
    prisPar[r.date] = (prisPar[r.date] || 0) + 1
  }

  // Blocages manuels
  const minDate = dates[0] + 'T00:00:00'
  const maxDate = dates[dates.length - 1] + 'T23:59:59'
  const { data: blocagesManuels } = await supabase
    .from('clinique_creneaux_manuels')
    .select('date_creneau')
    .eq('service_id', service.id)
    .gte('date_creneau', new Date(minDate).toISOString())
    .lte('date_creneau', new Date(maxDate).toISOString())

  const blocagesPar: Record<string, number> = {}
  for (const b of blocagesManuels || []) {
    const d = new Date(b.date_creneau)
    const dateStr = d.toISOString().split('T')[0]
    blocagesPar[dateStr] = (blocagesPar[dateStr] || 0) + 1
  }

  // Congés
  const { data: conges } = await supabase
    .from('clinique_creneaux_bloques')
    .select('date_debut, date_fin')
    .eq('service_id', service.id)
    .lte('date_debut', new Date(maxDate).toISOString())
    .gte('date_fin', new Date(minDate).toISOString())

  const result: Record<string, { total: number, restants: number }> = {}
  for (const dateStr of dates) {
    // Congé ce jour ?
    const estEnConge = (conges || []).some((c: any) => {
      const debut = new Date(c.date_debut)
      const fin = new Date(c.date_fin)
      const d = new Date(dateStr + 'T12:00:00')
      return d >= debut && d <= fin
    })
    if (estEnConge) { result[dateStr] = { total: 0, restants: 0 }; continue }

    const date = new Date(dateStr + 'T12:00:00')
    const jourSemaine = (date.getDay() + 6) % 7
    const dispos = (service.disponibilites || []).filter((d: any) => d.jour_semaine === jourSemaine)

    const slotsSet = new Set<string>()
    for (const dispo of dispos) {
      const [hDebH, hDebM] = dispo.heure_debut.split(':').map(Number)
      const [hFinH, hFinM] = dispo.heure_fin.split(':').map(Number)
      let current = hDebH * 60 + hDebM
      const fin = hFinH * 60 + hFinM
      const duree = service.duree_minutes || 30
      while (current + duree <= fin) {
        const h = Math.floor(current / 60).toString().padStart(2, '0')
        const m = (current % 60).toString().padStart(2, '0')
        slotsSet.add(`${h}:${m}`)
        current += duree
      }
    }
    const total = slotsSet.size
    const pris = (prisPar[dateStr] || 0) + (blocagesPar[dateStr] || 0)
    result[dateStr] = { total, restants: Math.max(0, total - pris) }
  }
  return result
}

async function compterPlagesParJour(
  supabase: any,
  service: any,
  dates: string[]
): Promise<Record<string, { plages: string[], prises: string[] }>> {
  if (dates.length === 0) return {}

  const { data: rdvsPris } = await supabase
    .from('clinique_rdvs')
    .select('date, heure')
    .eq('service_id', service.id)
    .in('date', dates)
    .in('statut', ['en_attente', 'confirme'])

  const minDate = dates[0] + 'T00:00:00'
  const maxDate = dates[dates.length - 1] + 'T23:59:59'

  const { data: blocagesManuels } = await supabase
    .from('clinique_creneaux_manuels')
    .select('date_creneau')
    .eq('service_id', service.id)
    .gte('date_creneau', new Date(minDate).toISOString())
    .lte('date_creneau', new Date(maxDate).toISOString())

  const { data: conges } = await supabase
    .from('clinique_creneaux_bloques')
    .select('date_debut, date_fin')
    .eq('service_id', service.id)
    .lte('date_debut', new Date(maxDate).toISOString())
    .gte('date_fin', new Date(minDate).toISOString())

  const prisPar: Record<string, string[]> = {}
  for (const r of rdvsPris || []) {
    if (!prisPar[r.date]) prisPar[r.date] = []
    prisPar[r.date].push(r.heure)
  }

  const blocagesPar: Record<string, string[]> = {}
  for (const b of blocagesManuels || []) {
    const d = new Date(b.date_creneau)
    const dateStr = d.toISOString().split('T')[0]
    const h = d.getHours()
    const plage = h < 12 ? 'matin' : h < 17 ? 'après-midi' : 'soir'
    if (!blocagesPar[dateStr]) blocagesPar[dateStr] = []
    blocagesPar[dateStr].push(plage)
  }

  const result: Record<string, { plages: string[], prises: string[] }> = {}
  for (const dateStr of dates) {
    const estEnConge = (conges || []).some((c: any) => {
      const debut = new Date(c.date_debut)
      const fin = new Date(c.date_fin)
      const d = new Date(dateStr + 'T12:00:00')
      return d >= debut && d <= fin
    })
    if (estEnConge) { result[dateStr] = { plages: [], prises: [] }; continue }

    const date = new Date(dateStr + 'T12:00:00')
    const jourSemaine = (date.getDay() + 6) % 7
    const dispos = (service.disponibilites || []).filter((d: any) => d.jour_semaine === jourSemaine)

    const plages: string[] = []
    for (const dispo of dispos) {
      const [h] = dispo.heure_debut.split(':').map(Number)
      const [hf] = dispo.heure_fin.split(':').map(Number)
      if (h < 12) plages.push('matin')
      if (h < 17 && hf > 12) plages.push('après-midi')
      if (hf > 17) plages.push('soir')
    }

    const prises = [
      ...(prisPar[dateStr] || []),
      ...(blocagesPar[dateStr] || []),
    ]

    result[dateStr] = { plages: [...new Set(plages)], prises }
  }
  return result
}

export default function PageClinique({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [clinique, setClinique] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [serviceSelectionne, setServiceSelectionne] = useState<any>(null)
  const [filtreCategorie, setFiltreCategorie] = useState('tous')

  // Messagerie
  const [msgModal, setMsgModal] = useState(false)
  const [msgTexte, setMsgTexte] = useState('')
  const [msgEnvoye, setMsgEnvoye] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      const { data: c } = await supabase.from('cliniques').select('*').eq('id', id).single()
      if (!c) { setLoading(false); return }
      setClinique(c)
      const { data: svcs } = await supabase
        .from('clinique_services')
        .select('*, disponibilites:clinique_disponibilites(*)')
        .eq('clinique_id', id)
        .eq('actif', true)
        .order('categorie', { ascending: true })
      setServices(svcs || [])
      setLoading(false)
    }
    load()
  }, [id])

  const envoyerMessageClinique = async () => {
    if (!msgTexte.trim() || !user) return
    setSendingMsg(true)
    await supabase.from('clinique_messages').insert({
      clinique_id: clinique.id,
      patient_id: user.id,
      expediteur_type: 'patient',
      contenu: msgTexte.trim(),
      lu: false,
    })
    const { data: cl } = await supabase.from('cliniques').select('admin_id').eq('id', clinique.id).single()
    if (cl?.admin_id) {
      await supabase.from('notifications').insert({
        user_id: cl.admin_id,
        type: 'message_patient',
        titre: 'Nouveau message patient',
        corps: msgTexte.trim().slice(0, 100),
        lu: false,
      })
    }
    setSendingMsg(false)
    setMsgTexte('')
    setMsgEnvoye(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  if (!clinique) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '3rem' }}>🏥</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Clinique introuvable</div>
      <button onClick={() => router.push('/')} style={{ padding: '10px 24px', borderRadius: '10px', background: '#2eb592', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
        Retour à l'accueil
      </button>
    </div>
  )

  const categoriesPresentes = ['tous', ...Array.from(new Set(services.map(s => s.categorie)))]
  const servicesFiltres = filtreCategorie === 'tous' ? services : services.filter(s => s.categorie === filtreCategorie)

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: 'Outfit, sans-serif' }}>

      {/* NAV */}
      <nav style={{ background: '#0d2b22', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          Rad<em style={{ color: '#2eb592' }}>oko</em>
        </a>
        {user ? (
          <a href="/dashboard/patient" style={{ padding: '8px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
            Mon espace
          </a>
        ) : (
          <a href="/login" style={{ padding: '8px 18px', borderRadius: '10px', background: '#2eb592', color: 'white', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
            Connexion
          </a>
        )}
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0d2b22 0%, #1a4a35 100%)', padding: '52px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(46,181,146,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '28px', alignItems: 'center', position: 'relative' }}>
          <div style={{ width: '90px', height: '90px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {clinique.logo_url
              ? <img src={clinique.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span style={{ fontSize: '2.5rem' }}>🏥</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-block', background: 'rgba(200,153,42,0.2)', color: '#e6b84a', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', border: '1px solid rgba(200,153,42,0.2)' }}>
              Établissement de santé
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: 'white', lineHeight: 1.1, marginBottom: '10px' }}>
              {clinique.nom}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              {clinique.adresse && <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>📍 {clinique.adresse}{clinique.region ? ', ' + clinique.region : ''}</span>}
              {clinique.telephone && <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>📞 {clinique.telephone}</span>}
              {clinique.email && <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>✉️ {clinique.email}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 600, color: 'white', lineHeight: 1 }}>{services.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>service{services.length !== 1 ? 's' : ''} disponible{services.length !== 1 ? 's' : ''}</div>
            </div>
            {user && (
              <button onClick={() => setMsgModal(true)}
                style={{ padding: '9px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                💬 Contacter la clinique
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '36px 40px' }}>
        {clinique.description && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '24px 28px', marginBottom: '28px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '10px' }}>À propos</div>
            <div style={{ fontSize: '0.88rem', color: '#4a4438', lineHeight: 1.7 }}>{clinique.description}</div>
          </div>
        )}

        {services.length > 0 && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#0d2b22', marginBottom: '14px' }}>Nos services</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {categoriesPresentes.map(cat => {
                  const info = CATEGORIES.find(c => c.id === cat)
                  return (
                    <button key={cat} onClick={() => setFiltreCategorie(cat)}
                      style={{ padding: '6px 16px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: filtreCategorie === cat ? '#0d2b22' : '#f0ece2', color: filtreCategorie === cat ? 'white' : '#7a7260' }}>
                      {cat === 'tous' ? 'Tous les services' : (info ? info.icon + ' ' + info.label : cat)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {servicesFiltres.map(svc => (
                <CarteService key={svc.id} service={svc} onReserver={() => {
                  if (!user) { router.push('/login'); return }
                  setServiceSelectionne(svc)
                }} />
              ))}
            </div>
          </>
        )}

        {services.length === 0 && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚕️</div>
            <div style={{ fontSize: '0.85rem' }}>Aucun service disponible pour le moment</div>
          </div>
        )}
      </div>

      {/* PANEL RÉSERVATION */}
      {serviceSelectionne && (
        <PanelReservation
          service={serviceSelectionne}
          clinique={clinique}
          user={user}
          supabase={supabase}
          onClose={() => setServiceSelectionne(null)}
        />
      )}

      {/* MODAL MESSAGE */}
      {msgModal && (
        <>
          <div onClick={() => { setMsgModal(false); setMsgEnvoye(false); setMsgTexte('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '460px', background: 'white', borderRadius: '20px', zIndex: 101, overflow: 'hidden', boxShadow: '0 24px 80px rgba(13,43,34,0.25)' }}>
            <div style={{ background: 'linear-gradient(135deg, #0d2b22, #163d2f)', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Contacter {clinique.nom}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Votre message sera transmis à l'équipe</div>
              </div>
              <button onClick={() => { setMsgModal(false); setMsgEnvoye(false); setMsgTexte('') }}
                style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              {msgEnvoye ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>Message envoyé !</div>
                  <div style={{ fontSize: '0.82rem', color: '#7a7260', lineHeight: 1.6, marginBottom: '20px' }}>La clinique vous répondra dans votre espace patient, section Messagerie cliniques.</div>
                  <button onClick={() => { setMsgModal(false); setMsgEnvoye(false); setMsgTexte('') }}
                    style={{ padding: '10px 24px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Fermer</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <textarea
                    value={msgTexte}
                    onChange={e => setMsgTexte(e.target.value)}
                    rows={4}
                    placeholder="Bonjour, j'aimerais avoir des informations sur…"
                    style={{ width: '100%', padding: '12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={envoyerMessageClinique}
                    disabled={!msgTexte.trim() || sendingMsg}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: !msgTexte.trim() ? '#cfc5ae' : '#22816a', color: 'white', border: 'none', cursor: !msgTexte.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.88rem' }}>
                    {sendingMsg ? '⏳ Envoi…' : '💬 Envoyer le message'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── CARTE SERVICE ─────────────────────────────────────────────────────────────
function CarteService({ service, onReserver }: any) {
  const cat = CATEGORIES.find(c => c.id === service.categorie)
  const joursDispos = [...new Set((service.disponibilites || []).map((d: any) => d.jour_semaine))]
    .sort().map((j: any) => JOURS[j].slice(0, 3))
  const modePlage = service.mode_reservation === 'plage'

  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 22px', flex: 1 }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
            {cat?.icon || '⚕️'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d2b22', marginBottom: '2px' }}>{service.nom}</div>
            <div style={{ fontSize: '0.7rem', color: '#22816a', fontWeight: 600 }}>{cat?.label}</div>
          </div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '50px', background: modePlage ? '#fdf8ec' : '#e8f5f1', color: modePlage ? '#c8992a' : '#22816a', border: `1px solid ${modePlage ? 'rgba(200,153,42,0.2)' : 'rgba(34,129,106,0.2)'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {modePlage ? '🕐 Libre' : '📅 Créneau'}
          </div>
        </div>
        {service.description && <div style={{ fontSize: '0.78rem', color: '#7a7260', lineHeight: 1.6, marginBottom: '12px' }}>{service.description}</div>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!modePlage && service.duree_minutes && (
            <span style={{ fontSize: '0.72rem', color: '#7a7260', background: '#faf8f4', padding: '3px 10px', borderRadius: '50px', border: '1px solid #f0ece2' }}>⏱ {service.duree_minutes} min</span>
          )}
          {service.tarif && (
            <span style={{ fontSize: '0.72rem', color: '#c8992a', fontWeight: 700, background: '#fdf8ec', padding: '3px 10px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)' }}>{service.tarif.toLocaleString()} Ar</span>
          )}
        </div>
        {joursDispos.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px' }}>
            {joursDispos.map((j: string) => (
              <span key={j} style={{ fontSize: '0.65rem', fontWeight: 600, color: '#22816a', background: '#e8f5f1', padding: '2px 8px', borderRadius: '50px' }}>{j}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f0ece2', background: '#faf8f4' }}>
        {(service.disponibilites || []).length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: '#a8a090', textAlign: 'center' }}>Contactez la clinique</div>
        ) : (
          <button onClick={onReserver} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
            {modePlage ? 'Choisir un jour' : 'Réserver un créneau'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── PANEL RÉSERVATION ─────────────────────────────────────────────────────────
function PanelReservation({ service, clinique, user, supabase, onClose }: any) {
  const cat = CATEGORIES.find(c => c.id === service.categorie)
  const modePlage = service.mode_reservation === 'plage'

  const joursDisponibles = (() => {
    const joursAvecDispo = new Set((service.disponibilites || []).map((d: any) => d.jour_semaine))
    const dates: string[] = []
    const today = new Date()
    for (let i = 0; i < 60 && dates.length < 30; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const jourSemaine = (d.getDay() + 6) % 7
      if (joursAvecDispo.has(jourSemaine)) {
        dates.push(d.toISOString().split('T')[0])
      }
    }
    return dates
  })()

  const [dateSelectionnee, setDateSelectionnee] = useState<string | null>(null)
  const [heureSelectionnee, setHeureSelectionnee] = useState<string | null>(null)
  const [plageSelectionnee, setPlageSelectionnee] = useState<string | null>(null)
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [plagesDispo, setPlagesDispo] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)
  const [comptesParJour, setComptesParJour] = useState<Record<string, any>>({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    const charger = async () => {
      if (modePlage) {
        const res = await compterPlagesParJour(supabase, service, joursDisponibles)
        setComptesParJour(res)
      } else {
        const res = await compterCreneauxParJour(supabase, service, joursDisponibles)
        setComptesParJour(res)
      }
    }
    charger()
  }, [])

  const onDateChange = async (dateStr: string) => {
    setDateSelectionnee(dateStr)
    setHeureSelectionnee(null)
    setPlageSelectionnee(null)
    setCreneaux([])
    setPlagesDispo([])
    setLoadingCreneaux(true)
    if (modePlage) {
      const res = await compterPlagesParJour(supabase, service, [dateStr])
      const info = res[dateStr]
      if (info) setPlagesDispo(info.plages.filter((p: string) => !info.prises.includes(p)))
    } else {
      const { slots } = await genererCreneauxDisponibles(supabase, service, dateStr)
      setCreneaux(slots)
    }
    setLoadingCreneaux(false)
  }

  const jourEstComplet = (dateStr: string): boolean => {
    const info = comptesParJour[dateStr]
    if (!info) return false
    if (modePlage) return info.plages.length > 0 && info.plages.every((p: string) => info.prises.includes(p))
    return info.total > 0 && info.restants === 0
  }

  const confirmer = async () => {
    if (!dateSelectionnee) return
    if (!modePlage && !heureSelectionnee) return
    if (modePlage && !plageSelectionnee) return
    setSaving(true)

    const heureAInserer = modePlage ? plageSelectionnee! : heureSelectionnee! + ':00'
    const { data: conflit } = await supabase
      .from('clinique_rdvs')
      .select('id')
      .eq('service_id', service.id)
      .eq('date', dateSelectionnee)
      .eq('heure', heureAInserer)
      .in('statut', ['en_attente', 'confirme'])
      .maybeSingle()

    if (conflit) {
      setSaving(false)
      await onDateChange(dateSelectionnee)
      if (modePlage) {
        const res = await compterPlagesParJour(supabase, service, joursDisponibles)
        setComptesParJour(res)
      } else {
        const res = await compterCreneauxParJour(supabase, service, joursDisponibles)
        setComptesParJour(res)
      }
      alert('Ce créneau vient d\'être pris. Veuillez en choisir un autre.')
      return
    }

    await supabase.from('clinique_rdvs').insert({
      service_id: service.id,
      clinique_id: clinique.id,
      patient_id: user.id,
      date: dateSelectionnee,
      heure: heureAInserer,
      statut: 'en_attente',
      notes_patient: notes || null,
    })

    const { data: cl } = await supabase.from('cliniques').select('admin_id').eq('id', clinique.id).single()
    if (cl?.admin_id) {
      const dateFormatee = new Date(dateSelectionnee + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      const heureLabel = modePlage ? `(${plageSelectionnee})` : `à ${heureSelectionnee}`
      await supabase.from('notifications').insert({
        user_id: cl.admin_id,
        type: 'nouveau_rdv',
        titre: 'Nouvelle réservation 📅',
        corps: `Un patient a réservé ${service.nom} le ${dateFormatee} ${heureLabel}.`,
      })
    }

    setSaving(false)
    setSucces(true)
  }

  if (succes) return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px', background: 'white', zIndex: 101, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '40px', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✅</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: '#0d2b22', textAlign: 'center' }}>
          {modePlage ? 'Demande envoyée !' : 'Réservation envoyée !'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#7a7260', lineHeight: 1.7, textAlign: 'center' }}>
          Votre demande pour <strong>{service.nom}</strong><br />
          le {new Date(dateSelectionnee! + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {modePlage ? ` (${plageSelectionnee})` : ` à ${heureSelectionnee}`}<br />
          a bien été enregistrée. La clinique vous confirmera votre rendez-vous.
        </div>
        <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: '12px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Outfit, sans-serif' }}>
          Fermer
        </button>
      </div>
    </>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,34,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px', background: 'white', zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '20px 24px', background: '#0d2b22', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>{cat?.icon || '⚕️'}</span>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{service.nom}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{clinique.nom}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: modePlage ? '#e6b84a' : '#2eb592', background: modePlage ? 'rgba(200,153,42,0.2)' : 'rgba(46,181,146,0.15)', padding: '2px 10px', borderRadius: '50px' }}>
              {modePlage ? '🕐 Accès libre — choisissez votre créneau' : '📅 Rendez-vous fixe'}
            </span>
            {!modePlage && service.duree_minutes && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)', padding: '2px 10px', borderRadius: '50px' }}>⏱ {service.duree_minutes} min</span>
            )}
            {service.tarif && (
              <span style={{ fontSize: '0.7rem', color: '#e6b84a', background: 'rgba(200,153,42,0.2)', padding: '2px 10px', borderRadius: '50px' }}>💰 {service.tarif.toLocaleString()} Ar</span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '12px' }}>
              1 — Choisissez une date
            </div>
            {joursDisponibles.length === 0 ? (
              <div style={{ padding: '16px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>
                Aucune disponibilité configurée pour ce service
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {joursDisponibles.map(date => {
                  const d = new Date(date + 'T12:00:00')
                  const selectionne = dateSelectionnee === date
                  const complet = jourEstComplet(date)
                  const info = comptesParJour[date]
                  return (
                    <button key={date} onClick={() => !complet && onDateChange(date)} disabled={complet}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: '2px solid ' + (selectionne ? '#22816a' : complet ? '#f0ece2' : '#f0ece2'), background: selectionne ? '#e8f5f1' : complet ? '#faf8f4' : 'white', cursor: complet ? 'not-allowed' : 'pointer', textAlign: 'center', minWidth: '70px', opacity: complet ? 0.6 : 1 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: selectionne ? '#22816a' : complet ? '#cfc5ae' : '#a8a090', textTransform: 'uppercase' }}>
                        {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: selectionne ? '#22816a' : complet ? '#cfc5ae' : '#0d2b22', lineHeight: 1.2 }}>
                        {d.getDate()}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: selectionne ? '#22816a' : complet ? '#cfc5ae' : '#a8a090' }}>
                        {d.toLocaleDateString('fr-FR', { month: 'short' })}
                      </div>
                      {complet ? (
                        <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#dc3545', marginTop: '3px', textTransform: 'uppercase' }}>Complet</div>
                      ) : info && !modePlage && info.total > 0 ? (
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: info.restants <= 3 ? '#c8992a' : '#22816a', marginTop: '3px' }}>
                          {info.restants} dispo{info.restants > 1 ? 's' : ''}
                        </div>
                      ) : modePlage && info ? (
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22816a', marginTop: '3px' }}>
                          {info.plages.length} plage{info.plages.length > 1 ? 's' : ''}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {dateSelectionnee && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '12px' }}>
                {modePlage ? '2 — Choisissez une plage horaire' : '2 — Choisissez un créneau'}
                {loadingCreneaux && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '8px', color: '#a8a090' }}>chargement…</span>}
              </div>

              {modePlage && !loadingCreneaux && (
                <>
                  {plagesDispo.length === 0 ? (
                    <div style={{ padding: '16px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>
                      Toutes les plages sont complètes ce jour — essayez une autre date
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { id: 'matin', label: 'Matin', emoji: '🌅', desc: 'Avant 12h00' },
                        { id: 'après-midi', label: 'Après-midi', emoji: '☀️', desc: '12h00 – 17h00' },
                        { id: 'soir', label: 'Soir', emoji: '🌆', desc: 'Après 17h00' },
                      ].filter(p => plagesDispo.includes(p.id)).map(plage => (
                        <button key={plage.id} onClick={() => setPlageSelectionnee(plage.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', border: '2px solid ' + (plageSelectionnee === plage.id ? '#22816a' : '#f0ece2'), background: plageSelectionnee === plage.id ? '#e8f5f1' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontSize: '1.5rem' }}>{plage.emoji}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: plageSelectionnee === plage.id ? '#22816a' : '#0d2b22' }}>{plage.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a8a090' }}>{plage.desc}</div>
                          </div>
                          {plageSelectionnee === plage.id && (
                            <div style={{ marginLeft: 'auto', width: '20px', height: '20px', borderRadius: '50%', background: '#22816a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem' }}>✓</div>
                          )}
                        </button>
                      ))}
                      <div style={{ fontSize: '0.72rem', color: '#a8a090', padding: '8px 12px', background: '#faf8f4', borderRadius: '8px', lineHeight: 1.5 }}>
                        💡 La clinique gère les rendez-vous sur place dans l'ordre d'arrivée.
                      </div>
                    </div>
                  )}
                </>
              )}

              {!modePlage && !loadingCreneaux && (
                <>
                  {creneaux.length === 0 ? (
                    <div style={{ padding: '16px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a', textAlign: 'center' }}>
                      Aucun créneau disponible ce jour — essayez une autre date
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {creneaux.map((h, idx) => (
                        <button key={`${h}-${idx}`} onClick={() => setHeureSelectionnee(h)}
                          style={{ padding: '10px 6px', borderRadius: '10px', border: '2px solid ' + (heureSelectionnee === h ? '#22816a' : '#f0ece2'), background: heureSelectionnee === h ? '#e8f5f1' : 'white', color: heureSelectionnee === h ? '#22816a' : '#0d2b22', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {((modePlage && plageSelectionnee) || (!modePlage && heureSelectionnee)) && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '12px' }}>
                3 — Notes (optionnel)
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Ex: allergie au produit de contraste, ordonnance à joindre…"
                style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: '#1a1512', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {dateSelectionnee && (heureSelectionnee || plageSelectionnee) && (
            <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', border: '1px solid #f0ece2' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '10px' }}>Récapitulatif</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#a8a090' }}>Service</span>
                  <span style={{ color: '#0d2b22', fontWeight: 600 }}>{service.nom}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#a8a090' }}>Date</span>
                  <span style={{ color: '#0d2b22', fontWeight: 600 }}>
                    {new Date(dateSelectionnee + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#a8a090' }}>{modePlage ? 'Plage' : 'Heure'}</span>
                  <span style={{ color: '#22816a', fontWeight: 700 }}>
                    {modePlage ? (plageSelectionnee === 'matin' ? '🌅 Matin' : plageSelectionnee === 'après-midi' ? '☀️ Après-midi' : '🌆 Soir') : heureSelectionnee}
                  </span>
                </div>
                {service.tarif && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid #f0ece2', paddingTop: '6px', marginTop: '2px' }}>
                    <span style={{ color: '#a8a090' }}>Tarif estimé</span>
                    <span style={{ color: '#c8992a', fontWeight: 700 }}>{service.tarif.toLocaleString()} Ar</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ece2', flexShrink: 0 }}>
          <button onClick={confirmer}
            disabled={!dateSelectionnee || (!heureSelectionnee && !plageSelectionnee) || saving}
            style={{ width: '100%', padding: '13px', borderRadius: '12px', background: !dateSelectionnee || (!heureSelectionnee && !plageSelectionnee) || saving ? '#cfc5ae' : '#22816a', color: 'white', border: 'none', cursor: !dateSelectionnee || (!heureSelectionnee && !plageSelectionnee) || saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Outfit, sans-serif' }}>
            {saving ? '⏳ Vérification…' : '✓ Confirmer la réservation'}
          </button>
        </div>
      </div>
    </>
  )
}