'use client'

import { useEffect, useState } from 'react'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DUREES = [15, 20, 30, 45, 60]

type Dispo = {
  id?: string
  jour_semaine: number
  heure_debut: string
  heure_fin: string
  duree_creneau: number
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

/**
 * Construit un ISO string en heure LOCALE (sans conversion UTC)
 * Ex: dateStr = "2025-03-10", heure = "12:00" → "2025-03-10T12:00:00.000+03:00"
 */
function toLocalISO(dateStr: string, heure: string): string {
  const [annee, mois, jour] = dateStr.split('-').map(Number)
  const [h, m] = heure.split(':').map(Number)
  const d = new Date(annee, mois - 1, jour, h, m, 0, 0)
  // On retourne l'ISO avec offset local
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hOff = Math.floor(Math.abs(off) / 60).toString().padStart(2, '0')
  const mOff = (Math.abs(off) % 60).toString().padStart(2, '0')
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${annee}-${pad(mois)}-${pad(jour)}T${pad(h)}:${pad(m)}:00${sign}${hOff}:${mOff}`
}

export default function Disponibilites({ medecinId, supabase }: {
  medecinId: string
  supabase: any
}) {
  const [dispos, setDispos] = useState<Dispo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [jourPreview, setJourPreview] = useState<number | null>(null)

  const [creneauxBloques, setCreneauxBloques] = useState<any[]>([])
  const [creneauxManuels, setCreneauxManuels] = useState<any[]>([])

  // UI states
  const [showBlocage, setShowBlocage] = useState(false)
  const [showBlocageManuel, setShowBlocageManuel] = useState(false)
  const [showBlocageRecurrent, setShowBlocageRecurrent] = useState(false)
  const [showTousManuels, setShowTousManuels] = useState(false)

  const [blocageForm, setBlocageForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [blocageManuelForm, setBlocageManuelForm] = useState({
    date: '',
    creneauxSelectionnes: [] as string[],
    motif: 'Pause déjeuner',
  })
  const [blocageRecurrentForm, setBlocageRecurrentForm] = useState({
    heure_debut: '12:00',
    duree: 60,
    motif: 'Pause déjeuner',
    jours: [0, 1, 2, 3, 4] as number[],
    semaines: 4,
  })
  const [creneauxDuJour, setCreneauxDuJour] = useState<string[]>([])
  const [savingBlocage, setSavingBlocage] = useState(false)
  const [savingRecurrent, setSavingRecurrent] = useState(false)
  const [debugMsg, setDebugMsg] = useState('')

  useEffect(() => { load() }, [medecinId])

  const load = async () => {
    setLoading(true)

    const { data: d } = await supabase
      .from('disponibilites')
      .select('*')
      .eq('medecin_id', medecinId)
      .order('jour_semaine')

    const { data: b } = await supabase
      .from('creneaux_bloques')
      .select('*')
      .eq('medecin_id', medecinId)
      .gte('date_fin', new Date().toISOString())
      .order('date_debut')

    const { data: bm } = await supabase
      .from('creneaux_manuels')
      .select('*')
      .eq('medecin_id', medecinId)
      .gte('date_creneau', new Date().toISOString())
      .order('date_creneau')

    const disposInit: Dispo[] = JOURS.map((_, i) => {
      const existing = d?.find((x: any) => x.jour_semaine === i)
      return existing || {
        jour_semaine: i,
        heure_debut: '08:00',
        heure_fin: '17:00',
        duree_creneau: 30,
        actif: i < 5,
      }
    })

    setDispos(disposInit)
    setCreneauxBloques(b || [])
    setCreneauxManuels(bm || [])
    setLoading(false)
  }

  const updateDispo = (jour: number, field: keyof Dispo, value: any) => {
    setDispos(prev => prev.map(d => d.jour_semaine === jour ? { ...d, [field]: value } : d))
  }

  const save = async () => {
    setSaving(true)
    for (const dispo of dispos) {
      const payload = {
        medecin_id: medecinId,
        jour_semaine: dispo.jour_semaine,
        heure_debut: dispo.heure_debut,
        heure_fin: dispo.heure_fin,
        duree_creneau: dispo.duree_creneau,
        actif: dispo.actif,
      }
      await supabase.from('disponibilites').upsert(payload, { onConflict: 'medecin_id,jour_semaine' })
    }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
    load()
  }

  // ── ABSENCES ──────────────────────────────────────────
  const ajouterBlocage = async () => {
    if (!blocageForm.date_debut || !blocageForm.date_fin) return
    setSavingBlocage(true)
    await supabase.from('creneaux_bloques').insert({
      medecin_id: medecinId,
      date_debut: new Date(blocageForm.date_debut).toISOString(),
      date_fin: new Date(blocageForm.date_fin).toISOString(),
      motif: blocageForm.motif,
    })
    setBlocageForm({ date_debut: '', date_fin: '', motif: '' })
    setShowBlocage(false)
    setSavingBlocage(false)
    load()
  }

  const supprimerBlocage = async (id: string) => {
    await supabase.from('creneaux_bloques').delete().eq('id', id)
    load()
  }

  // ── BLOCAGE PONCTUEL ───────────────────────────────────
  const onDateBlocageManuel = (dateStr: string) => {
    setBlocageManuelForm({ ...blocageManuelForm, date: dateStr, creneauxSelectionnes: [] })
    if (!dateStr) { setCreneauxDuJour([]); return }

    // Calcul du jour de semaine en heure locale (évite le décalage UTC)
    const [annee, mois, jour] = dateStr.split('-').map(Number)
    const date = new Date(annee, mois - 1, jour, 12, 0, 0)
    const jourJS = date.getDay() // 0=Dim, 1=Lun...
    const jourSemaine = jourJS === 0 ? 6 : jourJS - 1 // 0=Lun...5=Sam

    const dispo = dispos.find(d => d.jour_semaine === jourSemaine && d.actif)
    if (!dispo) {
      setCreneauxDuJour([])
      return
    }
    setCreneauxDuJour(genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau))
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
    setDebugMsg('')

    // ✅ FIX : utilise l'heure locale, pas UTC
    const inserts = blocageManuelForm.creneauxSelectionnes.map(creneau => ({
      medecin_id: medecinId,
      date_creneau: toLocalISO(blocageManuelForm.date, creneau),
      motif: blocageManuelForm.motif,
    }))

    const { error } = await supabase.from('creneaux_manuels').insert(inserts)

    if (error) {
      setDebugMsg(`Erreur: ${error.message}`)
    } else {
      setDebugMsg(`✅ ${inserts.length} créneau(x) bloqué(s)`)
      setBlocageManuelForm({ date: '', creneauxSelectionnes: [], motif: 'Pause déjeuner' })
      setCreneauxDuJour([])
      setShowBlocageManuel(false)
    }

    setSavingBlocage(false)
    setTimeout(() => setDebugMsg(''), 4000)
    load()
  }

  // ── BLOCAGE RÉCURRENT ──────────────────────────────────
  const toggleJourRecurrent = (jour: number) => {
    const jours = blocageRecurrentForm.jours
    setBlocageRecurrentForm({
      ...blocageRecurrentForm,
      jours: jours.includes(jour) ? jours.filter(j => j !== jour) : [...jours, jour],
    })
  }

  const ajouterBlocageRecurrent = async () => {
    setSavingRecurrent(true)
    setDebugMsg('')

    const inserts: any[] = []
    const aujourd = new Date()
    aujourd.setHours(0, 0, 0, 0)

    for (let semaine = 0; semaine < blocageRecurrentForm.semaines; semaine++) {
      for (const jour of blocageRecurrentForm.jours) {
        // jour: 0=Lundi…5=Samedi / JS: 0=Dim,1=Lun…6=Sam
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

        const creneauxJour = genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau)
        const [h, m] = blocageRecurrentForm.heure_debut.split(':').map(Number)
        const debutMin = h * 60 + m
        const finMin = debutMin + blocageRecurrentForm.duree

        for (const creneau of creneauxJour) {
          const [ch, cm] = creneau.split(':').map(Number)
          const creneauMin = ch * 60 + cm
          if (creneauMin >= debutMin && creneauMin < finMin) {
            // ✅ FIX : heure locale
            inserts.push({
              medecin_id: medecinId,
              date_creneau: toLocalISO(dateStr, creneau),
              motif: blocageRecurrentForm.motif,
            })
          }
        }
      }
    }

    if (inserts.length === 0) {
      setDebugMsg('⚠ Aucun créneau trouvé — vérifiez que les jours sélectionnés sont actifs dans vos horaires')
      setSavingRecurrent(false)
      return
    }

    const { error } = await supabase.from('creneaux_manuels').insert(inserts)

    if (error) {
      setDebugMsg(`Erreur: ${error.message}`)
    } else {
      setDebugMsg(`✅ ${inserts.length} créneau(x) bloqué(s) sur ${blocageRecurrentForm.semaines} semaines`)
      setShowBlocageRecurrent(false)
    }

    setSavingRecurrent(false)
    setTimeout(() => setDebugMsg(''), 5000)
    load()
  }

  const supprimerBlocageManuel = async (id: string) => {
    await supabase.from('creneaux_manuels').delete().eq('id', id)
    load()
  }

  const supprimerTousBlocagesManuels = async () => {
    if (!confirm(`Supprimer tous les ${creneauxManuels.length} créneaux bloqués manuellement ?`)) return
    for (const b of creneauxManuels) {
      await supabase.from('creneaux_manuels').delete().eq('id', b.id)
    }
    load()
  }

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
      ⏳ Chargement…
    </div>
  )

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px',
  }
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', background: '#faf8f4',
    border: '1.5px solid #f0ece2', borderRadius: '8px',
    fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem',
    color: '#1a1512', outline: 'none',
  }

  const dispoActive = dispos.filter(d => d.actif)
  const totalCreneaux = dispoActive.reduce((acc, d) =>
    acc + genererCreneaux(d.heure_debut, d.heure_fin, d.duree_creneau).length, 0)

  // Grouper les créneaux manuels par date pour l'affichage
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

      {/* MESSAGE DEBUG */}
      {debugMsg && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: debugMsg.startsWith('✅') ? '#e8f5f1' : '#fdf0ee',
          color: debugMsg.startsWith('✅') ? '#22816a' : '#c0392b',
          fontWeight: 600, fontSize: '0.85rem',
        }}>
          {debugMsg}
        </div>
      )}

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Jours actifs', value: dispoActive.length, color: '#22816a' },
          { label: 'Créneaux / semaine', value: totalCreneaux, color: '#0d2b22' },
          { label: 'Absences prévues', value: creneauxBloques.length, color: '#c8992a' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #f0ece2' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a090', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── HORAIRES PAR JOUR ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Horaires hebdomadaires</div>
            <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Ces horaires s'appliquent chaque semaine, toute l'année</div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: '10px',
              background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22',
              color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem',
            }}
          >
            {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : 'Enregistrer'}
          </button>
        </div>

        <div style={{ padding: '8px 0' }}>
          {dispos.map(dispo => {
            const creneaux = genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau)
            const isPreview = jourPreview === dispo.jour_semaine
            return (
              <div key={dispo.jour_semaine} style={{ borderBottom: '1px solid #f0ece2', opacity: dispo.actif ? 1 : 0.5 }}>
                <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Toggle actif */}
                  <div
                    onClick={() => updateDispo(dispo.jour_semaine, 'actif', !dispo.actif)}
                    style={{
                      width: '40px', height: '22px', borderRadius: '50px',
                      background: dispo.actif ? '#22816a' : '#e0d8cc',
                      cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '3px',
                      left: dispo.actif ? '20px' : '3px',
                      width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>

                  <div style={{ width: '80px', fontWeight: 600, fontSize: '0.88rem', color: '#0d2b22', flexShrink: 0 }}>
                    {JOURS[dispo.jour_semaine]}
                  </div>

                  {dispo.actif ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>De</label>
                        <input type="time" value={dispo.heure_debut} onChange={e => updateDispo(dispo.jour_semaine, 'heure_debut', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>À</label>
                        <input type="time" value={dispo.heure_fin} onChange={e => updateDispo(dispo.jour_semaine, 'heure_fin', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Durée</label>
                        <select value={dispo.duree_creneau} onChange={e => updateDispo(dispo.jour_semaine, 'duree_creneau', Number(e.target.value))} style={inputStyle}>
                          {DUREES.map(d => <option key={d} value={d}>{d} min</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                        <span style={{ fontSize: '0.75rem', color: '#7a7260', fontWeight: 600 }}>{creneaux.length} créneau{creneaux.length > 1 ? 'x' : ''}</span>
                        <button
                          onClick={() => setJourPreview(isPreview ? null : dispo.jour_semaine)}
                          style={{
                            padding: '4px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                            background: isPreview ? '#0d2b22' : '#f0ece2',
                            color: isPreview ? 'white' : '#7a7260',
                          }}
                        >
                          {isPreview ? 'Masquer' : 'Aperçu'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#a8a090', fontStyle: 'italic' }}>Jour non travaillé</span>
                  )}
                </div>
                {isPreview && dispo.actif && (
                  <div style={{ padding: '0 22px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {creneaux.map(c => (
                        <span key={c} style={{ padding: '4px 10px', borderRadius: '8px', background: '#e8f5f1', color: '#22816a', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(34,129,106,0.2)' }}>
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

      {/* ── BLOCAGES RÉCURRENTS ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Blocages récurrents</div>
            <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Pause déjeuner, réunion hebdo — s'applique automatiquement sur plusieurs semaines</div>
          </div>
          <button
            onClick={() => setShowBlocageRecurrent(!showBlocageRecurrent)}
            style={{
              padding: '8px 16px', borderRadius: '10px',
              background: showBlocageRecurrent ? '#f0ece2' : '#c8992a',
              color: showBlocageRecurrent ? '#0d2b22' : 'white',
              border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem',
            }}
          >
            {showBlocageRecurrent ? 'Annuler' : '⟳ Bloquer en récurrent'}
          </button>
        </div>

        {showBlocageRecurrent && (
          <div style={{ padding: '18px 22px', background: '#faf8f4' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Motif</label>
                  <select value={blocageRecurrentForm.motif} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, motif: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                    <option>Pause déjeuner</option>
                    <option>Patient externe</option>
                    <option>Réunion</option>
                    <option>Formation</option>
                    <option>Indisponible</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Heure de début</label>
                  <input type="time" value={blocageRecurrentForm.heure_debut} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, heure_debut: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>Durée</label>
                  <select value={blocageRecurrentForm.duree} onChange={e => setBlocageRecurrentForm({ ...blocageRecurrentForm, duree: Number(e.target.value) })} style={{ ...inputStyle, width: '100%' }}>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2 heures</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Jours concernés</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {JOURS.map((jour, i) => {
                    const selected = blocageRecurrentForm.jours.includes(i)
                    return (
                      <button key={i} onClick={() => toggleJourRecurrent(i)} style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600,
                        background: selected ? '#0d2b22' : '#f0ece2',
                        color: selected ? 'white' : '#7a7260',
                        transition: 'all 0.1s',
                      }}>
                        {jour.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Appliquer sur</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[2, 4, 8, 12].map(s => (
                    <button key={s} onClick={() => setBlocageRecurrentForm({ ...blocageRecurrentForm, semaines: s })} style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem', fontWeight: 600,
                      background: blocageRecurrentForm.semaines === s ? '#22816a' : '#f0ece2',
                      color: blocageRecurrentForm.semaines === s ? 'white' : '#7a7260',
                    }}>
                      {s} semaines
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#e8f5f1', borderRadius: '10px', fontSize: '0.82rem', color: '#22816a', fontWeight: 500 }}>
                ℹ {blocageRecurrentForm.motif} de {blocageRecurrentForm.heure_debut} pendant {blocageRecurrentForm.duree >= 60 ? `${blocageRecurrentForm.duree / 60}h` : `${blocageRecurrentForm.duree} min`},
                les {blocageRecurrentForm.jours.sort().map(j => JOURS[j].slice(0, 3)).join(', ')},
                sur {blocageRecurrentForm.semaines} semaines
              </div>

              <button
                onClick={ajouterBlocageRecurrent}
                disabled={savingRecurrent || blocageRecurrentForm.jours.length === 0}
                style={{
                  padding: '10px 20px', borderRadius: '10px', border: 'none',
                  background: blocageRecurrentForm.jours.length === 0 ? '#cfc5ae' : '#c8992a',
                  color: 'white',
                  cursor: blocageRecurrentForm.jours.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem',
                  alignSelf: 'flex-start',
                }}
              >
                {savingRecurrent ? '⏳ Application en cours…' : `Appliquer sur ${blocageRecurrentForm.semaines} semaines →`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BLOCAGES PONCTUELS ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>
              Créneaux bloqués ponctuellement
              {creneauxManuels.length > 0 && (
                <span style={{ marginLeft: '10px', fontSize: '0.72rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 8px', borderRadius: '50px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                  {creneauxManuels.length} bloqué{creneauxManuels.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Pause midi, patient externe, réunion</div>
          </div>
          <button
            onClick={() => setShowBlocageManuel(!showBlocageManuel)}
            style={{
              padding: '8px 16px', borderRadius: '10px',
              background: showBlocageManuel ? '#f0ece2' : '#22816a',
              color: showBlocageManuel ? '#0d2b22' : 'white',
              border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem',
            }}
          >
            {showBlocageManuel ? 'Annuler' : '+ Bloquer des créneaux'}
          </button>
        </div>

        {/* Formulaire blocage ponctuel */}
        {showBlocageManuel && (
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', background: '#faf8f4' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    value={blocageManuelForm.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => onDateBlocageManuel(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Motif</label>
                  <select value={blocageManuelForm.motif} onChange={e => setBlocageManuelForm({ ...blocageManuelForm, motif: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                    <option>Pause déjeuner</option>
                    <option>Patient externe</option>
                    <option>Réunion</option>
                    <option>Formation</option>
                    <option>Indisponible</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>

              {blocageManuelForm.date && creneauxDuJour.length === 0 && (
                <div style={{ padding: '12px', background: '#fdf8ec', borderRadius: '10px', fontSize: '0.82rem', color: '#c8992a' }}>
                  ⚠ Aucun créneau configuré pour ce jour — vérifiez vos horaires et cliquez sur <strong>Enregistrer</strong> d'abord
                </div>
              )}

              {creneauxDuJour.length > 0 && (
                <div>
                  <label style={labelStyle}>
                    Sélectionnez les créneaux à bloquer
                    <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '6px', color: '#22816a' }}>(cliquez pour sélectionner)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {creneauxDuJour.map(c => {
                      const selected = blocageManuelForm.creneauxSelectionnes.includes(c)
                      return (
                        <button key={c} onClick={() => toggleCreneau(c)} style={{
                          padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 600,
                          background: selected ? '#c0392b' : '#f0ece2',
                          color: selected ? 'white' : '#0d2b22',
                          transition: 'all 0.1s',
                        }}>
                          {selected ? '✕ ' : ''}{c.replace(':', 'h')}
                        </button>
                      )
                    })}
                  </div>
                  {blocageManuelForm.creneauxSelectionnes.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#c0392b', fontWeight: 600 }}>
                      {blocageManuelForm.creneauxSelectionnes.length} créneau{blocageManuelForm.creneauxSelectionnes.length > 1 ? 'x' : ''} sélectionné{blocageManuelForm.creneauxSelectionnes.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={ajouterBlocagesManuel}
                disabled={savingBlocage || blocageManuelForm.creneauxSelectionnes.length === 0}
                style={{
                  padding: '10px 20px', borderRadius: '10px', border: 'none',
                  background: blocageManuelForm.creneauxSelectionnes.length === 0 ? '#cfc5ae' : '#0d2b22',
                  color: 'white',
                  cursor: blocageManuelForm.creneauxSelectionnes.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem',
                  alignSelf: 'flex-start',
                }}
              >
                {savingBlocage ? '⏳ Enregistrement…' : `Bloquer ${blocageManuelForm.creneauxSelectionnes.length > 0 ? blocageManuelForm.creneauxSelectionnes.length + ' créneau(x)' : 'les créneaux'} →`}
              </button>
            </div>
          </div>
        )}

        {/* ── LISTE GROUPÉE PAR DATE ── */}
        {creneauxManuels.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>
            Aucun créneau bloqué ponctuellement
          </div>
        ) : (
          <div>
            {datesAffichees.map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* En-tête de date */}
                <div style={{ padding: '10px 22px', background: '#faf8f4', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0d2b22', textTransform: 'capitalize' }}>
                    📅 {dateLabel}
                  </div>
                  <span style={{ fontSize: '0.68rem', background: '#fdf0ee', color: '#c0392b', padding: '2px 8px', borderRadius: '50px', fontWeight: 700 }}>
                    {items.length} bloqué{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                {/* Créneaux de cette date */}
                <div style={{ padding: '10px 22px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f0ece2' }}>
                  {items.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px 5px 12px', borderRadius: '8px', background: '#fdf0ee', border: '1px solid rgba(192,57,43,0.15)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c0392b' }}>
                        {new Date(b.date_creneau).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#7a7260' }}>— {b.motif}</span>
                      <button
                        onClick={() => supprimerBlocageManuel(b.id)}
                        style={{ marginLeft: '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(192,57,43,0.15)', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Bouton Voir plus / Voir moins */}
            {datesManuels.length > LIMIT_DATES && (
              <div style={{ padding: '14px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setShowTousManuels(!showTousManuels)}
                  style={{ padding: '7px 16px', borderRadius: '8px', background: '#f0ece2', color: '#0d2b22', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {showTousManuels
                    ? '▲ Réduire la liste'
                    : `▼ Voir tout (${datesManuels.length - LIMIT_DATES} date${datesManuels.length - LIMIT_DATES > 1 ? 's' : ''} de plus)`}
                </button>
                {creneauxManuels.length > 5 && (
                  <button
                    onClick={supprimerTousBlocagesManuels}
                    style={{ padding: '7px 16px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    🗑 Tout supprimer ({creneauxManuels.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ABSENCES / CONGÉS ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Absences & congés</div>
            <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Bloquez des périodes entières — aucun créneau ne sera disponible</div>
          </div>
          <button
            onClick={() => setShowBlocage(!showBlocage)}
            style={{
              padding: '8px 16px', borderRadius: '10px', background: '#f0ece2', color: '#0d2b22',
              border: '1px solid #e8e0cc', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem',
            }}
          >
            {showBlocage ? 'Annuler' : '+ Ajouter une absence'}
          </button>
        </div>

        {showBlocage && (
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2', background: '#faf8f4' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Date de début</label>
                <input type="datetime-local" value={blocageForm.date_debut} onChange={e => setBlocageForm({ ...blocageForm, date_debut: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Date de fin</label>
                <input type="datetime-local" value={blocageForm.date_fin} onChange={e => setBlocageForm({ ...blocageForm, date_fin: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Motif (optionnel)</label>
                <input value={blocageForm.motif} onChange={e => setBlocageForm({ ...blocageForm, motif: e.target.value })} placeholder="Ex: Congés, formation…" style={{ ...inputStyle, width: '100%' }} />
              </div>
              <button
                onClick={ajouterBlocage}
                disabled={savingBlocage || !blocageForm.date_debut || !blocageForm.date_fin}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0d2b22', color: 'white', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                Ajouter →
              </button>
            </div>
          </div>
        )}

        {creneauxBloques.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#a8a090', fontSize: '0.82rem' }}>Aucune absence planifiée</div>
        ) : (
          <div>
            {creneauxBloques.map(b => (
              <div key={b.id} style={{ padding: '14px 22px', borderBottom: '1px solid #f0ece2', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fdf8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🏖️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d2b22' }}>
                    {new Date(b.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} → {new Date(b.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {b.motif && <div style={{ fontSize: '0.75rem', color: '#7a7260', marginTop: '2px' }}>{b.motif}</div>}
                </div>
                <button onClick={() => supprimerBlocage(b.id)} style={{ padding: '5px 12px', borderRadius: '8px', background: '#fdf0ee', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
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