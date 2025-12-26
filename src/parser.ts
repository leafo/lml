// @ts-ignore - generated file
import * as peg from "./grammar.js"
import { parseNote, noteName, KeySignature } from "./music.js"
import { MultiTrackSong, SongNote } from "./song.js"
import { AutoChords, AutoChordsOptions } from "./auto-chords.js"

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

          if (!hasAccidental) {
            // apply default accidental
            noteName = state.keySignature.unconvertNote(noteName)
          }

          if (start === null) {
            start = state.position
            state.position += duration
          }

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
