// Niveaux officiels padel (1-10)
export const LEVEL_OPTIONS = [
  { value: '1',  label: '1 — Initiation' },
  { value: '2',  label: '2 — Débutant' },
  { value: '3',  label: '3 — Débutant +' },
  { value: '4',  label: '4 — Intermédiaire' },
  { value: '5',  label: '5 — Confirmé' },
  { value: '6',  label: '6 — Avancé' },
  { value: '7',  label: '7 — Avancé +' },
  { value: '8',  label: '8 — Expert' },
  { value: '9',  label: '9 — Expert +' },
  { value: '10', label: '10 — Élite' },
]

export const LEVEL_LABEL = Object.fromEntries(LEVEL_OPTIONS.map(l => [l.value, l.label]))

export const LEVEL_SHORT = {
  '1': 'Initiation', '2': 'Débutant', '3': 'Débutant+',
  '4': 'Intermédiaire', '5': 'Confirmé', '6': 'Avancé',
  '7': 'Avancé+', '8': 'Expert', '9': 'Expert+', '10': 'Élite',
}
