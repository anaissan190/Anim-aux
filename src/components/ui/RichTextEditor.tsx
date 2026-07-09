// src/components/ui/RichTextEditor.tsx
import { useRef, useEffect } from 'react'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export default function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Ne synchronise le contenu depuis `value` qu'au montage (pas à chaque
  // frappe) : sinon le curseur revient au début du texte à chaque caractère.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exec(command: string) {
    document.execCommand(command, false)
    ref.current?.focus()
    handleInput()
  }

  function handleInput() {
    if (!ref.current) return
    onChange(sanitizeHtml(ref.current.innerHTML))
  }

  const isEmpty = !value || value === '<br>'

  const ToolbarButton = ({ label, command, style }: { label: string; command: string; style?: React.CSSProperties }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={() => exec(command)}
      style={style}
      className="w-7 h-7 rounded-lg hover:bg-gray-200 text-sm text-gray-600 flex items-center justify-center transition-colors"
    >
      {label}
    </button>
  )

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${className ?? ''}`}>
      <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-1.5 py-1.5">
        <ToolbarButton label="B" command="bold" style={{ fontWeight: 800 }} />
        <ToolbarButton label="I" command="italic" style={{ fontStyle: 'italic' }} />
        <ToolbarButton label="U" command="underline" style={{ textDecoration: 'underline' }} />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarButton label="•—" command="insertUnorderedList" />
        <ToolbarButton label="1." command="insertOrderedList" />
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <span className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          suppressContentEditableWarning
          className="min-h-[112px] px-3 py-2.5 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1"
        />
      </div>
    </div>
  )
}
