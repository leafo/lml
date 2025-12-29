// @ts-ignore - generated file
import * as peg from "./grammar.js"
import { parseNote, KeySignature, OFFSETS, OCTAVE_SIZE } from "./music.js"
import { MultiTrackSong, SongNote } from "./song.js"
import { AutoChords, AutoChordsOptions } from "./auto-chords.js"

/**
 * Internal tick resolution for timing calculations.
 * 48 ticks per beat allows exact representation of common subdivisions
 * including triplets, sixtuplets, and standard note values.
 * Divisible by 1, 2, 3, 4, 6, 8, 12, 16, 24, 48.
 */
const TICKS_PER_BEAT = 48

/**
 * Calculates the duration multiplier for dotted notes.
 * Each dot adds half of the previous value to the note duration.
 * @param dots - Number of dots (1, 2, 3, etc.)
 * @returns Duration multiplier (1 dot = 1.5x, 2 dots = 1.75x, 3 dots = 1.875x)
 * @example
 * dottedMultiplier(1) // 1.5
 * dottedMultiplier(2) // 1.75
 * dottedMultiplier(3) // 1.875
 */
function dottedMultiplier(dots: number): number {
  return (Math.pow(2, dots + 1) - 1) / Math.pow(2, dots)
}

/**
 * Finds the octave that places a note closest to a reference pitch.
 * Used for relative note entry where the octave is inferred from context.
 * @param noteLetter - Note name without octave (e.g., "C", "F#", "Bb")
 * @param referencePitch - MIDI pitch number to stay close to
 * @returns Full note name with octave (e.g., "C4", "F#5")
 * @throws Error if noteLetter is not a valid note name
 * @example
 * findClosestOctave("G", 60) // "G4" (closest G to middle C)
 * findClosestOctave("C", 67) // "C5" (closest C to G4)
 */
function findClosestOctave(noteLetter: string, referencePitch: number): string {
  const match = noteLetter.match(/^([A-G])(#|b)?$/)
  if (!match) {
    throw new Error(`Invalid note letter: ${noteLetter}`)
  }

  const [, letter] = match
  if (OFFSETS[letter] === undefined) {
    throw new Error(`Invalid note letter: ${letter}`)
  }

  // Find the reference note's octave (MIDI: C4 = 60)
  const refOctave = Math.floor(referencePitch / OCTAVE_SIZE) - 1

  // Calculate pitches for octaves around the reference using parseNote for spelling rules.
  let bestOctave = refOctave
  let bestPitch = parseNote(`${noteLetter}${refOctave}`)
  let bestDistance = Math.abs(bestPitch - referencePitch)

  const belowOctave = refOctave - 1
  const pitchBelow = parseNote(`${noteLetter}${belowOctave}`)
  const distBelow = Math.abs(pitchBelow - referencePitch)
  if (distBelow < bestDistance) {
    bestOctave = belowOctave
    bestPitch = pitchBelow
    bestDistance = distBelow
  }

  const aboveOctave = refOctave + 1
  const pitchAbove = parseNote(`${noteLetter}${aboveOctave}`)
  const distAbove = Math.abs(pitchAbove - referencePitch)
  if (distAbove < bestDistance) {
    bestOctave = aboveOctave
  }

  return `${noteLetter}${bestOctave}`
}

/**
 * Options for a note AST node, specifying timing and accidentals.
 */
export type NoteOpts = {
  /** Duration multiplier relative to current beat (e.g., 0.5 for half duration) */
  duration?: number
  /** Number of dots extending the duration */
  dots?: number
  /** Explicit start position in beats (using @ syntax) */
  start?: number
  /** Note has explicit sharp accidental */
  sharp?: boolean
  /** Note has explicit flat accidental */
  flat?: boolean
  /** Note has explicit natural accidental */
  natural?: boolean
  /** Source location as [startOffset, endOffset] in the input string */
  location?: [number, number]
}

/**
 * AST node types produced by the PEG grammar parser.
 * Each node is a tuple with the command type as the first element.
 */
export type ASTNode =
  /** Key-value metadata from YAML-style frontmatter */
  | ["frontmatter", string, string]
  /** Musical note with name and optional timing/accidental options */
  | ["note", string, NoteOpts?]
  /** Rest (silence) with optional duration */
  | ["rest", { duration?: number; dots?: number; start?: number }?]
  /** Key signature change: [command, accidental count, sourceLocation] */
  | ["keySignature", number, [number, number]]
  /** Time signature: [command, beats per measure, note value] */
  | ["timeSignature", number, number]
  /** Halve tempo (double note durations), with optional repeat count */
  | ["halfTime", number?]
  /** Double tempo (halve note durations), with optional repeat count */
  | ["doubleTime", number?]
  /** Triple tempo (divide note durations by 3), with optional repeat count */
  | ["tripleTime", number?]
  /** Measure marker, optionally with explicit measure number */
  | ["measure", number?]
  /** Nested block of commands with isolated scope */
  | ["block", ASTNode[]]
  /** Reset position to start of current block */
  | ["restoreStartPosition"]
  /** Switch to a different track by number */
  | ["setTrack", number]
  /** Set clef for the current track */
  | ["clef", string]
  /** Chord macro for auto-chord generation */
  | ["macro", string]
  /** Text annotation at current position */
  | ["string", string]

/** Array of AST nodes representing a parsed song */
export type AST = ASTNode[]

/**
 * Parsed representation of a single note string.
 * Contains the note's components extracted from LML notation.
 */
export interface ParsedNote {
  /** Note letter name (uppercase): "C", "D", etc. */
  name: string
  /** Accidental: '+' for sharp, '-' for flat, '=' for natural */
  accidental?: '+' | '-' | '='
  /** Octave number as string (e.g., "4", "5") */
  octave?: string
  /** Duration multiplier: *N gives N, /N gives 1/N */
  duration?: number
  /** Number of dots (1 = dotted, 2 = double-dotted, etc.) */
  dots?: number
  /** Explicit start position in beats (from @ syntax) */
  start?: number
}

/**
 * Internal state maintained during AST compilation.
 * Tracks position, timing, key signature, and context for note processing.
 */
interface CompilerState {
  /** Start position of current block in ticks */
  startPosition: number
  /** Current playback position in ticks */
  position: number
  /** Base note duration in ticks (affected by time signature) */
  ticksPerNote: number
  /** Length of one measure in ticks */
  ticksPerMeasure: number
  /** Duration multiplier from halfTime/doubleTime/tripleTime commands */
  timeScale: number
  /** Current key signature for accidental handling */
  keySignature: KeySignature
  /** Current track number for multi-track output */
  currentTrack: number
  /** Last measure number encountered */
  lastMeasure: number
  /** Tick position where next auto-increment measure starts */
  nextMeasureStart: number
  /** Whether last measure command had explicit number */
  explicitMeasureUsed: boolean
  /** MIDI pitch of last note played (for relative octave) */
  lastNotePitch: number | null
  /** Default MIDI pitch when no previous note exists */
  defaultPitch: number
}

/**
 * Options for configuring the song parser and compiler.
 */
export interface SongParserOptions {
  /** Custom AutoChords class, or false to disable auto-chord generation */
  autoChords?: typeof AutoChords | false
  /** Configuration options passed to AutoChords */
  autoChordsSettings?: AutoChordsOptions
  /** Default octave for relative notes without octave number (default: 4) */
  defaultOctave?: number
}

/**
 * Parser and compiler for the LML (Leafo Music Language) notation format.
 * Converts text-based music notation into a MultiTrackSong with note and timing data.
 *
 * @example
 * // Quick load from string
 * const song = SongParser.load("c d e f g")
 *
 * // Two-step parse and compile
 * const parser = new SongParser()
 * const ast = parser.parse("c d e | f g a")
 * const song = parser.compile(ast)
 */
export default class SongParser {
  /** The PEG.js parser module for direct access to grammar */
  static peg = peg

  /**
   * Convenience method to parse and compile a song in one step.
   * @param songText - LML notation string to parse
   * @param opts - Optional parser configuration
   * @returns Compiled MultiTrackSong
   * @example
   * const song = SongParser.load("c d e | f g a")
   */
  static load(songText: string, opts?: SongParserOptions): MultiTrackSong {
    const parser = new SongParser()
    const ast = parser.parse(songText)
    return parser.compile(ast, opts)
  }

  /**
   * Parses a single note string into its component parts.
   * @param noteStr - Note string to parse (e.g., "c5", "c+5*2", "c5.")
   * @returns ParsedNote object, or null if parsing fails
   * @example
   * SongParser.parseNote("c5")      // { name: "C", octave: "5" }
   * SongParser.parseNote("c+5*2")   // { name: "C", accidental: "+", octave: "5", duration: 2 }
   * SongParser.parseNote("c5.")     // { name: "C", octave: "5", dots: 1 }
   * SongParser.parseNote("c5@2")    // { name: "C", octave: "5", start: 2 }
   */
  static parseNote(noteStr: string): ParsedNote | null {
    try {
      const result = peg.parse(noteStr, { startRule: 'note' }) as [string, string, {
        sharp?: boolean
        flat?: boolean
        natural?: boolean
        duration?: number
        dots?: number
        start?: number
      }]

      const [, noteName, opts] = result

      const parsed: ParsedNote = {
        name: noteName[0],  // Just the letter (already uppercase from grammar)
        octave: noteName.slice(1) || undefined,
        accidental: opts.sharp ? '+' : opts.flat ? '-' : opts.natural ? '=' : undefined,
        duration: opts.duration,
        start: opts.start,
      }
      if (opts.dots) parsed.dots = opts.dots
      return parsed
    } catch {
      return null
    }
  }

  /**
   * Parses LML notation text into an abstract syntax tree.
   * @param songText - LML notation string to parse
   * @returns Array of AST nodes representing the parsed song
   * @throws SyntaxError if the input contains invalid syntax
   * @example
   * const parser = new SongParser()
   * const ast = parser.parse("C4 D4 E4")
   * // ast = [["note", "C", {...}], ["note", "D", {...}], ["note", "E", {...}]]
   */
  parse(songText: string): AST {
    return peg.parse(songText, { grammarSource: "input" })
  }

  /**
   * Compiles an AST into a MultiTrackSong with note data.
   * Processes all commands, resolves relative octaves, applies key signatures,
   * and optionally generates auto-chords.
   * @param ast - Abstract syntax tree from parse()
   * @param opts - Optional compiler configuration
   * @returns Compiled song with tracks, notes, and metadata
   * @example
   * const parser = new SongParser()
   * const ast = parser.parse("$G | C D E | F G A |")
   * const song = parser.compile(ast)
   * // song.metadata.keySignature = 1 (G major)
   */
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

  /**
   * Recursively processes AST commands and updates song state.
   * @param commands - Array of AST nodes to process
   * @param state - Current compiler state (modified in place)
   * @param song - Song being built (notes added to tracks)
   */
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
            // Auto-increment - always jump to next measure boundary
            state.lastMeasure += 1
            state.position = state.nextMeasureStart
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
            if (noteOpts.dots) {
              durationTicks *= dottedMultiplier(noteOpts.dots)
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
            if (restTiming.dots) {
              durationTicks *= dottedMultiplier(restTiming.dots)
            }
          }

          state.position += Math.round(durationTicks)
          break
        }
        case "keySignature": {
          const [, count, sourceLocation] = command
          state.keySignature = new KeySignature(count)

          if (!song.keySignatures) {
            song.keySignatures = []
          }
          song.keySignatures.push([state.position / TICKS_PER_BEAT, count, sourceLocation])
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
