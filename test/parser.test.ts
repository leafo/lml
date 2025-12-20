import { describe, it } from "node:test"
import assert from "node:assert"

import SongParser from "../src/parser.js"
import { SongNote } from "../src/song.js"

// Helper to strip auto-generated IDs for comparison
const stripIds = (notes: SongNote[]) =>
  notes.map(n => ({ note: n.note, start: n.start, duration: n.duration }))

const matchNotes = (have: SongNote[], expected: SongNote[]) => {
  assert.deepStrictEqual(stripIds(have), stripIds(expected))
}

// ============================================================================
// PARSE TESTS (text -> AST)
// ============================================================================

describe("parse", () => {
  const parser = new SongParser()

  describe("notes", () => {
    it("parses single note", () => {
      assert.deepStrictEqual(parser.parse("a5"), [
        ["note", "A5"]
      ])
    })

    it("parses note with whitespace", () => {
      assert.deepStrictEqual(parser.parse(`
        a5
      `), [
        ["note", "A5"]
      ])
    })

    it("parses multiple notes", () => {
      assert.deepStrictEqual(parser.parse("a5 b5 c6"), [
        ["note", "A5"],
        ["note", "B5"],
        ["note", "C6"]
      ])
    })

    it("parses note with duration", () => {
      assert.deepStrictEqual(parser.parse("a5.2"), [
        ["note", "A5", { duration: 2 }]
      ])
    })

    it("parses note with duration and start", () => {
      assert.deepStrictEqual(parser.parse("f3.1.2"), [
        ["note", "F3", { duration: 1, start: 2 }]
      ])
    })

    it("parses notes with timing information", () => {
      assert.deepStrictEqual(parser.parse("g4 a5.1 b2 f3.1.2"), [
        ["note", "G4"],
        ["note", "A5", { duration: 1 }],
        ["note", "B2"],
        ["note", "F3", { duration: 1, start: 2 }]
      ])
    })

    it("parses sharp accidental", () => {
      assert.deepStrictEqual(parser.parse("a+5"), [
        ["note", "A5", { sharp: true }]
      ])
    })

    it("parses flat accidental", () => {
      assert.deepStrictEqual(parser.parse("a-5"), [
        ["note", "A5", { flat: true }]
      ])
    })

    it("parses natural accidental", () => {
      assert.deepStrictEqual(parser.parse("a=5"), [
        ["note", "A5", { natural: true }]
      ])
    })

    it("parses all accidentals", () => {
      assert.deepStrictEqual(parser.parse("a+5 a-5 a=5"), [
        ["note", "A5", { sharp: true }],
        ["note", "A5", { flat: true }],
        ["note", "A5", { natural: true }]
      ])
    })

    it("parses accidental with duration", () => {
      assert.deepStrictEqual(parser.parse("c+5.2"), [
        ["note", "C5", { sharp: true, duration: 2 }]
      ])
    })

    it("converts lowercase to uppercase", () => {
      assert.deepStrictEqual(parser.parse("c5 D5 e5"), [
        ["note", "C5"],
        ["note", "D5"],
        ["note", "E5"]
      ])
    })
  })

  describe("rests", () => {
    it("parses simple rest", () => {
      assert.deepStrictEqual(parser.parse("r"), [
        ["rest"]
      ])
    })

    it("parses rest with duration", () => {
      assert.deepStrictEqual(parser.parse("r2"), [
        ["rest", { duration: 2 }]
      ])
    })

    it("parses uppercase rest", () => {
      assert.deepStrictEqual(parser.parse("R"), [
        ["rest"]
      ])
    })

    it("parses notes and rests", () => {
      assert.deepStrictEqual(parser.parse("g4.1 r2 a4.3 r b2"), [
        ["note", "G4", { duration: 1 }],
        ["rest", { duration: 2 }],
        ["note", "A4", { duration: 3 }],
        ["rest"],
        ["note", "B2"]
      ])
    })
  })

  describe("key signatures", () => {
    it("parses key signature with no accidentals", () => {
      assert.deepStrictEqual(parser.parse("ks0"), [
        ["keySignature", 0]
      ])
    })

    it("parses key signature with sharps", () => {
      assert.deepStrictEqual(parser.parse("ks2"), [
        ["keySignature", 2]
      ])
    })

    it("parses key signature with flats", () => {
      assert.deepStrictEqual(parser.parse("ks-4"), [
        ["keySignature", -4]
      ])
    })

    it("parses multiple key signatures", () => {
      assert.deepStrictEqual(parser.parse("ks-4 g5 ks2 d6"), [
        ["keySignature", -4],
        ["note", "G5"],
        ["keySignature", 2],
        ["note", "D6"]
      ])
    })
  })

  describe("time signatures", () => {
    it("parses 4/4 time", () => {
      assert.deepStrictEqual(parser.parse("ts4/4"), [
        ["timeSignature", 4, 4]
      ])
    })

    it("parses 3/4 time", () => {
      assert.deepStrictEqual(parser.parse("ts3/4"), [
        ["timeSignature", 3, 4]
      ])
    })

    it("parses 6/8 time", () => {
      assert.deepStrictEqual(parser.parse("ts6/8"), [
        ["timeSignature", 6, 8]
      ])
    })

    it("parses multiple time signatures", () => {
      assert.deepStrictEqual(parser.parse("ts4/4 ts3/4 ts6/8"), [
        ["timeSignature", 4, 4],
        ["timeSignature", 3, 4],
        ["timeSignature", 6, 8]
      ])
    })
  })

  describe("time modifiers", () => {
    it("parses half time", () => {
      assert.deepStrictEqual(parser.parse("ht"), [
        ["halfTime"]
      ])
    })

    it("parses double time", () => {
      assert.deepStrictEqual(parser.parse("dt"), [
        ["doubleTime"]
      ])
    })

    it("parses triple time", () => {
      assert.deepStrictEqual(parser.parse("tt"), [
        ["tripleTime"]
      ])
    })

    it("parses multiple time modifiers", () => {
      assert.deepStrictEqual(parser.parse("ht ht dt dt"), [
        ["halfTime"],
        ["halfTime"],
        ["doubleTime"],
        ["doubleTime"]
      ])
    })
  })

  describe("measures", () => {
    it("parses measure 0", () => {
      assert.deepStrictEqual(parser.parse("m0"), [
        ["measure", 0]
      ])
    })

    it("parses measure 1", () => {
      assert.deepStrictEqual(parser.parse("m1"), [
        ["measure", 1]
      ])
    })

    it("parses multiple measures", () => {
      assert.deepStrictEqual(parser.parse("m0 m1 m2"), [
        ["measure", 0],
        ["measure", 1],
        ["measure", 2]
      ])
    })

    it("parses time adjustments with measures", () => {
      assert.deepStrictEqual(parser.parse("ht ht dt dt m1 m2 ht"), [
        ["halfTime"],
        ["halfTime"],
        ["doubleTime"],
        ["doubleTime"],
        ["measure", 1],
        ["measure", 2],
        ["halfTime"]
      ])
    })
  })

  describe("blocks", () => {
    it("parses a block", () => {
      assert.deepStrictEqual(parser.parse("{ a5 }"), [
        ["block", [
          ["note", "A5"]
        ]]
      ])
    })

    it("parses block with measure", () => {
      assert.deepStrictEqual(parser.parse("m1 { a5 }"), [
        ["measure", 1],
        ["block", [
          ["note", "A5"]
        ]]
      ])
    })

    it("parses nested blocks", () => {
      assert.deepStrictEqual(parser.parse("{ a5 { b5 } c5 }"), [
        ["block", [
          ["note", "A5"],
          ["block", [
            ["note", "B5"]
          ]],
          ["note", "C5"]
        ]]
      ])
    })
  })

  describe("position restore", () => {
    it("parses restore position", () => {
      assert.deepStrictEqual(parser.parse("|"), [
        ["restoreStartPosition"]
      ])
    })

    it("parses multiple restores", () => {
      assert.deepStrictEqual(parser.parse("c5 | e5 | g5"), [
        ["note", "C5"],
        ["restoreStartPosition"],
        ["note", "E5"],
        ["restoreStartPosition"],
        ["note", "G5"]
      ])
    })
  })

  describe("tracks", () => {
    it("parses track 0", () => {
      assert.deepStrictEqual(parser.parse("t0"), [
        ["setTrack", 0]
      ])
    })

    it("parses track 1", () => {
      assert.deepStrictEqual(parser.parse("t1"), [
        ["setTrack", 1]
      ])
    })

    it("parses multiple tracks", () => {
      assert.deepStrictEqual(parser.parse("t0 a5 t1 b5"), [
        ["setTrack", 0],
        ["note", "A5"],
        ["setTrack", 1],
        ["note", "B5"]
      ])
    })
  })

  describe("clefs", () => {
    it("parses treble clef", () => {
      assert.deepStrictEqual(parser.parse("/g"), [
        ["clef", "g"]
      ])
    })

    it("parses bass clef", () => {
      assert.deepStrictEqual(parser.parse("/f"), [
        ["clef", "f"]
      ])
    })

    it("parses alto clef", () => {
      assert.deepStrictEqual(parser.parse("/c"), [
        ["clef", "c"]
      ])
    })

    it("parses uppercase clef", () => {
      assert.deepStrictEqual(parser.parse("/G"), [
        ["clef", "g"]
      ])
    })
  })

  describe("macros", () => {
    it("parses simple macro", () => {
      assert.deepStrictEqual(parser.parse("$hello"), [
        ["macro", "hello"]
      ])
    })

    it("parses chord macro", () => {
      assert.deepStrictEqual(parser.parse("$Cmaj7"), [
        ["macro", "Cmaj7"]
      ])
    })

    it("parses multiple macros", () => {
      assert.deepStrictEqual(parser.parse("$hello $w $cm7"), [
        ["macro", "hello"],
        ["macro", "w"],
        ["macro", "cm7"]
      ])
    })
  })

  describe("comments", () => {
    it("ignores a comment", () => {
      assert.deepStrictEqual(parser.parse(`
        # this is comment
        a5 c5 # a good one

        #more comment

        b6 #a5
      `), [
        ["note", "A5"],
        ["note", "C5"],
        ["note", "B6"]
      ])
    })

    // TODO: Bug - comments at the very start (before any whitespace) cause a parse error
    it.todo("ignores comment at start of input")
  })

  describe("whitespace", () => {
    it("handles multiple spaces", () => {
      assert.deepStrictEqual(parser.parse("a5    b5"), [
        ["note", "A5"],
        ["note", "B5"]
      ])
    })

    it("handles tabs", () => {
      assert.deepStrictEqual(parser.parse("a5\tb5"), [
        ["note", "A5"],
        ["note", "B5"]
      ])
    })

    it("handles newlines", () => {
      assert.deepStrictEqual(parser.parse("a5\nb5"), [
        ["note", "A5"],
        ["note", "B5"]
      ])
    })
  })
})

// ============================================================================
// COMPILE/LOAD TESTS (AST -> song notes)
// ============================================================================

describe("load", () => {
  describe("basic notes", () => {
    it("loads empty song", () => {
      const song = SongParser.load("ks0")
      assert.deepStrictEqual([...song], [])
    })

    it("loads single note", () => {
      const song = SongParser.load("c5")
      matchNotes([...song], [
        new SongNote("C5", 0, 1)
      ])
    })

    it("loads sequential notes", () => {
      const song = SongParser.load("c5 d5 e5 f5")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F5", 3, 1)
      ])
    })

    it("loads some notes", () => {
      const song = SongParser.load(`
        ks1
        b6 a6 g6 a6
        b6 b6 b6.2
        a6 a6 a6.2
      `)

      matchNotes([...song], [
        new SongNote("B6", 0, 1),
        new SongNote("A6", 1, 1),
        new SongNote("G6", 2, 1),
        new SongNote("A6", 3, 1),

        new SongNote("B6", 4, 1),
        new SongNote("B6", 5, 1),
        new SongNote("B6", 6, 2),

        new SongNote("A6", 8, 1),
        new SongNote("A6", 9, 1),
        new SongNote("A6", 10, 2)
      ])
    })
  })

  describe("duration", () => {
    it("applies duration multiplier", () => {
      const song = SongParser.load("c5.2 d5.4")
      matchNotes([...song], [
        new SongNote("C5", 0, 2),
        new SongNote("D5", 2, 4)
      ])
    })

    it("loads notes with explicit start position", () => {
      const song = SongParser.load("c5.1.0 d5.1.4 e5.1.8")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 4, 1),
        new SongNote("E5", 8, 1)
      ])
    })
  })

  describe("rests", () => {
    it("loads notes with rests", () => {
      const song = SongParser.load("r1 g5 r2 a5 r3 r1.1 f6")

      matchNotes([...song], [
        new SongNote("G5", 1, 1),
        new SongNote("A5", 4, 1),
        new SongNote("F6", 8, 1)
      ])
    })

    it("loads rest at start", () => {
      const song = SongParser.load("r2 c5")
      matchNotes([...song], [
        new SongNote("C5", 2, 1)
      ])
    })
  })

  describe("time modifiers", () => {
    it("applies double time", () => {
      const song = SongParser.load("dt c5 d5 e5 f5")
      matchNotes([...song], [
        new SongNote("C5", 0, 0.5),
        new SongNote("D5", 0.5, 0.5),
        new SongNote("E5", 1, 0.5),
        new SongNote("F5", 1.5, 0.5)
      ])
    })

    it("applies half time", () => {
      const song = SongParser.load("ht c5 d5")
      matchNotes([...song], [
        new SongNote("C5", 0, 2),
        new SongNote("D5", 2, 2)
      ])
    })

    it("applies triple time", () => {
      const song = SongParser.load("tt c5 d5 e5")
      matchNotes([...song], [
        new SongNote("C5", 0, 1/3),
        new SongNote("D5", 1/3, 1/3),
        new SongNote("E5", 2/3, 1/3)
      ])
    })

    it("stacks time modifiers", () => {
      const song = SongParser.load("dt dt c5 d5")
      matchNotes([...song], [
        new SongNote("C5", 0, 0.25),
        new SongNote("D5", 0.25, 0.25)
      ])
    })

    it("sets position and time correctly when using half and double time", () => {
      const song = SongParser.load(`
        ht
        a5.2
        dt
        b5.2
        dt
        c5.2
        c5
        dt
        g5

        m2
        a5
      `)

      matchNotes([...song], [
        new SongNote("A5", 0, 4),
        new SongNote("B5", 4, 2),
        new SongNote("C5", 6, 1),
        new SongNote("C5", 7, 0.5),
        new SongNote("G5", 7.5, 0.25),
        new SongNote("A5", 8, 0.25)
      ])
    })

    it("loads notes with timing", () => {
      const song = SongParser.load(`
        dt
        m0 c5 c5 c5
        m0 g5 a5 g5
        ht
        m1 c6
      `)

      matchNotes([...song], [
        // first measure
        new SongNote("C5", 0, 0.5),
        new SongNote("C5", 0.5, 0.5),
        new SongNote("C5", 1.0, 0.5),

        new SongNote("G5", 0, 0.5),
        new SongNote("A5", 0.5, 0.5),
        new SongNote("G5", 1.0, 0.5),

        // second measure
        new SongNote("C6", 4, 1)
      ])
    })
  })

  describe("time signatures", () => {
    it("loads song with 3/4 time", () => {
      const song = SongParser.load(`
        ts3/4
        m0 {
          c5
          d5.2
          |
          g4.3
        }

        m1 {
          e5
          d5
          c5
        }
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 2),
        new SongNote("G4", 0, 3),

        new SongNote("E5", 3, 1),
        new SongNote("D5", 4, 1),
        new SongNote("C5", 5, 1)
      ])
    })

    it("loads song with 6/8 time", () => {
      const song = SongParser.load(`
        ts6/8
        m0 {
          c5
          d5.2
          |
          g4.3
        }

        m1 {
          c6
        }
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 0.5),
        new SongNote("D5", 0.5, 1),
        new SongNote("G4", 0, 1.5),

        new SongNote("C6", 3, 0.5)
      ])
    })

    it("sets beatsPerMeasure in metadata", () => {
      const song = SongParser.load("ts6/8 c5")
      assert.strictEqual(song.metadata?.beatsPerMeasure, 3)
    })
  })

  describe("key signatures", () => {
    it("parses keySignature into metadata", () => {
      const song = SongParser.load(`
        ks-5
        c5
      `)

      assert.deepStrictEqual(song.metadata, {
        keySignature: -5,
        beatsPerMeasure: 4
      })
    })

    it("applies key signature with sharps", () => {
      const song = SongParser.load(`
        ks2
        c5
        d5
        e5
        f5
        g5
        a5
        b5
      `)

      matchNotes([...song], [
        new SongNote("C#5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F#5", 3, 1),
        new SongNote("G5", 4, 1),
        new SongNote("A5", 5, 1),
        new SongNote("B5", 6, 1)
      ])
    })

    it("applies key signature with flats", () => {
      const song = SongParser.load(`
        ks-2
        c5
        d5
        e5
        f5
        g5
        a5
        b5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("Eb5", 2, 1),
        new SongNote("F5", 3, 1),
        new SongNote("G5", 4, 1),
        new SongNote("A5", 5, 1),
        new SongNote("Bb5", 6, 1)
      ])
    })

    it("explicit accidentals override key signature", () => {
      const song = SongParser.load(`
        ks2
        c=5
        f=5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("F5", 1, 1)
      ])
    })

    it("explicit sharp works with key signature", () => {
      const song = SongParser.load(`
        ks0
        c+5
        d+5
      `)

      matchNotes([...song], [
        new SongNote("C#5", 0, 1),
        new SongNote("D#5", 1, 1)
      ])
    })

    it("explicit flat works with key signature", () => {
      const song = SongParser.load(`
        ks0
        b-5
        e-5
      `)

      matchNotes([...song], [
        new SongNote("Bb5", 0, 1),
        new SongNote("Eb5", 1, 1)
      ])
    })
  })

  describe("blocks", () => {
    it("sets position when using blocks", () => {
      const song = SongParser.load(`
        {
          dt
          a5
          a5.2
        }
        g6
      `)

      matchNotes([...song], [
        new SongNote("A5", 0, 0.5),
        new SongNote("A5", 0.5, 1),
        new SongNote("G6", 1.5, 1)
      ])
    })

    it("position flows from nested block", () => {
      const song = SongParser.load(`
        c5
        { d5 { e5 } f5 }
        g5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F5", 3, 1),
        new SongNote("G5", 4, 1)
      ])
    })
  })

  describe("position restore", () => {
    it("renders a chord with restore position", () => {
      const song = SongParser.load(`
        c5 | e5 | g5
        a6
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("E5", 0, 1),
        new SongNote("G5", 0, 1),
        new SongNote("A6", 1, 1)
      ])
    })

    it("restore in block resets to block start", () => {
      // When entering block, startPosition is set to current position (1 after c5)
      // | resets to startPosition (1), f5 goes at 1, position advances to 2
      // After block exits, g5 goes at position 2
      const song = SongParser.load(`
        c5
        {
          d5 e5
          |
          f5
        }
        g5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F5", 1, 1),
        new SongNote("G5", 2, 1)
      ])
    })
  })

  describe("multi-track", () => {
    it("separates notes by track", () => {
      const song = SongParser.load(`
        t0 c5 d5
        t1 e5 f5
      `)

      assert.strictEqual(song.tracks.length, 2)
      matchNotes([...song.tracks[0]], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1)
      ])
      matchNotes([...song.tracks[1]], [
        new SongNote("E5", 2, 1),
        new SongNote("F5", 3, 1)
      ])
    })

    it("switches between tracks", () => {
      const song = SongParser.load(`
        t0 c5
        t1 d5
        t0 e5
      `)

      matchNotes([...song.tracks[0]], [
        new SongNote("C5", 0, 1),
        new SongNote("E5", 2, 1)
      ])
      matchNotes([...song.tracks[1]], [
        new SongNote("D5", 1, 1)
      ])
    })
  })

  describe("auto chords", () => {
    it("loads song with autochords", () => {
      const song = SongParser.load(`
        ts6/8
        m0 $g
        m1 $bbm
      `, { autoChords: false })

      assert.strictEqual(song.metadata?.beatsPerMeasure, 3)
      assert.deepStrictEqual(song.autoChords, [
        [0, ["G", "M"]],
        [3, ["Bb", "m"]]
      ])
    })

    it("parses major chord macro", () => {
      const song = SongParser.load("$C", { autoChords: false })
      assert.deepStrictEqual(song.autoChords, [
        [0, ["C", "M"]]
      ])
    })

    it("parses minor chord macro", () => {
      const song = SongParser.load("$Am", { autoChords: false })
      assert.deepStrictEqual(song.autoChords, [
        [0, ["A", "m"]]
      ])
    })

    it("parses seventh chord macro", () => {
      const song = SongParser.load("$G7", { autoChords: false })
      assert.deepStrictEqual(song.autoChords, [
        [0, ["G", "7"]]
      ])
    })
  })

  describe("clefs", () => {
    it("records clef on track", () => {
      const song = SongParser.load("/g c5")
      assert.deepStrictEqual(song.tracks[0].clefs, [
        [0, "g"]
      ])
    })

    it("records bass clef", () => {
      const song = SongParser.load("/f c3")
      assert.deepStrictEqual(song.tracks[0].clefs, [
        [0, "f"]
      ])
    })
  })

  describe("measures", () => {
    it("sets position to measure start", () => {
      const song = SongParser.load(`
        m0 c5
        m1 d5
        m2 e5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 4, 1),
        new SongNote("E5", 8, 1)
      ])
    })

    it("works with different time signature", () => {
      const song = SongParser.load(`
        ts3/4
        m0 c5
        m1 d5
        m2 e5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 3, 1),
        new SongNote("E5", 6, 1)
      ])
    })
  })
})

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("parse errors", () => {
  const parser = new SongParser()

  it("throws on invalid note (missing octave)", () => {
    assert.throws(() => parser.parse("c"), /Expected/)
  })

  it("throws on invalid note letter", () => {
    assert.throws(() => parser.parse("x5"), /Expected/)
  })

  it("throws on malformed time signature (missing lower)", () => {
    assert.throws(() => parser.parse("ts4"), /Expected/)
  })

  it("throws on malformed time signature (missing upper)", () => {
    assert.throws(() => parser.parse("ts/4"), /Expected/)
  })

  it("throws on unclosed block", () => {
    assert.throws(() => parser.parse("{ a5"), /Expected/)
  })

  it("throws on invalid key signature", () => {
    assert.throws(() => parser.parse("ks"), /Expected/)
  })

  it("throws on invalid macro (empty)", () => {
    assert.throws(() => parser.parse("$"), /Expected/)
  })

  it("throws on invalid track (missing number)", () => {
    assert.throws(() => parser.parse("t"), /Expected/)
  })

  it("throws on invalid measure (missing number)", () => {
    assert.throws(() => parser.parse("m"), /Expected/)
  })
})
