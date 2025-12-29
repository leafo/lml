/**
 * @module @leafo/lml
 * @document ../migration-guide.md
 */

// Main parser
export { default as SongParser } from "./parser.js"
export type { AST, ASTNode, NoteOpts, SongParserOptions, ParsedNote } from "./parser.js"

// Song types
export { SongNote, SongNoteList, MultiTrackSong } from "./song.js"
export type { SongMetadata } from "./song.js"

// Music theory
export {
  // Constants
  MIDDLE_C_PITCH,
  OCTAVE_SIZE,
  OFFSETS,
  LETTER_OFFSETS,
  NOTE_NAME_OFFSETS,

  // Functions
  noteName,
  parseNote,
  noteStaffOffset,
  notesSame,
  addInterval,
  compareNotes,
  notesLessThan,
  notesGreaterThan,
  transposeKeySignature,

  // Classes
  KeySignature,
  ChromaticKeySignature,
  Scale,
  MajorScale,
  MinorScale,
  HarmonicMinorScale,
  AscendingMelodicMinorScale,
  MajorBluesScale,
  MinorBluesScale,
  ChromaticScale,
  Chord,
  Staff,
} from "./music.js"
export type { NoteLetter, ChordShapeName } from "./music.js"

// Auto chords
export {
  AutoChords,
  RootAutoChords,
  TriadAutoChords,
  Root5AutoChords,
  ArpAutoChords,
  BossaNovaAutoChords,
} from "./auto-chords.js"
export type { AutoChordsOptions, ChordBlock } from "./auto-chords.js"

// Note list
export { default as NoteList } from "./note-list.js"

// Note utilities (for serializing individual notes)
export { serializeNote, stepDuration } from "./note-utils.js"
