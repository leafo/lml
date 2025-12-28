import { parseNote, noteName, MIDDLE_C_PITCH } from "./music.js"

// note: C4, D#5, etc...
// start: when note begins in beats
// duration: how long note is in beats
export class SongNote {
  id: symbol
  note: string
  start: number
  duration: number
  sourceLocation?: [number, number]  // [startOffset, endOffset] in source string

  constructor(note: string, start: number, duration: number, sourceLocation?: [number, number]) {
    this.id = Symbol()
    this.note = note
    this.start = start
    this.duration = duration
    this.sourceLocation = sourceLocation
  }

  clone(): SongNote {
    const cloned = new SongNote(
      this.note, this.start, this.duration, this.sourceLocation
    )
    return cloned
  }

  inRange(min: number, max: number): boolean {
    const stop = this.start + this.duration

    if (min >= stop) { return false }
    if (max <= this.start) { return false }

    return true
  }

  transpose(semitones: number): SongNote {
    return new SongNote(
      noteName(parseNote(this.note) + semitones), this.start, this.duration, this.sourceLocation
    )
  }

  getStart(): number {
    return this.start
  }

  getStop(): number {
    return this.start + this.duration
  }

  getRenderStop(): number {
    return this.start + this.duration
  }

  toString(): string {
    return `${this.note},${this.start},${this.duration}`
  }
}

export interface SongMetadata {
  keySignature?: number
  beatsPerMeasure?: number
  frontmatter?: Record<string, string>
}

// like note list but notes in time
export class SongNoteList extends Array<SongNote> {
  static bucketSize = 8 // bucket size in beats

  metadata?: SongMetadata
  autoChords?: [number, [string, string]][]
  clefs?: [number, string][]
  strings?: [number, string][]
  timeSignatures?: [number, number][]  // [beat_position, beats_per_measure][]
  keySignatures?: [number, number, [number, number]][]  // [beat_position, count, sourceLocation][]
  trackName?: string

  private buckets?: Record<number, number[]>

  constructor() {
    super()
    Object.setPrototypeOf(this, SongNoteList.prototype)
  }

  static newSong(noteTuples: [string, number, number][]): SongNoteList {
    const notes = noteTuples.map(([note, start, duration]) =>
      new SongNote(note, start, duration))

    const song = new SongNoteList()
    for (const note of notes) {
      song.push(note)
    }

    return song
  }

  clone(): SongNoteList {
    const song = new SongNoteList()

    this.forEach(note =>
      song.push(note.clone())
    )

    return song
  }

  clearCache(): void {
    delete this.buckets
  }

  transpose(amount = 0): SongNoteList {
    if (amount == 0) {
      return this
    }

    const song = new SongNoteList()

    this.forEach(note =>
      song.push(note.transpose(amount))
    )

    return song
  }

  // find the notes that fall in the time range
  notesInRange(start: number, stop: number): SongNote[] {
    return [...this.filter((n) => n.inRange(start, stop))]
  }

  // find note indices that overlap with the given source position range
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

  getStopInBeats(): number {
    if (this.length == 0) { return 0 }
    return Math.max.apply(null, this.map((n) => n.getStop()))
  }

  getStartInBeats(): number {
    if (this.length == 0) { return 0 }
    return Math.min.apply(null, this.map((n) => n.getStart()))
  }

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

  private getBucketRange(start: number, stop: number): [number, number] {
    const bucketSize = SongNoteList.bucketSize

    const left = Math.floor(start / bucketSize)
    const right = Math.ceil(stop / bucketSize)
    return [left, right]
  }

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

  // get the buckets to scan to match notes for beat
  private adjacentBuckets(beat: number): [number, number] {
    return this.getBucketRange(beat - 1, beat + 1)
  }

  private getBuckets(): Record<number, number[]> {
    if (!this.buckets) {
      this.buckets = this.buildBuckets()
    }

    return this.buckets
  }

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

  // see if we're hitting a valid note
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

export class MultiTrackSong extends SongNoteList {
  tracks: SongNoteList[] = []

  constructor() {
    super()
    Object.setPrototypeOf(this, MultiTrackSong.prototype)
  }

  pushWithTrack(note: SongNote, trackIdx: number): SongNote {
    this.push(note)
    const track = this.getTrack(trackIdx)
    track.push(note)
    return note
  }

  // find an empty track to put autochords in
  findEmptyTrackIdx(): number {
    return this.tracks.length + 1
  }

  getTrack(idx: number): SongNoteList {
    if (!this.tracks[idx]) {
      this.tracks[idx] = new SongNoteList()
    }

    return this.tracks[idx]
  }
}
