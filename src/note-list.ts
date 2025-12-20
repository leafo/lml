import { notesLessThan, notesSame, parseNote } from "./music.js"

export default class NoteList extends Array<string> {
  constructor(notes?: string[]) {
    super()
    Object.setPrototypeOf(this, NoteList.prototype)

    if (notes && notes.length) {
      this.push.apply(this, notes)
    }
  }

  filterByRange(min: string, max: string): NoteList {
    return new NoteList(this.filter(function (n) {
      if (notesLessThan(n, min)) {
        return false
      }

      if (notesLessThan(max, n)) {
        return false
      }

      return true
    }))
  }

  // must be an array of notes
  matchesHead(notes: string[], anyOctave = false): boolean {
    const first = this[0]

    if (!Array.isArray(notes)) {
      throw new Error("matchesHead: notes should be an array")
    }

    if (Array.isArray(first)) {
      const firstArr = first as unknown as string[]
      if (firstArr.length != notes.length) {
        return false
      }
      if (anyOctave) {
        const noteSet: Record<string, boolean> = {}
        notes.forEach((n) => noteSet[n.replace(/\d+$/, "")] = true)
        return firstArr.every((n) => noteSet[n.replace(/\d+$/, "")])
      } else {
        const pitches = notes.map(parseNote)
        return firstArr.map(parseNote).every((n) => pitches.indexOf(n) >= 0)
      }
    } else {
      if (anyOctave) {
        return notes.length == 1 && notesSame(notes[0], first)
      } else {
        return notes.length == 1 && parseNote(notes[0]) == parseNote(first)
      }
    }
  }

  currentColumn(): string[] {
    const first = this[0]
    if (Array.isArray(first)) {
      return first as unknown as string[]
    } else {
      return [first]
    }
  }

  // if single note is in head
  inHead(note: string): boolean {
    const first = this[0]
    if (Array.isArray(first)) {
      return (first as unknown as string[]).some((n) => n == note)
    } else {
      return note == first
    }
  }

  override toString(): string {
    return this.map((n) => {
      if (Array.isArray(n)) {
        return (n as unknown as string[]).join(" ")
      }
      return n
    }).join(", ")
  }

  // converts it to serialize list of note numbers for quick comparisons
  toNoteString(): string {
    return this.map((n) => {
      if (Array.isArray(n)) {
        return (n as unknown as string[]).map(parseNote).join(" ")
      }
      return parseNote(n).toString()
    }).join(", ")
  }
}
