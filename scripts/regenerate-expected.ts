import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import SongParser from "../src/parser.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const serializeSong = (song: ReturnType<typeof SongParser.load>) => {
  const result: Record<string, unknown> = {
    notes: [...song].map(n => ({ note: n.note, start: n.start, duration: n.duration })),
    tracks: Array.from({ length: song.tracks.length }, (_, i) => {
      const t = song.tracks[i]
      if (!t) return null
      const track: Record<string, unknown> = {
        notes: [...t].map(n => ({ note: n.note, start: n.start, duration: n.duration }))
      }
      if (t.clefs !== undefined) track.clefs = t.clefs
      return track
    }),
    metadata: song.metadata
  }
  if (song.autoChords !== undefined) result.autoChords = song.autoChords
  if (song.strings !== undefined) result.strings = song.strings
  return result
}

const examplesDir = path.join(__dirname, "../examples")
const files = fs.readdirSync(examplesDir).filter(f => f.endsWith(".lml"))

for (const file of files) {
  const content = fs.readFileSync(path.join(examplesDir, file), "utf-8")
  const song = SongParser.load(content)
  const output = serializeSong(song)
  const outputPath = path.join(examplesDir, `${file}.expected.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n")
  console.log(`Generated: ${outputPath}`)
}
