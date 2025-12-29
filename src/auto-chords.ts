import {
  Chord, parseNote, noteName, addInterval, MIDDLE_C_PITCH, OCTAVE_SIZE,
  type ChordShapeName
} from "./music.js"

import { SongNote, SongNoteList, MultiTrackSong } from "./song.js"

/**
 * @category AutoChords
 */
export interface AutoChordsOptions {
  rate?: number
  chordMinSpacing?: number
}

/**
 * @category AutoChords
 */
export interface ChordBlock {
  start: number
  stop: number
  chord: [string, ChordShapeName]
}

/**
 * @category AutoChords
 */
export class AutoChords {
  static defaultChords(song: MultiTrackSong, options?: AutoChordsOptions): AutoChords {
    return new BossaNovaAutoChords(song, options)
  }

  // attempt to parse chord from macro name
  static coerceChord(macro: string): [string, ChordShapeName] | undefined {
    const m = macro.match(/([a-gA-G][#b]?)(.*)/)
    if (!m) { return }
    let [, root, shape] = m

    root = root.substr(0, 1).toUpperCase() + root.substr(1)

    if (shape == "") {
      shape = "M"
    }

    if (!(shape in Chord.SHAPES)) {
      return
    }

    return [root, shape as ChordShapeName]
  }

  static allGenerators: (typeof AutoChords)[] = []

  static displayName = "Auto Chords"

  song: MultiTrackSong
  options: AutoChordsOptions

  constructor(song: MultiTrackSong, options: AutoChordsOptions = {}) {
    this.song = song
    this.options = options
  }

  findChordBlocks(): ChordBlock[] {
    const beatsPerMeasure = this.song.metadata?.beatsPerMeasure

    if (!beatsPerMeasure) {
      throw new Error("Missing beats per measure for autochords")
    }

    if (!this.song.autoChords) {
      throw new Error("Song missing autochords")
    }

    const chords = [...this.song.autoChords]
    chords.reverse()
    const chordBlocks: ChordBlock[] = []

    let chordsUntil: number | null = null

    for (const [position, chord] of chords) {
      const start = position
      let stop = (Math.floor((position / beatsPerMeasure)) + 1) * beatsPerMeasure

      if (chordsUntil !== null) {
        stop = Math.min(stop, chordsUntil)
      }

      if (start >= stop) {
        console.warn("rejecting chord", chord, start, stop)
        continue
      }

      chordBlocks.push({
        start, stop, chord
      })
      chordsUntil = start
    }

    chordBlocks.reverse()
    return chordBlocks
  }

  addChords(): void {
    const blocks = this.findChordBlocks()
    const notesToAdd: SongNote[] = [] // the final set of notes added

    for (const block of blocks) {
      const [root, shape] = block.chord

      const toAdd = this.notesForChord(root, shape, block.start, block.stop)

      if (toAdd) {
        notesToAdd.push(...toAdd)
      }
    }

    const trackId = this.song.findEmptyTrackIdx()

    // just mutate the song for now
    for (const note of notesToAdd) {
      this.song.pushWithTrack(note, trackId)
    }

    const track = this.song.getTrack(trackId)
    track.trackName = "Autochords"
  }

  minPitchInRange(start: number, stop: number): number {
    const notes = this.song.notesInRange(start, stop)

    const pitches = [
      MIDDLE_C_PITCH + 5,
      ...notes.map(n => parseNote(n.note))
    ]

    let minPitch = Math.min(...pitches)

    if (this.options.chordMinSpacing) {
      minPitch -= this.options.chordMinSpacing
    }

    return minPitch
  }

  // find the closest root beneath the notes in range
  rootBelow(name: string, maxPitch: number): string {
    const rootPitch = parseNote(name + "0")
    const chordRootPitch = Math.floor(((maxPitch - 1) - rootPitch) / 12) * 12 + rootPitch
    return noteName(chordRootPitch)
  }

  notesForChord(_root: string, _shape: ChordShapeName, _blockStart: number, _blockStop: number): SongNote[] {
    console.warn("Autochords doesn't generate any notes")
    return []
  }

  inDivisions(start: number, stop: number, count: number, fn: (left: number, right: number, k: number) => void): void {
    const bpm = this.song.metadata?.beatsPerMeasure || 4

    const chunkSize = bpm / Math.pow(2, count - 1)
    let left = start

    let k = 0
    while (true) {
      const right = Math.min(stop, left + chunkSize)

      fn(left, right, k)
      left += chunkSize
      k += 1

      if (right >= stop) {
        break
      }
    }
  }
}

/**
 * @category AutoChords
 */
export class RootAutoChords extends AutoChords {
  static override displayName = "Root"

  notesForChord(root: string, _shape: ChordShapeName, blockStart: number, blockStop: number): SongNote[] {
    const maxPitch = this.minPitchInRange(blockStart, blockStop)

    const rate = this.options.rate || 1

    const out: SongNote[] = []
    this.inDivisions(blockStart, blockStop, rate, (start, stop) => {
      out.push(
        new SongNote(this.rootBelow(root, maxPitch), start, stop - start)
      )
    })

    return out
  }
}

/**
 * @category AutoChords
 */
export class TriadAutoChords extends AutoChords {
  static override displayName = "Triad"

  notesForChord(root: string, shape: ChordShapeName, blockStart: number, blockStop: number): SongNote[] {
    const maxPitch = this.minPitchInRange(blockStart, blockStop)
    const chordRoot = this.rootBelow(root, maxPitch)

    const rate = this.options.rate || 1

    const out: SongNote[] = []

    this.inDivisions(blockStart, blockStop, rate, (start, stop) => {
      Chord.notes(chordRoot, shape).map((note) =>
        out.push(new SongNote(note, start, stop - start))
      )
    })

    return out
  }
}

/**
 * @category AutoChords
 */
export class Root5AutoChords extends AutoChords {
  static override displayName = "Root+5"

  notesForChord(root: string, shape: ChordShapeName, blockStart: number, blockStop: number): SongNote[] {
    const maxPitch = this.minPitchInRange(blockStart, blockStop)
    let chordRoot = this.rootBelow(root, maxPitch)
    let chordNotes = Chord.notes(chordRoot, shape)

    if (parseNote(chordNotes[2]) > maxPitch) {
      chordRoot = addInterval(chordRoot, -OCTAVE_SIZE)
      chordNotes = Chord.notes(chordRoot, shape)
    }

    const rate = this.options.rate || 1

    const bpm = this.song.metadata?.beatsPerMeasure || 2

    const out: SongNote[] = []
    this.inDivisions(blockStart, blockStop, 1 + rate, (start, stop, k) => {
      if (k % bpm == 0) {
        // root on beat
        out.push(
          new SongNote(chordNotes[0], start, stop - start)
        )
      } else {
        // 5 on everything else
        out.push(
          new SongNote(chordNotes[2], start, stop - start)
        )
      }
    })

    return out
  }
}

/**
 * @category AutoChords
 */
export class ArpAutoChords extends AutoChords {
  static override displayName = "Arp"

  notesForChord(root: string, shape: ChordShapeName, blockStart: number, blockStop: number): SongNote[] {
    const maxPitch = this.minPitchInRange(blockStart, blockStop)
    const chordRoot = this.rootBelow(root, maxPitch)
    const chordNotes = Chord.notes(chordRoot, shape)

    const out: SongNote[] = []
    this.inDivisions(blockStart, blockStop, 3, (start, stop, k) => {
      switch (k) {
        case 0:
          out.push(
            new SongNote(chordNotes[0], start, stop - start)
          )
          break
        case 1:
          out.push(
            new SongNote(chordNotes[1], start, stop - start)
          )
          break
        case 2:
          out.push(
            new SongNote(chordNotes[3] || chordNotes[2],
              start, stop - start)
          )
          break
        case 3:
          out.push(
            new SongNote(chordNotes[1], start, stop - start)
          )
          break
      }
    })

    for (const note of out) {
      while (parseNote(note.note) >= maxPitch) {
        // shift everything down by octave
        for (const n of out) {
          n.note = noteName(parseNote(n.note) - 12)
        }
      }
    }

    return out
  }
}

/**
 * @category AutoChords
 */
export class BossaNovaAutoChords extends AutoChords {
  static override displayName = "Bossa Nova"

  notesForChord(root: string, shape: ChordShapeName, blockStart: number, blockStop: number): SongNote[] {
    const maxPitch = this.minPitchInRange(blockStart, blockStop)
    const chordRoot = this.rootBelow(root, maxPitch)
    const chordNotes = Chord.notes(chordRoot, shape)

    const out: SongNote[] = []
    this.inDivisions(blockStart, blockStop, 3, (start, stop, k) => {
      const d = (stop - start) / 2

      let one = chordNotes[0]
      let two = chordNotes[2]

      if (parseNote(two) >= maxPitch) {
        one = noteName(parseNote(chordNotes[2]) - 12)
        two = chordNotes[0]
      }

      switch (k) {
        case 0:
          out.push(
            new SongNote(one, start, d * 3)
          )
          break
        case 1:
          out.push(
            new SongNote(one, start + d, d)
          )
          break
        case 2:
          out.push(
            new SongNote(two, start, d * 3)
          )
          break
        case 3:
          out.push(
            new SongNote(two, start + d, d)
          )
          break
      }
    })

    return out
  }
}

AutoChords.allGenerators = [
  RootAutoChords,
  TriadAutoChords,
  Root5AutoChords,
  ArpAutoChords,
  BossaNovaAutoChords,
]
