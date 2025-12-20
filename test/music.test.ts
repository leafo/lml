import { describe, it } from "node:test"
import assert from "node:assert"

import {
  parseNote,
  noteName,
  notesSame,
  addInterval,
  compareNotes,
  MIDDLE_C_PITCH,
  MajorScale,
  MinorScale,
  Chord,
  KeySignature,
} from "../src/index.js"

describe("parseNote", () => {
  it("parses middle C", () => {
    assert.strictEqual(parseNote("C5"), MIDDLE_C_PITCH)
  })

  it("parses notes with sharps", () => {
    assert.strictEqual(parseNote("C#5"), MIDDLE_C_PITCH + 1)
    assert.strictEqual(parseNote("F#4"), parseNote("F4") + 1)
  })

  it("parses notes with flats", () => {
    assert.strictEqual(parseNote("Db5"), MIDDLE_C_PITCH + 1)
    assert.strictEqual(parseNote("Bb4"), parseNote("B4") - 1)
  })

  it("throws on invalid input", () => {
    assert.throws(() => parseNote("X5"), /invalid note format/)
    assert.throws(() => parseNote("C"), /invalid note format/)
  })
})

describe("noteName", () => {
  it("converts pitch to note name", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH), "C5")
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 12), "C6")
  })

  it("uses sharps by default for accidentals", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 1), "C#5")
  })

  it("can use flats for accidentals", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 1, false), "Db5")
  })
})

describe("notesSame", () => {
  it("compares notes ignoring octave", () => {
    assert.strictEqual(notesSame("C4", "C5"), true)
    assert.strictEqual(notesSame("C4", "D4"), false)
  })

  it("handles enharmonic equivalents", () => {
    assert.strictEqual(notesSame("C#4", "Db5"), true)
  })
})

describe("addInterval", () => {
  it("adds halfsteps to a note", () => {
    assert.strictEqual(addInterval("C5", 4), "E5")  // major third
    assert.strictEqual(addInterval("C5", 7), "G5")  // perfect fifth
    assert.strictEqual(addInterval("C5", 12), "C6") // octave
  })
})

describe("compareNotes", () => {
  it("returns 0 for same notes", () => {
    assert.strictEqual(compareNotes("C5", "C5"), 0)
  })

  it("returns negative when first note is lower", () => {
    assert.ok(compareNotes("C4", "C5") < 0)
  })

  it("returns positive when first note is higher", () => {
    assert.ok(compareNotes("C5", "C4") > 0)
  })
})

describe("MajorScale", () => {
  it("generates correct scale notes", () => {
    const scale = new MajorScale("C")
    const notes = scale.getRange(5, 8)
    assert.deepStrictEqual(notes, ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6"])
  })

  it("checks if note is in scale", () => {
    const scale = new MajorScale("C")
    assert.strictEqual(scale.containsNote("C4"), true)
    assert.strictEqual(scale.containsNote("E4"), true)
    assert.strictEqual(scale.containsNote("C#4"), false)
  })
})

describe("MinorScale", () => {
  it("generates correct scale notes", () => {
    const scale = new MinorScale("A")
    const notes = scale.getRange(4, 8)
    assert.deepStrictEqual(notes, ["A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"])
  })
})

describe("Chord", () => {
  it("creates a major chord", () => {
    const chord = new Chord("C", "M")
    const notes = chord.getRange(5, 3)
    assert.deepStrictEqual(notes, ["C5", "E5", "G5"])
  })

  it("creates a minor chord", () => {
    const chord = new Chord("A", "m")
    const notes = chord.getRange(4, 3)
    assert.deepStrictEqual(notes, ["A4", "C5", "E5"])
  })

  it("creates a seventh chord", () => {
    const chord = new Chord("G", "7")
    const notes = chord.getRange(4, 4)
    assert.deepStrictEqual(notes, ["G4", "B4", "D5", "F5"])
  })

  it("generates chord name", () => {
    assert.strictEqual(new Chord("C", "M").toString(), "C")
    assert.strictEqual(new Chord("A", "m").toString(), "Am")
    assert.strictEqual(new Chord("G", "7").toString(), "G7")
  })
})

describe("KeySignature", () => {
  it("creates key signature by count", () => {
    const cMajor = new KeySignature(0)
    assert.strictEqual(cMajor.name(), "C")

    const gMajor = new KeySignature(1)
    assert.strictEqual(gMajor.name(), "G")
  })

  it("identifies sharp vs flat keys", () => {
    const gMajor = new KeySignature(1)
    assert.strictEqual(gMajor.isSharp(), true)
    assert.strictEqual(gMajor.isFlat(), false)

    const fMajor = new KeySignature(-1)
    assert.strictEqual(fMajor.isSharp(), false)
    assert.strictEqual(fMajor.isFlat(), true)
  })
})
