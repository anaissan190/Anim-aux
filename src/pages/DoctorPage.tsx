// src/pages/DoctorPage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDoctor, useDoctorReviews, useCreateReview, useDoctorPublicClinic } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import StarRating from '@/components/ui/StarRating'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function DoctorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const { data: doctor, isLoading } = useDoctor(id!)
  const { data: reviews = [] } = useDoctorReviews(id!)
  const { data: clinic } = useDoctorPublicClinic(id)
  const createReview = useCreateReview()

  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSent, setReviewSent] = useState(false)

  async function submitReview() {
    setReviewError('')
    try {
      await createReview.mutateAsync({ doctorId: id!, rating, comment: comment.trim() || undefined })
      setShowReviewForm(false)
      setRating(5)
      setComment('')
      setReviewSent(true)
      setTimeout(() => setReviewSent(false), 4000)
    } catch (e: any) {
      setReviewError(e.message ?? "Erreur lors de l'envoi de l'avis.")
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-48 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )

  if (!doctor) return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Praticien introuvable.</p>
        <Link to="/search" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
      </div>
    </div>
  )

  // Un profil non vérifié reste invisible du public même via un lien direct
  // (cohérent avec son absence des résultats de recherche, voir useDoctors) —
  // sauf pour le praticien lui-même, qui doit pouvoir se prévisualiser.
  const isOwnProfile = user?.id === doctor.user_id
  if (doctor.verification_status !== 'verified' && !isOwnProfile) return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Ce profil n&apos;est pas encore disponible.</p>
        <Link to="/search" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
      </div>
    </div>
  )

  const name = doctor.profiles
    ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}`
    : 'Praticien'

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BackButton fallback="/search" />
        <div className="grid md:grid-cols-3 gap-6">

          {/* Colonne principale */}
          <div className="md:col-span-2 space-y-5">
            {/* En-tête */}
            <div className="card p-6 flex gap-5">
              <div className="w-20 h-20 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {doctor.profiles?.avatar_url ? (
                  <img src={doctor.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-sage-600">{name[0]}</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                <p className="text-sage-600 font-medium">{doctor.specialty}</p>
                {clinic ? (
                  <div className="mt-1 flex items-center gap-2">
                    {clinic.logo_url && (
                      <img src={clinic.logo_url} alt={clinic.clinic_name}
                        className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-gray-700 font-medium">🏥 Membre du cabinet {clinic.clinic_name}</p>
                      {(clinic.address || clinic.city) && (
                        <p className="text-sm text-gray-500">📍 {clinic.address ?? clinic.city}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  doctor.city && <p className="text-sm text-gray-500 mt-1">📍 {doctor.address ?? doctor.city}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={doctor.average_rating} />
                  <span className="text-sm text-gray-500">
                    {doctor.average_rating.toFixed(1)} ({doctor.review_count} avis)
                  </span>
                  {doctor.is_verified && <span className="badge-green">✓ Vérifié</span>}
                </div>
              </div>
            </div>

            {/* Bio */}
            {doctor.bio && (
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-3">À propos</h2>
                <div
                  className="text-gray-600 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(doctor.bio) }}
                />
              </div>
            )}

            {/* Carte */}
            {doctor.lat && doctor.lng && (
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-3">Localisation</h2>
                <div className="h-48 bg-sage-50 rounded-xl flex items-center justify-center text-sage-400 text-sm">
                  📍 {clinic ? (clinic.address ?? clinic.city) : (doctor.address ?? doctor.city)}
                  <br />
                  <span className="text-xs text-gray-400">(carte Leaflet — activée avec coordonnées réelles)</span>
                </div>
              </div>
            )}

            {/* Avis */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Avis patients ({reviews.length})
              </h2>

              {/* Laisser un avis : indépendant de tout RDV, sans limite */}
              {user?.role === 'patient' && (
                <div className="mb-5 pb-5 border-b border-gray-100">
                  {reviewSent && (
                    <p className="text-sm text-green-600 font-medium mb-2">✓ Votre avis a bien été envoyé, merci !</p>
                  )}
                  {!showReviewForm ? (
                    <button onClick={() => setShowReviewForm(true)} className="btn-secondary text-sm">
                      ⭐ Laisser un avis
                    </button>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" onClick={() => setRating(n)}
                            className={`text-lg leading-none ${n <= rating ? 'text-amber-400' : 'text-gray-300'}`}>
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea value={comment} onChange={e => setComment(e.target.value)}
                        className="input text-sm resize-none" rows={2}
                        placeholder="Votre commentaire (facultatif)..." />
                      {reviewError && <p className="text-red-500 text-xs mt-1">{reviewError}</p>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={submitReview} disabled={createReview.isPending} className="btn-primary text-xs px-3 py-1.5">
                          {createReview.isPending ? 'Envoi...' : 'Envoyer'}
                        </button>
                        <button onClick={() => setShowReviewForm(false)} className="btn-secondary text-xs px-3 py-1.5">Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reviews.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun avis pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 bg-sage-100 rounded-full flex items-center justify-center text-xs text-sage-700 font-medium">
                          {(r as any).profiles?.first_name?.[0] ?? '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {(r as any).profiles?.first_name
                            ? `${(r as any).profiles.first_name}${(r as any).profiles.last_name ? ' ' + (r as any).profiles.last_name[0].toUpperCase() + '.' : ''}`
                            : 'Patient anonyme'}
                        </span>
                        <StarRating rating={r.rating} size="sm" />
                        <span className="text-xs text-gray-400 ml-auto">
                          {format(new Date(r.created_at), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 ml-9">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — prise de RDV */}
          <div className="md:col-span-1">
            <div className="card p-5 sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-1">Prendre rendez-vous</h2>
              <p className="text-2xl font-bold text-sage-600 mb-4">
                {doctor.consultation_price}€
                <span className="text-sm font-normal text-gray-400 ml-1">/ consultation</span>
              </p>
              {user ? (
                <Link to={`/book/${doctor.id}`} className="btn-primary block text-center">
                  Voir les disponibilités
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link to="/login" className="btn-primary block text-center">Se connecter</Link>
                  <Link to="/register" className="btn-secondary block text-center text-sm">Créer un compte</Link>
                </div>
              )}
              {doctor.profiles?.phone && (
                <a href={`tel:${doctor.profiles.phone}`}
                  className="btn-secondary block text-center text-sm mt-2">
                  📞 {doctor.profiles.phone}
                </a>
              )}
              {clinic?.phone && (
                <a href={`tel:${clinic.phone}`}
                  className="btn-secondary block text-center text-sm mt-2">
                  📞 Cabinet : {clinic.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
