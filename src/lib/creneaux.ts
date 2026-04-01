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
  dateStr: string // format YYYY-MM-DD
): Promise<string[]> {
  const date = new Date(dateStr)
  // 0=Dimanche en JS, on convertit en 0=Lundi
  let jourJS = date.getDay()
  let jourSemaine = jourJS === 0 ? 6 : jourJS - 1 // Dimanche = 6, Lundi = 0

  // 1. Récupérer les dispos du médecin pour ce jour
  const { data: dispo } = await supabase
    .from('disponibilites')
    .select('*')
    .eq('medecin_id', medecinId)
    .eq('jour_semaine', jourSemaine)
    .eq('actif', true)
    .single()

  if (!dispo) return [] // Pas de dispo ce jour

  // 2. Générer tous les créneaux théoriques
  const tousLesCreneaux = genererCreneaux(dispo.heure_debut, dispo.heure_fin, dispo.duree_creneau)

  // 3. Récupérer les RDV déjà pris ce jour
  const debutJour = `${dateStr}T00:00:00`
  const finJour = `${dateStr}T23:59:59`

  const { data: rdvsPris } = await supabase
    .from('rendez_vous')
    .select('date_rdv')
    .eq('medecin_id', medecinId)
    .gte('date_rdv', debutJour)
    .lte('date_rdv', finJour)
    .in('statut', ['en_attente', 'confirme'])

  const heuresPrises = new Set(
    (rdvsPris || []).map((r: any) => {
      const d = new Date(r.date_rdv)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    })
  )

  // 4. Récupérer les blocages manuels ce jour (pauses, patients externes)
  const { data: blocagesManuels } = await supabase
    .from('creneaux_manuels')
    .select('date_creneau')
    .eq('medecin_id', medecinId)
    .gte('date_creneau', debutJour)
    .lte('date_creneau', finJour)

  const heuresBloqueesManuel = new Set(
    (blocagesManuels || []).map((b: any) => {
      const d = new Date(b.date_creneau)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    })
  )

  // 5. Récupérer les congés/absences longues
  const { data: absences } = await supabase
    .from('creneaux_bloques')
    .select('date_debut, date_fin')
    .eq('medecin_id', medecinId)
    .lte('date_debut', finJour)
    .gte('date_fin', debutJour)

  // Vérifier si le jour entier est dans une absence
  const jourBloque = (absences || []).some((a: any) => {
    return new Date(a.date_debut) <= date && new Date(a.date_fin) >= date
  })

  if (jourBloque) return []

  // 6. Filtrer les créneaux disponibles
  return tousLesCreneaux.filter(c => !heuresPrises.has(c) && !heuresBloqueesManuel.has(c))
}

export function formatCreneau(heure: string): string {
  // Convertit "08:00" en "08h00"
  return heure.replace(':', 'h')
}