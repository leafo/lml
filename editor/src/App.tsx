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

c5 d5 e5 f5
g5.2 a5 b5
c6.4
`

export function App() {
  const inputRef = useRef<LmlInputHandle>(null)
  const [autoChordType, setAutoChordType] = useState("Root5AutoChords")
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

  // Compute highlighted notes based on cursor position
  const highlightedNotes = useMemo(() => {
    if (!parseResult.songObj) return new Set<number>()
    return parseResult.songObj.findNotesForSelection(cursorPosition[0], cursorPosition[1])
  }, [cursorPosition[0], cursorPosition[1], parseResult.songObj])

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

  return (
    <div className="app">
      <header className="header">
        <h1>LML Editor</h1>
      </header>
      <main className="main">
        <LmlInput
          ref={inputRef}
          defaultValue={DEFAULT_LML}
          onChange={handleChange}
          onSelectionChange={setCursorPosition}
          songObj={parseResult.songObj}
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
      />
    </div>
  )
}
