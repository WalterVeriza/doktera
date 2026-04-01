'use client'

import { useEffect, useState } from 'react'

export default function DossierMedical({ patientId, supabase, isMedecin = false, medecinId }: {
  patientId: string
  supabase: any
  isMedecin?: boolean
  medecinId?: string
}) {
  const [patient, setPatient] = useState<any>(null)
  const [rdvs, setRdvs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('infos')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    groupe_sanguin: '',
    allergies: '',
    antecedents: '',
    date_naissance: '',
    poids: '',
    taille: '',
  })

  useEffect(() => { load() }, [patientId])

  const load = async () => {
    setLoading(true)

    const { data: p } = await supabase
      .from('patients')
      .select('*, profil:profils(*)')
      .eq('id', patientId)
      .single()

    let query = supabase
      .from('rendez_vous')
      .select('*, medecin:medecins(*, profil:profils(*))')
      .eq('patient_id', patientId)
      .eq('statut', 'termine')
      .order('date_rdv', { ascending: false })

    if (isMedecin && medecinId) {
      query = query.eq('medecin_id', medecinId)
    }

    const { data: r } = await query

    setPatient(p)
    setRdvs(r || [])
    if (p) {
      setForm({
        groupe_sanguin: p.groupe_sanguin || '',
        allergies: p.allergies || '',
        antecedents: p.antecedents || '',
        date_naissance: p.date_naissance || '',
        poids: p.poids || '',
        taille: p.taille || '',
      })
    }
    setLoading(false)
  }

  const saveInfos = async () => {
    setSaving(true)
    await supabase.from('patients').update({
      groupe_sanguin: form.groupe_sanguin,
      allergies: form.allergies,
      antecedents: form.antecedents,
      date_naissance: form.date_naissance || null,
      poids: form.poids ? Number(form.poids) : null,
      taille: form.taille ? Number(form.taille) : null,
    }).eq('id', patientId)
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const saveNotesMedecin = async (rdvId: string, data: any) => {
    await supabase.from('rendez_vous').update({
      notes_medecin: data.notes,
      diagnostic: data.diagnostic,
      ordonnance: data.ordonnance,
      examens: data.examens,
      analyses: data.analyses,
    }).eq('id', rdvId)
  }

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
      ⏳ Chargement du dossier…
    </div>
  )

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '5px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#faf8f4',
    border: '1.5px solid #f0ece2', borderRadius: '10px',
    fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem',
    color: '#1a1512', outline: 'none',
  }

  const tabs = [
    { id: 'infos', label: '📋 Informations' },
    { id: 'consultations', label: `🏥 Consultations (${rdvs.length})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* EN-TÊTE PATIENT */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0, overflow: 'hidden' }}>
          {patient?.profil?.avatar_url
            ? <img src={patient.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} alt="" />
            : <span style={{ fontSize: '1.4rem' }}>🧑</span>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22' }}>
            {patient?.profil?.prenom} {patient?.profil?.nom}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7a7260', marginTop: '2px' }}>
            {form.date_naissance && `Né(e) le ${new Date(form.date_naissance).toLocaleDateString('fr-FR')} · `}
            {form.groupe_sanguin && `Groupe sanguin : ${form.groupe_sanguin}`}
          </div>
          {isMedecin && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', background: '#fdf8ec', color: '#c8992a', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', border: '1px solid rgba(200,153,42,0.2)' }}>
              🔒 Vous ne voyez que vos propres consultations
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {form.poids && (
            <div style={{ textAlign: 'center', background: '#faf8f4', padding: '10px 16px', borderRadius: '12px', border: '1px solid #f0ece2' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#0d2b22' }}>{form.poids}</div>
              <div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600 }}>kg</div>
            </div>
          )}
          {form.taille && (
            <div style={{ textAlign: 'center', background: '#faf8f4', padding: '10px 16px', borderRadius: '12px', border: '1px solid #f0ece2' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#0d2b22' }}>{form.taille}</div>
              <div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600 }}>cm</div>
            </div>
          )}
          {form.groupe_sanguin && (
            <div style={{ textAlign: 'center', background: '#fdf0ee', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(192,57,43,0.1)' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#c0392b' }}>{form.groupe_sanguin}</div>
              <div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600 }}>sang</div>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 600,
            background: activeTab === tab.id ? '#0d2b22' : 'white',
            color: activeTab === tab.id ? 'white' : '#7a7260',
            border: `1px solid ${activeTab === tab.id ? '#0d2b22' : '#f0ece2'}`,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* TAB: INFOS */}
      {activeTab === 'infos' && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ece2' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: '#0d2b22' }}>Informations médicales</div>
            {!isMedecin && <div style={{ fontSize: '0.75rem', color: '#a8a090', marginTop: '2px' }}>Ces informations aident les médecins à mieux vous soigner</div>}
          </div>
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Date de naissance</label>
                <input type="date" value={form.date_naissance} onChange={e => setForm({ ...form, date_naissance: e.target.value })} disabled={isMedecin} style={{ ...inputStyle, opacity: isMedecin ? 0.6 : 1 }} />
              </div>
              <div>
                <label style={labelStyle}>Poids (kg)</label>
                <input type="number" value={form.poids} onChange={e => setForm({ ...form, poids: e.target.value })} placeholder="Ex: 70" disabled={isMedecin} style={{ ...inputStyle, opacity: isMedecin ? 0.6 : 1 }} />
              </div>
              <div>
                <label style={labelStyle}>Taille (cm)</label>
                <input type="number" value={form.taille} onChange={e => setForm({ ...form, taille: e.target.value })} placeholder="Ex: 170" disabled={isMedecin} style={{ ...inputStyle, opacity: isMedecin ? 0.6 : 1 }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Groupe sanguin</label>
              <select value={form.groupe_sanguin} onChange={e => setForm({ ...form, groupe_sanguin: e.target.value })} disabled={isMedecin} style={{ ...inputStyle, opacity: isMedecin ? 0.6 : 1 }}>
                <option value="">Non renseigné</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Allergies connues</label>
              <textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="Ex: Pénicilline, arachides, latex…" rows={2} disabled={isMedecin} style={{ ...inputStyle, resize: 'vertical', opacity: isMedecin ? 0.6 : 1 }} />
            </div>
            <div>
              <label style={labelStyle}>Antécédents médicaux</label>
              <textarea value={form.antecedents} onChange={e => setForm({ ...form, antecedents: e.target.value })} placeholder="Ex: Diabète type 2, hypertension…" rows={3} disabled={isMedecin} style={{ ...inputStyle, resize: 'vertical', opacity: isMedecin ? 0.6 : 1 }} />
            </div>
            {!isMedecin && (
              <button onClick={saveInfos} disabled={saving} style={{ padding: '10px 22px', borderRadius: '10px', background: saved ? '#22816a' : saving ? '#cfc5ae' : '#0d2b22', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>
                {saving ? '⏳ Sauvegarde…' : saved ? '✅ Sauvegardé !' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB: CONSULTATIONS */}
      {activeTab === 'consultations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {rdvs.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', padding: '60px', textAlign: 'center', color: '#a8a090' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏥</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', color: '#0d2b22', marginBottom: '6px' }}>
                {isMedecin ? 'Aucune consultation de votre part avec ce patient' : 'Aucune consultation terminée'}
              </div>
              <div style={{ fontSize: '0.82rem' }}>
                {isMedecin ? 'Seules vos propres consultations sont visibles ici.' : "L'historique apparaîtra ici après vos consultations."}
              </div>
            </div>
          ) : (
            rdvs.map(rdv => (
              <ConsultationCard key={rdv.id} rdv={rdv} isMedecin={isMedecin} onSave={saveNotesMedecin} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// CONSULTATION CARD
// ═══════════════════════════════════════════════════════
function ConsultationCard({ rdv, isMedecin, onSave }: any) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    notes: rdv.notes_medecin || '',
    diagnostic: rdv.diagnostic || '',
    ordonnance: rdv.ordonnance || '',
    examens: rdv.examens || '',
    analyses: rdv.analyses || '',
  })
  const [saving, setSaving] = useState(false)
  const med = rdv.medecin

  const save = async () => {
    setSaving(true)
    await onSave(rdv.id, form)
    setSaving(false)
    setEditing(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#faf8f4',
    border: '1.5px solid #f0ece2', borderRadius: '10px',
    fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem',
    color: '#1a1512', outline: 'none', resize: 'vertical' as const,
  }

  // Champs visibles par le médecin
  const champsMedian = [
    { key: 'diagnostic', label: '🩺 Diagnostic', emoji: '', rows: 2, placeholder: 'Diagnostic du médecin…', bg: '#faf8f4', border: '#f0ece2' },
    { key: 'notes', label: '📝 Notes du médecin', emoji: '', rows: 3, placeholder: 'Notes, observations…', bg: '#faf8f4', border: '#f0ece2' },
    { key: 'ordonnance', label: '💊 Ordonnance', emoji: '', rows: 4, placeholder: 'Médicaments prescrits, posologie…', bg: '#fdf8ec', border: 'rgba(200,153,42,0.2)' },
    { key: 'examens', label: '🔬 Examens', emoji: '', rows: 2, placeholder: 'Examens à réaliser…', bg: '#faf8f4', border: '#f0ece2' },
    { key: 'analyses', label: '🧪 Analyses', emoji: '', rows: 2, placeholder: 'Analyses à faire…', bg: '#faf8f4', border: '#f0ece2' },
  ]

  // Champs visibles par le patient (PAS le diagnostic)
  const champsPatient = [
    { key: 'ordonnance', label: '💊 Ordonnance / Prescriptions', rows: 4, bg: '#fdf8ec', border: 'rgba(200,153,42,0.2)' },
    { key: 'examens', label: '🔬 Examens à réaliser', rows: 2, bg: '#faf8f4', border: '#f0ece2' },
    { key: 'analyses', label: '🧪 Analyses à faire', rows: 2, bg: '#faf8f4', border: '#f0ece2' },
    { key: 'notes', label: '📝 Notes du médecin', rows: 3, bg: '#faf8f4', border: '#f0ece2' },
  ]

  const champs = isMedecin ? champsMedian : champsPatient

  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0ece2', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {med?.profil?.avatar_url
            ? <img src={med.profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <span style={{ fontSize: '1.2rem' }}>👨‍⚕️</span>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0d2b22' }}>
            Dr. {med?.profil?.prenom} {med?.profil?.nom}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7a7260' }}>
            {med?.specialite} · {new Date(rdv.date_rdv).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        {/* Badges résumé */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {isMedecin && rdv.diagnostic && <div style={{ background: '#e8f5f1', color: '#22816a', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px' }}>Diagnostic ✓</div>}
          {rdv.ordonnance && <div style={{ background: '#fdf8ec', color: '#c8992a', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px' }}>Ordonnance ✓</div>}
          {rdv.examens && <div style={{ background: '#f0f4ff', color: '#3b5bdb', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px' }}>Examens ✓</div>}
          {rdv.analyses && <div style={{ background: '#f3f0ff', color: '#7950f2', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px' }}>Analyses ✓</div>}
        </div>
        <div style={{ color: '#a8a090', fontSize: '0.8rem', marginLeft: '4px' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid #f0ece2' }}>
          <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {rdv.motif && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '5px' }}>Motif de consultation</div>
                <div style={{ fontSize: '0.85rem', color: '#1a1512', background: '#faf8f4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0ece2' }}>{rdv.motif}</div>
              </div>
            )}

            {champs.map(champ => {
              const val = form[champ.key as keyof typeof form]
              return (
                <div key={champ.key}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', marginBottom: '5px' }}>{champ.label}</div>
                  {editing && isMedecin ? (
                    <textarea
                      value={val}
                      onChange={e => setForm({ ...form, [champ.key]: e.target.value })}
                      rows={champ.rows}
                      style={inputStyle}
                      placeholder={(champ as any).placeholder || ''}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: val ? '#1a1512' : '#a8a090', background: champ.bg, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${champ.border}`, fontStyle: val ? 'normal' : 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {val || 'Non renseigné'}
                    </div>
                  )}
                </div>
              )
            })}

            {isMedecin && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {editing ? (
                  <>
                    <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: '10px', background: '#22816a', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>
                      {saving ? '⏳' : '✅ Sauvegarder'}
                    </button>
                    <button onClick={() => setEditing(false)} style={{ padding: '8px 18px', borderRadius: '10px', background: '#f0ece2', color: '#7a7260', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>Annuler</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={{ padding: '8px 18px', borderRadius: '10px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem' }}>✏️ Modifier la consultation</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}