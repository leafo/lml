import { parseNote, noteName, MIDDLE_C_PITCH, transposeKeySignature, type ChordShapeName } from "./music.js"

/**
 * Represents a single musical note with pitch, timing, and duration.
 * @example
 * const note = new SongNote("C4", 0, 1) // Middle C at beat 0, duration 1 beat
 * const note2 = new SongNote("D#5", 4, 0.5) // D#5 at beat 4, half beat duration
 */
export class SongNote {
  /** Unique identifier for this note instance */
  id: symbol
  /** Note name with octave (e.g., "C4", "D#5", "Bb3") */
  note: string
  /** Start position in beats */
  start: number
  /** Duration in beats */
  duration: number
  /** Source location in LML text as [startOffset, endOffset], used for editor features */
  sourceLocation?: [number, number]

  /**
   * Creates a new SongNote.
   * @param note - Note name with octave (e.g., "C4", "D#5")
   * @param start - Start position in beats
   * @param duration - Duration in beats
   * @param sourceLocation - Optional source location in LML text [startOffset, endOffset]
   */
  constructor(note: string, start: number, duration: number, sourceLocation?: [number, number]) {
    this.id = Symbol()
    this.note = note
    this.start = start
    this.duration = duration
    this.sourceLocation = sourceLocation
  }

  /**
   * Creates a copy of this note.
   * @returns A new SongNote with the same properties
   */
  clone(): SongNote {
    const cloned = new SongNote(
      this.note, this.start, this.duration, this.sourceLocation
    )
    return cloned
  }

  /**
   * Checks if this note overlaps with a time range.
   * @param min - Start of the range in beats
   * @param max - End of the range in beats
   * @returns True if the note overlaps with the range
   */
  inRange(min: number, max: number): boolean {
    const stop = this.start + this.duration

    if (min >= stop) { return false }
    if (max <= this.start) { return false }

    return true
  }

  /**
   * Creates a new note transposed by a number of semitones.
   * @param semitones - Number of semitones to transpose (positive = up, negative = down)
   * @returns A new SongNote with the transposed pitch
   * @example
   * const c4 = new SongNote("C4", 0, 1)
   * const d4 = c4.transpose(2) // D4
   * const b3 = c4.transpose(-1) // B3
   */
  transpose(semitones: number): SongNote {
    return new SongNote(
      noteName(parseNote(this.note) + semitones), this.start, this.duration, this.sourceLocation
    )
  }

  /** Returns the start position in beats. */
  getStart(): number {
    return this.start
  }

  /** Returns the end position in beats (start + duration). */
  getStop(): number {
    return this.start + this.duration
  }

  /** Returns the end position for rendering purposes. */
  getRenderStop(): number {
    return this.start + this.duration
  }

  /** Returns a string representation of the note. */
  toString(): string {
    return `${this.note},${this.start},${this.duration}`
  }
}

/**
 * Metadata associated with a parsed song.
 */
export interface SongMetadata {
  /** Key signature as number of accidentals (positive = sharps, negative = flats) */
  keySignature?: number
  /** Number of beats per measure */
  beatsPerMeasure?: number
  /** Frontmatter key-value pairs from the LML source */
  frontmatter?: Record<string, string>
}

/**
 * A list of notes representing a song or track, with associated metadata.
 * Extends Array<SongNote> to allow direct indexing and array methods.
 * @example
 * const song = SongNoteList.newSong([
 *   ["C4", 0, 1],
 *   ["E4", 1, 1],
 *   ["G4", 2, 1],
 * ])
 * song.transpose(2) // Transpose up a whole step
 */
export class SongNoteList extends Array<SongNote> {
  /** Bucket size in beats for spatial indexing optimization */
  static bucketSize = 8

  /** Song metadata including key signature and time signature */
  metadata?: SongMetadata
  /** Auto chord markers as [beat_position, [root, chord_shape]][] */
  autoChords?: [number, [string, ChordShapeName]][]
  /** Clef changes as [beat_position, clef_name][] */
  clefs?: [number, string][]
  /** String annotations as [beat_position, text][] */
  strings?: [number, string][]
  /** Time signature changes as [beat_position, beats_per_measure][] */
  timeSignatures?: [number, number][]
  /** Key signature changes as [beat_position, accidental_count, source_location][] */
  keySignatures?: [number, number, [number, number]][]
  /** Optional track name */
  trackName?: string

  /** Cached spatial index buckets for fast note lookup */
  private buckets?: Record<number, number[]>

  constructor() {
    super()
    Object.setPrototypeOf(this, SongNoteList.prototype)
  }

  /**
   * Creates a new SongNoteList from an array of note tuples.
   * @param noteTuples - Array of [note, start, duration] tuples
   * @returns A new SongNoteList containing the notes
   * @example
   * const song = SongNoteList.newSong([
   *   ["C4", 0, 1],
   *   ["D4", 1, 1],
   * ])
   */
  static newSong(noteTuples: [string, number, number][]): SongNoteList {
    const notes = noteTuples.map(([note, start, duration]) =>
      new SongNote(note, start, duration))

    const song = new SongNoteList()
    for (const note of notes) {
      song.push(note)
    }

    return song
  }

  /**
   * Creates a deep copy of this song (notes are cloned).
   * @returns A new SongNoteList with cloned notes
   */
  clone(): SongNoteList {
    const song = new SongNoteList()

    this.forEach(note =>
      song.push(note.clone())
    )

    return song
  }

  /**
   * Clears the spatial index cache. Call this after modifying notes.
   */
  clearCache(): void {
    delete this.buckets
  }

  /**
   * Creates a new song with all notes and key signatures transposed.
   * Uses circle of fifths for key signature transposition.
   * Returns `this` if amount is 0.
   * @param amount - Number of semitones to transpose (positive = up, negative = down)
   * @returns A new SongNoteList with transposed notes, or `this` if amount is 0
   * @example
   * const song = parser.compile(parser.parse("ks0 c d e"))
   * const transposed = song.transpose(1) // Transposes to Db major
   * // transposed.metadata.keySignature === -5
   */
  transpose(amount = 0): SongNoteList {
    if (amount == 0) {
      return this
    }

    const song = new (this.constructor as typeof SongNoteList)()
    this.transposeNotesInto(song, amount)

    // Copy metadata, transposing key signature
    if (this.metadata) {
      song.metadata = {
        ...this.metadata,
        keySignature: this.metadata.keySignature !== undefined
          ? transposeKeySignature(this.metadata.keySignature, amount)
          : undefined
      }
    }

    // Transpose key signatures array
    if (this.keySignatures) {
      song.keySignatures = this.keySignatures.map(([beat, count, loc]) =>
        [beat, transposeKeySignature(count, amount), loc]
      )
    }

    // Reuse references to unchanged properties
    song.timeSignatures = this.timeSignatures
    song.clefs = this.clefs
    song.strings = this.strings
    song.autoChords = this.autoChords
    song.trackName = this.trackName

    return song
  }

  /**
   * Transposes notes from this song into the target song.
   * Override in subclasses for custom note handling (e.g., multi-track).
   * @param target - The song to add transposed notes to
   * @param amount - Number of semitones to transpose
   */
  protected transposeNotesInto(target: SongNoteList, amount: number): void {
    this.forEach(note => target.push(note.transpose(amount)))
  }

  /**
   * Finds all notes that overlap with a time range.
   * @param start - Start of the range in beats
   * @param stop - End of the range in beats
   * @returns Array of notes that overlap with the range
   */
  notesInRange(start: number, stop: number): SongNote[] {
    return [...this.filter((n) => n.inRange(start, stop))]
  }

  /**
   * Finds indices of notes whose source location overlaps with a text selection.
   * Used for editor features like transposition of selected notes.
   * @param start - Start offset in source text
   * @param end - End offset in source text
   * @returns Set of note indices that overlap with the selection
   */
  findNotesForSelection(start: number, end: number): Set<number> {
    const result = new Set<number>()
    this.forEach((note, index) => {
      if (!note.sourceLocation) return
      const [noteStart, noteEnd] = note.sourceLocation
      if (start <= noteEnd && end >= noteStart) {
        result.add(index)
      }
    })
    return result
  }

  /**
   * Finds key signatures whose source location overlaps with a text selection.
   * Used for editor features like transposition of selected key signatures.
   * @param start - Start offset in source text
   * @param end - End offset in source text
   * @returns Array of key signature entries that overlap with the selection
   */
  findKeySignaturesForSelection(start: number, end: number): [number, number, [number, number]][] {
    if (!this.keySignatures) return []
    return this.keySignatures.filter(([, , [ksStart, ksEnd]]) =>
      start <= ksEnd && end >= ksStart
    )
  }

  /**
   * Returns the end position of the last note in beats.
   * @returns End position in beats, or 0 if empty
   */
  getStopInBeats(): number {
    if (this.length == 0) { return 0 }
    return Math.max.apply(null, this.map((n) => n.getStop()))
  }

  /**
   * Returns the start position of the first note in beats.
   * @returns Start position in beats, or 0 if empty
   */
  getStartInBeats(): number {
    if (this.length == 0) { return 0 }
    return Math.min.apply(null, this.map((n) => n.getStart()))
  }

  /**
   * Calculates measure boundaries based on time signatures.
   * @returns Array of measure objects with start position and beat count
   */
  getMeasures(): { start: number; beats: number }[] {
    const measures: { start: number; beats: number }[] = []
    const songEnd = this.getStopInBeats()

    if (songEnd === 0) return measures

    // Default to 4 beats per measure if no time signatures
    const timeSigs = this.timeSignatures ?? [[0, 4]]

    let position = 0
    let sigIndex = 0
    let currentBeats = timeSigs[0]?.[1] ?? 4

    while (position < songEnd) {
      // Check if time signature changes at or before current position
      while (sigIndex < timeSigs.length && timeSigs[sigIndex][0] <= position) {
        currentBeats = timeSigs[sigIndex][1]
        sigIndex++
      }

      measures.push({ start: position, beats: currentBeats })
      position += currentBeats
    }

    return measures
  }

  /**
   * Returns the pitch range of all notes in the song.
   * @returns Tuple of [lowest, highest] note names, or undefined if empty
   */
  noteRange(): [string, string] | undefined {
    if (!this.length) { return undefined }

    let min = parseNote(this[0].note)
    let max = min

    for (const songNote of this) {
      const pitch = parseNote(songNote.note)
      if (pitch < min) {
        min = pitch
      }

      if (pitch > max) {
        max = pitch
      }
    }

    return [noteName(min), noteName(max)]
  }

  /**
   * Determines the best staff type for displaying this song.
   * @returns "treble", "bass", or "grand" based on note range and clef settings
   */
  fittingStaff(): "treble" | "bass" | "grand" {
    if (this.clefs && this.clefs.length == 1) {
      const firstNote = this[0]
      // it is at the start
      if (!firstNote || firstNote.getStart() >= this.clefs[0][0]) {
        // return the staff that was assigned
        switch (this.clefs[0][1]) {
          case "f":
            return "bass"
          case "g":
            return "treble"
        }
      }
    }

    const range = this.noteRange()
    if (!range) {
      return "treble"
    }

    const [min, max] = range
    let useBase = false
    let useTreble = false

    if (parseNote(max) > MIDDLE_C_PITCH + 4) {
      useTreble = true
    }

    if (parseNote(min) < MIDDLE_C_PITCH - 4) {
      useBase = true
    }

    if (useTreble && useBase) {
      return "grand"
    } else if (useBase) {
      return "bass"
    } else {
      return "treble"
    }
  }

  /** Calculates the bucket range for a time span. */
  private getBucketRange(start: number, stop: number): [number, number] {
    const bucketSize = SongNoteList.bucketSize

    const left = Math.floor(start / bucketSize)
    const right = Math.ceil(stop / bucketSize)
    return [left, right]
  }

  /** Builds the spatial index buckets for fast note lookup. */
  private buildBuckets(): Record<number, number[]> {
    const buckets: Record<number, number[]> = {}
    this.forEach((songNote, idx) => {
      const [left, right] = this.getBucketRange(songNote.getStart(), songNote.getStop())
      for (let i = left; i < right; i++) {
        if (!buckets[i]) buckets[i] = []
        buckets[i].push(idx)
      }
    })

    return buckets
  }

  /** Gets the buckets to scan when matching notes near a beat. */
  private adjacentBuckets(beat: number): [number, number] {
    return this.getBucketRange(beat - 1, beat + 1)
  }

  /** Gets or builds the spatial index buckets. */
  private getBuckets(): Record<number, number[]> {
    if (!this.buckets) {
      this.buckets = this.buildBuckets()
    }

    return this.buckets
  }

  /**
   * Finds the note closest to a beat position using spatial indexing.
   * Faster than matchNote for large songs.
   * @param findNote - Note name to search for (e.g., "C4")
   * @param beat - Beat position to search near
   * @param wrapRight - Optional right boundary for wrap-around search
   * @param wrapLeft - Optional left boundary for wrap-around search
   * @returns Index of the matching note, or null if not found
   */
  matchNoteFast(findNote: string, beat: number, wrapRight?: number, wrapLeft?: number): number | null {
    const buckets = this.getBuckets()
    const [left, right] = this.adjacentBuckets(beat)

    let foundIdx: number | null = null

    for (let bucketIdx = left; bucketIdx < right; bucketIdx++) {
      const bucket = buckets[bucketIdx]
      if (!bucket) continue
      for (const songNoteIdx of bucket) {
        const note = this[songNoteIdx]

        if (foundIdx == songNoteIdx) {
          continue
        }

        if (parseNote(note.note) != parseNote(findNote)) {
          continue
        }

        if (foundIdx != null) {
          const found = this[foundIdx]
          if (Math.abs(found.start - beat) > Math.abs(note.start - beat)) {
            foundIdx = songNoteIdx
          }
        } else {
          foundIdx = songNoteIdx
        }
      }
    }

    if (wrapRight !== undefined && wrapLeft !== undefined) {
      const delta = wrapRight - beat
      if (delta < 2) {
        const wrapFoundIdx = this.matchNoteFast(findNote, wrapLeft - delta)
        if (wrapFoundIdx != null) {
          const found = this[wrapFoundIdx]
          if (foundIdx != null) {
            const current = this[foundIdx]
            if (Math.abs(found.start - (wrapLeft - delta)) < Math.abs(current.start - beat)) {
              foundIdx = wrapFoundIdx
            }
          } else {
            foundIdx = wrapFoundIdx
          }
        }
      }
    }

    return foundIdx
  }

  /**
   * Finds the note closest to a beat position using linear search.
   * Use matchNoteFast for better performance on large songs.
   * @param findNote - Note name to search for (e.g., "C4")
   * @param beat - Beat position to search near
   * @returns Index of the matching note, or null if not found
   */
  matchNote(findNote: string, beat: number): number | null {
    let foundIdx: number | null = null

    for (let idx = 0; idx < this.length; idx++) {
      const note = this[idx]

      if (parseNote(note.note) != parseNote(findNote)) {
        continue
      }

      if (foundIdx != null) {
        const found = this[foundIdx]
        if (Math.abs(found.start - beat) > Math.abs(note.start - beat)) {
          foundIdx = idx
        }
      } else {
        foundIdx = idx
      }
    }

    return foundIdx
  }
}

/**
 * A song containing multiple tracks, where each track is a SongNoteList.
 * Notes are stored both in the main list and in their respective tracks.
 * @example
 * const song = new MultiTrackSong()
 * song.pushWithTrack(new SongNote("C4", 0, 1), 0) // Track 0
 * song.pushWithTrack(new SongNote("E4", 0, 1), 1) // Track 1
 */
export class MultiTrackSong extends SongNoteList {
  /** Array of individual tracks */
  tracks: SongNoteList[] = []

  constructor() {
    super()
    Object.setPrototypeOf(this, MultiTrackSong.prototype)
  }

  /**
   * Adds a note to both the main song and a specific track.
   * @param note - The note to add
   * @param trackIdx - The track index to add the note to
   * @returns The added note
   */
  pushWithTrack(note: SongNote, trackIdx: number): SongNote {
    this.push(note)
    const track = this.getTrack(trackIdx)
    track.push(note)
    return note
  }

  /**
   * Finds an unused track index for auto-generated content like chords.
   * @returns The next available track index
   */
  findEmptyTrackIdx(): number {
    return this.tracks.length + 1
  }

  /**
   * Gets a track by index, creating it if it doesn't exist.
   * @param idx - The track index
   * @returns The SongNoteList for the track
   */
  getTrack(idx: number): SongNoteList {
    if (!this.tracks[idx]) {
      this.tracks[idx] = new SongNoteList()
    }

    return this.tracks[idx]
  }

  /**
   * Transposes notes from this song into the target song, handling tracks.
   * Notes are transposed per-track and added to both the track and main list.
   * @param target - The MultiTrackSong to add transposed notes to
   * @param amount - Number of semitones to transpose
   */
  protected override transposeNotesInto(target: SongNoteList, amount: number): void {
    const multiTarget = target as MultiTrackSong
    this.tracks.forEach((track, idx) => {
      if (track) {
        const transposedTrack = track.transpose(amount)
        multiTarget.tracks[idx] = transposedTrack
        transposedTrack.forEach(note => multiTarget.push(note))
      }
    })
  }
}
