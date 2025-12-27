// @ts-ignore - generated file
import * as peg from "./grammar.js"
import { parseNote, noteName, KeySignature, OFFSETS, OCTAVE_SIZE } from "./music.js"
import { MultiTrackSong, SongNote } from "./song.js"
import { AutoChords, AutoChordsOptions } from "./auto-chords.js"

// 48 ticks per beat - divisible by 1,2,3,4,6,8,12,16,24,48
// Allows exact representation of triplets, sixtuplets, etc.
const TICKS_PER_BEAT = 48

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

  const finalOctave = Math.floor(bestPitch / OCTAVE_SIZE) - 1
  return `${noteLetter}${finalOctave}`
}

// AST node types from the PEG grammar
export type NoteOpts = {
  duration?: number
  start?: number
  sharp?: boolean
  flat?: boolean
  natural?: boolean
  location?: [number, number]  // [startOffset, endOffset]
}

export type ASTNode =
  | ["frontmatter", string, string]
  | ["note", string, NoteOpts?]
  | ["rest", { duration?: number; start?: number }?]
  | ["keySignature", number]
  | ["timeSignature", number, number]
  | ["halfTime", number?]
  | ["doubleTime", number?]
  | ["tripleTime", number?]
  | ["measure", number?]
  | ["block", ASTNode[]]
  | ["restoreStartPosition"]
  | ["setTrack", number]
  | ["clef", string]
  | ["macro", string]
  | ["string", string]

export type AST = ASTNode[]

interface CompilerState {
  startPosition: number      // in ticks
  position: number           // in ticks
  ticksPerNote: number       // base duration in ticks (default: TICKS_PER_BEAT)
  ticksPerMeasure: number    // ticks per measure
  timeScale: number          // duration multiplier (unchanged by tick conversion)
  keySignature: KeySignature
  currentTrack: number
  lastMeasure: number
  nextMeasureStart: number   // where the next auto-increment measure should start
  explicitMeasureUsed: boolean  // track if last measure was explicit (affects nextMeasureStart updates)
  lastNotePitch: number | null
  defaultPitch: number
}

export interface SongParserOptions {
  autoChords?: typeof AutoChords | false
  autoChordsSettings?: AutoChordsOptions
  defaultOctave?: number  // Default octave for relative notes (default: 5)
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

    const defaultOctave = opts?.defaultOctave ?? 4
    const state: CompilerState = {
      startPosition: 0,
      position: 0,
      ticksPerNote: TICKS_PER_BEAT,        // 1 beat = 48 ticks
      ticksPerMeasure: TICKS_PER_BEAT * 4, // 4 beats per measure default
      timeScale: 1,
      keySignature: new KeySignature(0),
      currentTrack: 0,
      lastMeasure: -1,
      nextMeasureStart: 0,
      explicitMeasureUsed: false,
      lastNotePitch: null,
      defaultPitch: (defaultOctave + 1) * OCTAVE_SIZE,  // C at the default octave (MIDI: C4 = 60)
    }

    const song = new MultiTrackSong()
    this.compileCommands(ast, state, song)

    song.metadata = {
      keySignature: state.keySignature.count,
      beatsPerMeasure: state.ticksPerMeasure / TICKS_PER_BEAT,
      ...(Object.keys(frontmatter).length > 0 && { frontmatter }),
    }

    // Ensure default 4/4 time signature at position 0 for getMeasures()
    if (!song.timeSignatures || song.timeSignatures.length === 0 || song.timeSignatures[0][0] > 0) {
      if (!song.timeSignatures) song.timeSignatures = []
      song.timeSignatures.unshift([0, 4])
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

          // If time signature changed inside block, recalculate next measure boundary
          if (blockState.ticksPerMeasure !== state.ticksPerMeasure) {
            const measureStart = state.nextMeasureStart - state.ticksPerMeasure
            state.nextMeasureStart = measureStart + blockState.ticksPerMeasure
            state.ticksPerMeasure = blockState.ticksPerMeasure
          }

          break
        }
        case "halfTime": {
          const [, count = 1] = command
          state.timeScale *= Math.pow(2, count)
          break
        }
        case "doubleTime": {
          const [, count = 1] = command
          state.timeScale *= Math.pow(0.5, count)
          break
        }
        case "tripleTime": {
          const [, count = 1] = command
          state.timeScale *= Math.pow(1 / 3, count)
          break
        }
        case "measure": {
          const [, measure] = command

          if (measure !== undefined) {
            // Explicit measure number - calculate position (for jumps)
            const measureNum = measure
            state.lastMeasure = measureNum
            state.position = measureNum * state.ticksPerMeasure
            state.nextMeasureStart = (measureNum + 1) * state.ticksPerMeasure
            state.explicitMeasureUsed = true
          } else {
            // Auto-increment - use max of expected boundary or actual position
            // This handles: 1) notes that don't fill the measure (jump to boundary)
            //               2) blocks with different time sig (continue from where we are)
            state.lastMeasure += 1
            state.position = Math.max(state.nextMeasureStart, state.position)
            state.nextMeasureStart = state.position + state.ticksPerMeasure
            state.explicitMeasureUsed = false
          }
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

          // Convert ticks to beats for storage
          track.clefs.push([state.position / TICKS_PER_BEAT, clef])
          break
        }
        case "note": {
          const [, name, noteOpts] = command
          let noteName = name
          let durationTicks = state.ticksPerNote * state.timeScale
          let hasAccidental = false

          if (noteOpts) {
            if (noteOpts.duration) {
              durationTicks *= noteOpts.duration
            }

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
            const referencePitch = state.lastNotePitch ?? state.defaultPitch
            noteName = findClosestOctave(noteName, referencePitch)
          }

          if (!hasAccidental) {
            // apply default accidental
            noteName = state.keySignature.unconvertNote(noteName)
          }

          // Round duration to ensure integer ticks
          durationTicks = Math.round(durationTicks)

          // Determine start position
          let startTicks: number
          if (noteOpts?.start != null) {
            // Explicit @ position is in beats, convert to ticks
            startTicks = noteOpts.start * TICKS_PER_BEAT
          } else {
            startTicks = state.position
            state.position += durationTicks
          }

          // Update lastNotePitch for relative octave tracking
          state.lastNotePitch = parseNote(noteName)

          // Convert ticks to beats for SongNote
          song.pushWithTrack(
            new SongNote(noteName, startTicks / TICKS_PER_BEAT, durationTicks / TICKS_PER_BEAT, noteOpts?.location),
            state.currentTrack
          )
          break
        }
        case "rest": {
          const [, restTiming] = command

          let durationTicks = state.ticksPerNote * state.timeScale

          if (restTiming) {
            if (restTiming.start) {
              break // do nothing
            }

            if (restTiming.duration) {
              durationTicks *= restTiming.duration
            }
          }

          state.position += Math.round(durationTicks)
          break
        }
        case "keySignature": {
          state.keySignature = new KeySignature(+command[1])
          break
        }
        case "timeSignature": {
          const [, perBeat, noteValue] = command
          // Convert beat duration to ticks: 4/4 means quarter note = 1 beat = 48 ticks
          // In 6/8, eighth note = 1 beat = 48 ticks, so ticksPerNote = 48 * (4/8) = 24
          state.ticksPerNote = TICKS_PER_BEAT * (4 / noteValue)
          state.ticksPerMeasure = state.ticksPerNote * perBeat

          // Track time signature changes for getMeasures()
          if (!song.timeSignatures) {
            song.timeSignatures = []
          }
          song.timeSignatures.push([state.position / TICKS_PER_BEAT, perBeat])
          break
        }
        case "macro": {
          const [, macroName] = command
          const chord = AutoChords.coerceChord(macroName)

          if (chord) {
            if (!song.autoChords) {
              song.autoChords = []
            }
            // Convert ticks to beats for storage
            song.autoChords.push([state.position / TICKS_PER_BEAT, chord])
          }

          break
        }
        case "string": {
          const [, text] = command
          if (!song.strings) {
            song.strings = []
          }
          // Convert ticks to beats for storage
          song.strings.push([state.position / TICKS_PER_BEAT, text])
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
