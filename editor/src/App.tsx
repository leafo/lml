import { useState, useCallback } from 'react'
import { SongParser } from '../../dist/index.js'
import { LmlInput } from './components/LmlInput'
import { OutputTabs } from './components/OutputTabs'

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
    song: unknown
    error: string | null
  }>({ ast: null, song: null, error: null })

  const handleChange = useCallback((text: string) => {
    setLmlText(text)

    try {
      const parser = new SongParser()
      const ast = parser.parse(text)
      const song = parser.compile(ast)

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
      }

      setParseResult({ ast, song: songData, error: null })
    } catch (e) {
      setParseResult({
        ast: null,
        song: null,
        error: e instanceof Error ? e.message : String(e),
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
        />
      </main>
    </div>
  )
}
