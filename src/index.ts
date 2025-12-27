// Main parser
export { default as SongParser } from "./parser.js"
export type { AST, ASTNode, NoteOpts, SongParserOptions } from "./parser.js"

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

// Note utilities (for parsing/serializing individual notes)
export { parseNoteString, serializeNote, stepDuration } from "./noteUtils.js"
export type { ParsedNote } from "./noteUtils.js"
