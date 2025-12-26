import { useState, useCallback } from 'react'
import { SongParser } from '@leafo/lml'
import { LmlInput } from './components/LmlInput'
import { OutputTabs } from './components/OutputTabs'
import { PianoRoll } from './components/PianoRoll'

const DEFAULT_LML = `# title: Example Song
# bpm: 120

ks0
ts4/4

c5 d5 e5 f5
g5.2 a5 b5
c6.4
`

export function App() {
  const [lmlText, setLmlText] = useState(DEFAULT_LML)
  const [parseResult, setParseResult] = useState<{
    ast: unknown
    song: {
      notes: { note: string; start: number; duration: number }[]
      metadata?: { beatsPerMeasure?: number }
      tracks?: { note: string; start: number; duration: number }[][]
      measures?: { start: number; beats: number }[]
    } | null
    error: string | null
    timing: { parse: number; compile: number } | null
  }>({ ast: null, song: null, error: null, timing: null })
  const [canvasTime, setCanvasTime] = useState<number | null>(null)

  const handleChange = useCallback((text: string) => {
    setLmlText(text)

    try {
      const parser = new SongParser()

      const parseStart = performance.now()
      const ast = parser.parse(text)
      const parseEnd = performance.now()

      const compileStart = performance.now()
      const song = parser.compile(ast)
      const compileEnd = performance.now()

      // Convert song to a serializable format
      const songData = {
        notes: [...song].map(note => ({
          note: note.note,
          start: note.start,
          duration: note.duration,
        })),
        metadata: song.metadata,
        tracks: song.tracks?.map(track => [...track].map(note => ({
          note: note.note,
          start: note.start,
          duration: note.duration,
        }))),
        measures: song.getMeasures(),
      }

      setParseResult({
        ast,
        song: songData,
        error: null,
        timing: {
          parse: parseEnd - parseStart,
          compile: compileEnd - compileStart,
        },
      })
    } catch (e) {
      setParseResult({
        ast: null,
        song: null,
        error: e instanceof Error ? e.message : String(e),
        timing: null,
      })
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>LML Editor</h1>
      </header>
      <main className="main">
        <LmlInput value={lmlText} onChange={handleChange} />
        <OutputTabs
          ast={parseResult.ast}
          song={parseResult.song}
          error={parseResult.error}
          timing={parseResult.timing ? { ...parseResult.timing, canvas: canvasTime } : null}
        />
      </main>
      <PianoRoll
        notes={parseResult.song?.notes ?? null}
        measures={parseResult.song?.measures}
        onRenderTime={setCanvasTime}
      />
    </div>
  )
}
