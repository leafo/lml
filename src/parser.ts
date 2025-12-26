// @ts-ignore - generated file
import * as peg from "./grammar.js"
import { parseNote, noteName, KeySignature, OFFSETS, OCTAVE_SIZE } from "./music.js"
import { MultiTrackSong, SongNote } from "./song.js"
import { AutoChords, AutoChordsOptions } from "./auto-chords.js"

/**
 * Given a note name without octave (e.g., "C", "F#") and a reference pitch,
 * find the octave that places the note closest to the reference.
 */
function findClosestOctave(noteLetter: string, referencePitch: number): string {
  const match = noteLetter.match(/^([A-G])(#|b)?$/)
  if (!match) {
    throw new Error(`Invalid note letter: ${noteLetter}`)
  }

  const [, letter, accidental] = match
  let noteOffset = OFFSETS[letter] as number

  if (accidental === "#") noteOffset += 1
  if (accidental === "b") noteOffset -= 1

  // Normalize to 0-11 range (handles Cb = 11, B# = 0)
  noteOffset = ((noteOffset % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE

  // Find the reference note's octave
  const refOctave = Math.floor(referencePitch / OCTAVE_SIZE)

  // Calculate pitches for octaves around the reference
  let bestPitch = refOctave * OCTAVE_SIZE + noteOffset
  let bestDistance = Math.abs(bestPitch - referencePitch)

  // Check octave below
  const pitchBelow = (refOctave - 1) * OCTAVE_SIZE + noteOffset
  const distBelow = Math.abs(pitchBelow - referencePitch)
  if (distBelow < bestDistance) {
    bestPitch = pitchBelow
    bestDistance = distBelow
  }

  // Check octave above
  const pitchAbove = (refOctave + 1) * OCTAVE_SIZE + noteOffset
  const distAbove = Math.abs(pitchAbove - referencePitch)
  if (distAbove < bestDistance) {
    bestPitch = pitchAbove
  }

  const finalOctave = Math.floor(bestPitch / OCTAVE_SIZE)
  return `${noteLetter}${finalOctave}`
}

// AST node types from the PEG grammar
export type NoteOpts = {
  duration?: number
  start?: number
  sharp?: boolean
  flat?: boolean
  natural?: boolean
}

export type ASTNode =
  | ["frontmatter", string, string]
  | ["note", string, NoteOpts?]
  | ["rest", { duration?: number; start?: number }?]
  | ["keySignature", number]
  | ["timeSignature", number, number]
  | ["halfTime"]
  | ["doubleTime"]
  | ["tripleTime"]
  | ["measure", number?]
  | ["block", ASTNode[]]
  | ["restoreStartPosition"]
  | ["setTrack", number]
  | ["clef", string]
  | ["macro", string]
  | ["string", string]

export type AST = ASTNode[]

interface CompilerState {
  startPosition: number
  position: number
  beatsPerNote: number
  beatsPerMeasure: number
  timeScale: number
  keySignature: KeySignature
  currentTrack: number
  lastMeasure: number
  lastNotePitch: number | null
}

export interface SongParserOptions {
  autoChords?: typeof AutoChords | false
  autoChordsSettings?: AutoChordsOptions
}

// tokens are separated by whitespace
// a note is a5.1.2
//   - 5 is the octave
//   - 1 is the duration
//   - 2 is the start
//
//   duration and start are optional
//   duration defaults to 1 beat (or the current duration)
//   start defaults to current cursor position

export default class SongParser {
  static peg = peg

  static load(songText: string, opts?: SongParserOptions): MultiTrackSong {
    const parser = new SongParser()
    const ast = parser.parse(songText)
    return parser.compile(ast, opts)
  }

  // convert song text to ast
  parse(songText: string): AST {
    return peg.parse(songText)
  }

  // compile ast to song notes
  compile(ast: AST, opts?: SongParserOptions): MultiTrackSong {
    // Extract frontmatter from AST
    const frontmatter: Record<string, string> = {}
    for (const node of ast) {
      if (node[0] === "frontmatter") {
        frontmatter[node[1]] = node[2]
      }
    }

    const state: CompilerState = {
      startPosition: 0,
      position: 0,
      beatsPerNote: 1,
      beatsPerMeasure: 4,
      timeScale: 1,
      keySignature: new KeySignature(0),
      currentTrack: 0,
      lastMeasure: -1,
      lastNotePitch: null,
    }

    const song = new MultiTrackSong()
    this.compileCommands(ast, state, song)

    song.metadata = {
      keySignature: state.keySignature.count,
      beatsPerMeasure: state.beatsPerMeasure,
      ...(Object.keys(frontmatter).length > 0 && { frontmatter }),
    }

    if (song.autoChords) {
      const settings = opts ? opts.autoChordsSettings : {}
      if (opts && opts.autoChords) {
        new opts.autoChords(song, settings).addChords()
      } else if (opts?.autoChords !== false) {
        AutoChords.defaultChords(song, settings).addChords()
      }
    }

    return song
  }

  private compileCommands(commands: AST, state: CompilerState, song: MultiTrackSong): void {
    for (const command of commands) {
      const t = command[0]
      switch (t) {
        case "restoreStartPosition": {
          state.position = state.startPosition
          break
        }
        case "block": {
          const [, blockCommands] = command
          const blockState: CompilerState = {
            ...state,
            startPosition: state.position
          }

          Object.setPrototypeOf(blockState, state)
          this.compileCommands(blockCommands, blockState, song)

          state.position = blockState.position
          state.lastNotePitch = blockState.lastNotePitch

          break
        }
        case "halfTime": {
          state.timeScale *= 2
          break
        }
        case "doubleTime": {
          state.timeScale *= 0.5
          break
        }
        case "tripleTime": {
          state.timeScale *= 1 / 3
          break
        }
        case "measure": {
          const [, measure] = command
          const measureNum = measure !== undefined ? measure : state.lastMeasure + 1
          state.lastMeasure = measureNum
          state.position = measureNum * state.beatsPerMeasure
          break
        }
        case "setTrack": {
          const [, track] = command
          state.currentTrack = +track
          break
        }
        case "clef": {
          const [, clef] = command
          const track = song.getTrack(state.currentTrack)
          if (!track.clefs) {
            track.clefs = []
          }

          track.clefs.push([state.position, clef])
          break
        }
        case "note": {
          const [, name, noteOpts] = command
          let noteName = name
          let duration = state.beatsPerNote * state.timeScale
          let start: number | null = null

          let hasAccidental = false

          if (noteOpts) {
            if (noteOpts.duration) {
              duration *= noteOpts.duration
            }

            start = noteOpts.start ?? null

            if (noteOpts.sharp) {
              hasAccidental = true
              noteName = noteName.substring(0, 1) + "#" + noteName.substring(1)
            } else if (noteOpts.flat) {
              hasAccidental = true
              noteName = noteName.substring(0, 1) + "b" + noteName.substring(1)
            } else if (noteOpts.natural) {
              hasAccidental = true
            }
          }

          // Handle relative octave (note without octave number)
          const hasOctave = /\d$/.test(noteName)
          if (!hasOctave) {
            const DEFAULT_PITCH = 60 // C5
            const referencePitch = state.lastNotePitch ?? DEFAULT_PITCH
            noteName = findClosestOctave(noteName, referencePitch)
          }

          if (!hasAccidental) {
            // apply default accidental
            noteName = state.keySignature.unconvertNote(noteName)
          }

          if (start === null) {
            start = state.position
            state.position += duration
          }

          // Update lastNotePitch for relative octave tracking
          state.lastNotePitch = parseNote(noteName)

          song.pushWithTrack(new SongNote(noteName, start, duration), state.currentTrack)
          break
        }
        case "rest": {
          const [, restTiming] = command

          let duration = state.beatsPerNote * state.timeScale

          if (restTiming) {
            if (restTiming.start) {
              break // do nothing
            }

            if (restTiming.duration) {
              duration *= restTiming.duration
            }
          }

          state.position += duration
          break
        }
        case "keySignature": {
          state.keySignature = new KeySignature(+command[1])
          break
        }
        case "timeSignature": {
          const [, perBeat, noteValue] = command
          state.beatsPerNote = 4 / noteValue
          state.beatsPerMeasure = state.beatsPerNote * perBeat
          break
        }
        case "macro": {
          const [, macroName] = command
          const chord = AutoChords.coerceChord(macroName)

          if (chord) {
            if (!song.autoChords) {
              song.autoChords = []
            }
            song.autoChords.push([state.position, chord])
          }

          break
        }
        case "string": {
          const [, text] = command
          if (!song.strings) {
            song.strings = []
          }
          song.strings.push([state.position, text])
          break
        }
        case "frontmatter": {
          // Handled separately before compileCommands
          break
        }
        default: {
          console.warn("Got unknown command when parsing song", command)
        }
      }
    }
  }
}
