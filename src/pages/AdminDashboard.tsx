// src/pages/AdminDashboard.tsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import {
  useAdminPendingDoctors, useAdminReviewDoctor, useAdminPlatformStats, useAdminDoctorsByStatus,
  useAdminDoctorDetail, useAdminReviews, useAdminPatients, useAdminPatientDetail,
  useAdminClinics, useAdminClinicDetail,
} from '@/hooks/useData'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts'

type Tab = 'pending' | 'verified' | 'rejected'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge bg-amber-100 text-amber-700',
  verified: 'badge bg-green-100 text-green-700',
  rejected: 'badge bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', verified: 'Vérifié', rejected: 'Rejeté',
}
const APPT_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmés', completed: 'Terminés',
  cancelled: 'Annulés', no_show: 'Absences',
}
const APPT_STATUS_COLOR: Record<string, string> = {
  pending: '#d1d5db', confirmed: '#8fa377', completed: '#f2820f',
  cancelled: '#ef4444', no_show: '#fca5a5',
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDoctorId = searchParams.get('doctor')
  const selectedPatientId = searchParams.get('patient')
  const selectedClinicId = searchParams.get('clinic')
  const view = searchParams.get('view')

  if (selectedDoctorId) {
    return <AdminDoctorDetail doctorId={selectedDoctorId} onBack={() => setSearchParams({})} />
  }
  if (selectedPatientId) {
    return <AdminPatientDetail userId={selectedPatientId} onBack={() => setSearchParams({ view: 'patients' })} />
  }
  if (selectedClinicId) {
    return (
      <AdminClinicDetail clinicId={selectedClinicId} onBack={() => setSearchParams({ view: 'clinics' })}
        onSelectDoctor={id => setSearchParams({ doctor: id })} />
    )
  }
  if (view === 'reviews') {
    return <AdminReviewsView onBack={() => setSearchParams({})} />
  }
  if (view === 'patients') {
    return <AdminPatientsView onBack={() => setSearchParams({})} onSelectPatient={id => setSearchParams({ patient: id })} />
  }
  if (view === 'clinics') {
    return <AdminClinicsView onBack={() => setSearchParams({})} onSelectClinic={id => setSearchParams({ clinic: id })} />
  }
  return (
    <AdminOverview
      onSelectDoctor={id => setSearchParams({ doctor: id })}
      onViewReviews={() => setSearchParams({ view: 'reviews' })}
      onViewPatients={() => setSearchParams({ view: 'patients' })}
      onViewClinics={() => setSearchParams({ view: 'clinics' })}
    />
  )
}

function AdminOverview({ onSelectDoctor, onViewReviews, onViewPatients, onViewClinics }: {
  onSelectDoctor: (id: string) => void; onViewReviews: () => void; onViewPatients: () => void; onViewClinics: () => void
}) {
  const { data: stats } = useAdminPlatformStats()
  const [tab, setTab] = useState<Tab>('pending')

  const { data: pendingDoctors = [], isLoading: pendingLoading } = useAdminPendingDoctors()
  const { data: verifiedDoctors = [], isLoading: verifiedLoading } = useAdminDoctorsByStatus(tab === 'verified' ? 'verified' : null)
  const { data: rejectedDoctors = [], isLoading: rejectedLoading } = useAdminDoctorsByStatus(tab === 'rejected' ? 'rejected' : null)

  const reviewDoctor = useAdminReviewDoctor()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  async function handleApprove(doctorId: string) {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: true })
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la validation.')
    }
  }

  async function handleReject(doctorId: string) {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: false, reason: rejectReason.trim() || undefined })
      setRejectingId(null)
      setRejectReason('')
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du rejet.')
    }
  }

  const activeList = tab === 'pending' ? pendingDoctors : tab === 'verified' ? verifiedDoctors : rejectedDoctors
  const activeLoading = tab === 'pending' ? pendingLoading : tab === 'verified' ? verifiedLoading : rejectedLoading
  const filteredList = search.trim()
    ? activeList.filter((d: any) => {
        const q = search.trim().toLowerCase()
        return `${d.first_name} ${d.last_name}`.toLowerCase().includes(q)
          || d.email?.toLowerCase().includes(q)
          || d.specialty?.toLowerCase().includes(q)
      })
    : activeList

  function goToDoctorsTab(t: Tab) {
    setTab(t)
    document.getElementById('dossiers-praticiens')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const statCards = stats ? [
    { label: 'Propriétaires', value: stats.patients_count, icon: '🙋', onClick: onViewPatients },
    { label: 'Praticiens vérifiés', value: stats.doctors_verified, icon: '✅', onClick: () => goToDoctorsTab('verified') },
    { label: 'Praticiens en attente', value: stats.doctors_pending, icon: '⏳', onClick: () => goToDoctorsTab('pending') },
    { label: 'Praticiens rejetés', value: stats.doctors_rejected, icon: '⛔', onClick: () => goToDoctorsTab('rejected') },
    { label: 'Secrétariats', value: stats.secretaries_count, icon: '🏥' },
    { label: 'Cabinets', value: stats.clinics_count, icon: '🏢', onClick: onViewClinics },
    { label: 'RDV à venir', value: stats.appointments_upcoming, icon: '🗓️' },
    { label: 'RDV au total', value: stats.appointments_total, icon: '📋' },
    { label: 'Avis publiés', value: stats.reviews_count, icon: '⭐', onClick: onViewReviews },
  ] : []

  const signupsData = (stats?.signups_weekly ?? []).map(w => ({
    semaine: format(new Date(w.week_start), 'd MMM', { locale: fr }),
    Praticiens: w.doctors,
    Propriétaires: w.patients,
  }))

  const doctorsStatusData = stats ? [
    { name: 'Vérifiés', value: stats.doctors_verified, color: '#16a34a' },
    { name: 'En attente', value: stats.doctors_pending, color: '#f59e0b' },
    { name: 'Rejetés', value: stats.doctors_rejected, color: '#ef4444' },
  ].filter(d => d.value > 0) : []

  const appointmentsStatusData = stats
    ? Object.entries(stats.appointments_by_status ?? {}).map(([status, count]) => ({
        status: APPT_STATUS_LABEL[status] ?? status, count, color: APPT_STATUS_COLOR[status] ?? '#9ca3af',
      }))
    : []

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Administration</h1>
        <p className="text-sm text-gray-500 mb-6">
          Vue d'ensemble de la plateforme et vérification des praticiens.
        </p>

        {/* Vue d'ensemble — compteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {statCards.map(c => {
            const Tag = c.onClick ? 'button' : 'div'
            return (
              <Tag key={c.label} onClick={c.onClick}
                className={`card p-4 text-left ${c.onClick ? 'hover:border-sage-300 hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
                <div className="text-xl mb-1">{c.icon}</div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}{c.onClick && <span className="text-sage-500"> →</span>}</p>
              </Tag>
            )
          })}
        </div>

        {/* Vue d'ensemble — graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className="card p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Inscriptions</h3>
            <p className="text-xs text-gray-400 mb-2">8 dernières semaines</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={signupsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semaine" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                <Tooltip />
                <Area type="monotone" dataKey="Praticiens" stroke="#f2820f" fill="#f2820f" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="Propriétaires" stroke="#8fa377" fill="#8fa377" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Praticiens par statut</h3>
            <p className="text-xs text-gray-400 mb-2">Vérification</p>
            {doctorsStatusData.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">Pas encore de données.</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={doctorsStatusData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {doctorsStatusData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Rendez-vous par statut</h3>
            <p className="text-xs text-gray-400 mb-2">Toutes périodes confondues</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={appointmentsStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 9 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {appointmentsStatusData.map(d => <Cell key={d.status} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dossiers praticiens */}
        <div id="dossiers-praticiens" className="card p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
              {(['pending', 'verified', 'rejected'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setSearch('') }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5
                    ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {STATUS_LABEL[t]}
                  {t === 'pending' && pendingDoctors.length > 0 && (
                    <span className="badge bg-amber-100 text-amber-700">{pendingDoctors.length}</span>
                  )}
                </button>
              ))}
            </div>
            {tab !== 'pending' && (
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, spécialité..."
                className="input text-sm max-w-xs" />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {activeLoading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : filteredList.length === 0 ? (
            <p className="text-sm text-gray-400">
              {search.trim() ? 'Aucun résultat pour cette recherche.' : `Aucun dossier "${STATUS_LABEL[tab].toLowerCase()}" pour l'instant.`}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredList.map((d: any) => (
                <div key={d.doctor_id} className="border border-gray-100 rounded-2xl p-4">
                  <button onClick={() => onSelectDoctor(d.doctor_id)}
                    className="flex items-start justify-between gap-4 mb-3 w-full text-left hover:opacity-80 transition-opacity">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{d.first_name} {d.last_name}</p>
                        {d.verification_status && d.verification_status !== 'pending' && (
                          <span className={STATUS_BADGE[d.verification_status]}>{STATUS_LABEL[d.verification_status]}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {d.specialty} · {d.email}{d.city ? ` · ${d.city}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Inscrit {format(new Date(d.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        {typeof d.review_count === 'number' && d.review_count > 0 && (
                          <> · ⭐ {d.average_rating} ({d.review_count} avis)</>
                        )}
                      </p>
                      {d.verification_rejected_reason && (
                        <p className="text-xs text-red-500 mt-1">Motif du rejet : {d.verification_rejected_reason}</p>
                      )}
                    </div>
                    <span className="text-gray-300 text-lg flex-shrink-0">›</span>
                  </button>

                  {(!d.documents || d.documents.length === 0) ? (
                    <p className="text-xs text-amber-600 mb-3">Aucun document déposé pour l&apos;instant.</p>
                  ) : (
                    <ul className="space-y-1.5 mb-3">
                      {d.documents.map((doc: any) => (
                        <li key={doc.id}>
                          <a href={doc.file_url} target="_blank" rel="noreferrer"
                            className="text-sm text-sage-600 hover:underline">
                            📄 {doc.document_type} — {doc.file_name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  {rejectingId === d.doctor_id ? (
                    <div className="space-y-2">
                      <input className="input text-sm" placeholder="Motif du rejet (optionnel, visible par le praticien)"
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-primary bg-red-500 hover:bg-red-600 text-sm px-4 py-2">
                          Confirmer le rejet
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                          className="btn-secondary text-sm px-4 py-2">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {tab !== 'verified' && (
                        <button onClick={() => handleApprove(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-primary text-sm px-4 py-2">
                          ✓ Valider
                        </button>
                      )}
                      {tab !== 'rejected' && (
                        <button onClick={() => setRejectingId(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-secondary text-sm px-4 py-2 text-red-500">
                          ✕ Rejeter
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type ReviewSort = 'recent' | 'old' | 'rating_asc' | 'rating_desc'

function AdminReviewsView({ onBack }: { onBack: () => void }) {
  const { data: reviews = [], isLoading } = useAdminReviews()
  const [ratingFilter, setRatingFilter] = useState<number | 'all' | 'negative'>('all')
  const [sort, setSort] = useState<ReviewSort>('recent')
  const [search, setSearch] = useState('')

  let list = reviews
  if (ratingFilter === 'negative') list = list.filter((r: any) => r.rating <= 2)
  else if (ratingFilter !== 'all') list = list.filter((r: any) => r.rating === ratingFilter)
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    list = list.filter((r: any) =>
      r.doctor_name?.toLowerCase().includes(q) || r.patient_name?.toLowerCase().includes(q) || r.comment?.toLowerCase().includes(q))
  }
  list = [...list].sort((a: any, b: any) => {
    if (sort === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'old') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'rating_asc') return a.rating - b.rating
    return b.rating - a.rating
  })

  const negativeCount = reviews.filter((r: any) => r.rating <= 2).length

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour à l'administration
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Avis publiés</h1>
        <p className="text-sm text-gray-500 mb-5">
          {reviews.length} avis au total
          {negativeCount > 0 && <span className="text-red-500"> · {negativeCount} avis à 1 ou 2 étoiles</span>}
        </p>

        <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setRatingFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ratingFilter === 'all' ? 'bg-sage-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tous
            </button>
            <button onClick={() => setRatingFilter('negative')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ratingFilter === 'negative' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
              ⚠️ Négatifs (≤2★)
            </button>
            {[5, 4, 3, 2, 1].map(n => (
              <button key={n} onClick={() => setRatingFilter(n)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ratingFilter === n ? 'bg-sage-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {n}★
              </button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as ReviewSort)} className="input text-xs py-2 w-auto">
            <option value="recent">Plus récents</option>
            <option value="old">Plus anciens</option>
            <option value="rating_asc">Note croissante</option>
            <option value="rating_desc">Note décroissante</option>
          </select>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par praticien, propriétaire ou mot-clé..."
          className="input text-sm mb-4" />

        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-sm">Aucun avis pour ces filtres.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r: any) => (
              <div key={r.id} className={`card p-4 ${r.rating <= 2 ? 'border-red-200 bg-red-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="text-sm">
                    {'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-gray-700 mb-2">{r.comment}</p>}
                <p className="text-xs text-gray-400">
                  {r.patient_name || 'Propriétaire'} → <span className="text-gray-600 font-medium">{r.doctor_name || 'Praticien'}</span>
                  {r.doctor_specialty && ` (${r.doctor_specialty})`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminPatientsView({ onBack, onSelectPatient }: { onBack: () => void; onSelectPatient: (id: string) => void }) {
  const { data: patients = [], isLoading } = useAdminPatients()
  const [search, setSearch] = useState('')

  const list = search.trim()
    ? patients.filter((p: any) => {
        const q = search.trim().toLowerCase()
        return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
      })
    : patients

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour à l'administration
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Propriétaires d'animaux</h1>
        <p className="text-sm text-gray-500 mb-5">{patients.length} compte{patients.length > 1 ? 's' : ''} au total</p>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email..."
          className="input text-sm mb-4" />

        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-sm">Aucun résultat.</p>
          </div>
        ) : (
          <div className="card p-2">
            {list.map((p: any) => (
              <button key={p.user_id} onClick={() => onSelectPatient(p.user_id)}
                className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm flex-shrink-0">
                  {(p.first_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  <p>{p.animals_count} animal{p.animals_count > 1 ? 'aux' : ''}</p>
                  <p>{p.appointments_count} RDV</p>
                </div>
                <span className="text-gray-300 text-lg flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminPatientDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { data: p, isLoading } = useAdminPatientDetail(userId)

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour aux propriétaires
        </button>

        {isLoading || !p ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-sage-500 flex items-center justify-center text-xl text-white font-bold overflow-hidden flex-shrink-0">
                {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : (p.first_name?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{p.first_name} {p.last_name}</h1>
                <p className="text-sm text-gray-500">Propriétaire d'animal</p>
              </div>
            </div>

            {/* Coordonnées */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Coordonnées</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 mb-5">
              <div><span className="text-gray-400 text-xs block">Email</span>{p.email}</div>
              <div><span className="text-gray-400 text-xs block">Téléphone</span>{p.phone || '—'}</div>
              <div className="col-span-2"><span className="text-gray-400 text-xs block">Adresse</span>{p.address || '—'}</div>
              <div><span className="text-gray-400 text-xs block">Date de naissance</span>{p.date_of_birth ? format(new Date(p.date_of_birth), "d MMMM yyyy", { locale: fr }) : '—'}</div>
              <div><span className="text-gray-400 text-xs block">Inscrit le</span>{format(new Date(p.created_at), "d MMMM yyyy", { locale: fr })}</div>
            </div>

            {/* Activité */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activité</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{p.animals?.length ?? 0}</p>
                <p className="text-[11px] text-gray-400">Animaux</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{p.appointments_total}</p>
                <p className="text-[11px] text-gray-400">RDV totaux</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-sage-600 tabular-nums">{p.appointments_upcoming}</p>
                <p className="text-[11px] text-gray-400">À venir</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-red-500 tabular-nums">{p.appointments_cancelled}</p>
                <p className="text-[11px] text-gray-400">Annulés</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{p.reviews_written}</p>
                <p className="text-[11px] text-gray-400">Avis rédigés</p>
              </div>
            </div>

            {/* Animaux */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Animaux</h3>
            {(!p.animals || p.animals.length === 0) ? (
              <p className="text-sm text-gray-400">Aucun animal enregistré.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.animals.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
                      {a.avatar_url ? <img src={a.avatar_url} className="w-full h-full object-cover" alt="" /> : '🐾'}
                    </div>
                    <span className="text-sm text-gray-700">{a.name} <span className="text-gray-400">· {a.species}</span></span>
                  </div>
                ))}
              </div>
            )}

            <a href={`mailto:${p.email}`} className="btn-secondary text-sm px-4 py-2 inline-block mt-5">
              ✉️ Contacter
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminClinicsView({ onBack, onSelectClinic }: { onBack: () => void; onSelectClinic: (id: string) => void }) {
  const { data: clinics = [], isLoading } = useAdminClinics()
  const [search, setSearch] = useState('')

  const list = search.trim()
    ? clinics.filter((c: any) => {
        const q = search.trim().toLowerCase()
        return c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q) || c.owner_name?.toLowerCase().includes(q)
      })
    : clinics

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour à l'administration
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Cabinets</h1>
        <p className="text-sm text-gray-500 mb-5">{clinics.length} cabinet{clinics.length > 1 ? 's' : ''} au total</p>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, ville ou propriétaire..."
          className="input text-sm mb-4" />

        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-sm">Aucun résultat.</p>
          </div>
        ) : (
          <div className="card p-2">
            {list.map((c: any) => (
              <button key={c.clinic_id} onClick={() => onSelectClinic(c.clinic_id)}
                className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                  {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" alt="" /> : '🏥'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.city || '—'} · {c.owner_name || c.owner_email}</p>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  <p>{c.members_count} praticien{c.members_count > 1 ? 's' : ''}</p>
                  <p>{c.secretaries_count} secrétariat{c.secretaries_count > 1 ? 's' : ''}</p>
                </div>
                <span className="text-gray-300 text-lg flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminClinicDetail({ clinicId, onBack, onSelectDoctor }: {
  clinicId: string; onBack: () => void; onSelectDoctor: (id: string) => void
}) {
  const { data: c, isLoading } = useAdminClinicDetail(clinicId)

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour aux cabinets
        </button>

        {isLoading || !c ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" alt="" /> : '🏥'}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{c.name}</h1>
                <p className="text-sm text-gray-500">{c.city}</p>
              </div>
            </div>

            {/* Coordonnées */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Coordonnées</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 mb-5">
              <div className="col-span-2"><span className="text-gray-400 text-xs block">Adresse</span>{c.address ? `${c.address}${c.city ? ', ' + c.city : ''}` : (c.city || '—')}</div>
              <div><span className="text-gray-400 text-xs block">Téléphone</span>{c.phone || '—'}</div>
              <div><span className="text-gray-400 text-xs block">Code d'invitation</span>{c.invite_code || '—'}</div>
              <div className="col-span-2"><span className="text-gray-400 text-xs block">Propriétaire</span>{c.owner_name} ({c.owner_email})</div>
            </div>

            {/* Activité */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activité</h3>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{c.members?.length ?? 0}</p>
                <p className="text-[11px] text-gray-400">Praticiens</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{c.secretaries?.length ?? 0}</p>
                <p className="text-[11px] text-gray-400">Secrétariats</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{c.appointments_total}</p>
                <p className="text-[11px] text-gray-400">RDV totaux</p>
              </div>
            </div>

            {/* Praticiens membres */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Praticiens membres</h3>
            {(!c.members || c.members.length === 0) ? (
              <p className="text-sm text-gray-400 mb-5">Aucun praticien membre.</p>
            ) : (
              <div className="space-y-1.5 mb-5">
                {c.members.map((m: any) => (
                  <button key={m.doctor_id} onClick={() => onSelectDoctor(m.doctor_id)}
                    className="flex items-center gap-2 w-full text-left p-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-gray-800 flex-1">
                      {m.first_name} {m.last_name} <span className="text-gray-400">· {m.specialty}</span>
                      {m.is_owner && <span className="text-xs text-sage-600 ml-1">(propriétaire)</span>}
                    </span>
                    <span className={STATUS_BADGE[m.verification_status]}>{STATUS_LABEL[m.verification_status]}</span>
                    <span className="text-gray-300">›</span>
                  </button>
                ))}
              </div>
            )}

            {/* Secrétariat */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Secrétariat</h3>
            {(!c.secretaries || c.secretaries.length === 0) ? (
              <p className="text-sm text-gray-400">Aucun compte secrétariat.</p>
            ) : (
              <ul className="space-y-1">
                {c.secretaries.map((s: any) => (
                  <li key={s.user_id} className="text-sm text-gray-700">
                    {s.first_name} {s.last_name} <span className="text-gray-400">· {s.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminDoctorDetail({ doctorId, onBack }: { doctorId: string; onBack: () => void }) {
  const { data: d, isLoading } = useAdminDoctorDetail(doctorId)
  const reviewDoctor = useAdminReviewDoctor()
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')

  async function handleApprove() {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: true })
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la validation.')
    }
  }

  async function handleReject() {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: false, reason: rejectReason.trim() || undefined })
      setRejecting(false)
      setRejectReason('')
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du rejet.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour à l'administration
        </button>

        {isLoading || !d ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <>
            <div className="card p-6 mb-4">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-sage-500 flex items-center justify-center text-xl text-white font-bold overflow-hidden flex-shrink-0">
                    {d.avatar_url ? <img src={d.avatar_url} className="w-full h-full object-cover" alt="" /> : (d.first_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">{d.first_name} {d.last_name}</h1>
                    <p className="text-sm text-gray-500">{d.specialty}</p>
                  </div>
                </div>
                <span className={STATUS_BADGE[d.verification_status]}>{STATUS_LABEL[d.verification_status]}</span>
              </div>

              {d.verification_rejected_reason && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                  Motif du rejet : {d.verification_rejected_reason}
                </div>
              )}

              {/* Coordonnées */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Coordonnées</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 mb-5">
                <div><span className="text-gray-400 text-xs block">Email</span>{d.email}</div>
                <div><span className="text-gray-400 text-xs block">Téléphone</span>{d.phone || '—'}</div>
                <div className="col-span-2"><span className="text-gray-400 text-xs block">Adresse</span>{d.address ? `${d.address}${d.city ? ', ' + d.city : ''}` : (d.city || '—')}</div>
                <div><span className="text-gray-400 text-xs block">Cabinet</span>{d.clinic ? `${d.clinic.name}${d.clinic.is_owner ? ' (propriétaire)' : ' (membre)'}` : 'Aucun'}</div>
                <div><span className="text-gray-400 text-xs block">N° RPPS</span>{d.rpps_number || '—'}</div>
                <div><span className="text-gray-400 text-xs block">Tarif consultation</span>{d.consultation_price} €</div>
                <div><span className="text-gray-400 text-xs block">Déplacement à domicile</span>{d.home_visit ? 'Oui' : 'Non'}</div>
                <div className="col-span-2"><span className="text-gray-400 text-xs block">Espèces acceptées</span>{d.accepted_species?.length ? d.accepted_species.join(', ') : '—'}</div>
                <div><span className="text-gray-400 text-xs block">Inscrit le</span>{format(new Date(d.created_at), "d MMMM yyyy", { locale: fr })}</div>
              </div>

              {d.bio && (
                <>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Biographie</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 mb-5">{d.bio}</p>
                </>
              )}

              {/* Activité */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activité</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{d.appointments_total}</p>
                  <p className="text-[11px] text-gray-400">RDV totaux</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-sage-600 tabular-nums">{d.appointments_upcoming}</p>
                  <p className="text-[11px] text-gray-400">À venir</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{d.appointments_completed}</p>
                  <p className="text-[11px] text-gray-400">Terminés</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-red-500 tabular-nums">{d.appointments_cancelled}</p>
                  <p className="text-[11px] text-gray-400">Annulés</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{d.review_count > 0 ? `${d.average_rating} ★` : '—'}</p>
                  <p className="text-[11px] text-gray-400">{d.review_count} avis</p>
                </div>
              </div>

              {/* Documents */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Documents justificatifs</h3>
              {(!d.documents || d.documents.length === 0) ? (
                <p className="text-sm text-amber-600 mb-2">Aucun document déposé.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.documents.map((doc: any) => (
                    <li key={doc.id}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm text-sage-600 hover:underline">
                        📄 {doc.document_type} — {doc.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="card p-6">
              {rejecting ? (
                <div className="space-y-2">
                  <input className="input text-sm" placeholder="Motif du rejet (optionnel, visible par le praticien)"
                    value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={handleReject} disabled={reviewDoctor.isPending}
                      className="btn-primary bg-red-500 hover:bg-red-600 text-sm px-4 py-2">
                      Confirmer le rejet
                    </button>
                    <button onClick={() => { setRejecting(false); setRejectReason('') }} className="btn-secondary text-sm px-4 py-2">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {d.verification_status !== 'verified' && (
                    <button onClick={handleApprove} disabled={reviewDoctor.isPending} className="btn-primary text-sm px-4 py-2">
                      ✓ Valider
                    </button>
                  )}
                  {d.verification_status !== 'rejected' && (
                    <button onClick={() => setRejecting(true)} disabled={reviewDoctor.isPending}
                      className="btn-secondary text-sm px-4 py-2 text-red-500">
                      ✕ Rejeter
                    </button>
                  )}
                  <a href={`mailto:${d.email}`} className="btn-secondary text-sm px-4 py-2">
                    ✉️ Contacter
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
