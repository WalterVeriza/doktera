export function toLocalISO(dateStr: string, heure: string): string {
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

export function isoToLocalHHMM(isoStr: string): string {
  const d = new Date(isoStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function genererCreneaux(debut: string, fin: string, duree: number): string[] {
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

export async function getCreneauxDisponibles(
  supabase: any,
  medecinId: string,
  dateStr: string
): Promise<string[]> {
  // Fix bug UTC : T12:00:00 évite le décalage de jour sur les fuseaux UTC-
  const date = new Date(dateStr + 'T12:00:00')
  const jourJS = date.getDay()
  const jourSemaine = jourJS === 0 ? 6 : jourJS - 1

  const debutJour = toLocalISO(dateStr, '00:00')
  const finJour = toLocalISO(dateStr, '23:59')

  // Requêtes parallèles — ~3x plus rapide
  const [
    { data: dispo },
    { data: rdvsPris },
    { data: blocagesManuels },
    { data: absences },
  ] = await Promise.all([
    supabase.from('disponibilites').select('*').eq('medecin_id', medecinId).eq('jour_semaine', jourSemaine).eq('actif', true).single(),
    supabase.from('rendez_vous').select('date_rdv').eq('medecin_id', medecinId).gte('date_rdv', debutJour).lte('date_rdv', finJour).in('statut', ['en_attente', 'confirme']),
    supabase.from('creneaux_manuels').select('date_creneau').eq('medecin_id', medecinId).gte('date_creneau', debutJour).lte('date_creneau', finJour),
    supabase.from('creneaux_bloques').select('date_debut, date_fin').eq('medecin_id', medecinId).lte('date_debut', finJour).gte('date_fin', debutJour),
  ])

  if (!dispo) return []

  // Fix bug UTC sur comparaison absences
  const jourBloque = (absences || []).some((a: any) =>
    new Date(a.date_debut) <= date && new Date(a.date_fin) >= date
  )
  if (jourBloque) return []

  const tousLesCreneaux = genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau)
  const heuresPrises = new Set<string>((rdvsPris || []).map((r: any) => isoToLocalHHMM(r.date_rdv)))
  const heuresBloqueesManuel = new Set<string>((blocagesManuels || []).map((b: any) => isoToLocalHHMM(b.date_creneau)))

  return tousLesCreneaux.filter(c => !heuresPrises.has(c) && !heuresBloqueesManuel.has(c))
}

export function formatCreneau(heure: string): string {
  return heure.replace(':', 'h')
}
