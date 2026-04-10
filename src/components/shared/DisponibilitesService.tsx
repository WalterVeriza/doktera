'use client'

import { useEffect, useState } from 'react'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DUREES = [15, 20, 30, 45, 60]

type DispoService = {
  id?: string
  jour_semaine: number
  heure_debut: string
  heure_fin: string
  duree_creneau?: number
  actif: boolean
}

function genererCreneaux(debut: string, fin: string, duree: number): string[] {
  const creneaux: string[] = []
  const [hd, md] = debut.split(':').map(Number)
  const [hf, mf] = fin.split(':').map(Number)
  let total = hd * 60 + md
  const finMin = hf * 60 + mf
  while (total + duree <= finMin) {
    const h = Math.floor(total / 60).toString().padStart(2, '0')
    const m = (total % 60).toString().padStart(2, '0')
    creneaux.push(`${h}:${m}`)
    total += duree
  }
  return creneaux
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

export default function DisponibilitesService({ service, supabase }: {
  service: any
  supabase: any
}) {
  const modePlage = service.mode_reservation === 'plage'
  const [dispos, setDispos] = useState<DispoService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [jourPreview, setJourPreview] = useState<number | null>(null)

  // Blocages ponctuels
  const [creneauxManuels, setCreneauxManuels] = useState<any[]>([])
  const [showBlocageManuel, setShowBlocageManuel] = useState(false)
  const [showTousManuels, setShowTousManuels] = useState(false)
  const [savingBlocage, setSavingBlocage] = useState(false)
  const [blocageManuelForm, setBlocageManuelForm] = useState({
    date: '', creneauxSelectionnes: [] as string[], motif: 'Indisponible',
  })
  const [creneauxDuJour, setCreneauxDuJour] = useState<string[]>([])

  // Blocages récurrents
  const [showBlocageRecurrent, setShowBlocageRecurrent] = useState(false)
  const [savingRecurrent, setSavingRecurrent] = useState(false)
  const [blocageRecurrentForm, setBlocageRecurrentForm] = useState({
    heure_debut: '12:00', duree: 60, motif: 'Pause déjeuner',
    jours: [0, 1, 2, 3, 4] as number[], semaines: 4,
  })

  // Congés / absences
  const [creneauxBloques, setCreneauxBloques] = useState<any[]>([])
  const [showConges, setShowConges] = useState(false)
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' })

  useEffect(() => { load() }, [service.id])

  const load = async () => {
    setLoading(true)

    const { data: d } = await supabase
      .from('clinique_disponibilites')
      .select('*')
      .eq('service_id', service.id)
      .order('jour_semaine')

    const { data: bm } = await supabase
      .from('clinique_creneaux_manuels')
      .select('*')
      .eq('service_id', service.id)
      .gte('date_creneau', new Date().toISOString())
      .order('date_creneau')

    const { data: b } = await supabase
      .from('clinique_creneaux_bloques')
      .select('*')
      .eq('service_id', service.id)
      .gte('date_fin', new Date().toISOString())
      .order('date_debut')

    const disposInit: DispoService[] = JOURS.map((_, i) => {
      const existing = d?.find((x: any) => x.jour_semaine === i)
      return existing || {
        jour_semaine: i,
        heure_debut: '08:00',
        heure_fin: '17:00',
        duree_creneau: service.duree_minutes || 30,
        actif: i < 5,
      }
    })

    setDispos(disposInit)
    setCreneauxManuels(bm || [])
    setCreneauxBloques(b || [])
    setLoading(false)
  }

  const updateDispo = (jour: number, field: keyof DispoService, value: any) => {
    setDispos(prev => prev.map(d => d.jour_semaine === jour ? { ...d, [field]: value } : d))
  }

  const save = async () => {
    setSaving(true)
    for (const dispo of dispos) {
      const payload: any = {
        service_id: service.id,
        jour_semaine: dispo.jour_semaine,
        heure_debut: dispo.heure_debut,
        heure_fin: dispo.heure_fin,
        actif: dispo.actif,
      }
      if (!modePlage) payload.duree_creneau = dispo.duree_creneau || service.duree_minutes || 30

      if (dispo.id) {
        await supabase.from('clinique_disponibilites').update(payload).eq('id', dispo.id)
      } else if (dispo.actif) {
        const { data: inserted } = await supabase.from('clinique_disponibilites').insert(payload).select().single()
        if (inserted) setDispos(prev => prev.map(d => d.jour_semaine === dispo.jour_semaine ? { ...d, id: inserted.id } : d))
      }
    }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
    load()
  }

  // ── BLOCAGE PONCTUEL ───────────────────────────────────────────────────────
  const onDateBlocageManuel = (dateStr: string) => {
    setBlocageManuelForm({ ...blocageManuelForm, date: dateStr, creneauxSelectionnes: [] })
    if (!dateStr) { setCreneauxDuJour([]); return }
    const [annee, mois, jour] = dateStr.split('-').map(Number)
    const date = new Date(annee, mois - 1, jour, 12, 0, 0)
    const jourJS = date.getDay()
    const jourSemaine = jourJS === 0 ? 6 : jourJS - 1
    const dispo = dispos.find(d => d.jour_semaine === jourSemaine && d.actif)
    if (!dispo) { setCreneauxDuJour([]); return }
    if (modePlage) {
      setCreneauxDuJour(['matin', 'après-midi', 'soir'].filter(p => {
        const [h] = dispo.heure_debut.split(':').map(Number)
        const [hf] = dispo.heure_fin.split(':').map(Number)
        if (p === 'matin') return h < 12
        if (p === 'après-midi') return h < 17 && hf > 12
        return hf > 17
      }))
    } else {
      setCreneauxDuJour(genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau || service.duree_minutes || 30))
    }
  }

  const toggleCreneau = (c: string) => {
    const sel = blocageManuelForm.creneauxSelectionnes
    setBlocageManuelForm({
      ...blocageManuelForm,
      creneauxSelectionnes: sel.includes(c) ? sel.filter(x => x !== c) : [...sel, c],
    })
  }

  const ajouterBlocagesManuel = async () => {
    if (!blocageManuelForm.date || blocageManuelForm.creneauxSelectionnes.length === 0) return
    setSavingBlocage(true)
    const inserts = blocageManuelForm.creneauxSelectionnes.map(creneau => ({
      service_id: service.id,
      date_creneau: modePlage ? toLocalISO(blocageManuelForm.date, '00:00') + '_' + creneau : toLocalISO(blocageManuelForm.date, creneau),
      motif: blocageManuelForm.motif,
    }))
    // Pour le mode plage, on stocke la plage dans date_creneau sous forme spéciale
    const insertsFinaux = blocageManuelForm.creneauxSelectionnes.map(creneau => ({
      service_id: service.id,
      date_creneau: modePlage
        ? (() => { const [a, mo, j] = blocageManuelForm.date.split('-').map(Number); return new Date(a, mo - 1, j, creneau === 'matin' ? 6 : creneau === 'après-midi' ? 13 : 18, 0).toISOString() })()
        : toLocalISO(blocageManuelForm.date, creneau),
      motif: blocageManuelForm.motif,
    }))
    const { error } = await supabase.from('clinique_creneaux_manuels').insert(insertsFinaux)
    if (error) {
      console.error('Erreur blocage manuel:', error.message)
    } else {
      console.log(`✅ ${insertsFinaux.length} créneau(x) bloqué(s)`)
      setBlocageManuelForm({ date: '', creneauxSelectionnes: [], motif: 'Indisponible' })
      setCreneauxDuJour([])
      setShowBlocageManuel(false)
    }
    setSavingBlocage(false)
    setTimeout(() => setSaved(true), 4000)
    load()
  }

  const supprimerBlocageManuel = async (id: string) => {
    await supabase.from('clinique_creneaux_manuels').delete().eq('id', id)
    load()
  }

  const supprimerTousBlocagesManuels = async () => {
    if (!confirm(`Supprimer tous les ${creneauxManuels.length} créneaux bloqués ?`)) return
    for (const b of creneauxManuels) {
      await supabase.from('clinique_creneaux_manuels').delete().eq('id', b.id)
    }
    load()
  }

  // ── BLOCAGE RÉCURRENT ──────────────────────────────────────────────────────
  const toggleJourRecurrent = (jour: number) => {
    const jours = blocageRecurrentForm.jours
    setBlocageRecurrentForm({
      ...blocageRecurrentForm,
      jours: jours.includes(jour) ? jours.filter(j => j !== jour) : [...jours, jour],
    })
  }

  const ajouterBlocageRecurrent = async () => {
    setSavingRecurrent(true)
    const inserts: any[] = []
    const aujourd = new Date()
    aujourd.setHours(0, 0, 0, 0)

    for (let semaine = 0; semaine < blocageRecurrentForm.semaines; semaine++) {
      for (const jour of blocageRecurrentForm.jours) {
        const jourJS = jour === 6 ? 0 : jour + 1
        const jourActuelJS = new Date().getDay()
        let diff = jourJS - jourActuelJS
        if (semaine === 0 && diff <= 0) diff += 7
        if (semaine > 0) diff += semaine * 7
        const date = new Date(aujourd)
        date.setDate(aujourd.getDate() + diff)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const dispo = dispos.find(d => d.jour_semaine === jour && d.actif)
        if (!dispo) continue
        if (modePlage) {
          const [h] = blocageRecurrentForm.heure_debut.split(':').map(Number)
          const plage = h < 12 ? 'matin' : h < 17 ? 'après-midi' : 'soir'
          const [a, mo, j] = dateStr.split('-').map(Number)
          inserts.push({
            service_id: service.id,
            date_creneau: new Date(a, mo - 1, j, plage === 'matin' ? 6 : plage === 'après-midi' ? 13 : 18, 0).toISOString(),
            motif: blocageRecurrentForm.motif,
          })
        } else {
          const creneauxJour = genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau || service.duree_minutes || 30)
          const [h, m] = blocageRecurrentForm.heure_debut.split(':').map(Number)
          const debutMin = h * 60 + m
          const finMin = debutMin + blocageRecurrentForm.duree
          for (const creneau of creneauxJour) {
            const [ch, cm] = creneau.split(':').map(Number)
            const creneauMin = ch * 60 + cm
            if (creneauMin >= debutMin && creneauMin < finMin) {
              inserts.push({ service_id: service.id, date_creneau: toLocalISO(dateStr, creneau), motif: blocageRecurrentForm.motif })
            }
          }
        }
      }
    }

    if (inserts.length === 0) {
      setSavingRecurrent(false)
      return
    }
    const { error } = await supabase.from('clinique_creneaux_manuels').insert(inserts)
    if (error) {
      console.error('Erreur blocage manuel:', error.message)
    } else {
 bloqué(s) sur ${blocageRecurrentForm.semaines} semaines`)
      setShowBlocageRecurrent(false)
    }
    setSavingRecurrent(false)
    setTimeout(() =>
, 5000)
    load()
  }

  // ── CONGÉS ────────────────────────────────────────────────────────────────
  const ajouterConge = async () => {
    if (!congeForm.date_debut || !congeForm.date_fin) return
    await supabase.from('clinique_creneaux_bloques').insert({
      service_id: service.id,
      date_debut: new Date(congeForm.date_debut).toISOString(),
      date_fin: new Date(congeForm.date_fin).toISOString(),
      motif: congeForm.motif,
    })
    setCongeForm({ date_debut: '', date_fin: '', motif: '' })
    setShowConges(false)
    load()
  }

  const supprimerConge = async (id: string) => {
    await supabase.from('clinique_creneaux_bloques').delete().eq('id', id)
    load()
  }

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>⏳ Chargement…</div>
  )

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px',
  }
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', background: '#faf8f4', border: '1.5px solid #f0ece2',
    borderRadius: '8px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem',
    color: '#1a1512', outline: 'none',
  }

  const dispoActive = dispos.filter(d => d.actif)
  const totalCreneaux = modePlage ? dispoActive.length : dispoActive.reduce((acc, d) =>
    acc + genererCreneaux(d.heure_debut, d.heure_fin, d.duree_creneau || service.duree_minutes || 30).length, 0)

  const manuelsParDate = creneauxManuels.reduce((acc: Record<string, any[]>, b) => {
    const dateKey = new Date(b.date_creneau).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(b)
    return acc
  }, {})
  const datesManuels = Object.entries(manuelsParDate)
  const LIMIT_DATES = 3
  const datesAffichees = showTousManuels ? datesManuels : datesManuels.slice(0, LIMIT_DATES)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {debugMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: debugMsg.startsWith('✅') ? '#e8f5f1' : '#fdf0ee', color: debugMsg.startsWith('✅') ? '#22816a' : '#c0392b', fontWeight: 600, fontSize: '0.85rem' }}>
          {debugMsg}
        </div>
      )}

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Jours actifs', value: dispoActive.length, color: '#22816a' },
          { label: modePlage ? 'Plages / semaine' : 'Créneaux / semaine', value: totalCreneaux, color: '#0d2b22' },
          { label: 'Congés prévus', value: creneauxBloques.length, color: '#c8992a' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #f0ece2' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* HORAIRES PAR JOUR */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: '#0d2b22' }}>
              {modePlage ? 'Jours & heures d\'ouverture' : 'Horaires & créneaux'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '2px' }}>
              {modePlage
                ? 'Définissez les jours où le service est disponible et ses horaires'
                : 'Les créneaux sont générés automatiquement selon la durée du service'}
            </div>
          </div>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>
            {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : 'Enregistrer'}
          </button>
        </div>

        <div style={{ padding: '8px 0' }}>
          {dispos.map(dispo => {
            const creneaux = !modePlage ? genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau || service.duree_minutes || 30) : []
            const isPreview = jourPreview === dispo.jour_semaine
            return (
              <div key={dispo.jour_semaine} style={{ borderBottom: '1px solid #f0ece2', opacity: dispo.actif ? 1 : 0.5 }}>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {/* Toggle actif */}
                  <div onClick={() => updateDispo(dispo.jour_semaine, 'actif', !dispo.actif)}
                    style={{ width: '38px', height: '21px', borderRadius: '50px', background: dispo.actif ? '#22816a' : '#e0d8cc', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: '3px', left: dispo.actif ? '19px' : '3px', width: '15px', height: '15px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <div style={{ width: '76px', fontWeight: 600, fontSize: '0.86rem', color: '#0d2b22', flexShrink: 0 }}>
                    {JOURS[dispo.jour_semaine]}
                  </div>
                  {dispo.actif ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>De</label>
                        <input type="time" value={dispo.heure_debut} onChange={e => updateDispo(dispo.jour_semaine, 'heure_debut', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>À</label>
                        <input type="time" value={dispo.heure_fin} onChange={e => updateDispo(dispo.jour_semaine, 'heure_fin', e.target.value)} style={inputStyle} />
                      </div>
                      {!modePlage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Durée</label>
                          <select value={dispo.duree_creneau || service.duree_minutes || 30}
                            onChange={e => updateDispo(dispo.jour_semaine, 'duree_creneau', Number(e.target.value))}
                            style={inputStyle}>
                            {DUREES.map(d => <option key={d} value={d}>{d} min</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                        {!modePlage && (
                          <span style={{ fontSize: '0.72rem', color: '#7a7260', fontWeight: 600 }}>
                            {creneaux.length} créneau{creneaux.length > 1 ? 'x' : ''}
                          </span>
                        )}
                        {modePlage && (
                          <span style={{ fontSize: '0.72rem', color: '#7a7260', fontWeight: 600 }}>
                            {(() => {
                              const [h] = dispo.heure_debut.split(':').map(Number)
                              const [hf] = dispo.heure_fin.split(':').map(Number)
                              const plages = []
                              if (h < 12) plages.push('🌅 Matin')
                              if (h < 17 && hf > 12) plages.push('☀️ Ap-m')
                              if (hf > 17) plages.push('🌆 Soir')
                              return plages.join(' · ')
                            })()}
                          </span>
                        )}
                        {!modePlage && (
                          <button onClick={() => setJourPreview(isPreview ? null : dispo.jour_semaine)}
                            style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, background: isPreview ? '#0d2b22' : '#f0ece2', color: isPreview ? 'white' : '#7a7260' }}>
                            {isPreview ? 'Masquer' : 'Aperçu'}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#a8a090', fontStyle: 'italic' }}>Jour non disponible</span>
                  )}
                </div>
                {isPreview && dispo.actif && !modePlage && (
                  <div style={{ padding: '0 20px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {creneaux.map(c => (
                        <span key={c} style={{ padding: '3px 9px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', fontSize: '0.72rem', fontWeight: 600, border: '1px solid rgba(34,129,106,0.2)' }}>
                          {c.replace(':', 'h')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* BLOCAGES RÉCURRENTS */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: '#0d2b22' }}>Blocages récurrents</div>
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '2px' }}>Pause déjeuner, réunion hebdo — s'applique sur plusieurs semaines</div>
          </div>
          <button onClick={() => setShowBlocageRecurrent(!showBlocageRecurrent)}
            style={{ padding: '7px 14px', borderRadius: '10px', background: showBlocageRecurrent ? '#f0ece2' : '#c8992a', color: showBlocageRecurrent ? '#0d2b22' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.78rem' }}>
            {showBlocageRecurrent ? 'Annuler' : '⟳ Bloquer en récurrent'}
          </button>
        </div>

        {showBlocageRecurrent && (
          <div style={{ padding: '16px 20px', background: '#faf8f4', borderBottom: '1px solid #f0ece2' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: modePlage ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Motif</label>
                  <select value={blocageRecurrentForm.motif} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, motif: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                    <option>Pause déjeuner</option>
                    <option>Réunion</option>
                    <option>Formation</option>
                    <option>Indisponible</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{modePlage ? 'Plage à bloquer' : 'Heure de début'}</label>
                  {modePlage ? (
                    <select value={blocageRecurrentForm.heure_debut} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, heure_debut: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                      <option value="06:00">🌅 Matin</option>
                      <option value="13:00">☀️ Après-midi</option>
                      <option value="18:00">🌆 Soir</option>
                    </select>
                  ) : (
                    <input type="time" value={blocageRecurrentForm.heure_debut} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, heure_debut: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                  )}
                </div>
                {!modePlage && (
                  <div>
                    <label style={labelStyle}>Durée</label>
                    <select value={blocageRecurrentForm.duree} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, duree: Number(e.target.value) })} style={{ ...inputStyle, width: '100%' }}>
                      <option value={30}>30 min</option>
                      <option value={60}>1 heure</option>
                      <option value={90}>1h30</option>
                      <option value={120}>2 heures</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Jours concernés</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {JOURS.map((jour, i) => {
                    const selected = blocageRecurrentForm.jours.includes(i)
                    return (
                      <button key={i} onClick={() => toggleJourRecurrent(i)} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: selected ? '#0d2b22' : '#f0ece2', color: selected ? 'white' : '#7a7260' }}>
                        {jour.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Appliquer sur</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[2, 4, 8, 12].map(s => (
                    <button key={s} onClick={() => setBlocageRecurrentForm({ ...blocageRecurrentForm, semaines: s })} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: blocageRecurrentForm.semaines === s ? '#22816a' : '#f0ece2', color: blocageRecurrentForm.semaines === s ? 'white' : '#7a7260' }}>
                      {s} sem.
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={ajouterBlocageRecurrent} disabled={savingRecurrent || blocageRecurrentForm.jours.length === 0}
                style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: blocageRecurrentForm.jours.length === 0 ? '#cfc5ae' : '#c8992a', color: 'white', cursor: blocageRecurrentForm.jours.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem', alignSelf: 'flex-start' }}>
                {savingRecurrent ? '⏳ Application…' : `Appliquer sur ${blocageRecurrentForm.semaines} semaines →`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BLOCAGES PONCTUELS */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: '#0d2b22' }}>
              Créneaux bloqués ponctuellement
              {creneauxManuels.length > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 7px', borderRadius: '50px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                  {creneauxManuels.length} bloqué{creneauxManuels.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '2px' }}>Bloquez des créneaux spécifiques sur une date donnée</div>
          </div>
          <button onClick={() => setShowBlocageManuel(!showBlocageManuel)}
            style={{ padding: '7px 14px', borderRadius: '10px', background: showBlocageManuel ? '#f0ece2' : '#22816a', color: showBlocageManuel ? '#0d2b22' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.78rem' }}>
            {showBlocageManuel ? 'Annuler' : '+ Bloquer des créneaux'}
          </button>
        </div>

        {showBlocageManuel && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', background: '#faf8f4' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={blocageManuelForm.date} min={new Date().toISOString().split('T')[0]}
                    onChange={e => onDateBlocageManuel(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>Motif</label>
                  <select value={blocageManuelForm.motif} onChange={e => setBlocageManuelForm({ ...blocageManuelForm, motif: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                    <option>Indisponible</option>
                    <option>Pause déjeuner</option>
                    <option>Réunion</option>
                    <option>Formation</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>

              {blocageManuelForm.date && creneauxDuJour.length === 0 && (
                <div style={{ padding: '10px 12px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.8rem', color: '#c8992a' }}>
                  ⚠ Aucun créneau configuré pour ce jour — activez d'abord ce jour dans les horaires et cliquez sur <strong>Enregistrer</strong>
                </div>
              )}

              {creneauxDuJour.length > 0 && (
                <div>
                  <label style={labelStyle}>
                    {modePlage ? 'Plages à bloquer' : 'Créneaux à bloquer'}
                    <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '6px', color: '#22816a' }}>(cliquez pour sélectionner)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {creneauxDuJour.map(c => {
                      const selected = blocageManuelForm.creneauxSelectionnes.includes(c)
                      const label = modePlage
                        ? (c === 'matin' ? '🌅 Matin' : c === 'après-midi' ? '☀️ Après-midi' : '🌆 Soir')
                        : c.replace(':', 'h')
                      return (
                        <button key={c} onClick={() => toggleCreneau(c)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: selected ? '#c0392b' : '#f0ece2', color: selected ? 'white' : '#0d2b22' }}>
                          {selected ? '✕ ' : ''}{label}
                        </button>
                      )
                    })}
                  </div>
                  {blocageManuelForm.creneauxSelectionnes.length > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#c0392b', fontWeight: 600 }}>
                      {blocageManuelForm.creneauxSelectionnes.length} sélectionné{blocageManuelForm.creneauxSelectionnes.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}

              <button onClick={ajouterBlocagesManuel} disabled={savingBlocage || blocageManuelForm.creneauxSelectionnes.length === 0}
                style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: blocageManuelForm.creneauxSelectionnes.length === 0 ? '#cfc5ae' : '#0d2b22', color: 'white', cursor: blocageManuelForm.creneauxSelectionnes.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem', alignSelf: 'flex-start' }}>
                {savingBlocage ? '⏳ Enregistrement…' : `Bloquer ${blocageManuelForm.creneauxSelectionnes.length > 0 ? blocageManuelForm.creneauxSelectionnes.length + ' créneau(x)' : 'les créneaux'} →`}
              </button>
            </div>
          </div>
        )}

        {creneauxManuels.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>
            Aucun créneau bloqué ponctuellement
          </div>
        ) : (
          <div>
            {datesAffichees.map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <div style={{ padding: '9px 20px', background: '#faf8f4', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d2b22', textTransform: 'capitalize' }}>📅 {dateLabel}</div>
                  <span style={{ fontSize: '0.65rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 7px', borderRadius: '50px', fontWeight: 700 }}>
                    {items.length} bloqué{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ padding: '9px 20px 12px', display: 'flex', flexWrap: 'wrap', gap: '7px', borderBottom: '1px solid #f0ece2' }}>
                  {items.map((b: any) => {
                    const d = new Date(b.date_creneau)
                    const h = d.getHours()
                    const label = modePlage
                      ? (h < 12 ? '🌅 Matin' : h < 17 ? '☀️ Après-midi' : '🌆 Soir')
                      : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px 4px 11px', borderRadius: '8px', background: '#fdf0ee', border: '1px solid rgba(192,57,43,0.15)' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c0392b' }}>{label}</span>
                        <span style={{ fontSize: '0.65rem', color: '#7a7260' }}>— {b.motif}</span>
                        <button onClick={() => supprimerBlocageManuel(b.id)} style={{ marginLeft: '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(192,57,43,0.15)', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {datesManuels.length > LIMIT_DATES && (
              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ece2' }}>
                <button onClick={() => setShowTousManuels(!showTousManuels)} style={{ padding: '6px 14px', borderRadius: '8px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                  {showTousManuels ? '▲ Réduire' : `▼ Voir tout (${datesManuels.length - LIMIT_DATES} de plus)`}
                </button>
                {creneauxManuels.length > 5 && (
                  <button onClick={supprimerTousBlocagesManuels} style={{ padding: '6px 14px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                    🗑 Tout supprimer ({creneauxManuels.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONGÉS */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.05rem', fontWeight: 600, color: '#0d2b22' }}>Fermetures & congés</div>
            <div style={{ fontSize: '0.72rem', color: '#a8a090', marginTop: '2px' }}>Bloquez des périodes entières — aucun créneau ne sera disponible</div>
          </div>
          <button onClick={() => setShowConges(!showConges)}
            style={{ padding: '7px 14px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22', border: '1px solid #e8e0cc', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.78rem' }}>
            {showConges ? 'Annuler' : '+ Ajouter une fermeture'}
          </button>
        </div>

        {showConges && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece2', background: '#faf8f4' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Début</label>
                <input type="datetime-local" value={congeForm.date_debut} onChange={e => setCongeForm({ ...congeForm, date_debut: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Fin</label>
                <input type="datetime-local" value={congeForm.date_fin} onChange={e => setCongeForm({ ...congeForm, date_fin: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Motif (optionnel)</label>
                <input value={congeForm.motif} onChange={e => setCongeForm({ ...congeForm, motif: e.target.value })} placeholder="Ex: Fermeture annuelle…" style={{ ...inputStyle, width: '100%' }} />
              </div>
              <button onClick={ajouterConge} disabled={!congeForm.date_debut || !congeForm.date_fin}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#0d2b22', color: 'white', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                Ajouter →
              </button>
            </div>
          </div>
        )}

        {creneauxBloques.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>Aucune fermeture planifiée</div>
        ) : (
          <div>
            {creneauxBloques.map(b => (
              <div key={b.id} style={{ padding: '13px 20px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#fdf8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🏖️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#0d2b22' }}>
                    {new Date(b.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} → {new Date(b.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {b.motif && <div style={{ fontSize: '0.72rem', color: '#7a7260', marginTop: '2px' }}>{b.motif}</div>}
                </div>
                <button onClick={() => supprimerConge(b.id)} style={{ padding: '4px 10px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}