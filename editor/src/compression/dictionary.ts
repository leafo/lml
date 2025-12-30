// LML compression dictionary: maps tokens to single bytes for efficient encoding

// Command codes (0x01-0x0F)
export const COMMANDS: Record<string, number> = {
  'm': 0x01,      // measure
  '{': 0x02,      // block start
  '}': 0x03,      // block end
  '|': 0x04,      // restore position
  'dt': 0x05,     // double time
  'ht': 0x06,     // half time
  'tt': 0x07,     // triple time
  'r': 0x08,      // rest (lowercase)
  'ks': 0x09,     // key signature
  'ts': 0x0A,     // time signature
  't': 0x0B,      // set track
  '/g': 0x0C,     // treble clef
  '/c': 0x0D,     // alto clef
  '/f': 0x0E,     // bass clef
  '$': 0x0F,      // macro prefix
}

// Notes without explicit octave (0x10-0x16)
export const NOTES_OCT5: Record<string, number> = {
  'c': 0x10, 'd': 0x11, 'e': 0x12, 'f': 0x13,
  'g': 0x14, 'a': 0x15, 'b': 0x16,
}

// Note indices for encoding other octaves
export const NOTE_INDICES: Record<string, number> = {
  'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6,
}

// Marker for note with explicit octave (followed by encoded note+octave byte)
export const NOTE_WITH_OCTAVE = 0x17

// Note+octave combinations (0x20-0x7F)
// Encoding: 0x20 + (octave * 7) + noteIndex
// Octaves 0-9 fit in 70 values (0x20-0x65)
export function encodeNoteOctave(noteLetter: string, octave: number): number {
  const noteIdx = NOTE_INDICES[noteLetter.toLowerCase()]
  if (noteIdx === undefined || octave < 0 || octave > 9) {
    throw new Error(`Invalid note: ${noteLetter}${octave}`)
  }
  return 0x20 + (octave * 7) + noteIdx
}

export function decodeNoteOctave(byte: number): { note: string, octave: number } | null {
  if (byte < 0x20 || byte > 0x65) return null
  const value = byte - 0x20
  const octave = Math.floor(value / 7)
  const noteIdx = value % 7
  const notes = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
  return { note: notes[noteIdx], octave }
}

// Modifiers (0x80-0x9F)
export const MODIFIERS: Record<string, number> = {
  '+': 0x80,      // sharp
  '-': 0x81,      // flat
  '=': 0x82,      // natural
  '*2': 0x83,     // duration *2
  '*3': 0x84,     // duration *3
  '*4': 0x85,     // duration *4
  '*5': 0x86,     // duration *5
  '*6': 0x87,     // duration *6
  '/2': 0x88,     // duration /2
  '/4': 0x89,     // duration /4
  '.': 0x8A,      // single dot
  '..': 0x8B,     // double dot
  '@': 0x8C,      // explicit start position (number follows)
  '*': 0x8D,      // arbitrary duration multiplier (number follows)
  '/': 0x8E,      // arbitrary duration divisor (number follows)
}

// Special markers
export const SPECIAL = {
  NUMBER: 0x90,           // arbitrary number follows (varint)
  STRING_START: 0x91,     // string literal follows
  STRING_END: 0x92,       // end of string
  FRONTMATTER_KEY: 0x93,  // frontmatter key follows
  NEGATIVE: 0x94,         // next number is negative
  HAS_COUNT: 0x95,        // command has a count/number argument following
}

// LZ77 markers (0xA0-0xDF)
export const LZ77 = {
  // Short back-reference: 0xA0-0xBF (32 values)
  // Encodes offset 1-32, length 3-10 in 2 bytes total
  SHORT_MIN: 0xA0,
  SHORT_MAX: 0xBF,

  // Medium back-reference: 0xC0-0xDF (32 values)
  // Encodes offset 1-4096, length 3-34 in 3 bytes total
  MEDIUM_MIN: 0xC0,
  MEDIUM_MAX: 0xDF,
  // Long encoding removed - was buggy
}

// Literal escape (0xFF) - next byte is literal
export const LITERAL_ESCAPE = 0xFF

// Build reverse dictionaries for decoding
export const REVERSE_COMMANDS: Map<number, string> = new Map(
  Object.entries(COMMANDS).map(([k, v]) => [v, k])
)

export const REVERSE_NOTES_OCT5: Map<number, string> = new Map(
  Object.entries(NOTES_OCT5).map(([k, v]) => [v, k])
)

export const REVERSE_MODIFIERS: Map<number, string> = new Map(
  Object.entries(MODIFIERS).map(([k, v]) => [v, k])
)

// Check if a byte is in a specific range
export function isCommand(byte: number): boolean {
  return byte >= 0x01 && byte <= 0x0F
}

export function isNoteOct5(byte: number): boolean {
  return byte >= 0x10 && byte <= 0x16
}

export function isNoteWithOctave(byte: number): boolean {
  return byte >= 0x20 && byte <= 0x65
}

export function isModifier(byte: number): boolean {
  return byte >= 0x80 && byte <= 0x8E
}

export function isSpecial(byte: number): boolean {
  return byte >= 0x90 && byte <= 0x94
}

export function isLz77Short(byte: number): boolean {
  return byte >= LZ77.SHORT_MIN && byte <= LZ77.SHORT_MAX
}

export function isLz77Medium(byte: number): boolean {
  return byte >= LZ77.MEDIUM_MIN && byte <= LZ77.MEDIUM_MAX
}

export function isLz77(byte: number): boolean {
  return isLz77Short(byte) || isLz77Medium(byte)
}
