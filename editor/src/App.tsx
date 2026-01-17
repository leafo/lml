import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  SongParser,
  AutoChords,
  RootAutoChords,
  TriadAutoChords,
  Root5AutoChords,
  ArpAutoChords,
  BossaNovaAutoChords,
  SongNoteList,
} from '@leafo/lml'
import { LmlInput, LmlInputHandle } from './components/LmlInput'
import { OutputTabs } from './components/OutputTabs'
import { PianoRoll } from './components/PianoRoll'
import { usePlayback } from './hooks/usePlayback'
import { useHotkeys } from './hooks/useHotkeys'
import { compress, decompress } from './compression'

const AUTO_CHORD_OPTIONS: { value: string; label: string; generator: typeof AutoChords | false }[] = [
  { value: "disabled", label: "Disabled", generator: false },
  { value: "RootAutoChords", label: "Root", generator: RootAutoChords },
  { value: "TriadAutoChords", label: "Triad", generator: TriadAutoChords },
  { value: "Root5AutoChords", label: "Root+5", generator: Root5AutoChords },
  { value: "ArpAutoChords", label: "Arp", generator: ArpAutoChords },
  { value: "BossaNovaAutoChords", label: "Bossa Nova", generator: BossaNovaAutoChords },
]

const DEFAULT_LML = `# title: Example Song
# bpm: 120

ks0
ts4/4

c5 d e f
g*2 a b
c*4
`

// Get initial LML from URL hash or use default
function getInitialLml(): string {
  const hash = window.location.hash.slice(1)
  if (hash) {
    try {
      return decompress(hash)
    } catch (e) {
      console.warn('Failed to decompress URL hash:', e)
    }
  }
  return DEFAULT_LML
}

export function App() {
  const inputRef = useRef<LmlInputHandle>(null)
  const [autoChordType, setAutoChordType] = useState("Root5AutoChords")
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [initialLml] = useState(getInitialLml)
  const [parseResult, setParseResult] = useState<{
    ast: unknown
    song: {
      notes: { note: string; start: number; duration: number; sourceLocation?: [number, number] }[]
      metadata?: { beatsPerMeasure?: number }
      tracks?: { note: string; start: number; duration: number; sourceLocation?: [number, number] }[][]
      measures?: { start: number; beats: number }[]
    } | null
    songObj: SongNoteList | null
    error: string | null
    timing: { parse: number; compile: number } | null
  }>({ ast: null, song: null, songObj: null, error: null, timing: null })
  const [canvasTime, setCanvasTime] = useState<number | null>(null)
  const [cursorPosition, setCursorPosition] = useState<[number, number]>([0, 0])

  const { isPlaying, currentBeat, play, stop } = usePlayback({
    songObj: parseResult.songObj,
  })

  // Compute highlighted notes based on cursor position
  const highlightedNotes = useMemo(() => {
    if (!parseResult.songObj) return new Set<number>()
    return parseResult.songObj.findNotesForSelection(cursorPosition[0], cursorPosition[1])
  }, [cursorPosition[0], cursorPosition[1], parseResult.songObj])

  // Get the earliest beat from selected notes (or 0 if none selected)
  const getEarliestSelectedBeat = useCallback((): number => {
    if (!parseResult.songObj || highlightedNotes.size === 0) {
      return 0
    }

    let earliestBeat = Infinity
    for (const idx of highlightedNotes) {
      const note = parseResult.songObj[idx]
      if (note && note.start < earliestBeat) {
        earliestBeat = note.start
      }
    }

    return earliestBeat === Infinity ? 0 : earliestBeat
  }, [parseResult.songObj, highlightedNotes])

  // Hotkey handlers
  const handlePlayFromSelection = useCallback(() => {
    if (!parseResult.songObj || parseResult.songObj.length === 0) return
    const startBeat = getEarliestSelectedBeat()
    play(startBeat)
  }, [parseResult.songObj, getEarliestSelectedBeat, play])

  const handleStopPlayback = useCallback(() => {
    if (isPlaying) {
      stop()
    }
  }, [isPlaying, stop])

  // Register global hotkeys
  useHotkeys([
    { key: 'Escape', handler: handleStopPlayback },
    { key: ' ', ctrlKey: true, handler: handlePlayFromSelection },
  ])

  const handleChange = useCallback((text: string) => {
    try {
      const parser = new SongParser()

      const parseStart = performance.now()
      const ast = parser.parse(text)
      const parseEnd = performance.now()

      const autoChordOption = AUTO_CHORD_OPTIONS.find(o => o.value === autoChordType)
      const compileStart = performance.now()
      const song = parser.compile(ast, {
        autoChords: autoChordOption?.generator,
      })
      const compileEnd = performance.now()

      // Convert song to a serializable format
      const songData = {
        notes: [...song].map(note => ({
          note: note.note,
          start: note.start,
          duration: note.duration,
          sourceLocation: note.sourceLocation,
        })),
        metadata: song.metadata,
        tracks: song.tracks?.map(track => [...track].map(note => ({
          note: note.note,
          start: note.start,
          duration: note.duration,
          sourceLocation: note.sourceLocation,
        }))),
        measures: song.getMeasures(),
      }

      setParseResult({
        ast,
        song: songData,
        songObj: song,
        error: null,
        timing: {
          parse: parseEnd - parseStart,
          compile: compileEnd - compileStart,
        },
      })
    } catch (e) {
      let errorMessage: string

      // Use Peggy's format() method for nicely formatted errors with code context
      if (e && typeof e === "object" && "format" in e && typeof e.format === "function") {
        errorMessage = e.format([{ source: "input", text }])
      } else {
        errorMessage = e instanceof Error ? e.message : String(e)
      }

      setParseResult({
        ast: null,
        song: null,
        songObj: null,
        error: errorMessage,
        timing: null,
      })
    }
  }, [autoChordType])

  // Recompile when autoChordType changes
  useEffect(() => {
    if (inputRef.current) {
      handleChange(inputRef.current.getValue())
    }
  }, [autoChordType, handleChange])

  // Handle share button click
  const handleShare = useCallback(async () => {
    if (!inputRef.current) return

    try {
      const lml = inputRef.current.getValue()
      const compressed = compress(lml)
      window.location.hash = compressed

      await navigator.clipboard.writeText(window.location.href)
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch (e) {
      console.error('Failed to share:', e)
      setShareStatus('error')
      setTimeout(() => setShareStatus('idle'), 2000)
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>LML Editor</h1>
        <a href="./docs/" className="header-link">Docs</a>
      </header>
      <main className="main">
        <LmlInput
          ref={inputRef}
          defaultValue={initialLml}
          onChange={handleChange}
          onSelectionChange={setCursorPosition}
          songObj={parseResult.songObj}
          onShare={handleShare}
          shareStatus={shareStatus}
        />
        <OutputTabs
          ast={parseResult.ast}
          song={parseResult.song}
          error={parseResult.error}
          timing={parseResult.timing}
        />
      </main>
      <div className="toolbar">
        <label>
          Auto Chords:
          <select
            value={autoChordType}
            onChange={e => setAutoChordType(e.target.value)}
          >
            {AUTO_CHORD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="play-btn"
          onClick={isPlaying ? stop : play}
          disabled={!parseResult.songObj || parseResult.songObj.length === 0}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        {canvasTime != null && (
          <span className="canvas-timing">
            canvas: {canvasTime < 1 ? `${(canvasTime * 1000).toFixed(0)}µs` : `${canvasTime.toFixed(2)}ms`}
          </span>
        )}
      </div>
      <PianoRoll
        tracks={parseResult.song?.tracks}
        measures={parseResult.song?.measures}
        highlightedNotes={highlightedNotes}
        onRenderTime={setCanvasTime}
        playheadBeat={currentBeat}
      />
    </div>
  )
}
