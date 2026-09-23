// src/components/animal/WeightChart.tsx
// Extrait de AnimalHealthPage.tsx et chargé en lazy (voir l'import dans
// cette page) : recharts pèse à lui seul 353 Ko (104 Ko compressés), plus
// que n'importe quel autre chunk de l'appli — le charger au même moment que
// le reste de la fiche santé de l'animal (une page très fréquemment
// visitée) ralentissait son ouverture même pour un propriétaire qui ne
// consulte jamais l'onglet Poids.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { PARIS_TZ } from '@/lib/parisTime'
import { SPECIES_MAX_WEIGHT } from '@/lib/animalSpecies'

export default function WeightChart({ weights, species }: { weights: any[]; species: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={weights.map(w => ({
        date: formatInTimeZone(new Date(w.measured_at), PARIS_TZ, 'd MMM', { locale: fr }),
        poids: w.weight_kg,
      }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit=" kg" domain={[
          0,
          (dataMax: number) => Math.max(dataMax, SPECIES_MAX_WEIGHT[species] ?? 50)
        ]} />
        <Tooltip formatter={(v: any) => [`${v} kg`, 'Poids']} />
        <Line type="monotone" dataKey="poids" stroke="#f2820f" strokeWidth={2} dot={{ fill: '#f2820f', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
