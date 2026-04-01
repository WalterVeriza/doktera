'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

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

export default function LandingPage() {
  const width = useWindowWidth()
  const isMobile = width < 640
  const isTablet = width >= 640 && width < 1024
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <main style={{ fontFamily: 'Outfit, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: isMobile ? '14px 20px' : isTablet ? '16px 32px' : '18px 60px',
        display: 'flex', alignItems: 'center',
        background: 'rgba(250,248,244,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(13,43,34,0.06)',
      }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '1.5rem' : '1.7rem', fontWeight: 600, color: '#0d2b22', letterSpacing: '-0.02em' }}>
          Rad<em style={{ color: '#22816a' }}>oko</em>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', gap: '32px', marginLeft: '48px' }}>
            <span onClick={() => scrollTo('fonctionnalites')} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#7a7260', cursor: 'pointer' }}>Fonctionnalités</span>
            <span onClick={() => scrollTo('tarifs')} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#7a7260', cursor: 'pointer' }}>Tarifs</span>
            <span onClick={() => scrollTo('contact')} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#7a7260', cursor: 'pointer' }}>Contact</span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isMobile ? (
            <>
              <Link href="/login" style={{ padding: '8px 16px', borderRadius: '10px', background: '#0d2b22', fontSize: '0.8rem', fontWeight: 700, color: 'white', textDecoration: 'none' }}>
                Connexion
              </Link>
              <button onClick={() => setMenuOpen(!menuOpen)}
                style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0ece2', border: 'none', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {menuOpen ? '✕' : '☰'}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ padding: '8px 18px', borderRadius: '10px', border: '1.5px solid #cfc5ae', background: 'none', fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22', textDecoration: 'none' }}>
                Se connecter
              </Link>
              <Link href="/login" style={{ padding: '8px 20px', borderRadius: '10px', background: '#0d2b22', fontSize: '0.82rem', fontWeight: 700, color: 'white', textDecoration: 'none', boxShadow: '0 2px 8px rgba(13,43,34,0.2)' }}>
                Commencer gratuitement →
              </Link>
            </>
          )}
        </div>

        {isMobile && menuOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderBottom: '1px solid #f0ece2', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            <span onClick={() => scrollTo('fonctionnalites')} style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0d2b22', cursor: 'pointer', padding: '4px 0' }}>Fonctionnalités</span>
            <span onClick={() => scrollTo('tarifs')} style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0d2b22', cursor: 'pointer', padding: '4px 0' }}>Tarifs</span>
            <span onClick={() => scrollTo('contact')} style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0d2b22', cursor: 'pointer', padding: '4px 0' }}>Contact</span>
            <Link href="/recherche" onClick={() => setMenuOpen(false)} style={{ padding: '10px', borderRadius: '10px', background: '#2eb592', color: '#0d2b22', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
              Trouver un médecin →
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '100px 20px 60px' : isTablet ? '120px 32px 80px' : '120px 60px 80px',
        background: '#0d2b22',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 80% at 85% 40%, rgba(34,129,106,0.35) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 10% 70%, rgba(200,153,42,0.12) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: isMobile || isTablet ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '48px' : '40px' }}>
          <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(46,181,146,0.15)', border: '1px solid rgba(46,181,146,0.25)', color: '#2eb592', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '5px 14px', borderRadius: '50px', marginBottom: '28px' }}>
              🇲🇬 Première plateforme médicale de Madagascar
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '3rem' : isTablet ? '3.5rem' : '5rem', fontWeight: 600, color: 'white', lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: '24px' }}>
              La santé,<br /><em style={{ color: '#2eb592' }}>accessible</em><br />à tous.
            </h1>
            <p style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.6)', marginBottom: '40px', maxWidth: '500px', fontWeight: 300, margin: isMobile ? '0 auto 40px' : '0 0 40px' }}>
              Radoko connecte patients, médecins et cliniques à Madagascar. Trouvez un praticien, réservez un créneau, consultez — en moins de 2 minutes.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <Link href="/recherche" style={{ padding: '14px 32px', borderRadius: '10px', background: '#2eb592', color: '#0d2b22', fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(46,181,146,0.35)' }}>
                Trouver un médecin →
              </Link>
              <Link href="/login" style={{ padding: '14px 28px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.18)', color: 'white', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none' }}>
                Espace professionnel
              </Link>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? '24px' : '40px', marginTop: '56px', paddingTop: '40px', borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
              {[
                { num: '1 200+', label: 'Praticiens à rejoindre' },
                { num: '28M', label: 'Habitants à connecter' },
                { num: '22', label: 'Régions couvertes' },
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: isMobile ? 'center' : 'left' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 600, color: 'white', lineHeight: 1 }}>{stat.num}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {!isMobile && (
            <div style={{ flexShrink: 0, width: isTablet ? '100%' : '320px', maxWidth: '320px' }}>
              <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: '20px', padding: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.35)', marginBottom: '14px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontWeight: 600, color: '#0d2b22', marginBottom: '14px' }}>Disponibles aujourd'hui</div>
                {[
                  { emoji: '👩‍⚕️', nom: 'Dr. Rasoamanarivo', spec: 'Pédiatre · Analakely', slots: ['10h', '14h'] },
                  { emoji: '👨‍⚕️', nom: 'Dr. Rakotobe Fidy', spec: 'Cardiologue · Faravohitra', slots: ['13h'] },
                  { emoji: '🏥', nom: 'Clinik Madera', spec: 'Clinique · Antananarivo', slots: ['08h', '11h'] },
                ].map(doc => (
                  <div key={doc.nom} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0ece2' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#0d2b22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{doc.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0d2b22' }}>{doc.nom}</div>
                      <div style={{ fontSize: '0.7rem', color: '#7a7260' }}>{doc.spec}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {doc.slots.map(s => (
                        <span key={s} style={{ padding: '3px 8px', borderRadius: '6px', background: '#e8f5f1', color: '#22816a', fontSize: '0.68rem', fontWeight: 700 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 16px 40px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', width: 'fit-content' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e8f5f1', color: '#22816a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#7a7260' }}>Médecins vérifiés</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0d2b22' }}>Dispo maintenant</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PROBLÈME / SOLUTION */}
      <section style={{ padding: isMobile ? '60px 20px' : isTablet ? '80px 32px' : '96px 60px', background: '#faf8f4' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22816a', marginBottom: '12px' }}>Le problème</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 600, color: '#0d2b22', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '16px' }}>
            Accéder à un médecin<br />ne devrait pas être un combat.
          </h2>
          <p style={{ fontSize: '1rem', color: '#7a7260', maxWidth: '520px', lineHeight: 1.65, fontWeight: 300, marginBottom: '48px' }}>
            À Madagascar, le système de santé manque cruellement d'outils modernes. Radoko est là pour changer ça.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1px', background: '#e8e0cc', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e8e0cc' }}>
            {[
              { icon: '✗', bg: '#fdf0ee', title: 'Pas de répertoire centralisé', desc: 'Impossible de savoir quels médecins exercent dans votre quartier sans appeler.', type: 'bad' },
              { icon: '✓', bg: '#e8f5f1', title: 'Annuaire complet et consultable', desc: 'Médecins et cliniques filtrés par région, spécialité et disponibilité — en temps réel.', type: 'good' },
              { icon: '✗', bg: '#fdf0ee', title: 'Des heures de route pour rien', desc: 'Les patients font parfois des dizaines de km pour trouver le cabinet fermé.', type: 'bad' },
              { icon: '✓', bg: '#e8f5f1', title: 'Réservation en 2 minutes', desc: 'Créneaux médecins et services cliniques réservables en ligne. Confirmation instantanée.', type: 'good' },
              { icon: '✗', bg: '#fdf0ee', title: 'Aucune confiance dans les praticiens', desc: 'Sans vérification, difficile de faire confiance à un inconnu.', type: 'bad' },
              { icon: '✓', bg: '#e8f5f1', title: 'Médecins vérifiés', desc: 'Chaque praticien est vérifié par notre équipe avant d\'apparaître sur la plateforme.', type: 'good' },
            ].map(item => (
              <div key={item.title} style={{ background: 'white', padding: isMobile ? '24px 20px' : '36px 32px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px', color: item.type === 'bad' ? '#c0392b' : '#22816a', fontWeight: 700 }}>{item.icon}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>{item.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#7a7260', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POUR QUI */}
      <section style={{ padding: isMobile ? '60px 20px' : isTablet ? '80px 32px' : '96px 60px', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22816a', marginBottom: '12px' }}>Pour qui ?</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '48px' }}>
            Une plateforme,<br />trois profils.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              {
                emoji: '🧑', titre: 'Patients', couleur: '#2eb592',
                desc: 'Trouvez un médecin ou une clinique près de chez vous. Réservez en ligne, recevez des rappels, consultez votre dossier médical.',
                features: ['Recherche par spécialité et région', 'Réservation en temps réel', 'Messagerie avec votre médecin', 'Historique des consultations'],
                cta: 'Trouver un médecin', href: '/recherche',
              },
              {
                emoji: '👨‍⚕️', titre: 'Médecins', couleur: '#c8992a',
                desc: 'Gérez votre agenda, vos patients et votre cabinet depuis un seul tableau de bord. Développez votre patientèle en ligne.',
                features: ['Profil public visible', 'Agenda et disponibilités', 'Messagerie et dossiers patients', 'Analytiques et revenus'],
                cta: 'Rejoindre en tant que médecin', href: '/login',
              },
              {
                emoji: '🏥', titre: 'Cliniques', couleur: '#0d2b22',
                desc: 'Gérez vos services, vos réservations et votre communication patients depuis un dashboard clinique complet.',
                features: ['Profil clinique public', 'Gestion multi-services', 'Réservations créneaux et plages', 'Dashboard avec statistiques'],
                cta: 'Rejoindre en tant que clinique', href: '/login',
              },
            ].map(profil => (
              <div key={profil.titre} style={{ background: '#faf8f4', border: '1px solid #f0ece2', borderRadius: '20px', padding: isMobile ? '24px 20px' : '32px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${profil.couleur}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>{profil.emoji}</div>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#0d2b22', marginBottom: '6px' }}>{profil.titre}</div>
                  <div style={{ fontSize: '0.83rem', color: '#7a7260', lineHeight: 1.6 }}>{profil.desc}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profil.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#4a4035' }}>
                      <span style={{ color: profil.couleur, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link href={profil.href} style={{ marginTop: 'auto', display: 'block', padding: '11px', borderRadius: '10px', background: profil.couleur, color: profil.couleur === '#0d2b22' ? 'white' : '#0d2b22', fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                  {profil.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" style={{ padding: isMobile ? '60px 20px' : isTablet ? '80px 32px' : '96px 60px', background: '#faf8f4' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22816a', marginBottom: '12px' }}>Ce que vous obtenez</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '48px' }}>
            Tout ce qu'il faut,<br />rien de superflu.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              { num: '01', title: 'Agenda en temps réel', desc: 'Les créneaux médecins et cliniques se mettent à jour instantanément. Fini les appels téléphoniques.' },
              { num: '02', title: 'Messagerie directe', desc: 'Patients et professionnels communiquent directement avant et après la consultation.' },
              { num: '03', title: 'Rappels automatiques', desc: 'Notifications la veille de chaque rendez-vous pour réduire les absences.' },
              { num: '04', title: 'Paiement local intégré', desc: 'MVola et Orange Money pour les abonnements professionnels. Simple et local.' },
              { num: '05', title: 'Dossier patient complet', desc: 'Historique des consultations, ordonnances, examens et analyses accessibles au médecin.' },
              { num: '06', title: 'Cliniques multi-services', desc: 'Imagerie, laboratoire, chirurgie, maternité — chaque service avec ses propres disponibilités.' },
            ].map(f => (
              <div key={f.num} style={{ background: 'white', border: '1px solid #f0ece2', borderRadius: '16px', padding: isMobile ? '24px 20px' : '32px 28px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '3rem', fontWeight: 600, color: '#f0ece2', lineHeight: 1, marginBottom: '16px' }}>{f.num}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>{f.title}</div>
                <div style={{ fontSize: '0.83rem', color: '#7a7260', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" style={{ padding: isMobile ? '60px 20px' : isTablet ? '80px 32px' : '96px 60px', background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22816a', marginBottom: '12px' }}>Tarifs</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>
            Gratuit pour les patients.<br />Simple pour les pros.
          </h2>
          <p style={{ fontSize: '1rem', color: '#7a7260', marginBottom: '48px', fontWeight: 300 }}>
            Les patients accèdent à Radoko sans frais. Paiement via MVola ou Orange Money.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
            {[
              {
                name: 'Essentiel', price: '15 000', featured: false, pour: 'Médecins',
                features: ['Profil public complet', 'Réservation en ligne', 'Gestion de l\'agenda', 'Notifications patients', 'Tableau de bord basique'],
              },
              {
                name: 'Pro', price: '30 000', featured: true, pour: 'Médecins',
                features: ['Tout Essentiel inclus', 'Messagerie patients', 'Dossiers médicaux', 'Analytiques & revenus', 'Support prioritaire'],
              },
              {
                name: 'Clinique', price: '80 000', featured: false, pour: 'Cliniques',
                features: ['Profil clinique public', 'Gestion multi-services', 'Réservations créneaux & plages', 'Messagerie patients', 'Dashboard complet'],
              },
            ].map(plan => (
              <div key={plan.name} style={{
                background: plan.featured ? '#0d2b22' : 'white',
                border: `1px solid ${plan.featured ? '#0d2b22' : '#f0ece2'}`,
                borderRadius: '24px', padding: isMobile ? '28px 24px' : '36px 32px',
                transform: plan.featured && !isMobile ? 'translateY(-8px)' : 'none',
                boxShadow: plan.featured ? '0 24px 64px rgba(13,43,34,0.18)' : 'none',
                position: 'relative',
              }}>
                {plan.featured && (
                  <div style={{ position: 'absolute', top: '20px', right: '20px', background: '#c8992a', color: '#0d2b22', fontSize: '0.62rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Populaire</div>
                )}
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: plan.featured ? 'rgba(255,255,255,0.4)' : '#a8a090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{plan.pour}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: plan.featured ? 'white' : '#0d2b22' }}>{plan.name}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.6rem', fontWeight: 600, color: plan.featured ? 'white' : '#0d2b22', lineHeight: 1, margin: '16px 0 4px' }}>{plan.price}</div>
                <div style={{ fontSize: '0.75rem', color: plan.featured ? 'rgba(255,255,255,0.5)' : '#7a7260', marginBottom: '24px' }}>Ar / mois</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', padding: 0 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: '0.82rem', color: plan.featured ? 'rgba(255,255,255,0.65)' : '#7a7260', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: plan.featured ? '#2eb592' : '#22816a', fontWeight: 700 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" style={{ display: 'block', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', textAlign: 'center', textDecoration: 'none', background: plan.featured ? '#2eb592' : '#f0ece2', color: '#0d2b22' }}>
                  Commencer →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: isMobile ? '60px 20px' : '100px 60px', textAlign: 'center', background: '#faf8f4' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2.2rem' : '3.4rem', fontWeight: 600, color: '#0d2b22', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '20px' }}>
            Prêt à rejoindre<br />la <em style={{ color: '#22816a' }}>bêta fermée</em> ?
          </h2>
          <p style={{ fontSize: '1rem', color: '#7a7260', marginBottom: '40px', fontWeight: 300, lineHeight: 1.6 }}>
            Les 50 premiers médecins et cliniques partenaires bénéficient de 6 mois gratuits et d'une réduction à vie de 50%. Places limitées.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ padding: '14px 32px', borderRadius: '10px', background: '#2eb592', color: '#0d2b22', fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(46,181,146,0.35)' }}>
              Je suis professionnel de santé →
            </Link>
            <Link href="/recherche" style={{ padding: '14px 28px', borderRadius: '10px', background: '#f0ece2', border: '1.5px solid #cfc5ae', color: '#0d2b22', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none' }}>
              Je suis patient
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: isMobile ? '60px 20px' : isTablet ? '80px 32px' : '96px 60px', background: '#0d2b22' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#2eb592', marginBottom: '12px' }}>Contact</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '2rem' : '2.8rem', fontWeight: 600, color: 'white', marginBottom: '16px' }}>
            Une question ?<br />On vous répond.
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', marginBottom: '40px', lineHeight: 1.6, fontWeight: 300 }}>
            Que vous soyez patient, médecin ou clinique, notre équipe est disponible pour vous accompagner.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <a href="mailto:radoko.mg@gmail.com" style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px', padding: '16px 24px', width: '100%', maxWidth: '400px',
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(46,181,146,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>✉️</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Email</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'white' }}>radoko.mg@gmail.com</div>
              </div>
            </a>
            <a href="https://wa.me/261327231486" target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px', padding: '16px 24px', width: '100%', maxWidth: '400px',
              textDecoration: 'none',
            }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>💬</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>WhatsApp</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'white' }}>+261 32 723 14 86</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#0d2b22',
        padding: isMobile ? '28px 20px' : '40px 60px',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '16px' : '0',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: 'white' }}>
          Dokt<em style={{ color: '#2eb592' }}>éra</em>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>© 2026 Radoko · Madagascar</div>
        <div style={{ display: 'flex', gap: isMobile ? '16px' : '24px', flexWrap: 'wrap' }}>
          <a href="mailto:radoko.mg@gmail.com" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>radoko.mg@gmail.com</a>
          <a href="https://wa.me/261327231486" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>WhatsApp</a>
        </div>
      </footer>

    </main>
  )
}