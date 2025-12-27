import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { SongNoteList, parseNote, noteName, parseNoteString, serializeNote, stepDuration } from '@leafo/lml'

interface LmlInputProps {
  defaultValue: string
  onChange: (value: string) => void
  onSelectionChange?: (selection: [number, number]) => void
  songObj?: SongNoteList | null
}

export interface LmlInputHandle {
  getValue: () => string
}

export const LmlInput = forwardRef<LmlInputHandle, LmlInputProps>(function LmlInput(
  { defaultValue, onChange, onSelectionChange, songObj },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastSelectionRef = useRef<[number, number]>([-1, -1])

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getValue: () => textareaRef.current?.value ?? '',
  }))

  // Trigger initial parse on mount
  useEffect(() => {
    onChange(defaultValue)
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

  const handleTranspose = (semitones: number) => {
    if (!songObj || !textareaRef.current) return

    const textarea = textareaRef.current
    const selStart = textarea.selectionStart
    const selEnd = textarea.selectionEnd

    const noteIndices = songObj.findNotesForSelection(selStart, selEnd)
    if (noteIndices.size === 0) return

    const lmlText = textarea.value
    const replacements: [number, number, string][] = []

    noteIndices.forEach(idx => {
      const note = songObj[idx]
      if (!note.sourceLocation) return

      const [start, end] = note.sourceLocation
      const oldText = lmlText.substring(start, end)

      const parsed = parseNoteString(oldText)
      if (!parsed) return

      // Transpose using the already-computed note.note (which is normalized)
      const newPitch = parseNote(note.note) + semitones
      const newNoteStr = noteName(newPitch)  // e.g., "C#5" or "D5"

      // Parse the new note name (letter, optional #, octave)
      const newNoteMatch = newNoteStr.match(/^([A-G])(#)?(\d+)$/)
      if (!newNoteMatch) return
      const [, newBaseLetter, hasSharp, newOctaveNum] = newNoteMatch

      // Preserve original case
      const isLowercase = parsed.name === parsed.name.toLowerCase()

      // Update parsed note with new pitch info
      parsed.name = isLowercase ? newBaseLetter.toLowerCase() : newBaseLetter
      parsed.accidental = hasSharp ? '+' : undefined
      parsed.octave = newOctaveNum

      const newText = serializeNote(parsed, isLowercase)
      replacements.push([start, end, newText])
    })

    // Sort in reverse order to preserve offsets when applying
    replacements.sort((a, b) => b[0] - a[0])

    // Calculate separate adjustments for selection start and end
    let startAdjustment = 0
    let endAdjustment = 0
    for (const [start, end, newText] of replacements) {
      const lengthDelta = newText.length - (end - start)
      if (start < selStart) startAdjustment += lengthDelta
      if (start < selEnd) endAdjustment += lengthDelta
    }

    // Apply replacements
    let newLmlText = lmlText
    for (const [start, end, newText] of replacements) {
      newLmlText = newLmlText.slice(0, start) + newText + newLmlText.slice(end)
    }

    // Update textarea directly and restore selection
    textarea.value = newLmlText
    textarea.setSelectionRange(selStart + startAdjustment, selEnd + endAdjustment)

    // Trigger re-parse
    onChange(newLmlText)
  }

  const handleDurationChange = (delta: number, pow2 = false) => {
    // delta: +1 to increase duration, -1 to decrease
    if (!songObj || !textareaRef.current) return

    const textarea = textareaRef.current
    const selStart = textarea.selectionStart
    const selEnd = textarea.selectionEnd

    const noteIndices = songObj.findNotesForSelection(selStart, selEnd)
    if (noteIndices.size === 0) return

    const lmlText = textarea.value
    const replacements: [number, number, string][] = []

    noteIndices.forEach(idx => {
      const note = songObj[idx]
      if (!note.sourceLocation) return

      const [start, end] = note.sourceLocation
      const oldText = lmlText.substring(start, end)

      const parsed = parseNoteString(oldText)
      if (!parsed) return

      // Preserve original case
      const isLowercase = parsed.name === parsed.name.toLowerCase()

      // Step the duration
      parsed.duration = stepDuration(parsed.duration, delta, pow2)

      const newText = serializeNote(parsed, isLowercase)
      replacements.push([start, end, newText])
    })

    // Sort in reverse order to preserve offsets when applying
    replacements.sort((a, b) => b[0] - a[0])

    // Calculate separate adjustments for selection start and end
    let startAdjustment = 0
    let endAdjustment = 0
    for (const [start, end, newText] of replacements) {
      const lengthDelta = newText.length - (end - start)
      if (start < selStart) startAdjustment += lengthDelta
      if (start < selEnd) endAdjustment += lengthDelta
    }

    // Apply replacements
    let newLmlText = lmlText
    for (const [start, end, newText] of replacements) {
      newLmlText = newLmlText.slice(0, start) + newText + newLmlText.slice(end)
    }

    // Update textarea and restore selection
    textarea.value = newLmlText
    textarea.setSelectionRange(selStart + startAdjustment, selEnd + endAdjustment)

    onChange(newLmlText)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const direction = e.key === 'ArrowUp' ? 1 : -1
      const semitones = e.shiftKey ? 12 : 1
      handleTranspose(direction * semitones)
    } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      handleDurationChange(delta, e.shiftKey)
    }
  }

  const handleChange = () => {
    if (textareaRef.current) {
      onChange(textareaRef.current.value)
    }
  }

  return (
    <div className="input-panel">
      <div className="panel-header">
        <span>LML Input</span>
      </div>
      <textarea
        ref={textareaRef}
        className="lml-textarea"
        defaultValue={defaultValue}
        onChange={handleChange}
        onSelect={handleSelectionChange}
        onKeyDown={handleKeyDown}
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
