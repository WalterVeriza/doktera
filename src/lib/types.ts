export type UserRole = 'medecin' | 'patient'

export type RdvStatus = 'en_attente' | 'confirme' | 'termine' | 'annule'

export interface Profil {
  id: string
  role: UserRole
  prenom: string
  nom: string
  telephone?: string
  created_at: string
}

export interface Medecin {
  id: string
  specialite: string
  adresse?: string
  region?: string
  tarif?: number
  presentation?: string
  langues: string[]
  note_moyenne: number
  nombre_avis: number
  verifie: boolean
  profil?: Profil
}

export interface Patient {
  id: string
  date_naissance?: string
  groupe_sanguin?: string
  allergies?: string
  adresse?: string
  profil?: Profil
}

export interface Creneau {
  id: string
  medecin_id: string
  jour_semaine: number
  heure_debut: string
  duree_minutes: number
  actif: boolean
}

export interface RendezVous {
  id: string
  medecin_id: string
  patient_id: string
  creneau_id?: string
  date_rdv: string
  motif?: string
  statut: RdvStatus
  notes_medecin?: string
  created_at: string
  medecin?: Medecin
  patient?: Patient
}

export interface Message {
  id: string
  expediteur_id: string
  destinataire_id: string
  rdv_id?: string
  contenu: string
  lu: boolean
  created_at: string
}

export interface Avis {
  id: string
  medecin_id: string
  patient_id: string
  rdv_id?: string
  note: number
  commentaire?: string
  created_at: string
}

export interface DossierMedical {
  id: string
  patient_id: string
  medecin_id?: string
  type_entree: 'consultation' | 'ordonnance' | 'analyse'
  titre: string
  contenu?: string
  date_entree: string
}