import { useEffect, useRef, memo } from 'react'

interface LmlInputProps {
  value: string
  onChange: (value: string) => void
  onSelectionChange?: (selection: [number, number]) => void
}

export const LmlInput = memo(function LmlInput({ value, onChange, onSelectionChange }: LmlInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastSelectionRef = useRef<[number, number]>([-1, -1])

  // Trigger initial parse on mount
  useEffect(() => {
    onChange(value)
  }, [])

  const handleSelectionChange = () => {
    // Defer to next tick to ensure browser has updated selection
    setTimeout(() => {
      if (textareaRef.current && onSelectionChange) {
        const start = textareaRef.current.selectionStart
        const end = textareaRef.current.selectionEnd

        // Only call callback if selection actually changed
        if (start !== lastSelectionRef.current[0] || end !== lastSelectionRef.current[1]) {
          lastSelectionRef.current = [start, end]
          onSelectionChange([start, end])
        }
      }
    }, 0)
  }

  const handleBlur = () => {
    // Clear selection when focus is lost
    onSelectionChange?.([-1, -1])
  }

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
        onSelect={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onFocus={handleSelectionChange}
        onBlur={handleBlur}
        spellCheck={false}
        placeholder="Enter LML code here..."
      />
    </div>
  )
})
