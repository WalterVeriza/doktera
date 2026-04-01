'use client'

import { useEffect, useRef } from 'react'

export default function MapComponent({ userPos, medecins }: {
  userPos: { lat: number, lng: number }
  medecins: any[]
}) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let L: any
    let map: any

    const init = async () => {
      L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // Évite le bug des icônes manquantes
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!containerRef.current) return

      map = L.map(containerRef.current).setView([userPos.lat, userPos.lng], 13)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map)

      // Marqueur utilisateur (bleu)
      const userIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      })
      L.marker([userPos.lat, userPos.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('Votre position')

      // Marqueurs médecins (vert)
      medecins.forEach(med => {
        if (!med.latitude || !med.longitude) return
        const medIcon = L.divIcon({
          html: `<div style="width:12px;height:12px;background:#22816a;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          className: '',
        })
        L.marker([med.latitude, med.longitude], { icon: medIcon })
          .addTo(map)
          .bindPopup(`<b>Dr. ${med.profil?.prenom} ${med.profil?.nom}</b><br>${med.specialite || ''}`)
      })
    }

    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // intentionnellement vide — init une seule fois

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}