// src/lib/animalSpecies.ts

export interface SpeciesGroup {
  group: string
  species: { name: string; maxWeight: number }[]
}

export const SPECIES_GROUPS: SpeciesGroup[] = [
  {
    group: 'Mammifères domestiques',
    species: [
      { name: 'Chien',               maxWeight: 90 },
      { name: 'Chat',                maxWeight: 20 },
      { name: 'Lapin',               maxWeight: 10 },
      { name: 'Cochon d\'Inde',      maxWeight: 2 },
      { name: 'Hamster',             maxWeight: 0.5 },
      { name: 'Gerbille',            maxWeight: 0.3 },
      { name: 'Rat',                 maxWeight: 0.8 },
      { name: 'Souris',              maxWeight: 0.1 },
      { name: 'Furet',               maxWeight: 3 },
      { name: 'Chinchilla',          maxWeight: 1 },
      { name: 'Degu',                maxWeight: 0.5 },
      { name: 'Octodon',             maxWeight: 0.5 },
      { name: 'Hérisson',            maxWeight: 1.5 },
      { name: 'Écureuil de Corée',   maxWeight: 0.3 },
      { name: 'Sugar glider',        maxWeight: 0.2 },
      { name: 'Ragondin',            maxWeight: 9 },
      { name: 'Fennec',              maxWeight: 2 },
      { name: 'Renard',              maxWeight: 10 },
      { name: 'Mouffette',           maxWeight: 4 },
    ],
  },
  {
    group: 'Oiseaux',
    species: [
      { name: 'Perroquet',           maxWeight: 2 },
      { name: 'Perruche',            maxWeight: 0.1 },
      { name: 'Cacatoès',            maxWeight: 1 },
      { name: 'Cockatiel',           maxWeight: 0.15 },
      { name: 'Canari',              maxWeight: 0.05 },
      { name: 'Pinson',              maxWeight: 0.05 },
      { name: 'Diamant mandarin',    maxWeight: 0.02 },
      { name: 'Calopsitte',          maxWeight: 0.1 },
      { name: 'Lori',                maxWeight: 0.3 },
      { name: 'Toucan',              maxWeight: 0.8 },
      { name: 'Corbeau',             maxWeight: 1.5 },
      { name: 'Pie',                 maxWeight: 0.3 },
      { name: 'Poule',               maxWeight: 5 },
      { name: 'Canard',              maxWeight: 4 },
      { name: 'Oie',                 maxWeight: 10 },
      { name: 'Dinde',               maxWeight: 15 },
      { name: 'Caille',              maxWeight: 0.3 },
      { name: 'Faisan',              maxWeight: 2 },
      { name: 'Paon',                maxWeight: 6 },
      { name: 'Autruche',            maxWeight: 150 },
      { name: 'Émeu',                maxWeight: 60 },
    ],
  },
  {
    group: 'Reptiles',
    species: [
      { name: 'Tortue terrestre',    maxWeight: 30 },
      { name: 'Tortue aquatique',    maxWeight: 20 },
      { name: 'Gecko',               maxWeight: 0.1 },
      { name: 'Iguane',              maxWeight: 8 },
      { name: 'Lézard',              maxWeight: 2 },
      { name: 'Serpent',             maxWeight: 10 },
      { name: 'Boa',                 maxWeight: 30 },
      { name: 'Python',              maxWeight: 90 },
      { name: 'Caméléon',            maxWeight: 0.5 },
      { name: 'Agame barbu',         maxWeight: 0.6 },
      { name: 'Scinque',             maxWeight: 0.15 },
      { name: 'Varan',               maxWeight: 80 },
      { name: 'Crocodilien',         maxWeight: 1000 },
    ],
  },
  {
    group: 'Amphibiens',
    species: [
      { name: 'Axolotl',             maxWeight: 0.3 },
      { name: 'Grenouille',          maxWeight: 0.5 },
      { name: 'Rainette',            maxWeight: 0.1 },
      { name: 'Salamandre',          maxWeight: 0.2 },
      { name: 'Triton',              maxWeight: 0.1 },
    ],
  },
  {
    group: 'Poissons',
    species: [
      { name: 'Poisson rouge',       maxWeight: 3 },
      { name: 'Koi',                 maxWeight: 15 },
      { name: 'Betta',               maxWeight: 0.01 },
      { name: 'Guppy',               maxWeight: 0.005 },
      { name: 'Néon',                maxWeight: 0.005 },
      { name: 'Discus',              maxWeight: 0.5 },
      { name: 'Poisson-clown',       maxWeight: 0.2 },
      { name: 'Oscar',               maxWeight: 1.5 },
      { name: 'Poisson eau salée',   maxWeight: 5 },
    ],
  },
  {
    group: 'Invertébrés',
    species: [
      { name: 'Tarentule',           maxWeight: 0.1 },
      { name: 'Mygale',              maxWeight: 0.15 },
      { name: 'Scorpion',            maxWeight: 0.06 },
      { name: 'Phasme',              maxWeight: 0.05 },
      { name: 'Mante religieuse',    maxWeight: 0.01 },
      { name: 'Poulpe',              maxWeight: 10 },
      { name: 'Crabe',               maxWeight: 3 },
      { name: 'Crevette',            maxWeight: 0.05 },
      { name: 'Escargot',            maxWeight: 0.05 },
      { name: 'Coléoptère',          maxWeight: 0.1 },
    ],
  },
  {
    group: 'Grands animaux',
    species: [
      { name: 'Cheval',              maxWeight: 900 },
      { name: 'Poney',               maxWeight: 350 },
      { name: 'Âne',                 maxWeight: 400 },
      { name: 'Mulet',               maxWeight: 500 },
      { name: 'Vache',               maxWeight: 800 },
      { name: 'Mouton',              maxWeight: 150 },
      { name: 'Chèvre',              maxWeight: 100 },
      { name: 'Cochon',              maxWeight: 300 },
      { name: 'Lama',                maxWeight: 200 },
      { name: 'Alpaga',              maxWeight: 90 },
      { name: 'Cerf',                maxWeight: 250 },
      { name: 'Sanglier domestique', maxWeight: 200 },
    ],
  },
]

// Liste plate de toutes les espèces
export const ALL_SPECIES = SPECIES_GROUPS.flatMap(g => g.species)

// Poids max par nom d'espèce
export const SPECIES_MAX_WEIGHT: Record<string, number> = Object.fromEntries(
  ALL_SPECIES.map(s => [s.name, s.maxWeight])
)

// Emoji par espèce
export const SPECIES_EMOJI: Record<string, string> = {
  'Chien': '🐕', 'Chat': '🐈', 'Lapin': '🐇', 'Cochon d\'Inde': '🐹',
  'Hamster': '🐹', 'Gerbille': '🐭', 'Rat': '🐀', 'Souris': '🐭',
  'Furet': '🦦', 'Chinchilla': '🐭', 'Hérisson': '🦔', 'Fennec': '🦊',
  'Renard': '🦊', 'Perroquet': '🦜', 'Perruche': '🦜', 'Cacatoès': '🦜',
  'Canari': '🐦', 'Pinson': '🐦', 'Cockatiel': '🦜', 'Poule': '🐓',
  'Canard': '🦆', 'Oie': '🪿', 'Dinde': '🦃', 'Autruche': '🦤',
  'Tortue terrestre': '🐢', 'Tortue aquatique': '🐢', 'Gecko': '🦎',
  'Iguane': '🦎', 'Serpent': '🐍', 'Boa': '🐍', 'Python': '🐍',
  'Caméléon': '🦎', 'Axolotl': '🦎', 'Grenouille': '🐸', 'Rainette': '🐸',
  'Poisson rouge': '🐠', 'Koi': '🐟', 'Betta': '🐠', 'Poisson-clown': '🐠',
  'Tarentule': '🕷️', 'Scorpion': '🦂', 'Crabe': '🦀', 'Escargot': '🐌',
  'Cheval': '🐴', 'Poney': '🐴', 'Âne': '🫏', 'Vache': '🐄',
  'Mouton': '🐑', 'Chèvre': '🐐', 'Cochon': '🐖', 'Lama': '🦙',
  'Alpaga': '🦙',
}

// Placeholder de race par espèce
export const BREED_PLACEHOLDER: Record<string, string> = {
  'Chien':             'Ex: Labrador',
  'Chat':              'Ex: Siamois',
  'Lapin':             'Ex: Bélier',
  'Cochon d\'Inde':    'Ex: Teddy',
  'Hamster':           'Ex: Syrien',
  'Perroquet':         'Ex: Gris du Gabon',
  'Perruche':          'Ex: Ondulée',
  'Cacatoès':          'Ex: Cacatoès blanc',
  'Tortue terrestre':  'Ex: Hermann',
  'Gecko':             'Ex: Léopard',
  'Iguane':            'Ex: Iguane vert',
  'Serpent':           'Ex: Serpent des blés',
  'Cheval':            'Ex: Pur-sang',
  'Poney':             'Ex: Shetland',
  'Vache':             'Ex: Normande',
  'Mouton':            'Ex: Mérinos',
}
