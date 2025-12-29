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
    assert.strictEqual(parseNote("C4"), MIDDLE_C_PITCH)
  })

  it("parses notes with sharps", () => {
    assert.strictEqual(parseNote("C#4"), MIDDLE_C_PITCH + 1)
    assert.strictEqual(parseNote("F#3"), parseNote("F3") + 1)
  })

  it("parses notes with flats", () => {
    assert.strictEqual(parseNote("Db4"), MIDDLE_C_PITCH + 1)
    assert.strictEqual(parseNote("Bb3"), parseNote("B3") - 1)
  })

  it("throws on invalid input", () => {
    assert.throws(() => parseNote("X5"), /invalid note format/)
    assert.throws(() => parseNote("C"), /invalid note format/)
  })
})

describe("noteName", () => {
  it("converts pitch to note name", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH), "C4")
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 12), "C5")
  })

  it("uses sharps by default for accidentals", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 1), "C#4")
  })

  it("can use flats for accidentals", () => {
    assert.strictEqual(noteName(MIDDLE_C_PITCH + 1, false), "Db4")
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
    assert.strictEqual(addInterval("C4", 4), "E4")  // major third
    assert.strictEqual(addInterval("C4", 7), "G4")  // perfect fifth
    assert.strictEqual(addInterval("C4", 12), "C5") // octave
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
    const notes = scale.getRange(4, 8)
    assert.deepStrictEqual(notes, ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"])
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
    const notes = scale.getRange(3, 8)
    assert.deepStrictEqual(notes, ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"])
  })
})

describe("Chord", () => {
  it("creates a major chord", () => {
    const chord = new Chord("C", "M")
    const notes = chord.getRange(4, 3)
    assert.deepStrictEqual(notes, ["C4", "E4", "G4"])
  })

  it("creates a minor chord", () => {
    const chord = new Chord("A", "m")
    const notes = chord.getRange(3, 3)
    assert.deepStrictEqual(notes, ["A3", "C4", "E4"])
  })

  it("creates a seventh chord", () => {
    const chord = new Chord("G", "7")
    const notes = chord.getRange(3, 4)
    assert.deepStrictEqual(notes, ["G3", "B3", "D4", "F4"])
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

  describe("convertNote", () => {
    it("strips sharps implied by key signature", () => {
      const gMajor = new KeySignature(1) // F#
      assert.strictEqual(gMajor.convertNote("F#4"), "F4")
      assert.strictEqual(gMajor.convertNote("F#5"), "F5")
    })

    it("keeps sharps not in key signature", () => {
      const gMajor = new KeySignature(1) // F#
      assert.strictEqual(gMajor.convertNote("C#4"), "C#4")
      assert.strictEqual(gMajor.convertNote("G#4"), "G#4")
    })

    it("strips flats implied by key signature", () => {
      const fMajor = new KeySignature(-1) // Bb
      assert.strictEqual(fMajor.convertNote("Bb4"), "B4")
      assert.strictEqual(fMajor.convertNote("Bb3"), "B3")
    })

    it("keeps flats not in key signature", () => {
      const fMajor = new KeySignature(-1) // Bb
      assert.strictEqual(fMajor.convertNote("Eb4"), "Eb4")
      assert.strictEqual(fMajor.convertNote("Ab4"), "Ab4")
    })

    it("leaves notes without accidentals unchanged", () => {
      const gMajor = new KeySignature(1)
      assert.strictEqual(gMajor.convertNote("C4"), "C4")
      assert.strictEqual(gMajor.convertNote("G4"), "G4")
    })

    it("handles C major (no accidentals)", () => {
      const cMajor = new KeySignature(0)
      assert.strictEqual(cMajor.convertNote("C4"), "C4")
      assert.strictEqual(cMajor.convertNote("F#4"), "F#4")
      assert.strictEqual(cMajor.convertNote("Bb4"), "Bb4")
    })

    it("handles keys with multiple accidentals", () => {
      const dMajor = new KeySignature(2) // F#, C#
      assert.strictEqual(dMajor.convertNote("F#4"), "F4")
      assert.strictEqual(dMajor.convertNote("C#4"), "C4")
      assert.strictEqual(dMajor.convertNote("G#4"), "G#4")

      const bbMajor = new KeySignature(-2) // Bb, Eb
      assert.strictEqual(bbMajor.convertNote("Bb4"), "B4")
      assert.strictEqual(bbMajor.convertNote("Eb4"), "E4")
      assert.strictEqual(bbMajor.convertNote("Ab4"), "Ab4")
    })
  })

  describe("noteName", () => {
    it("uses sharps for sharp keys (MIDI 60-72)", () => {
      const gMajor = new KeySignature(1)
      assert.strictEqual(gMajor.noteName(60), "C4")
      assert.strictEqual(gMajor.noteName(61), "C#4")
      assert.strictEqual(gMajor.noteName(62), "D4")
      assert.strictEqual(gMajor.noteName(63), "D#4")
      assert.strictEqual(gMajor.noteName(64), "E4")
      assert.strictEqual(gMajor.noteName(65), "F4")
      assert.strictEqual(gMajor.noteName(66), "F#4")
      assert.strictEqual(gMajor.noteName(67), "G4")
      assert.strictEqual(gMajor.noteName(68), "G#4")
      assert.strictEqual(gMajor.noteName(69), "A4")
      assert.strictEqual(gMajor.noteName(70), "A#4")
      assert.strictEqual(gMajor.noteName(71), "B4")
      assert.strictEqual(gMajor.noteName(72), "C5")
    })

    it("uses flats for flat keys (MIDI 60-72)", () => {
      const fMajor = new KeySignature(-1)
      assert.strictEqual(fMajor.noteName(60), "C4")
      assert.strictEqual(fMajor.noteName(61), "Db4")
      assert.strictEqual(fMajor.noteName(62), "D4")
      assert.strictEqual(fMajor.noteName(63), "Eb4")
      assert.strictEqual(fMajor.noteName(64), "E4")
      assert.strictEqual(fMajor.noteName(65), "F4")
      assert.strictEqual(fMajor.noteName(66), "Gb4")
      assert.strictEqual(fMajor.noteName(67), "G4")
      assert.strictEqual(fMajor.noteName(68), "Ab4")
      assert.strictEqual(fMajor.noteName(69), "A4")
      assert.strictEqual(fMajor.noteName(70), "Bb4")
      assert.strictEqual(fMajor.noteName(71), "B4")
      assert.strictEqual(fMajor.noteName(72), "C5")
    })

    it("defaults to sharps for C major (MIDI 60-72)", () => {
      const cMajor = new KeySignature(0)
      assert.strictEqual(cMajor.noteName(60), "C4")
      assert.strictEqual(cMajor.noteName(61), "C#4")
      assert.strictEqual(cMajor.noteName(62), "D4")
      assert.strictEqual(cMajor.noteName(63), "D#4")
      assert.strictEqual(cMajor.noteName(64), "E4")
      assert.strictEqual(cMajor.noteName(65), "F4")
      assert.strictEqual(cMajor.noteName(66), "F#4")
      assert.strictEqual(cMajor.noteName(67), "G4")
      assert.strictEqual(cMajor.noteName(68), "G#4")
      assert.strictEqual(cMajor.noteName(69), "A4")
      assert.strictEqual(cMajor.noteName(70), "A#4")
      assert.strictEqual(cMajor.noteName(71), "B4")
      assert.strictEqual(cMajor.noteName(72), "C5")
    })
  })
})
