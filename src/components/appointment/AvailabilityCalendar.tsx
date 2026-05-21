// src/components/appointment/AvailabilityCalendar.tsx
import { useState } from 'react'
import { format, addDays, startOfToday, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAvailableSlots } from '@/hooks/useData'

interface Props {
  doctorId: string
  onSelect: (slot: Date) => void
  selected: Date | null
}

export default function AvailabilityCalendar({ doctorId, onSelect, selected }: Props) {
  const today = startOfToday()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeDay, setActiveDay] = useState<Date | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + weekOffset * 7))

  const { data: slots = [], isLoading } = useAvailableSlots(doctorId, activeDay)

  return (
    <div className="space-y-4">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">
          {format(days[0], 'd MMM', { locale: fr })} – {format(days[6], 'd MMM yyyy', { locale: fr })}
        </span>
        <button onClick={() => setWeekOffset(w => Math.min(8, w + 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => (
          <button key={day.toISOString()}
            onClick={() => setActiveDay(isSameDay(day, activeDay ?? new Date(0)) ? null : day)}
            className={`flex flex-col items-center py-2 rounded-xl text-xs font-medium transition-colors
              ${isSameDay(day, activeDay ?? new Date(0))
                ? 'bg-sage-500 text-white'
                : 'hover:bg-sage-50 text-gray-700'}`}>
            <span className="text-gray-400 text-xs mb-1">{format(day, 'EEE', { locale: fr })}</span>
            <span>{format(day, 'd')}</span>
          </button>
        ))}
      </div>

      {/* Créneaux horaires */}
      {activeDay && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">
              Aucun créneau disponible ce jour
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => (
                <button key={slot.toISOString()}
                  onClick={() => onSelect(slot)}
                  className={`py-2 text-sm font-medium rounded-xl border transition-colors
                    ${selected && isSameDay(slot, selected) && slot.getHours() === selected.getHours() && slot.getMinutes() === selected.getMinutes()
                      ? 'bg-sage-500 border-sage-500 text-white'
                      : 'border-gray-200 hover:border-sage-400 hover:text-sage-600'}`}>
                  {format(slot, 'HH:mm')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
