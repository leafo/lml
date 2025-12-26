import { useRef, useEffect, useCallback, useState } from 'react'
import { parseNote } from '../../../dist/index.js'

interface Note {
  note: string
  start: number
  duration: number
}

interface Measure {
  start: number
  beats: number
}

interface PianoRollProps {
  notes: Note[] | null
  measures?: Measure[]
  onRenderTime?: (ms: number) => void
}

const NOTE_HEIGHT = 8
const BEAT_WIDTH = 40
const LEFT_MARGIN = 40

export function PianoRoll({ notes, measures, onRenderTime }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const scrollOffsetRef = useRef(scrollOffset)
  scrollOffsetRef.current = scrollOffset
  const dragRef = useRef<{ isDragging: boolean; startX: number; startOffset: number }>({
    isDragging: false,
    startX: 0,
    startOffset: 0,
  })

  const draw = useCallback(() => {
    const start = performance.now()

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to container size, accounting for device pixel ratio
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#0f0f23'
    ctx.fillRect(0, 0, rect.width, rect.height)

    if (!notes || notes.length === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '14px sans-serif'
      ctx.fillText('No notes to display', 20, rect.height / 2)
      return
    }

    // Parse notes and find range
    const parsedNotes = notes.map(n => ({
      pitch: parseNote(n.note),
      start: n.start,
      duration: n.duration,
      name: n.note,
    }))

    const pitches = parsedNotes.map(n => n.pitch)
    const minPitch = Math.min(...pitches) - 2
    const maxPitch = Math.max(...pitches) + 2
    const pitchRange = maxPitch - minPitch + 1

    const maxTime = Math.max(...parsedNotes.map(n => n.start + n.duration))
    const totalBeats = Math.ceil(maxTime) + 1

    // Calculate dimensions
    const drawWidth = rect.width - LEFT_MARGIN
    const drawHeight = rect.height - 20

    const noteHeight = Math.min(NOTE_HEIGHT, drawHeight / pitchRange)
    const beatWidth = Math.max(BEAT_WIDTH, drawWidth / totalBeats)

    // Draw grid
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 1

    // Horizontal lines (pitch rows)
    for (let p = minPitch; p <= maxPitch; p++) {
      const y = drawHeight - (p - minPitch) * noteHeight
      const isC = p % 12 === 0

      ctx.strokeStyle = isC ? '#2a2a4e' : '#1a1a2e'
      ctx.beginPath()
      ctx.moveTo(LEFT_MARGIN, y)
      ctx.lineTo(rect.width, y)
      ctx.stroke()

      // Label C notes
      if (isC) {
        ctx.fillStyle = '#666'
        ctx.font = '10px monospace'
        ctx.fillText(`C${Math.floor(p / 12)}`, 4, y + 4)
      }
    }

    // Build a map of measure starts for efficient lookup
    const measureStarts = new Map<number, number>()  // beat -> measure number
    if (measures) {
      measures.forEach((m, i) => measureStarts.set(m.start, i))
    }

    // Vertical lines (beats)
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = LEFT_MARGIN + beat * beatWidth + scrollOffset
      if (x < LEFT_MARGIN || x > rect.width) continue
      const measureNum = measureStarts.get(beat)
      const isMeasure = measureNum !== undefined

      ctx.strokeStyle = isMeasure ? '#2a2a4e' : '#1a1a2e'
      ctx.lineWidth = isMeasure ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, drawHeight)
      ctx.stroke()

      // Label measures
      if (isMeasure) {
        ctx.fillStyle = '#666'
        ctx.font = '10px monospace'
        ctx.fillText(`${measureNum}`, x + 4, drawHeight + 14)
      }
    }

    // Draw double line at the end of the song
    if (measures && measures.length > 0) {
      const lastMeasure = measures[measures.length - 1]
      const endBeat = lastMeasure.start + lastMeasure.beats
      const x = LEFT_MARGIN + endBeat * beatWidth + scrollOffset
      if (x >= LEFT_MARGIN && x <= rect.width) {
        ctx.strokeStyle = '#4a4a6e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, drawHeight)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + 4, 0)
        ctx.lineTo(x + 4, drawHeight)
        ctx.stroke()
      }
    }

    // Draw notes
    for (const note of parsedNotes) {
      const x = LEFT_MARGIN + note.start * beatWidth + scrollOffset
      const width = note.duration * beatWidth - 2

      // Skip notes that are off-screen
      if (x + width < LEFT_MARGIN || x > rect.width) continue

      const y = drawHeight - (note.pitch - minPitch + 1) * noteHeight
      const height = noteHeight - 2

      // Note fill
      ctx.fillStyle = '#e94560'
      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, width, height, 3)
      ctx.fill()

      // Note label (if wide enough)
      if (width > 30) {
        ctx.fillStyle = '#fff'
        ctx.font = '10px monospace'
        ctx.fillText(note.name, x + 5, y + height - 2)
      }
    }

    onRenderTime?.(performance.now() - start)
  }, [notes, measures, onRenderTime, scrollOffset])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      draw()
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [draw])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startOffset: scrollOffsetRef.current,
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grabbing'
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.isDragging) return
    const delta = e.clientX - dragRef.current.startX
    setScrollOffset(dragRef.current.startOffset + delta)
  }, [])

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab'
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab'
    }
  }, [])

  return (
    <div className="piano-roll" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'grab' }}
      />
    </div>
  )
}
