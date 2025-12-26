import { useEffect, useRef } from 'react'

interface LmlInputProps {
  value: string
  onChange: (value: string) => void
}

export function LmlInput({ value, onChange }: LmlInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Trigger initial parse on mount
  useEffect(() => {
    onChange(value)
  }, [])

  return (
    <div className="input-panel">
      <div className="panel-header">
        <span>LML Input</span>
      </div>
      <textarea
        ref={textareaRef}
        className="lml-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Enter LML code here..."
      />
    </div>
  )
}
