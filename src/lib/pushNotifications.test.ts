import { describe, it, expect } from 'vitest'
import { urlForNotificationType, urlBase64ToUint8Array } from './pushNotifications'

describe('urlForNotificationType', () => {
  it('renvoie /messages pour un nouveau message', () => {
    expect(urlForNotificationType('new_message')).toBe('/messages')
  })

  it('renvoie / pour tous les autres types connus', () => {
    expect(urlForNotificationType('appointment_confirmed')).toBe('/')
    expect(urlForNotificationType('appointment_cancelled')).toBe('/')
    expect(urlForNotificationType('appointment_reminder')).toBe('/')
    expect(urlForNotificationType('new_review')).toBe('/')
    expect(urlForNotificationType('doctor_verified')).toBe('/')
    expect(urlForNotificationType('doctor_rejected')).toBe('/')
    expect(urlForNotificationType('waitlist_slot_available')).toBe('/')
    expect(urlForNotificationType('vaccine_reminder')).toBe('/')
  })

  it('renvoie / si le type est absent', () => {
    expect(urlForNotificationType(undefined)).toBe('/')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('convertit une clé base64url standard en Uint8Array de la bonne longueur', () => {
    // Clé VAPID publique de test (65 octets pour un point EC P-256 non compressé)
    const key = 'BCN1S4kQGKcRQMAyV-JQxuiYhB6nnlrkSk2jodI7Pj506xaxk8cv23gWlUDt8gd7DGnGc4be76ARpB-xWa79JZM'
    const result = urlBase64ToUint8Array(key)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(65)
    expect(result[0]).toBe(0x04) // point EC non compressé commence toujours par 0x04
  })

  it('gère correctement le padding manquant (base64url sans "=")', () => {
    // "AB" en base64 standard vaut 1 octet (0x00), mais nécessite un padding "==" pour être décodable
    const result = urlBase64ToUint8Array('AA')
    expect(result.length).toBe(1)
    expect(result[0]).toBe(0)
  })

  it('remplace correctement les caractères base64url (-, _) par leurs équivalents standard (+, /)', () => {
    // Compare le résultat d'une même valeur encodée en base64url vs base64 standard
    const standard = urlBase64ToUint8Array('Pj4+') // "><>"  en base64 standard, pas de - ni _
    const urlSafe = urlBase64ToUint8Array('Pj4-')  // équivalent base64url attendu (dernier + -> -)
    expect(Array.from(urlSafe)).toEqual(Array.from(standard))
  })
})
