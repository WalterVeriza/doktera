'use client'

import { useEffect, useState } from 'react'
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

const PLANS_MEDECIN = [
  {
    id: 'essentiel', nom: 'Essentiel', prix: 15000, couleur: '#22816a',
    description: 'Pour démarrer votre présence en ligne',
    features: ['Profil public visible', 'Réservations en ligne', 'Agenda & disponibilités', 'Dashboard de base', 'Notifications patients'],
  },
  {
    id: 'pro', nom: 'Pro', prix: 30000, couleur: '#c8992a',
    description: 'Pour les médecins qui veulent aller plus loin',
    features: ['Tout Essentiel +', 'Messagerie directe patients', 'Dossiers médicaux', 'Analytiques & revenus', 'Support prioritaire'],
    recommande: true,
  },
]

const PLAN_CLINIQUE = {
  id: 'clinic', nom: 'Clinique', prix: 80000, couleur: '#0d2b22',
  description: 'Solution complète pour les établissements de santé',
  features: ['Profil clinique public', 'Gestion multi-services', 'Réservations créneaux & plages', 'Messagerie patients', 'Disponibilités par service', 'Dashboard complet'],
}

const MOYENS_PAIEMENT = [
  { id: 'mvola', nom: 'MVola', logo: '📱', numero: '038 08 162 55', nom_compte: 'Walter Hélène Aimé', couleur: '#e8174a' },
  { id: 'orange_money', nom: 'Orange Money', logo: '🟠', numero: '032 72 314 96', nom_compte: 'Walter Hélène Aimé', couleur: '#ff6900' },
]

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const width = useWindowWidth()
  const isMobile = width < 640
  const isTablet = width >= 640 && width < 1024

  const [role, setRole] = useState<'medecin' | 'clinique' | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [planSelectionne, setPlanSelectionne] = useState<string | null>(null)
  const [moyenSelectionne, setMoyenSelectionne] = useState<string | null>(null)
  const [etape, setEtape] = useState<'plans' | 'paiement' | 'confirmation'>('plans')
  const [form, setForm] = useState({ numero_envoi: '', reference: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [planActuel, setPlanActuel] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).single()
      if (!profil) { router.push('/login'); return }
      if (profil.role === 'medecin') {
        const { data: med } = await supabase.from('medecins').select('plan, specialite').eq('id', user.id).single()
        const { data: cl } = await supabase.from('cliniques').select('plan_actif').eq('admin_id', user.id).single()
        if (cl) {
          setRole('clinique')
          setPlanSelectionne('clinic')
          setPlanActuel(cl.plan_actif ? 'clinic' : null)
        } else {
          setRole('medecin')
          setPlanActuel(med?.plan || null)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const getPlanInfo = () => {
    if (role === 'clinique') return PLAN_CLINIQUE
    return PLANS_MEDECIN.find(p => p.id === planSelectionne) || null
  }

  const soumettrePaiement = async () => {
    if (!form.numero_envoi.trim() || !form.reference.trim() || !planSelectionne || !moyenSelectionne || !userId) return
    setSubmitting(true)
    const planInfo = getPlanInfo()
    await supabase.from('paiements').insert({
      user_id: userId, role, plan: planSelectionne,
      montant: planInfo?.prix, moyen: moyenSelectionne,
      numero_envoi: form.numero_envoi.trim(),
      reference: form.reference.trim(),
      statut: 'en_attente',
    })
    setSubmitting(false)
    setEtape('confirmation')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: 'white' }}>Chargement…</div>
    </div>
  )

  const planInfo = getPlanInfo()
  const moyenInfo = MOYENS_PAIEMENT.find(m => m.id === moyenSelectionne)

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: 'Outfit, sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: '#0d2b22', padding: isMobile ? '16px 20px' : '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => role === 'clinique' ? router.push('/dashboard/clinique') : router.push('/dashboard/medecin')}
          style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 600, color: 'white', letterSpacing: '-0.02em', cursor: 'pointer' }}>
          Rad<em style={{ color: '#2eb592' }}>oko</em>
        </div>
        <div onClick={() => role === 'clinique' ? router.push('/dashboard/clinique') : router.push('/dashboard/medecin')}
          style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          {isMobile ? '← Retour' : '← Retour au dashboard'}
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '28px 16px' : '48px 24px' }}>

        {/* ÉTAPE 1 — CHOIX DU PLAN */}
        {etape === 'plans' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: isMobile ? '28px' : '40px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '10px' }}>
                Choisissez votre plan
              </div>
              <div style={{ fontSize: '0.88rem', color: '#7a7260' }}>Paiement sécurisé via MVola ou Orange Money</div>
            </div>

            {/* Plans médecin */}
            {role === 'medecin' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                {PLANS_MEDECIN.map(plan => {
                  const estActuel = planActuel === plan.id
                  const selectionne = planSelectionne === plan.id
                  return (
                    <div key={plan.id} onClick={() => !estActuel && setPlanSelectionne(plan.id)} style={{
                      background: 'white', borderRadius: '20px', padding: isMobile ? '22px' : '28px',
                      border: `2px solid ${selectionne ? plan.couleur : '#f0ece2'}`,
                      cursor: estActuel ? 'default' : 'pointer', position: 'relative', overflow: 'hidden',
                      boxShadow: selectionne ? `0 8px 32px ${plan.couleur}22` : '0 2px 12px rgba(0,0,0,0.04)',
                      opacity: estActuel ? 0.6 : 1, transition: 'all 0.2s',
                    }}>
                      {plan.recommande && !estActuel && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#c8992a', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recommandé</div>
                      )}
                      {estActuel && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#22816a', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan actuel</div>
                      )}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: selectionne ? plan.couleur : '#f0ece2', transition: 'background 0.2s' }} />
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>{plan.nom}</div>
                      <div style={{ fontSize: '0.78rem', color: '#7a7260', marginBottom: '16px' }}>{plan.description}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 700, color: plan.couleur }}>{plan.prix.toLocaleString()}</span>
                        <span style={{ fontSize: '0.75rem', color: '#a8a090' }}>Ar / mois</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {plan.features.map(f => (
                          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#4a4035' }}>
                            <span style={{ color: plan.couleur, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                          </div>
                        ))}
                      </div>
                      {selectionne && (
                        <div style={{ marginTop: '20px', padding: '10px', borderRadius: '10px', background: `${plan.couleur}15`, border: `1px solid ${plan.couleur}30`, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: plan.couleur }}>✓ Sélectionné</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Plan clinique */}
            {role === 'clinique' && (
              <div style={{ maxWidth: '480px', margin: '0 auto 32px' }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: isMobile ? '24px' : '32px', border: `2px solid ${PLAN_CLINIQUE.couleur}`, position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(13,43,34,0.15)' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: PLAN_CLINIQUE.couleur, color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {planActuel === 'clinic' ? 'Plan actuel' : 'Votre plan'}
                  </div>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: PLAN_CLINIQUE.couleur }} />
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>{PLAN_CLINIQUE.nom}</div>
                  <div style={{ fontSize: '0.78rem', color: '#7a7260', marginBottom: '16px' }}>{PLAN_CLINIQUE.description}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 700, color: PLAN_CLINIQUE.couleur }}>{PLAN_CLINIQUE.prix.toLocaleString()}</span>
                    <span style={{ fontSize: '0.75rem', color: '#a8a090' }}>Ar / mois</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    {PLAN_CLINIQUE.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#4a4035' }}>
                        <span style={{ color: PLAN_CLINIQUE.couleur, fontWeight: 700 }}>✓</span> {f}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px', borderRadius: '10px', background: `${PLAN_CLINIQUE.couleur}10`, border: `1px solid ${PLAN_CLINIQUE.couleur}30`, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: PLAN_CLINIQUE.couleur }}>✓ Sélectionné automatiquement</div>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => { if (planSelectionne) setEtape('paiement') }} disabled={!planSelectionne} style={{
                padding: '14px 40px', borderRadius: '12px',
                background: planSelectionne ? '#0d2b22' : '#cfc5ae',
                color: 'white', border: 'none',
                cursor: planSelectionne ? 'pointer' : 'not-allowed',
                fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem',
                width: isMobile ? '100%' : 'auto',
              }}>
                Continuer vers le paiement →
              </button>
              <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#a8a090' }}>Paiement vérifié manuellement par notre équipe sous 24h</div>
            </div>
          </>
        )}

        {/* ÉTAPE 2 — PAIEMENT */}
        {etape === 'paiement' && planInfo && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px', fontSize: '0.78rem', color: '#a8a090', flexWrap: 'wrap' }}>
              {role === 'medecin' && (
                <span onClick={() => setEtape('plans')} style={{ cursor: 'pointer', color: '#22816a' }}>← Changer de plan</span>
              )}
              {role === 'medecin' && <span>·</span>}
              <span style={{ fontWeight: 600, color: '#0d2b22' }}>Plan {planInfo.nom} — {planInfo.prix.toLocaleString()} Ar/mois</span>
            </div>

            {/* Sur mobile : colonne unique. Sur desktop : 2 colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 1fr', gap: '24px' }}>

              {/* MOYENS DE PAIEMENT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '4px' }}>
                  1. Choisissez votre moyen de paiement
                </div>
                {MOYENS_PAIEMENT.map(moyen => (
                  <div key={moyen.id} onClick={() => setMoyenSelectionne(moyen.id)} style={{
                    background: 'white', borderRadius: '16px', padding: '20px',
                    border: `2px solid ${moyenSelectionne === moyen.id ? moyen.couleur : '#f0ece2'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: moyenSelectionne === moyen.id ? `0 4px 20px ${moyen.couleur}22` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: moyenSelectionne === moyen.id ? '14px' : '0' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${moyen.couleur}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{moyen.logo}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0d2b22' }}>{moyen.nom}</div>
                        <div style={{ fontSize: '0.72rem', color: '#7a7260', marginTop: '1px' }}>Paiement mobile Madagascar</div>
                      </div>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${moyenSelectionne === moyen.id ? moyen.couleur : '#d0c8bc'}`, background: moyenSelectionne === moyen.id ? moyen.couleur : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {moyenSelectionne === moyen.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                      </div>
                    </div>
                    {moyenSelectionne === moyen.id && (
                      <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '16px', border: '1px solid #f0ece2' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Instructions de paiement</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'white', borderRadius: '8px', border: '1px solid #f0ece2' }}>
                            <div>
                              <div style={{ fontSize: '0.65rem', color: '#a8a090', fontWeight: 600, marginBottom: '2px' }}>Numéro {moyen.nom}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0d2b22', letterSpacing: '0.05em' }}>{moyen.numero}</div>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#7a7260' }}>{moyen.nom_compte}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: `${moyen.couleur}10`, borderRadius: '8px', border: `1px solid ${moyen.couleur}25` }}>
                            <div style={{ fontSize: '0.72rem', color: '#7a7260' }}>Montant exact à envoyer</div>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 700, color: moyen.couleur }}>{planInfo.prix.toLocaleString()} Ar</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#7a7260', lineHeight: 1.6 }}>
                          ⚠️ Envoyez <strong>exactement {planInfo.prix.toLocaleString()} Ar</strong>. Conservez votre référence de transaction.
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* FORMULAIRE */}
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '16px' }}>
                  2. Confirmez votre paiement
                </div>
                <div style={{ background: 'white', borderRadius: '16px', padding: isMobile ? '20px' : '24px', border: '1px solid #f0ece2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#faf8f4', borderRadius: '12px', padding: '14px 16px', border: '1px solid #f0ece2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Plan sélectionné</div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0d2b22' }}>Plan {planInfo.nom}</div>
                    </div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 700, color: '#22816a' }}>{planInfo.prix.toLocaleString()} Ar</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '6px' }}>Numéro d'envoi *</label>
                    <input value={form.numero_envoi} onChange={e => setForm({ ...form, numero_envoi: e.target.value })} placeholder="Ex: 034 12 345 67"
                      style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ fontSize: '0.68rem', color: '#a8a090', marginTop: '4px' }}>Le numéro depuis lequel vous avez envoyé le paiement</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a090', display: 'block', marginBottom: '6px' }}>Référence de transaction *</label>
                    <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Ex: TXN-XXXXXXXX"
                      style={{ width: '100%', padding: '10px 12px', background: '#faf8f4', border: '1.5px solid #f0ece2', borderRadius: '10px', fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#1a1512', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ fontSize: '0.68rem', color: '#a8a090', marginTop: '4px' }}>La référence reçue par SMS après votre transaction</div>
                  </div>
                  <div style={{ background: '#fdf8ec', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(200,153,42,0.2)', fontSize: '0.72rem', color: '#a8906a', lineHeight: 1.6 }}>
                    ℹ️ Notre équipe vérifiera votre paiement dans un délai de <strong>24h ouvrées</strong>. Votre plan sera activé automatiquement après validation.
                  </div>
                  <button onClick={soumettrePaiement} disabled={submitting || !form.numero_envoi.trim() || !form.reference.trim() || !moyenSelectionne}
                    style={{
                      padding: '13px', borderRadius: '12px',
                      background: (!form.numero_envoi.trim() || !form.reference.trim() || !moyenSelectionne) ? '#cfc5ae' : '#0d2b22',
                      color: 'white', border: 'none',
                      cursor: (!form.numero_envoi.trim() || !form.reference.trim() || !moyenSelectionne) ? 'not-allowed' : 'pointer',
                      fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem',
                    }}>
                    {submitting ? '⏳ Envoi en cours…' : '✅ Soumettre ma demande de paiement'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 3 — CONFIRMATION */}
        {etape === 'confirmation' && (
          <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '36px 24px' : '48px 40px', border: '1px solid #f0ece2', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 20px' }}>✅</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.4rem' : '1.6rem', fontWeight: 600, color: '#0d2b22', marginBottom: '10px' }}>Demande envoyée !</div>
              <div style={{ fontSize: '0.85rem', color: '#7a7260', lineHeight: 1.7, marginBottom: '28px' }}>
                Votre demande a bien été reçue. Notre équipe va vérifier votre transaction et activer votre plan <strong>Plan {planInfo?.nom}</strong> sous <strong>24h ouvrées</strong>.
              </div>
              <div style={{ background: '#fdf8ec', borderRadius: '14px', padding: '16px 20px', border: '1px solid rgba(200,153,42,0.2)', marginBottom: '28px', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a8a090', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Récapitulatif</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { label: 'Plan', value: `Plan ${planInfo?.nom}` },
                    { label: 'Montant', value: `${planInfo?.prix.toLocaleString()} Ar` },
                    { label: 'Moyen', value: moyenInfo?.nom || '' },
                    { label: 'Numéro d\'envoi', value: form.numero_envoi },
                    { label: 'Référence', value: form.reference },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: '#7a7260' }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: '#0d2b22' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => role === 'clinique' ? router.push('/dashboard/clinique') : router.push('/dashboard/medecin')}
                style={{ padding: '13px 32px', borderRadius: '12px', background: '#0d2b22', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', width: isMobile ? '100%' : 'auto' }}>
                Retour au dashboard →
              </button>
              <div style={{ marginTop: '16px', fontSize: '0.72rem', color: '#a8a090' }}>Une notification vous sera envoyée dès la validation de votre paiement.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}