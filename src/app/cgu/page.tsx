// src/app/cgu/page.tsx
export default function CGUPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: 'Outfit, sans-serif' }}>
      <nav style={{ background: '#0d2b22', padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.7rem', fontWeight: 600, color: 'white', textDecoration: 'none' }}>
          Rad<em style={{ color: '#2eb592' }}>oko</em>
        </a>
        <a href="/login" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>← Retour</a>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 600, color: '#0d2b22', marginBottom: '8px' }}>
          Conditions Générales d'Utilisation
        </div>
        <div style={{ fontSize: '0.82rem', color: '#a8a090', marginBottom: '40px' }}>
          Dernière mise à jour : avril 2026
        </div>

        {[
          {
            titre: '1. Présentation de la plateforme',
            contenu: `Radoko est une plateforme numérique de santé opérée depuis Madagascar, permettant la mise en relation entre patients et professionnels de santé (médecins, cliniques, établissements de santé). Radoko ne fournit pas de soins médicaux et n'est pas un prestataire de services médicaux.`,
          },
          {
            titre: '2. Acceptation des conditions',
            contenu: `L'utilisation de la plateforme Radoko implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la plateforme. Ces conditions peuvent être modifiées à tout moment ; les utilisateurs en seront informés par email ou notification.`,
          },
          {
            titre: '3. Inscription et compte utilisateur',
            contenu: `L'inscription est gratuite pour les patients. Les professionnels de santé et établissements doivent souscrire à un plan payant pour apparaître dans la recherche. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités effectuées sous votre compte. Vous devez fournir des informations exactes et les maintenir à jour.`,
          },
          {
            titre: '4. Utilisation de la plateforme',
            contenu: `Radoko est une plateforme de mise en relation uniquement. La prise de rendez-vous via Radoko ne constitue pas un acte médical. Les informations médicales partagées entre patients et professionnels restent confidentielles et ne sont pas utilisées à des fins commerciales. Il est interdit d'utiliser la plateforme à des fins frauduleuses, illégales ou contraires à l'éthique médicale.`,
          },
          {
            titre: '5. Professionnels de santé',
            contenu: `Les professionnels de santé inscrits sur Radoko s'engagent à exercer conformément à la réglementation malgache en vigueur, à maintenir leurs informations à jour, et à honorer les rendez-vous confirmés sauf cas de force majeure. Radoko se réserve le droit de suspendre tout compte présentant des activités non conformes ou signalé par des patients.`,
          },
          {
            titre: '6. Données personnelles',
            contenu: `Les données collectées (nom, email, téléphone, informations médicales) sont utilisées uniquement pour le fonctionnement de la plateforme. Elles ne sont jamais vendues à des tiers. Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de modification et de suppression de vos données en contactant radoko.mg@gmail.com.`,
          },
          {
            titre: '7. Paiements et abonnements',
            contenu: `Les paiements s'effectuent via Mobile Money (MVola, Orange Money). Les abonnements sont mensuels et non remboursables sauf défaut avéré du service. Radoko se réserve le droit de modifier les tarifs avec un préavis de 30 jours. En cas de non-paiement, le profil du professionnel sera masqué de la recherche jusqu'à régularisation.`,
          },
          {
            titre: '8. Responsabilité',
            contenu: `Radoko agit en qualité d'intermédiaire technique et ne peut être tenu responsable de la qualité des soins dispensés par les professionnels inscrits, des annulations ou absences de rendez-vous, des informations médicales inexactes fournies par les utilisateurs, ni des dysfonctionnements techniques indépendants de sa volonté.`,
          },
          {
            titre: '9. Propriété intellectuelle',
            contenu: `L'ensemble des éléments de la plateforme Radoko (logo, design, code, contenu) est la propriété exclusive de Radoko. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.`,
          },
          {
            titre: '10. Résiliation',
            contenu: `Tout utilisateur peut supprimer son compte à tout moment en contactant radoko.mg@gmail.com. Radoko peut suspendre ou supprimer un compte en cas de violation des présentes CGU, sans préavis ni indemnité.`,
          },
          {
            titre: '11. Droit applicable',
            contenu: `Les présentes CGU sont soumises au droit malgache. Tout litige relatif à leur interprétation ou exécution sera soumis aux juridictions compétentes de Madagascar.`,
          },
          {
            titre: '12. Contact',
            contenu: `Pour toute question relative aux présentes CGU : radoko.mg@gmail.com`,
          },
        ].map(section => (
          <div key={section.titre} style={{ marginBottom: '32px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 600, color: '#0d2b22', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #f0ece2' }}>
              {section.titre}
            </div>
            <p style={{ fontSize: '0.88rem', color: '#4a4438', lineHeight: 1.8, margin: 0 }}>
              {section.contenu}
            </p>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px 24px', background: '#e8f5f1', borderRadius: '14px', border: '1px solid rgba(34,129,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0d2b22', marginBottom: '2px' }}>Vous avez des questions ?</div>
            <div style={{ fontSize: '0.82rem', color: '#7a7260' }}>Notre équipe est disponible par email</div>
          </div>
          <a href="mailto:radoko.mg@gmail.com" style={{ padding: '10px 20px', borderRadius: '10px', background: '#22816a', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
            radoko.mg@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}