/**
 * MIDI pitch value for middle C (C4).
 * @example
 * parseNote("C4") === MIDDLE_C_PITCH // true
 */
export const MIDDLE_C_PITCH = 60

/**
 * Number of semitones in an octave.
 */
export const OCTAVE_SIZE = 12

/**
 * Bidirectional mapping between note letters and their semitone offsets from C.
 * Maps both directions: number -> letter name, and letter name -> number.
 * Only includes natural notes (no sharps/flats).
 * @example
 * OFFSETS[0]   // "C"
 * OFFSETS["C"] // 0
 * OFFSETS[7]   // "G"
 * OFFSETS["G"] // 7
 */
export const OFFSETS: Record<number | string, string | number> = {
  0: "C",
  2: "D",
  4: "E",
  5: "F",
  7: "G",
  9: "A",
  11: "B",

  "C": 0,
  "D": 2,
  "E": 4,
  "F": 5,
  "G": 7,
  "A": 9,
  "B": 11
}

/**
 * Maps semitone offset (from C) to staff line position (0-6).
 * Used for determining vertical placement on sheet music.
 * @example
 * LETTER_OFFSETS[0]  // 0 (C)
 * LETTER_OFFSETS[7]  // 4 (G)
 */
export const LETTER_OFFSETS: Record<number, number> = {
  0: 0,
  2: 1,
  4: 2,
  5: 3,
  7: 4,
  9: 5,
  11: 6
}

/**
 * Maps note letter names to staff line position (0-6).
 * C=0, D=1, E=2, F=3, G=4, A=5, B=6.
 * @example
 * NOTE_NAME_OFFSETS["C"] // 0
 * NOTE_NAME_OFFSETS["G"] // 4
 */
export const NOTE_NAME_OFFSETS = {
  "C": 0,
  "D": 1,
  "E": 2,
  "F": 3,
  "G": 4,
  "A": 5,
  "B": 6,
} as const

/** Valid note letter names (A through G) */
export type NoteLetter = keyof typeof NOTE_NAME_OFFSETS

/**
 * Converts a MIDI pitch number to a note name string.
 * @param pitch - MIDI pitch number (60 = middle C)
 * @param sharpen - If true, use sharps for accidentals; if false, use flats
 * @returns Note name with octave (e.g., "C4", "F#5", "Bb3")
 * @example
 * noteName(60)        // "C4"
 * noteName(61)        // "C#4"
 * noteName(61, false) // "Db4"
 */
export function noteName(pitch: number, sharpen = true): string {
  const octave = Math.floor(pitch / OCTAVE_SIZE) - 1
  const offset = pitch - (octave + 1) * OCTAVE_SIZE

  let name = OFFSETS[offset] as string | undefined
  if (!name) {
    if (sharpen) {
      name = OFFSETS[offset - 1] + "#"
    } else {
      name = OFFSETS[offset + 1] + "b"
    }
  }

  return `${name}${octave}`
}

function parseNoteAccidentals(note: string): number {
  const match = note.match(/^([A-G])(#|b)?/)
  if (!match) {
    throw new Error(`Invalid note format: ${note}`)
  }
  const [, , accidental] = match
  let n = 0

  if (accidental == "#") {
    n += 1
  }

  if (accidental == "b") {
    n -= 1
  }

  return n
}

// get the octave independent offset in halfsteps (from C), used for comparison
function parseNoteOffset(note: string): number {
  const match = note.match(/^([A-G])(#|b)?/)
  if (!match) {
    throw new Error(`Invalid note format: ${note}`)
  }
  const [, letter, accidental] = match

  if (OFFSETS[letter] === undefined) {
    throw new Error(`Invalid note letter: ${letter}`)
  }

  let n = OFFSETS[letter] as number
  if (accidental == "#") { n += 1 }
  if (accidental == "b") { n -= 1 }

  return (n + 12) % 12 // wrap around for Cb and B#
}

/**
 * Parses a note string into its MIDI pitch number.
 * @param note - Note string with octave (e.g., "C4", "F#5", "Bb3")
 * @returns MIDI pitch number (60 = middle C)
 * @throws Error if note format is invalid
 * @example
 * parseNote("C4")  // 60
 * parseNote("A4")  // 69
 * parseNote("C#4") // 61
 */
export function parseNote(note: string): number {
  const parsed = note.match(/^([A-G])(#|b)?(\d+)$/)

  if (!parsed) {
    throw new Error(`parseNote: invalid note format '${note}'`)
  }

  const [, letter, accidental, octave] = parsed

  if (OFFSETS[letter] === undefined) {
    throw new Error(`Invalid note letter: ${letter}`)
  }

  let n = (OFFSETS[letter] as number) + (parseInt(octave, 10) + 1) * OCTAVE_SIZE

  if (accidental == "#") {
    n += 1
  }

  if (accidental == "b") {
    n -= 1
  }

  return n
}

/**
 * Calculates the vertical staff position for a note.
 * Used for positioning notes on sheet music.
 * @param note - Note string with octave (e.g., "C4", "G5"); letter must be A-G
 * @returns Staff offset value (higher = higher on staff)
 * @throws Error if note format is invalid; invalid letters yield NaN
 * @example
 * noteStaffOffset("C4") // 28
 * noteStaffOffset("D4") // 29
 */
export function noteStaffOffset(note: string): number {
  const match = note.match(/(\w)[#b]?(\d+)/)
  if (!match) { throw new Error("Invalid note") }
  const [, name, octave] = match
  return +octave * 7 + NOTE_NAME_OFFSETS[name as NoteLetter]
}

/**
 * Compares two notes ignoring octave (enharmonic comparison).
 * @param a - First note string (with or without octave)
 * @param b - Second note string (with or without octave)
 * @returns True if notes are the same pitch class
 * @example
 * notesSame("C4", "C5")   // true (same pitch class)
 * notesSame("C#4", "Db4") // true (enharmonic)
 * notesSame("C4", "D4")   // false
 */
export function notesSame(a: string, b: string): boolean {
  return parseNoteOffset(a) == parseNoteOffset(b)
}

/**
 * Transposes a note by a given interval in semitones.
 * @param note - Note string with octave (e.g., "C4")
 * @param halfSteps - Number of semitones to transpose (positive = up, negative = down)
 * @returns Transposed note string
 * @example
 * addInterval("C4", 2)  // "D4" (whole step up)
 * addInterval("C4", 12) // "C5" (octave up)
 * addInterval("C4", -1) // "B3" (half step down)
 */
export function addInterval(note: string, halfSteps: number): string {
  return noteName(parseNote(note) + halfSteps)
}

/**
 * Compares two notes and returns the difference in semitones.
 * @param a - First note string with octave
 * @param b - Second note string with octave
 * @returns 0 if equal, negative if a < b, positive if a > b
 * @example
 * compareNotes("C4", "C4") // 0
 * compareNotes("C4", "D4") // -2
 * compareNotes("D4", "C4") // 2
 */
export function compareNotes(a: string, b: string): number {
  return parseNote(a) - parseNote(b)
}

/**
 * Checks if the first note is lower than the second.
 * @param a - First note string with octave
 * @param b - Second note string with octave
 * @returns True if a is lower than b
 * @example
 * notesLessThan("C4", "D4") // true
 * notesLessThan("C5", "C4") // false
 */
export function notesLessThan(a: string, b: string): boolean {
  return compareNotes(a, b) < 0
}

/**
 * Checks if the first note is higher than the second.
 * @param a - First note string with octave
 * @param b - Second note string with octave
 * @returns True if a is higher than b
 * @example
 * notesGreaterThan("D4", "C4") // true
 * notesGreaterThan("C4", "D4") // false
 */
export function notesGreaterThan(a: string, b: string): boolean {
  return compareNotes(a, b) > 0
}

/**
 * Represents a musical key signature with a given number of sharps or flats.
 * Positive count = sharps, negative count = flats, zero = C major/A minor.
 * @example
 * const gMajor = new KeySignature(1)  // G major (1 sharp)
 * const fMajor = new KeySignature(-1) // F major (1 flat)
 * gMajor.name() // "G"
 * gMajor.accidentalNotes() // ["F"]
 */
export class KeySignature {
  /** Circle of fifths note names */
  static FIFTHS = [
    "F", "C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb"
  ]

  /** Natural note names in order of fifths (for accidental calculation) */
  static FIFTHS_TRUNCATED = [
    "F", "C", "G", "D", "A", "E", "B"
  ]

  private static cache: KeySignature[] | null = null

  /**
   * Returns all standard key signatures (excludes chromatic).
   * Uses flat spellings for 6 accidentals (Gb instead of F#).
   * @returns Array of KeySignature instances for standard major keys
   */
  static allKeySignatures(): KeySignature[] {
    return [
      0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5, -6
    ].map(key => new KeySignature(key))
  }

  /**
   * Gets a cached KeySignature instance for the given accidental count.
   * @param count - Number of accidentals (positive = sharps, negative = flats)
   * @returns KeySignature instance, or undefined if count is out of range
   */
  static forCount(count: number): KeySignature | undefined {
    if (!this.cache) {
      this.cache = this.allKeySignatures()
    }

    for (const key of this.cache) {
      if (key.count == count) {
        return key
      }
    }
  }

  /** Number of accidentals: positive = sharps, negative = flats, 0 = C major */
  count: number

  /**
   * Creates a new KeySignature.
   * @param count - Number of accidentals (positive = sharps, negative = flats)
   */
  constructor(count: number) {
    this.count = count
  }

  /** Returns the number of accidentals in this key signature. */
  getCount(): number {
    return this.count
  }

  /** Returns true if this is a chromatic key signature. */
  isChromatic(): boolean {
    return false
  }

  /** Returns true if this key has sharps. */
  isSharp(): boolean {
    return this.count > 0
  }

  /** Returns true if this key has flats. */
  isFlat(): boolean {
    return this.count < 0
  }

  /**
   * Returns the name of the major key (e.g., "G", "F", "Bb").
   * @returns Key name string
   * @example
   * new KeySignature(0).name()  // => "C"
   * new KeySignature(1).name()  // => "G" (1 sharp)
   * new KeySignature(2).name()  // => "D" (2 sharps)
   * new KeySignature(-1).name() // => "F" (1 flat)
   * new KeySignature(-2).name() // => "Bb" (2 flats)
   */
  name(): string {
    let offset = this.count + 1
    if (offset < 0) {
      offset += KeySignature.FIFTHS.length
    }

    return KeySignature.FIFTHS[offset]
  }

  /** Returns the key name as a string. */
  toString(): string {
    return this.name()
  }

  /**
   * Returns the root note for building scales from this key signature.
   * @returns Note name (e.g., "G", "F")
   */
  scaleRoot(): string {
    return this.name()
  }

  /**
   * Returns the default scale for this key signature.
   * @returns A MajorScale rooted on this key
   */
  defaultScale(): MajorScale {
    return new MajorScale(this)
  }

  /**
   * Converts a note to its enharmonic equivalent that fits this key signature.
   * Sharp keys convert flats to sharps; flat keys convert sharps to flats.
   * @param note - Note string with octave
   * @returns Enharmonic equivalent note string
   * @example
   * new KeySignature(1).enharmonic("Db4") // "C#4" (G major uses sharps)
   * new KeySignature(-1).enharmonic("C#4") // "Db4" (F major uses flats)
   */
  enharmonic(note: string): string {
    if (this.isFlat()) {
      if (note.indexOf("#") != -1) {
        return noteName(parseNote(note), false)
      }
    }

    if (this.isSharp()) {
      if (note.indexOf("b") != -1) {
        return noteName(parseNote(note), true)
      }
    }

    return note
  }

  /**
   * Converts a MIDI pitch to a note name with correct enharmonic spelling for this key.
   * Uses sharps for sharp keys and flats for flat keys.
   * @param pitch - MIDI pitch number
   * @returns Note name string with appropriate accidentals for this key
   * @example
   * new KeySignature(1).noteName(61)  // => "C#4" (G major uses sharps)
   * new KeySignature(-1).noteName(61) // => "Db4" (F major uses flats)
   * new KeySignature(0).noteName(61)  // => "C#4" (C major defaults to sharps)
   */
  noteName(pitch: number): string {
    return noteName(pitch, !this.isFlat())
  }

  /**
   * Returns the note letters that have accidentals in this key.
   * @returns Array of note letters (e.g., ["F"] for G major, ["B", "E"] for Bb major)
   * @example
   * new KeySignature(1).accidentalNotes()  // ["F"] (F# in G major)
   * new KeySignature(-2).accidentalNotes() // ["B", "E"] (Bb, Eb)
   */
  accidentalNotes(): string[] {
    const fifths = KeySignature.FIFTHS_TRUNCATED

    if (this.count > 0) {
      return fifths.slice(0, this.count)
    } else {
      return fifths.slice(fifths.length + this.count).reverse()
    }
  }

  /**
   * Converts a note without accidentals to its actual pitch in this key.
   * For example, in G major, "F" becomes "F#".
   * @param note - Note string or MIDI pitch
   * @returns Note string with appropriate accidentals applied
   */
  unconvertNote(note: string | number): string {
    if (this.count == 0) {
      return typeof note === "number" ? noteName(note) : note
    }

    if (typeof note == "number") {
      note = noteName(note)
    }

    const match = note.match(/^([A-G])(\d+)?/)

    if (!match) {
      throw new Error("can't unconvert note with accidental")
    }

    const [, name, octave] = match

    for (const modifiedNote of this.accidentalNotes()) {
      if (modifiedNote == name) {
        return `${name}${this.isSharp() ? "#" : "b"}${octave}`
      }
    }

    return note
  }

  /**
   * Converts a note with accidentals to its staff spelling in this key.
   * This is the inverse of unconvertNote - it strips accidentals that are
   * implied by the key signature.
   *
   * Note: This only strips # or b accidentals. Notes without accidentals are
   * returned unchanged. To determine if a natural sign is needed (e.g., F
   * natural in D major), use {@link accidentalsForNote} which returns 0 when
   * a natural is required.
   *
   * @param note - Note string with accidentals
   * @returns Note string as it would appear on a staff with this key signature
   * @example
   * // In G major (1 sharp on F):
   * new KeySignature(1).convertNote("F#4") // "F4" (sharp implied by key)
   * new KeySignature(1).convertNote("C#4") // "C#4" (not in key, keep accidental)
   * // In F major (1 flat on B):
   * new KeySignature(-1).convertNote("Bb4") // "B4" (flat implied by key)
   * // Notes without accidentals are unchanged:
   * new KeySignature(2).convertNote("F4")  // "F4" (use accidentalsForNote to check if natural needed)
   */
  convertNote(note: string): string {
    const accidental = this.accidentalsForNote(note)
    if (accidental === null) {
      // Note matches key signature, strip the accidental
      return note.replace(/[#b]/, "")
    }
    return note
  }

  /**
   * Determines how many accidentals should display for a note in this key.
   * @param note - Note string or MIDI pitch
   * @returns null if no accidental needed, 0 for natural, 1 for sharp, -1 for flat, etc.
   * @example
   * // In G major (1 sharp on F):
   * new KeySignature(1).accidentalsForNote("F#4") // null (already in key)
   * new KeySignature(1).accidentalsForNote("F4")  // 0 (natural needed)
   * new KeySignature(1).accidentalsForNote("C#4") // 1 (sharp not in key)
   */
  accidentalsForNote(note: string | number): number | null {
    if (typeof note == "number") {
      note = noteName(note)
    }

    const match = note.match(/^([A-G])(#|b)?/)
    if (!match) {
      throw new Error(`Invalid note format: ${note}`)
    }
    const [, name, a] = match

    if (a == "#") { return this.isSharp() && this.accidentalNotes().includes(name) ? null : 1 }
    if (a == "b") { return this.isFlat() && this.accidentalNotes().includes(name) ? null : -1 }

    for (const modifiedNote of this.accidentalNotes()) {
      if (modifiedNote == name) {
        return 0 // natural needed
      }
    }

    return null
  }

  /**
   * Returns the notes that need accidentals within a given pitch range.
   * The returned notes are natural note names at specific octaves.
   * @param min - Minimum note (string or MIDI pitch)
   * @param max - Maximum note (string or MIDI pitch)
   * @returns Array of note strings that need accidentals in this range
   */
  notesInRange(min: string | number, max: string | number): string[] {
    if (this.count == 0) {
      return []
    }

    if (typeof max == "string") {
      max = parseNote(max)
    }

    if (typeof min == "string") {
      min = parseNote(min)
    }

    const octave = 5 // TODO: pick something close to min/max
    let notes: number[] | null = null

    if (this.count > 0) {
      let count = this.count
      notes = [parseNote(`F${octave}`)]
      while (count > 1) {
        count -= 1
        notes.push(notes[notes.length - 1] + 7)
      }
    }

    if (this.count < 0) {
      let count = -1 * this.count
      notes = [parseNote(`B${octave}`)]
      while (count > 1) {
        count -= 1
        notes.push(notes[notes.length - 1] - 7)
      }
    }

    if (!notes) return []

    return notes.map(function (n) {
      while (n <= min) {
        n += 12
      }

      while (n > max) {
        n -= 12
      }

      return noteName(n)
    })
  }
}

/**
 * A special key signature for chromatic contexts where all 12 notes are equally valid.
 * Renders as C major (no accidentals in the key signature) but allows all chromatic notes.
 */
export class ChromaticKeySignature extends KeySignature {
  constructor() {
    super(0) // render as c major
  }

  /** Returns true (this is always a chromatic key signature). */
  isChromatic(): boolean {
    return true
  }

  /** Returns "Chromatic" as the key name. */
  name(): string {
    return "Chromatic"
  }

  /** Returns "C" as the scale root. */
  scaleRoot(): string {
    return "C"
  }

  /** Returns a ChromaticScale as the default scale. */
  defaultScale(): ChromaticScale {
    return new ChromaticScale(this)
  }
}

/**
 * Base class for musical scales. A scale is defined by a root note and
 * a pattern of intervals (steps) in semitones.
 * @example
 * const cMajor = new MajorScale("C")
 * cMajor.getRange(4, 8) // ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
 * cMajor.containsNote("D") // true
 * cMajor.containsNote("Db") // false
 */
export class Scale {
  /** Root note of the scale (e.g., "C", "G", "Bb") */
  root: string
  /** Interval pattern in semitones (e.g., [2,2,1,2,2,2,1] for major) */
  steps: number[] = []
  /** True if this is a minor scale (affects enharmonic spelling) */
  minor = false
  /** True if this is a chromatic scale */
  chromatic = false

  /**
   * Creates a new Scale.
   * @param root - Root note as string (e.g., "C") or KeySignature
   */
  constructor(root: string | KeySignature) {
    if (root instanceof KeySignature) {
      root = root.scaleRoot()
    }

    if (!root.match(/^[A-G][b#]?$/)) {
      throw new Error("scale root not properly formed: " + root)
    }

    this.root = root
  }

  /**
   * Returns all notes in the scale across 8 octaves.
   * @returns Array of note strings covering the full playable range
   */
  getFullRange(): string[] {
    return this.getRange(0, (this.steps.length + 1) * 8)
  }

  /**
   * Returns scale notes within a pitch range (inclusive).
   * @param min - Minimum note string (e.g., "C3")
   * @param max - Maximum note string (e.g., "C6")
   * @returns Array of scale notes within the range
   */
  getLooseRange(min: string, max: string): string[] {
    const fullRange = this.getFullRange()
    const minPitch = parseNote(min)
    const maxPitch = parseNote(max)
    return fullRange.filter(note => {
      const pitch = parseNote(note)
      return pitch >= minPitch && pitch <= maxPitch
    })
  }

  /**
   * Returns a range of notes from the scale starting at a given octave.
   * @param octave - Starting octave number
   * @param count - Number of notes to return (default: one octave)
   * @param offset - Scale degree offset (negative = start below root)
   * @returns Array of note strings
   * @example
   * new MajorScale("C").getRange(4, 8)    // ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
   * new MajorScale("C").getRange(4, 3, 2) // ["E4", "F4", "G4"] (start from 3rd degree)
   */
  getRange(octave: number, count: number = this.steps.length + 1, offset = 0): string[] {
    let current = parseNote(`${this.root}${octave}`)
    const isFlat = this.isFlat()
    const range: string[] = []

    let k = 0

    while (offset < 0) {
      k--
      if (k < 0) {
        k += this.steps.length
      }

      current -= this.steps[k % this.steps.length]
      offset++
    }

    for (let i = 0; i < count + offset; i++) {
      if (i >= offset) {
        range.push(noteName(current, this.chromatic || !isFlat))
      }

      current += this.steps[k++ % this.steps.length]
    }

    return range
  }

  /**
   * Determines if this scale should use flats for accidentals.
   * Based on the circle of fifths position of the root.
   * @returns True if the scale should use flats
   */
  isFlat(): boolean {
    let idx = KeySignature.FIFTHS.indexOf(this.root)

    if (idx == -1) {
      // the root is sharp
      let letter = this.root.charCodeAt(0) + 1

      if (letter > 71) {
        letter -= 5
      }

      const realRoot = String.fromCharCode(letter) + "#"
      idx = KeySignature.FIFTHS.indexOf(realRoot)
    }

    if (this.minor) {
      idx -= 3
      if (idx < 0) {
        idx += KeySignature.FIFTHS.length
      }
    }

    return idx < 1 || idx > 6
  }

  /**
   * Checks if a note (any octave) belongs to this scale.
   * @param note - Note string (with or without octave)
   * @returns True if the note is in the scale
   * @example
   * new MajorScale("C").containsNote("D")  // true
   * new MajorScale("C").containsNote("Db") // false
   */
  containsNote(note: string): boolean {
    let pitch = parseNoteOffset(note)
    const rootPitch = parseNoteOffset(this.root)

    // move note within an octave of root
    while (pitch < rootPitch) {
      pitch += OCTAVE_SIZE
    }

    while (pitch >= rootPitch + OCTAVE_SIZE) {
      pitch -= OCTAVE_SIZE
    }

    let currentPitch = rootPitch
    let i = 0

    // keep incrementing until we hit it, or pass it
    while (currentPitch <= pitch) {
      if (currentPitch == pitch) {
        return true
      }
      currentPitch += this.steps[i % this.steps.length]
      i++
    }

    return false
  }

  /**
   * Converts a scale degree number to a note name (without octave).
   * Degrees are 1-indexed: 1 = root, 2 = second, etc.
   * @param degree - Scale degree (1-indexed)
   * @returns Note name string (e.g., "C", "D", "E")
   * @example
   * new MajorScale("C").degreeToName(1) // "C"
   * new MajorScale("C").degreeToName(5) // "G"
   */
  degreeToName(degree: number): string {
    // truncate to reasonable range
    degree = (degree - 1) % this.steps.length + 1

    const range = this.getRange(0, degree)
    const note = range[range.length - 1]
    const m = note.match(/^[^\d]+/)
    return m ? m[0] : note
  }

  /**
   * Gets the scale degree of a note.
   * Degrees are 1-indexed: root = 1, second = 2, etc.
   * @param note - Note string (with or without octave)
   * @returns Scale degree number
   * @throws Error if note is not in the scale
   * @example
   * new MajorScale("C").getDegree("C") // 1
   * new MajorScale("C").getDegree("G") // 5
   */
  getDegree(note: string): number {
    let pitch = parseNoteOffset(note)
    const rootPitch = parseNoteOffset(this.root)

    // move note within an octave of root
    while (pitch < rootPitch) {
      pitch += OCTAVE_SIZE
    }

    while (pitch >= rootPitch + OCTAVE_SIZE) {
      pitch -= OCTAVE_SIZE
    }

    let degree = 1
    let currentPitch = rootPitch

    if (currentPitch == pitch) {
      return degree
    }

    for (const offset of this.steps) {
      currentPitch += offset
      degree += 1

      if (currentPitch == pitch) {
        return degree
      }

      if (currentPitch > pitch) {
        break
      }
    }

    throw new Error(`${note} is not in scale ${this.root}`)
  }

  /**
   * Builds chord intervals by stacking thirds from a scale degree.
   * @param degree - Starting scale degree (1-indexed)
   * @param count - Number of intervals to generate (2 = triad, 3 = seventh chord)
   * @returns Array of intervals in semitones
   * @example
   * new MajorScale("C").buildChordSteps(1, 2) // [4, 3] (C major triad intervals)
   * new MajorScale("C").buildChordSteps(2, 2) // [3, 4] (D minor triad intervals)
   */
  buildChordSteps(degree: number, count: number): number[] {
    let idx = degree - 1
    const out: number[] = []

    while (count > 0) {
      let stride = 2
      let step = 0

      while (stride > 0) {
        step += this.steps[idx % this.steps.length]
        idx++
        stride--
      }

      out.push(step)
      count--
    }

    return out
  }

  /**
   * Generates all diatonic chords in this scale.
   * @param noteCount - Number of notes per chord (3 = triads, 4 = seventh chords)
   * @returns Array of Chord instances built on each scale degree
   * @example
   * new MajorScale("C").allChords(3) // [C, Dm, Em, F, G, Am, Bdim]
   */
  allChords(noteCount = 3): Chord[] {
    const out: Chord[] = []
    for (let i = 0; i < this.steps.length; i++) {
      const degree = i + 1
      const root = this.degreeToName(degree)
      const steps = this.buildChordSteps(degree, noteCount - 1)
      out.push(new Chord(root, steps))
    }

    return out
  }
}

/**
 * Major scale with the interval pattern W-W-H-W-W-W-H (whole and half steps).
 * @example
 * new MajorScale("C").getRange(4, 8) // ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
 */
export class MajorScale extends Scale {
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 2, 1, 2, 2, 2, 1]
  }
}

/**
 * Natural minor scale (Aeolian mode) with pattern W-H-W-W-H-W-W.
 * @example
 * new MinorScale("A").getRange(4, 8) // ["A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"]
 */
export class MinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 1, 2, 2]
  }
}

/**
 * Harmonic minor scale with raised 7th degree.
 * Pattern: W-H-W-W-H-A2-H (A2 = augmented second, 3 semitones).
 */
export class HarmonicMinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 1, 3, 1]
  }
}

/**
 * Ascending melodic minor scale with raised 6th and 7th degrees.
 * Pattern: W-H-W-W-W-W-H.
 */
export class AscendingMelodicMinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 2, 2, 1]
  }
}

/**
 * Major blues scale (6 notes).
 * Notes in C: C, D, Eb, E, G, A.
 */
export class MajorBluesScale extends Scale {
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 1, 3, 2, 3]
  }
}

/**
 * Minor blues scale (6 notes).
 * Notes in C: C, Eb, F, Gb, G, Bb.
 */
export class MinorBluesScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [3, 2, 1, 1, 3, 2]
  }
}

/**
 * Chromatic scale containing all 12 semitones.
 */
export class ChromaticScale extends Scale {
  override chromatic = true

  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  }
}

/**
 * Represents a musical chord as a special kind of scale.
 * Chords are defined by a root note and interval pattern.
 * @example
 * const cMajor = new Chord("C", "M")
 * cMajor.getRange(4, 3) // ["C4", "E4", "G4"]
 * Chord.notes("C4", "m7") // ["C4", "Eb4", "G4", "Bb4"]
 */
export class Chord extends Scale {
  /**
   * Predefined chord shapes as interval arrays (in semitones).
   * - M: Major triad [4, 3]
   * - m: Minor triad [3, 4]
   * - dim: Diminished triad [3, 3]
   * - aug: Augmented triad [4, 4]
   * - 7: Dominant 7th [4, 3, 3]
   * - M7: Major 7th [4, 3, 4]
   * - m7: Minor 7th [3, 4, 3]
   * - And more...
   */
  static SHAPES = {
    "M": [4, 3],
    "m": [3, 4],

    "dim": [3, 3],
    "dimM7": [3, 3, 5],
    "dim7": [3, 3, 3],

    "aug": [4, 4],
    "augM7": [4, 4, 3],

    "M6": [4, 3, 2],
    "m6": [3, 4, 2],

    "M7": [4, 3, 4],
    "7": [4, 3, 3],
    "m7": [3, 4, 3],
    "m7b5": [3, 3, 4],
    "mM7": [3, 4, 4],

    "Q": [5, 5],
    "Qb4": [4, 5],
  } as const

  /**
   * Static helper to get chord notes at a specific position.
   * @param note - Root note with octave (e.g., "C4")
   * @param chordName - Chord type from SHAPES (e.g., "M", "m7")
   * @param inversion - Inversion number (0 = root position, 1 = first inversion, etc.)
   * @param notesCount - Number of notes to return (0 = all chord tones)
   * @returns Array of note strings
   * @throws Error if note format is invalid or chordName is unknown
   * @example
   * Chord.notes("C4", "M")    // ["C4", "E4", "G4"]
   * Chord.notes("C4", "M", 1) // ["E4", "G4", "C5"] (first inversion)
   */
  static notes(note: string, chordName: ChordShapeName, inversion = 0, notesCount = 0): string[] {
    const match = note.match(/^([^\d]+)(\d+)$/)
    if (!match) {
      throw new Error(`Invalid note format: ${note}`)
    }
    const [, root, octaveStr] = match
    const octave = +octaveStr

    const intervals = Chord.SHAPES[chordName]

    if (notesCount == 0) {
      notesCount = intervals.length + 1
    }

    return new Chord(root, [...intervals]).getRange(octave, notesCount, inversion)
  }

  /**
   * Creates a new Chord.
   * @param root - Root note as string (e.g., "C") or KeySignature
   * @param intervals - Chord shape name (e.g., "M", "m7") or array of intervals in semitones
   * @example
   * new Chord("C", "M")      // C major from shape name
   * new Chord("C", [4, 3])   // C major from intervals
   */
  constructor(root: string | KeySignature, intervals: ChordShapeName | readonly number[] | number[]) {
    super(root)

    let steps: number[]
    if (typeof intervals === "string") {
      const shape = Chord.SHAPES[intervals]
      if (!shape) {
        throw new Error(`Unknown chord shape: ${intervals}`)
      }
      steps = [...shape]
    } else {
      steps = [...intervals]
    }

    if (!steps.length) {
      throw new Error("Missing intervals for chord")
    }

    this.steps = steps

    // add wrapping interval to get back to octave
    let sum = 0
    for (const i of this.steps) {
      sum += i
    }

    let rest = -sum
    while (rest < 0) {
      rest += OCTAVE_SIZE
    }

    this.steps.push(rest)
  }

  /**
   * Checks if this chord functions as a dominant (major or dominant 7th).
   * @returns True if chord is major triad or dominant 7th
   */
  isDominant(): boolean {
    const shapeName = this.chordShapeName()
    if (shapeName == "M" || shapeName == "7") {
      return true
    }

    return false
  }

  /**
   * Gets possible resolution targets for this chord as a secondary dominant.
   * A secondary dominant resolves down a fifth (up a fourth).
   * @param noteCount - Number of notes in target chords (3 = triads, 4 = sevenths)
   * @returns Array of possible target Chords (major and minor variants)
   * @throws Error if this chord is not a dominant type
   */
  getSecondaryDominantTargets(noteCount = 3): Chord[] {
    if (!this.isDominant()) {
      throw new Error(`chord is not dominant to begin with: ${this.chordShapeName()}`)
    }

    // new root is 5 halfsteps above the current (or 7 below)
    const match = noteName(parseNote(`${this.root}5`) + 5).match(/^([^\d]+)(\d+)$/)
    if (!match) {
      throw new Error("Failed to compute secondary dominant target")
    }
    const [, newRoot] = match

    // triads
    if (noteCount == 3) {
      return (["M", "m"] as const).map(quality => new Chord(newRoot, quality))
    }

    // sevenths
    if (noteCount == 4) {
      return (["M7", "m7"] as const).map(quality => new Chord(newRoot, quality))
    }

    throw new Error(`don't know how to get secondary dominant for note count: ${noteCount}`)
  }

  /**
   * Gets the name of this chord's shape from SHAPES (e.g., "M", "m7", "dim").
   * @returns Shape name string, or undefined if no matching shape found
   */
  chordShapeName(): ChordShapeName | undefined {
    for (const shape of Object.keys(Chord.SHAPES) as ChordShapeName[]) {
      const intervals = Chord.SHAPES[shape]
      if (this.steps.length - 1 != intervals.length) {
        continue
      }

      let match = true
      for (let k = 0; k < intervals.length; k++) {
        if (intervals[k] != this.steps[k]) {
          match = false
          break
        }
      }

      if (match) {
        return shape
      }
    }
  }

  /**
   * Checks if all given notes belong to this chord.
   * @param notes - Array of note strings to check
   * @returns True if all notes are chord tones
   * @example
   * new Chord("C", "M").containsNotes(["C4", "E4", "G4"]) // true
   * new Chord("C", "M").containsNotes(["C4", "F4"]) // false
   */
  containsNotes(notes: string[]): boolean {
    if (!notes.length) {
      return false
    }

    for (const note of notes) {
      if (!this.containsNote(note)) {
        return false
      }
    }

    return true
  }

  /**
   * Counts how many notes two chords have in common.
   * @param otherChord - Chord to compare with
   * @returns Number of shared notes
   */
  countSharedNotes(otherChord: Chord): number {
    const myNotes = this.getRange(5, this.steps.length)
    const theirNotes = otherChord.getRange(5, this.steps.length)
    let count = 0

    const noteNames: Record<string, boolean> = {}
    const normalizeNote = (note: string) => note.replace(/\d+$/, "")

    for (const note of myNotes) {
      noteNames[normalizeNote(note)] = true
    }

    for (const note of theirNotes) {
      const normalized = normalizeNote(note)
      if (noteNames[normalized]) {
        count += 1
      }

      delete noteNames[normalized]
    }

    return count
  }

  /**
   * Returns the chord name as a string (e.g., "C", "Am7", "Bdim").
   * @returns Chord name with root and quality
   */
  toString(): string {
    const shapeName = this.chordShapeName()
    if (!shapeName) {
      console.warn("don't know name of chord", this.root, this.steps, this.getRange(5, 3))
      return this.root
    }

    if (shapeName == "M") { return this.root }
    return `${this.root}${shapeName}`
  }
}

/** Valid chord shape names from Chord.SHAPES */
export type ChordShapeName = keyof typeof Chord.SHAPES

/**
 * Represents a musical staff with clef and note range information.
 * Used for rendering notes on sheet music.
 * @example
 * const treble = Staff.forName("treble")
 * treble.lowerNote // "E5" (bottom line)
 * treble.upperNote // "F6" (top line)
 */
export class Staff {
  private static cache: Record<string, Staff> | null = null

  /**
   * Gets a Staff instance by name.
   * @param name - Staff name ("treble" or "bass")
   * @returns Staff instance, or undefined if not found
   */
  static forName(name: string): Staff | undefined {
    if (!this.cache) {
      this.cache = Object.fromEntries(this.allStaves().map(s => [s.name, s]))
    }

    return this.cache[name]
  }

  /**
   * Returns all available staff types.
   * @returns Array of Staff instances
   */
  static allStaves(): Staff[] {
    // TODO: alto, middle C center
    return [
      new Staff("treble", "E5", "F6", "G5"),
      new Staff("bass", "G3", "A4", "F4")
    ]
  }

  /** Staff name (e.g., "treble", "bass") */
  name: string
  /** Note on the bottom line of the staff */
  lowerNote: string
  /** Note on the top line of the staff */
  upperNote: string
  /** Note where the clef is positioned */
  clefNote: string

  /**
   * Creates a new Staff.
   * @param name - Staff identifier
   * @param lowerNote - Note on bottom line (e.g., "E5" for treble)
   * @param upperNote - Note on top line (e.g., "F6" for treble)
   * @param clefNote - Note at clef position (e.g., "G5" for treble G-clef)
   */
  constructor(name: string, lowerNote: string, upperNote: string, clefNote: string) {
    this.name = name
    this.lowerNote = lowerNote
    this.upperNote = upperNote
    this.clefNote = clefNote
  }

  /**
   * Gets the letter name of the clef (e.g., "G" for treble, "F" for bass).
   * @returns Single letter clef name
   */
  clefName(): string {
    const match = this.clefNote.match(/^([A-G])/)
    if (!match) {
      throw new Error(`Invalid clef note: ${this.clefNote}`)
    }
    return match[1]
  }
}

/**
 * Transposes a key signature by a given number of semitones using circle of fifths.
 * Each semitone = 7 steps on the circle of fifths (mod 12).
 * @param currentKs - Current key signature count (positive = sharps, negative = flats)
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns New key signature count, normalized to -6..5 range
 * @example
 * transposeKeySignature(0, 1)   // -5 (C major + 1 semitone = Db major)
 * transposeKeySignature(1, 1)   // -4 (G major + 1 semitone = Ab major)
 * transposeKeySignature(0, 12)  // 0  (octave transposition = no change)
 */
export function transposeKeySignature(currentKs: number, semitones: number): number {
  if (semitones % 12 === 0) return currentKs  // Octave = no key change
  let newKs = currentKs + (semitones * 7)
  newKs = ((newKs % 12) + 12) % 12  // Normalize to 0..11
  if (newKs > 6) newKs -= 12        // Normalize to -6..5
  return newKs
}
