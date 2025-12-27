export const MIDDLE_C_PITCH = 60
export const OCTAVE_SIZE = 12

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

export const LETTER_OFFSETS: Record<number, number> = {
  0: 0,
  2: 1,
  4: 2,
  5: 3,
  7: 4,
  9: 5,
  11: 6
}

export const NOTE_NAME_OFFSETS: Record<string, number> = {
  "C": 0,
  "D": 1,
  "E": 2,
  "F": 3,
  "G": 4,
  "A": 5,
  "B": 6,
}

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

export function noteStaffOffset(note: string): number {
  const match = note.match(/(\w)[#b]?(\d+)/)
  if (!match) { throw new Error("Invalid note") }
  const [, name, octave] = match
  return +octave * 7 + NOTE_NAME_OFFSETS[name]
}

// octaveless note comparison
export function notesSame(a: string, b: string): boolean {
  return parseNoteOffset(a) == parseNoteOffset(b)
}

export function addInterval(note: string, halfSteps: number): string {
  return noteName(parseNote(note) + halfSteps)
}

// returns 0 if notes are same
// returns < 0 if a < b
// returns > 0 if a > b
export function compareNotes(a: string, b: string): number {
  return parseNote(a) - parseNote(b)
}

export function notesLessThan(a: string, b: string): boolean {
  return compareNotes(a, b) < 0
}

export function notesGreaterThan(a: string, b: string): boolean {
  return compareNotes(a, b) > 0
}

export class KeySignature {
  static FIFTHS = [
    "F", "C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb"
  ]

  static FIFTHS_TRUNCATED = [
    "F", "C", "G", "D", "A", "E", "B"
  ]

  private static cache: KeySignature[] | null = null

  // excludes the chromatic option
  static allKeySignatures(): KeySignature[] {
    return [
      0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5, -6
    ].map(key => new KeySignature(key))
  }

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

  count: number

  // count: the number of accidentals in the key
  constructor(count: number) {
    this.count = count
  }

  getCount(): number {
    return this.count
  }

  isChromatic(): boolean {
    return false
  }

  isSharp(): boolean {
    return this.count > 0
  }

  isFlat(): boolean {
    return this.count < 0
  }

  name(): string {
    let offset = this.count + 1
    if (offset < 0) {
      offset += KeySignature.FIFTHS.length
    }

    return KeySignature.FIFTHS[offset]
  }

  toString(): string {
    return this.name()
  }

  // the default scale root for building scales from key signature
  scaleRoot(): string {
    return this.name()
  }

  // the scale used on the random note generator
  defaultScale(): MajorScale {
    return new MajorScale(this)
  }

  // convert note to enharmonic equivalent that fits into this key signature
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

  // which notes have accidentals in this key
  accidentalNotes(): string[] {
    const fifths = KeySignature.FIFTHS_TRUNCATED

    if (this.count > 0) {
      return fifths.slice(0, this.count)
    } else {
      return fifths.slice(fifths.length + this.count).reverse()
    }
  }

  // key note -> raw note
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

  // how many accidentals should display on note for this key
  // null: nothing
  // 0: a natural
  // 1: a sharp
  // -1: a flat
  // 2: double sharp, etc.
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

  // the notes to give accidentals to within the range [min, max], the returned
  // notes will not be sharp or flat
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

export class ChromaticKeySignature extends KeySignature {
  constructor() {
    super(0) // render as c major
  }

  isChromatic(): boolean {
    return true
  }

  name(): string {
    return "Chromatic"
  }

  scaleRoot(): string {
    return "C"
  }

  defaultScale(): ChromaticScale {
    return new ChromaticScale(this)
  }
}

export class Scale {
  root: string
  steps: number[] = []
  minor = false
  chromatic = false

  constructor(root: string | KeySignature) {
    if (root instanceof KeySignature) {
      root = root.scaleRoot()
    }

    if (!root.match(/^[A-G][b#]?$/)) {
      throw new Error("scale root not properly formed: " + root)
    }

    this.root = root
  }

  getFullRange(): string[] {
    return this.getRange(0, (this.steps.length + 1) * 8)
  }

  getLooseRange(min: string, max: string): string[] {
    const fullRange = this.getFullRange()
    const minPitch = parseNote(min)
    const maxPitch = parseNote(max)
    return fullRange.filter(note => {
      const pitch = parseNote(note)
      return pitch >= minPitch && pitch <= maxPitch
    })
  }

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

  // degrees are 1 indexed
  degreeToName(degree: number): string {
    // truncate to reasonable range
    degree = (degree - 1) % this.steps.length + 1

    const range = this.getRange(0, degree)
    const note = range[range.length - 1]
    const m = note.match(/^[^\d]+/)
    return m ? m[0] : note
  }

  // degrees are 1 indexed
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

  // degree is one indexed
  // new MajorScale().buildChordSteps(1, 2) -> major chord
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

  // all chords with count notes
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

export class MajorScale extends Scale {
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 2, 1, 2, 2, 2, 1]
  }
}

// natural minor
export class MinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 1, 2, 2]
  }
}

export class HarmonicMinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 1, 3, 1]
  }
}

export class AscendingMelodicMinorScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [2, 1, 2, 2, 2, 2, 1]
  }
}

export class MajorBluesScale extends Scale {
  constructor(root: string | KeySignature) {
    super(root)
    //  C, D, D#/Eb, E, G, A
    this.steps = [2, 1, 1, 3, 2, 3]
  }
}

export class MinorBluesScale extends Scale {
  override minor = true
  constructor(root: string | KeySignature) {
    super(root)
    // C, D#/Eb, F, F#/Gb, G, Bb
    this.steps = [3, 2, 1, 1, 3, 2]
  }
}

export class ChromaticScale extends Scale {
  override chromatic = true

  constructor(root: string | KeySignature) {
    super(root)
    this.steps = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  }
}

export class Chord extends Scale {
  static SHAPES: Record<string, number[]> = {
    "M": [4, 3],
    "m": [3, 4],

    "dim": [3, 3], // diminished
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

    // exotic
    "Q": [5, 5], // quartal
    "Qb4": [4, 5],
  }

  // Chord.notes("C5", "M", 1) -> first inversion C major chord
  static notes(note: string, chordName: string, inversion = 0, notesCount = 0): string[] {
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

    return new Chord(root, intervals).getRange(octave, notesCount, inversion)
  }

  constructor(root: string | KeySignature, intervals: string | number[]) {
    super(root)

    if (typeof intervals === "string") {
      const shape = Chord.SHAPES[intervals]
      if (!shape) {
        throw new Error(`Unknown chord shape: ${intervals}`)
      }
      intervals = shape
    }

    if (!intervals) {
      throw new Error("Missing intervals for chord")
    }

    this.steps = [...intervals]

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

  // is major or dom7 chord
  isDominant(): boolean {
    const shapeName = this.chordShapeName()
    if (shapeName == "M" || shapeName == "7") {
      return true
    }

    return false
  }

  // can point to a chord that's a 4th below (third above)
  // the target chord can either be major or minor (2,3,5,6) in new key
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
      return ["M", "m"].map(quality => new Chord(newRoot, quality))
    }

    // sevenths
    if (noteCount == 4) {
      return ["M7", "m7"].map(quality => new Chord(newRoot, quality))
    }

    throw new Error(`don't know how to get secondary dominant for note count: ${noteCount}`)
  }

  chordShapeName(): string | undefined {
    for (const shape in Chord.SHAPES) {
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

  // do all the notes fit this chord
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

  // how many notes do the two chords share
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

  toString(): string {
    let name = this.chordShapeName()
    if (!name) {
      console.warn("don't know name of chord", this.root, this.steps, this.getRange(5, 3))
      name = ""
    }

    if (name == "M") { name = "" }
    return `${this.root}${name}`
  }
}

export class Staff {
  private static cache: Record<string, Staff> | null = null

  static forName(name: string): Staff | undefined {
    if (!this.cache) {
      this.cache = Object.fromEntries(this.allStaves().map(s => [s.name, s]))
    }

    return this.cache[name]
  }

  static allStaves(): Staff[] {
    return [
      new Staff("treble", "E5", "F6", "G5"),
      new Staff("bass", "G3", "A4", "F4")
      // TODO: alto, middle C center
    ]
  }

  name: string
  lowerNote: string
  upperNote: string
  clefNote: string

  // upper and lower note are the notes for the lines on the top and bottom
  constructor(name: string, lowerNote: string, upperNote: string, clefNote: string) {
    this.name = name
    this.lowerNote = lowerNote
    this.upperNote = upperNote
    this.clefNote = clefNote
  }

  // F, G, etc
  clefName(): string {
    const match = this.clefNote.match(/^([A-G])/)
    if (!match) {
      throw new Error(`Invalid clef note: ${this.clefNote}`)
    }
    return match[1]
  }
}
