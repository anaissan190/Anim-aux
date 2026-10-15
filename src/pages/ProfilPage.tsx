import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { blocksAccountDeletion } from '@/lib/subscription'
import { useAuthStore } from '@/lib/authStore'
import { useCurrentDoctor, useMyClinic, useUpdateProfile, useUpdateDoctor, useDeleteAccount, useExportMyData, usePushSubscriptionStatus, useEnablePushNotifications, useDisablePushNotifications, useDoctorHasPro, useMySubscriptions } from '@/hooks/useData'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { PRACTITIONER_TYPES, getPractitionerType } from '@/lib/practitionerTypes'
import PractitionerTypePicker from '@/components/doctor/PractitionerTypePicker'
import { PRACTICE_SPECIES_OPTIONS } from '@/lib/animalSpecies'
import { showToast } from '@/lib/toast'
import { compressImage } from '@/lib/compressImage'
import ProfileSummary from '@/components/doctor/ProfileSummary'
import SubTabs from '@/components/ui/SubTabs'
import Toggle from '@/components/ui/Toggle'
import { PATIENT_PROFILE_SECTIONS, parsePatientProfileSection, roleLabel, type PatientProfileSection } from '@/lib/profileSections'
import { patientProfileCompleteness } from '@/lib/profileCompleteness'
import { removeStoredFiles } from '@/lib/storageCleanup'

export default function ProfilPage() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  // Sous-onglet ouvert (?section=notifications, par exemple) ; « Mon profil » par défaut.
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<PatientProfileSection>(parsePatientProfileSection(searchParams.get('section')))
  const { data: doctor } = useCurrentDoctor()
  const { data: hasPro } = useDoctorHasPro(doctor?.id)
  const { data: mySubscriptions = [] } = useMySubscriptions()
  const { data: clinic, isLoading: clinicLoading } = useMyClinic(doctor?.id)
  const updateProfile = useUpdateProfile()
  const updateDoctor = useUpdateDoctor()
  const deleteAccount = useDeleteAccount()
  const exportMyData = useExportMyData()
  const { data: pushStatus } = usePushSubscriptionStatus()
  const enablePush = useEnablePushNotifications()
  const disablePush = useDisablePushNotifications()
  const [pushError, setPushError] = useState('')
  const [exportError, setExportError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setPhotoError('')
    try {
      // Compressée avant l'envoi (retour d'Anaïs du 08/09/2026, même
      // correctif que les photos d'animaux) — voir src/lib/compressImage.ts.
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const path = `profiles/${user!.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const previousAvatar = profile?.avatar_url
      await updateProfile.mutateAsync({ avatar_url: data.publicUrl })
      await removeStoredFiles([previousAvatar])
    } catch (e: any) {
      setPhotoError(e.message ?? "Erreur lors de l'envoi de la photo.")
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    try {
      await deleteAccount.mutateAsync()
      await signOut()
      navigate('/')
    } catch (e: any) {
      setDeleteError(e.message ?? 'Erreur lors de la suppression du compte.')
    }
  }

  async function handleExportData() {
    setExportError('')
    try {
      const data = await exportMyData.mutateAsync()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `animeaux-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setExportError(e.message ?? "Erreur lors de l'export des données.")
    }
  }

  async function handleTogglePush() {
    setPushError('')
    try {
      if (pushStatus?.subscribed) await disablePush.mutateAsync()
      else await enablePush.mutateAsync()
    } catch (e: any) {
      setPushError(e.message ?? "Erreur lors de l'activation des notifications.")
    }
  }

  function closeDeleteModal() {
    setConfirmDelete(false)
    setDeleteConfirmText('')
    setDeleteError('')
  }

  const isDoctor = user?.role === 'doctor'

  // Champs profil
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [emergencyName, setEmergencyName]   = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  // Champs praticien
  const [practitionerTypeIds, setPractitionerTypeIds] = useState<string[]>([])
  const [otherProfession, setOtherProfession] = useState('')
  const [bio, setBio]               = useState('')
  const [city, setCity]             = useState('')
  const [address, setAddress]       = useState('')
  const [price, setPrice]           = useState('')
  const [acceptedSpecies, setAcceptedSpecies] = useState<string[]>([])
  const [homeVisit, setHomeVisit]   = useState(false)
  const [messagingEnabled, setMessagingEnabled] = useState(true)
  const [isListed, setIsListed] = useState(true)

  const [loading, setLoading] = useState(false)

  // Préremplir avec les données existantes
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setPhone(profile.phone || '')
      setHomeAddress(profile.address || '')
      setEmergencyName(profile.emergency_contact_name || '')
      setEmergencyPhone(profile.emergency_contact_phone || '')
    }
  }, [profile])

  useEffect(() => {
    if (doctor) {
      // Un métier de doctor.specialties qui ne correspond à aucun libellé
      // connu (ex: profession libre saisie via "Autre" à l'inscription)
      // devient un seul "autre" dans le picker, avec son texte d'origine
      // préservé — sans ça, ré-enregistrer ce formulaire écrasait la
      // profession personnalisée par le mot générique "Autre".
      const ids: string[] = []
      let otherText = ''
      for (const label of doctor.specialties ?? []) {
        const matched = PRACTITIONER_TYPES.find(p => p.label === label)
        if (matched) {
          if (!ids.includes(matched.id)) ids.push(matched.id)
        } else {
          if (!ids.includes('autre')) ids.push('autre')
          otherText = label
        }
      }
      setPractitionerTypeIds(ids)
      setOtherProfession(otherText)
      setBio(doctor.bio || '')
      setCity(doctor.city || '')
      setAddress(doctor.address || '')
      setPrice(doctor.consultation_price?.toString() || '')
      setAcceptedSpecies(doctor.accepted_species || [])
      setHomeVisit(doctor.home_visit || false)
      setMessagingEnabled(doctor.messaging_enabled ?? true)
      setIsListed(doctor.is_listed ?? true)
    }
  }, [doctor])

  function toggleSpecies(id: string) {
    setAcceptedSpecies(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        phone,
        address: homeAddress,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      })
      if (isDoctor) {
        const specialties = practitionerTypeIds
          .map(id => id === 'autre' ? otherProfession.trim() : getPractitionerType(id)?.label)
          .filter((label): label is string => !!label)
        await updateDoctor.mutateAsync({
          specialties,
          bio,
          city,
          address,
          consultation_price: price ? parseInt(price) : undefined,
          accepted_species: acceptedSpecies,
          home_visit: homeVisit,
          messaging_enabled: messagingEnabled,
          is_listed: isListed,
        })
      }
      showToast('✓ Profil mis à jour avec succès !')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const isPatient = user?.role === 'patient'

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      {/* Sur mobile, seul le rôle patient bascule vers la nouvelle coquille
          "Wow / Aurora" (MobileHeader/MobileTabBar) — les autres rôles
          gardent Navbar/BackButton classiques à toutes les largeurs. */}
      {isPatient ? (
        <div className="hidden md:block"><Navbar /></div>
      ) : (
        <Navbar />
      )}

      {isPatient && (
        <div className="md:hidden">
          <MobileHeader className="bg-sage-100/60">
            <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
          </MobileHeader>
        </div>
      )}

      <div className={`max-w-2xl mx-auto px-4 py-8 ${isPatient ? 'pb-28 md:pb-8' : ''}`}>

        {isPatient ? (
          <div className="hidden md:block">
            <BackButton fallback="/dashboard/patient" />
          </div>
        ) : (
          <BackButton fallback={isDoctor ? '/dashboard/doctor?tab=profil' : '/dashboard/patient'} />
        )}

        <div className="space-y-5">
        <ProfileSummary
          name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()}
          subtitle={user?.email}
          avatarUrl={profile?.avatar_url}
          specialties={isDoctor ? (doctor?.specialties ?? []) : [roleLabel(user?.role, user?.is_admin)].filter(Boolean)}
          verification={isDoctor ? (doctor?.verification_status as 'verified' | 'pending' | 'rejected' | undefined) : undefined}
          listed={isDoctor ? doctor?.is_listed : undefined}
          completeness={isDoctor ? undefined : patientProfileCompleteness({
            avatarUrl: profile?.avatar_url,
            phone: profile?.phone,
            homeAddress: profile?.address,
            emergencyName: profile?.emergency_contact_name,
            emergencyPhone: profile?.emergency_contact_phone,
          })}
        />
        <SubTabs items={PATIENT_PROFILE_SECTIONS} value={section} onChange={setSection} label="Sections du profil" />

        {section === 'profil' && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* IDENTITÉ — photo, prénom, nom */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Identité</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 flex-shrink-0 group">
                <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center text-2xl overflow-hidden">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Photo de profil" loading="lazy" />
                    : '👤'}
                </div>
                <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <span className="text-white text-xs font-medium">{photoUploading ? '...' : '📷'}</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Ma photo</p>
                <p className="text-xs text-gray-400">Survolez la photo pour la changer</p>
                {photoError && <p className="text-red-500 text-xs mt-1">{photoError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="profil-first-name" className="text-xs text-gray-500">Prénom</label>
                <input id="profil-first-name" className="input text-sm mt-1" value={firstName}
                  onChange={e => setFirstName(e.target.value)} placeholder="Votre prénom" required />
              </div>
              <div>
                <label htmlFor="profil-last-name" className="text-xs text-gray-500">Nom</label>
                <input id="profil-last-name" className="input text-sm mt-1" value={lastName}
                  onChange={e => setLastName(e.target.value)} placeholder="Votre nom" required />
              </div>
            </div>
          </div>

          {/* COORDONNÉES */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Coordonnées</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="profil-email" className="text-xs text-gray-500">Email</label>
                <input id="profil-email" className="input text-sm mt-1 bg-gray-50 text-gray-500" value={user?.email ?? ''}
                  disabled readOnly />
              </div>
              <div>
                <label htmlFor="profil-phone" className="text-xs text-gray-500">Téléphone</label>
                <input id="profil-phone" className="input text-sm mt-1" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" type="tel" />
              </div>
            </div>
            <div>
              <label htmlFor="profil-home-address" className="text-xs text-gray-500">Adresse postale</label>
              <input id="profil-home-address" className="input text-sm mt-1" value={homeAddress}
                onChange={e => setHomeAddress(e.target.value)} placeholder="12 rue des Lilas, 75001 Paris" />
            </div>
          </div>

          {/* CONTACT D'URGENCE */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-1">🚨 Contact d'urgence</h2>
            <p className="text-xs text-gray-400 mb-4">Facultatif — une personne à prévenir en cas d'urgence.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="profil-emergency-name" className="text-xs text-gray-500">Nom</label>
                <input id="profil-emergency-name" className="input text-sm mt-1" value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)} placeholder="Ex: Marie Dupont" />
              </div>
              <div>
                <label htmlFor="profil-emergency-phone" className="text-xs text-gray-500">Téléphone</label>
                <input id="profil-emergency-phone" className="input text-sm mt-1" value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)} placeholder="06 00 00 00 00" type="tel" />
              </div>
            </div>
          </div>

          {/* Pas de cabinet : accès direct à la création/adhésion, comme sur
              l'onglet Profil du tableau de bord (deux pages profil séparées). */}
          {isDoctor && !clinic && !clinicLoading && (
            <Link to="/dashboard/doctor?tab=disponibilites&view=shared"
              className="card p-4 flex items-center gap-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <span className="text-xl">🏥</span>
              <span>
                <span className="block font-medium text-gray-800">Créer ou rejoindre un cabinet</span>
                <span className="block text-xs text-gray-400">Partagez agenda, tarifs et patientèle avec vos confrères</span>
              </span>
            </Link>
          )}

          {/* INFOS PRO (praticiens uniquement) */}
          {isDoctor && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">🩺 Informations professionnelles</h2>
              <div className="mb-3">
                <PractitionerTypePicker
                  selectedIds={practitionerTypeIds}
                  onChange={setPractitionerTypeIds}
                  otherText={otherProfession}
                  onOtherTextChange={setOtherProfession}
                />
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Bio / Présentation</label>
                <RichTextEditor value={bio} onChange={setBio} placeholder="Décris ton activité, ton expérience…" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">Ville</label>
                  <input className="input text-sm mt-1" value={city}
                    onChange={e => setCity(e.target.value)} placeholder="Paris" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tarif (€)</label>
                  <input className="input text-sm mt-1" value={price}
                    onChange={e => setPrice(e.target.value)} placeholder="50" type="number" min="0" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500">Adresse</label>
                <input className="input text-sm mt-1" value={address}
                  onChange={e => setAddress(e.target.value)} placeholder="12 rue des Lilas, 75001 Paris" />
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1.5">Espèces acceptées</label>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_SPECIES_OPTIONS.map(opt => (
                    <button type="button" key={opt.id} onClick={() => toggleSpecies(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        acceptedSpecies.includes(opt.id)
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-sage-300'
                      }`}>
                      {opt.icon} {opt.id}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={homeVisit} onChange={e => setHomeVisit(e.target.checked)}
                  className="accent-sage-500 w-4 h-4" />
                🏠 Je me déplace à domicile
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-2">
                <input type="checkbox" checked={messagingEnabled} onChange={e => setMessagingEnabled(e.target.checked)}
                  className="accent-sage-500 w-4 h-4" />
                💬 Recevoir des messages des patients
              </label>
              {hasPro === false && (
                <p className="text-xs text-gray-400 mt-1">
                  La messagerie est réservée à l&apos;abonnement : ce réglage s&apos;appliquera dès que vous y passerez.
                </p>
              )}
              <p className="mt-4 text-sm text-gray-500">
                <Link to="/abonnement" className="text-sage-600 font-medium hover:underline">
                  {hasPro === false ? 'Voir les offres et passer à l’abonnement' : 'Mon abonnement'}
                </Link>
              </p>
              {!messagingEnabled && (
                <p className="text-xs text-gray-400 mt-1">
                  Les patients ne pourront plus vous envoyer de nouveaux messages. Vos conversations déjà en cours restent visibles.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-2">
                <input type="checkbox" checked={isListed} onChange={e => setIsListed(e.target.checked)}
                  className="accent-sage-500 w-4 h-4" />
                🔎 Apparaître dans la recherche
              </label>
              {!isListed && (
                <p className="text-xs text-gray-400 mt-1">
                  Votre fiche n&apos;apparaît plus dans les résultats et ne peut plus être ouverte par un lien. Les patients qui ont déjà un rendez-vous avec vous continuent de vous voir, et vous gardez l&apos;accès complet à votre espace.
                </p>
              )}
            </div>
          )}

          {/* BOUTON — confirmation en message glissant (showToast), plus de
              bandeau statique (retour d'Anaïs du 08/09/2026). */}

          {/* Même bouton mobile et desktop depuis le 07/09/2026 — la variante
              contour vert (btn-outline-moss) datait de la coquille "Wow /
              Aurora" et détonnait avec le reste de la refonte. */}
          <div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Enregistrement...' : 'Enregistrer mes informations'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">Enregistre tous les changements de cette page.</p>
          </div>

        </form>
        )}

        {section === 'notifications' && (
          <div className="card p-6">
            {pushStatus === undefined ? (
              <p className="text-sm text-gray-400">Chargement...</p>
            ) : pushStatus.supported ? (
              <>
                {pushError && <p className="text-red-500 text-xs mb-3">{pushError}</p>}
                <Toggle checked={!!pushStatus.subscribed} disabled={enablePush.isPending || disablePush.isPending}
                  onChange={() => handleTogglePush()} label="🔔 Notifications sur cet appareil"
                  description="Recevez une notification même quand Animéaux n'est pas ouvert (nouveau message, RDV confirmé, avis...). S'applique tout de suite, sans bouton Enregistrer." />
              </>
            ) : (
              <p className="text-sm text-gray-500">Les notifications ne sont pas disponibles sur cet appareil ou ce navigateur.</p>
            )}
          </div>
        )}

        {section === 'donnees' && (<>
        {/* EXPORT DES DONNÉES — droit à la portabilité (RGPD art. 20) */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Mes données</h2>
          <p className="text-xs text-gray-500 mb-4">
            Téléchargez une copie de toutes vos données personnelles (profil, animaux, rendez-vous, messages, avis…)
            dans un fichier structuré.
          </p>
          {exportError && <p className="text-red-500 text-xs mb-3">{exportError}</p>}
          <button onClick={handleExportData} disabled={exportMyData.isPending}
            className="btn-secondary text-sm">
            {exportMyData.isPending ? 'Préparation...' : '⬇️ Télécharger mes données'}
          </button>
        </div>

        {/* Déconnexion — sur mobile, Navbar (seul endroit où ce bouton
            existait) est masquée pour le rôle patient, remplacée par la
            coquille "Wow / Aurora" ; sans ça, aucun moyen de se déconnecter. */}
        <button onClick={() => signOut().then(() => navigate('/'))}
          className="md:hidden w-full flex items-center justify-center gap-2 bg-white border border-sand-200 rounded-2xl shadow-sm text-sm text-red-500 font-semibold py-3.5">
          🚪 Déconnexion
        </button>

        {/* ZONE DE DANGER */}
        <div className="card p-6 border border-red-100">
          <h2 className="font-semibold text-red-600 mb-1">Zone de danger</h2>
          <p className="text-xs text-gray-500 mb-4">
            La suppression de votre compte est définitive : profil, rendez-vous, animaux et dossiers de santé,
            messages, avis{isDoctor ? ', cabinet dont vous êtes le créateur' : ''} — tout sera effacé sans possibilité de retour en arrière.
          </p>
          {blocksAccountDeletion(mySubscriptions) && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3 mb-4">
              Vous avez un abonnement en cours : résiliez-le d&apos;abord, puis vous pourrez supprimer votre compte.{' '}
              <Link to="/abonnement" className="font-medium underline">Gérer mon abonnement</Link>
            </p>
          )}
          <button onClick={() => setConfirmDelete(true)} disabled={blocksAccountDeletion(mySubscriptions)}
            className="text-sm text-red-500 hover:underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed">
            Supprimer mon compte
          </button>
        </div>

        </>)}
        </div>

        {/* ÉCRAN INTERMÉDIAIRE DE CONFIRMATION — étape de friction volontaire
            avant une action irréversible : oblige à taper "SUPPRIMER" plutôt
            qu'un simple clic de confirmation. */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-4xl mb-3 text-center">⚠️</div>
              <h2 className="text-lg font-bold text-gray-900 text-center mb-2">
                Supprimer définitivement votre compte ?
              </h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                Cette action est <strong>irréversible</strong>. Seront effacés sans retour en arrière :
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-5 bg-red-50 rounded-xl p-4">
                <li>Votre profil et vos informations personnelles</li>
                <li>Tous vos rendez-vous (passés et à venir)</li>
                <li>Vos animaux et leurs dossiers de santé</li>
                <li>Vos messages et avis</li>
                {isDoctor && <li>Le cabinet dont vous êtes le créateur, le cas échéant</li>}
              </ul>
              <label className="text-xs text-gray-500 block mb-1.5">
                Tapez <strong>SUPPRIMER</strong> pour confirmer
              </label>
              <input className="input text-sm mb-4" value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER" autoFocus />
              {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
              <div className="flex gap-2">
                <button onClick={closeDeleteModal} className="btn-secondary flex-1 text-sm py-2">
                  Annuler
                </button>
                <button onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'SUPPRIMER' || deleteAccount.isPending}
                  className="btn-primary bg-red-500 hover:bg-red-600 flex-1 text-sm py-2">
                  {deleteAccount.isPending ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {isPatient && <MobileTabBar />}
    </div>
  )
}
