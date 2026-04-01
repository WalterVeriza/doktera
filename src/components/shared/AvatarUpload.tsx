'use client'

import { useState } from 'react'

export default function AvatarUpload({ userId, currentUrl, supabase, onUpload, role = 'patient' }: {
  userId: string
  currentUrl?: string | null
  supabase: any
  onUpload: (url: string) => void
  role?: 'medecin' | 'patient'
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifications
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop lourde — maximum 2MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Format non supporté — utilisez JPG, PNG ou WebP')
      return
    }

    setUploading(true)

    // Préview immédiat
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/avatar.${ext}`

      // Upload dans Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      // Récupérer l'URL publique
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${data.publicUrl}?t=${Date.now()}` // cache bust

      // Sauvegarder dans profils
      await supabase.from('profils').update({ avatar_url: publicUrl }).eq('id', userId)

      onUpload(publicUrl)
    } catch (err) {
      console.error('Erreur upload:', err)
      alert('Erreur lors de l\'upload — réessayez')
    } finally {
      setUploading(false)
    }
  }

  const initiales = role === 'medecin' ? '👨‍⚕️' : '🧑'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: preview ? 'transparent' : (role === 'medecin' ? '#0d2b22' : '#e8f5f1'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', border: '2px solid #f0ece2',
          fontSize: '2rem',
        }}>
          {preview ? (
            <img src={preview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initiales
          )}
        </div>
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '20px',
            background: 'rgba(13,43,34,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', color: 'white', fontWeight: 700,
          }}>
            ⏳
          </div>
        )}
      </div>

      {/* Bouton upload */}
      <div>
        <label style={{
          display: 'inline-block', padding: '8px 18px',
          borderRadius: '10px', background: '#f0ece2',
          color: '#0d2b22', fontSize: '0.82rem', fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          border: '1.5px solid #e8e0cc', transition: 'all 0.15s',
        }}>
          {uploading ? '⏳ Upload en cours…' : '📷 Changer la photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        <div style={{ fontSize: '0.7rem', color: '#a8a090', marginTop: '5px' }}>
          JPG, PNG ou WebP — max 2MB
        </div>
      </div>
    </div>
  )
}