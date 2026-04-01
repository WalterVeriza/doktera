export default function Avatar({ url, nom, prenom, role = 'patient', size = 40 }: {
  url?: string | null
  nom?: string
  prenom?: string
  role?: 'medecin' | 'patient'
  size?: number
}) {
  const initiales = prenom && nom
    ? `${prenom[0]}${nom[0]}`.toUpperCase()
    : role === 'medecin' ? '👨‍⚕️' : '🧑'

  const radius = size > 50 ? '20px' : '12px'

  if (url) {
    return (
      <img
        src={url}
        alt={`${prenom} ${nom}`}
        style={{
          width: `${size}px`, height: `${size}px`,
          borderRadius: radius, objectFit: 'cover',
          border: '1.5px solid #f0ece2', flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div style={{
      width: `${size}px`, height: `${size}px`,
      borderRadius: radius, flexShrink: 0,
      background: role === 'medecin' ? '#0d2b22' : '#e8f5f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 50 ? '1.8rem' : size > 36 ? '1.1rem' : '0.85rem',
      color: role === 'medecin' ? 'white' : '#22816a',
      fontWeight: 700, border: '1.5px solid #f0ece2',
      fontFamily: 'Outfit, sans-serif',
    }}>
      {prenom && nom ? initiales : (role === 'medecin' ? '👨‍⚕️' : '🧑')}
    </div>
  )
}