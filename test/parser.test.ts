import { describe, it } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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
      assert.deepStrictEqual(parser.parse("f3.1@2"), [
        ["note", "F3", { duration: 1, start: 2 }]
      ])
    })

    it("parses note with only start position", () => {
      assert.deepStrictEqual(parser.parse("c5@4"), [
        ["note", "C5", { start: 4 }]
      ])
    })

    it("parses notes with timing information", () => {
      assert.deepStrictEqual(parser.parse("g4 a5.1 b2 f3.1@2"), [
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

    it("parses duration divider", () => {
      assert.deepStrictEqual(parser.parse("c5/2"), [
        ["note", "C5", { duration: 0.5 }]
      ])
    })

    it("parses duration divider by 4", () => {
      assert.deepStrictEqual(parser.parse("c5/4"), [
        ["note", "C5", { duration: 0.25 }]
      ])
    })

    it("parses duration divider with start position", () => {
      assert.deepStrictEqual(parser.parse("c5/2@4"), [
        ["note", "C5", { duration: 0.5, start: 4 }]
      ])
    })

    it("parses duration divider with relative octave", () => {
      assert.deepStrictEqual(parser.parse("c/2"), [
        ["note", "C", { duration: 0.5 }]
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

    it("parses rest with start position", () => {
      assert.deepStrictEqual(parser.parse("r@4"), [
        ["rest", { start: 4 }]
      ])
    })

    it("parses rest with duration and start", () => {
      assert.deepStrictEqual(parser.parse("r2@4"), [
        ["rest", { duration: 2, start: 4 }]
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

    it("parses time modifiers with count", () => {
      assert.deepStrictEqual(parser.parse("dt2"), [
        ["doubleTime", 2]
      ])
      assert.deepStrictEqual(parser.parse("ht3"), [
        ["halfTime", 3]
      ])
      assert.deepStrictEqual(parser.parse("tt2"), [
        ["tripleTime", 2]
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

    it("parses measure without number", () => {
      assert.deepStrictEqual(parser.parse("m"), [
        ["measure"]
      ])
    })

    it("parses multiple auto-increment measures", () => {
      assert.deepStrictEqual(parser.parse("m m m"), [
        ["measure"],
        ["measure"],
        ["measure"]
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

    it("ignores comment at start of input", () => {
      assert.deepStrictEqual(parser.parse("# comment at start\na5 b5"), [
        ["note", "A5"],
        ["note", "B5"]
      ])
    })
  })

  describe("frontmatter", () => {
    it("parses single frontmatter line", () => {
      assert.deepStrictEqual(parser.parse("# title: My Song\na5"), [
        ["frontmatter", "title", "My Song"],
        ["note", "A5"]
      ])
    })

    it("parses multiple frontmatter lines", () => {
      assert.deepStrictEqual(parser.parse("# title: My Song\n# author: Test\n# bpm: 120\na5"), [
        ["frontmatter", "title", "My Song"],
        ["frontmatter", "author", "Test"],
        ["frontmatter", "bpm", "120"],
        ["note", "A5"]
      ])
    })

    it("handles frontmatter with no space after #", () => {
      assert.deepStrictEqual(parser.parse("#title: My Song\na5"), [
        ["frontmatter", "title", "My Song"],
        ["note", "A5"]
      ])
    })

    it("handles frontmatter with extra whitespace", () => {
      assert.deepStrictEqual(parser.parse("#  title  :  My Song  \na5"), [
        ["frontmatter", "title", "My Song"],
        ["note", "A5"]
      ])
    })

    it("handles underscore in key name", () => {
      assert.deepStrictEqual(parser.parse("# my_key: value\na5"), [
        ["frontmatter", "my_key", "value"],
        ["note", "A5"]
      ])
    })

    it("returns no frontmatter when none present", () => {
      assert.deepStrictEqual(parser.parse("a5"), [
        ["note", "A5"]
      ])
    })

    it("distinguishes frontmatter from regular comments", () => {
      // Regular comment (no colon pattern) should not be frontmatter
      assert.deepStrictEqual(parser.parse("# this is a comment\na5"), [
        ["note", "A5"]
      ])
    })

    it("stops parsing frontmatter after non-frontmatter content", () => {
      // Once we hit a non-frontmatter line, subsequent # key: lines are just comments
      assert.deepStrictEqual(parser.parse("# title: Song\na5\n# author: Test\nb5"), [
        ["frontmatter", "title", "Song"],
        ["note", "A5"],
        ["note", "B5"]
      ])
    })

    it("is case-sensitive for keys", () => {
      assert.deepStrictEqual(parser.parse("# Title: One\n# title: Two\na5"), [
        ["frontmatter", "Title", "One"],
        ["frontmatter", "title", "Two"],
        ["note", "A5"]
      ])
    })

    it("handles empty value", () => {
      assert.deepStrictEqual(parser.parse("# key:\na5"), [
        ["frontmatter", "key", ""],
        ["note", "A5"]
      ])
    })

    it("handles value with special characters", () => {
      assert.deepStrictEqual(parser.parse("# title: Hello: World! (test) [1,2,3]\na5"), [
        ["frontmatter", "title", "Hello: World! (test) [1,2,3]"],
        ["note", "A5"]
      ])
    })
  })

  describe("strings", () => {
    it("parses double quoted string", () => {
      assert.deepStrictEqual(parser.parse('"hello"'), [
        ["string", "hello"]
      ])
    })

    it("parses single quoted string", () => {
      assert.deepStrictEqual(parser.parse("'world'"), [
        ["string", "world"]
      ])
    })

    it("parses string with notes", () => {
      assert.deepStrictEqual(parser.parse('c5 "la" d5 "la"'), [
        ["note", "C5"],
        ["string", "la"],
        ["note", "D5"],
        ["string", "la"]
      ])
    })

    it("parses multi-line string", () => {
      assert.deepStrictEqual(parser.parse('"hello\nworld"'), [
        ["string", "hello\nworld"]
      ])
    })

    it("parses escaped double quote", () => {
      assert.deepStrictEqual(parser.parse('"say \\"hello\\""'), [
        ["string", 'say "hello"']
      ])
    })

    it("parses escaped single quote", () => {
      assert.deepStrictEqual(parser.parse("'it\\'s'"), [
        ["string", "it's"]
      ])
    })

    it("parses escaped backslash", () => {
      assert.deepStrictEqual(parser.parse('"path\\\\to"'), [
        ["string", "path\\to"]
      ])
    })

    it("parses escaped newline", () => {
      assert.deepStrictEqual(parser.parse('"line1\\nline2"'), [
        ["string", "line1\nline2"]
      ])
    })

    it("parses empty string", () => {
      assert.deepStrictEqual(parser.parse('""'), [
        ["string", ""]
      ])
    })
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

    it("applies duration divider", () => {
      const song = SongParser.load("c5/2 d5/4")
      matchNotes([...song], [
        new SongNote("C5", 0, 0.5),
        new SongNote("D5", 0.5, 0.25)
      ])
    })

    it("applies duration divider with relative octave", () => {
      const song = SongParser.load("c/2 d/2 e/2 f/2")
      matchNotes([...song], [
        new SongNote("C5", 0, 0.5),
        new SongNote("D5", 0.5, 0.5),
        new SongNote("E5", 1, 0.5),
        new SongNote("F5", 1.5, 0.5)
      ])
    })

    it("triplets land on exact beat boundaries", () => {
      // Three triplet notes should sum to exactly 1 beat
      const song = SongParser.load("c/3 d/3 e/3 f")
      const notes = [...song]
      // The fourth note (f) should start exactly at beat 1.0, not 0.9999... or 1.0000001
      assert.strictEqual(notes[3].start, 1)
    })

    it("sixtuplets land on exact beat boundaries", () => {
      // Six sixtuplet notes should sum to exactly 1 beat
      const song = SongParser.load("c/6 d/6 e/6 f/6 g/6 a/6 b")
      const notes = [...song]
      // The seventh note (b) should start exactly at beat 1.0
      assert.strictEqual(notes[6].start, 1)
    })

    it("multiple triplet groups land on exact beats", () => {
      // Two groups of triplets should land exactly on beat 2.0
      const song = SongParser.load("c/3 d/3 e/3 f/3 g/3 a/3 b")
      const notes = [...song]
      // The seventh note (b) should start exactly at beat 2.0
      assert.strictEqual(notes[6].start, 2)
    })

    it("loads notes with explicit start position", () => {
      const song = SongParser.load("c5.1@0 d5.1@4 e5.1@8")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 4, 1),
        new SongNote("E5", 8, 1)
      ])
    })
  })

  describe("rests", () => {
    it("loads notes with rests", () => {
      const song = SongParser.load("r1 g5 r2 a5 r3 r1@1 f6")

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

    it("applies time modifier with count", () => {
      // dt2 should be equivalent to dt dt
      const song = SongParser.load("dt2 c5 d5")
      matchNotes([...song], [
        new SongNote("C5", 0, 0.25),
        new SongNote("D5", 0.25, 0.25)
      ])

      // ht2 should be equivalent to ht ht (4x duration)
      const song2 = SongParser.load("ht2 c5")
      matchNotes([...song2], [
        new SongNote("C5", 0, 4)
      ])

      // tt2 should be equivalent to tt tt
      const song3a = SongParser.load("tt2 c5")
      const song3b = SongParser.load("tt tt c5")
      matchNotes([...song3a], [...song3b])
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

    it("includes frontmatter in metadata", () => {
      const song = SongParser.load("# title: Test Song\n# bpm: 120\nks2 c5")

      assert.deepStrictEqual(song.metadata, {
        keySignature: 2,
        beatsPerMeasure: 4,
        frontmatter: {
          title: "Test Song",
          bpm: "120"
        }
      })
    })

    it("omits frontmatter from metadata when none present", () => {
      const song = SongParser.load("c5")
      assert.strictEqual(song.metadata?.frontmatter, undefined)
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

  describe("strings", () => {
    it("records string at current position", () => {
      const song = SongParser.load('c5 "hello" d5')
      assert.deepStrictEqual(song.strings, [
        [1, "hello"]
      ])
    })

    it("records multiple strings with positions", () => {
      const song = SongParser.load('c5 "hel" d5 "lo" e5 "world"')
      assert.deepStrictEqual(song.strings, [
        [1, "hel"],
        [2, "lo"],
        [3, "world"]
      ])
    })

    it("string does not advance position", () => {
      const song = SongParser.load('"start" c5 d5')
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1)
      ])
      assert.deepStrictEqual(song.strings, [
        [0, "start"]
      ])
    })

    it("records string with multi-line content", () => {
      const song = SongParser.load('c5 "line1\nline2"')
      assert.deepStrictEqual(song.strings, [
        [1, "line1\nline2"]
      ])
    })

    it("no strings property when none present", () => {
      const song = SongParser.load("c5 d5 e5")
      assert.strictEqual(song.strings, undefined)
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

    it("auto-increments measure from start", () => {
      const song = SongParser.load(`
        m c5
        m d5
        m e5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),  // measure 0
        new SongNote("D5", 4, 1),  // measure 1
        new SongNote("E5", 8, 1)   // measure 2
      ])
    })

    it("auto-increments after explicit measure", () => {
      const song = SongParser.load(`
        m5 c5
        m d5
        m e5
      `)

      matchNotes([...song], [
        new SongNote("C5", 20, 1),  // measure 5
        new SongNote("D5", 24, 1),  // measure 6
        new SongNote("E5", 28, 1)   // measure 7
      ])
    })

    it("mixes explicit and auto-increment measures", () => {
      const song = SongParser.load(`
        m c5
        m d5
        m10 e5
        m f5
      `)

      matchNotes([...song], [
        new SongNote("C5", 0, 1),   // measure 0
        new SongNote("D5", 4, 1),   // measure 1
        new SongNote("E5", 40, 1),  // measure 10
        new SongNote("F5", 44, 1)   // measure 11
      ])
    })

    it("handles time signature changes with measure command", () => {
      const song = SongParser.load(`
        ts4/4
        m { c c c c }
        ts3/4
        m { d d d }
        ts4/4
        m { e e e e }
      `)
      const starts = [...song].map(n => n.start)
      assert.deepStrictEqual(starts, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it("handles time signature change inside block", () => {
      const song = SongParser.load(`
        ts4/4
        m { c c c c }
        m { ts3/4 d d d }
        m { e e e e }
      `)
      const starts = [...song].map(n => n.start)
      // ts3/4 inside block doesn't affect parent, but position flows correctly
      assert.deepStrictEqual(starts, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it("explicit measure jump then auto-increment", () => {
      const song = SongParser.load(`
        ts4/4
        m { c c }
        m5 { d d }
        m { e e }
      `)
      // m5 jumps to beat 20, m6 should be at beat 24
      const starts = [...song].map(n => n.start)
      assert.deepStrictEqual(starts, [0, 1, 20, 21, 24, 25])
    })
  })

  describe("relative octave", () => {
    it("defaults first relative note to octave 5", () => {
      const song = SongParser.load("c d e")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1)
      ])
    })

    it("uses closest octave from previous note", () => {
      // From C5, G4 (5 semitones below) is closer than G5 (7 semitones above)
      const song = SongParser.load("c5 g")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("G4", 1, 1)
      ])
    })

    it("jumps octave when note is far", () => {
      // From G4, C5 (5 semitones above) is closer than C4 (7 semitones below)
      const song = SongParser.load("g4 c")
      matchNotes([...song], [
        new SongNote("G4", 0, 1),
        new SongNote("C5", 1, 1)
      ])
    })

    it("handles ascending scale", () => {
      const song = SongParser.load("c5 d e f g a b c")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F5", 3, 1),
        new SongNote("G5", 4, 1),
        new SongNote("A5", 5, 1),
        new SongNote("B5", 6, 1),
        new SongNote("C6", 7, 1)
      ])
    })

    it("handles descending scale", () => {
      const song = SongParser.load("c6 b a g f e d c")
      matchNotes([...song], [
        new SongNote("C6", 0, 1),
        new SongNote("B5", 1, 1),
        new SongNote("A5", 2, 1),
        new SongNote("G5", 3, 1),
        new SongNote("F5", 4, 1),
        new SongNote("E5", 5, 1),
        new SongNote("D5", 6, 1),
        new SongNote("C5", 7, 1)
      ])
    })

    it("handles accidentals with relative octave", () => {
      const song = SongParser.load("c5 c+ d- e")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("C#5", 1, 1),
        new SongNote("Db5", 2, 1),
        new SongNote("E5", 3, 1)
      ])
    })

    it("applies key signature to relative notes", () => {
      // D major (ks2) has F# and C#
      // From C#5 (pitch 61): F5 (pitch 65, 4 away) is closer than F4 (pitch 53, 8 away)
      const song = SongParser.load("ks2 c5 f g")
      matchNotes([...song], [
        new SongNote("C#5", 0, 1),
        new SongNote("F#5", 1, 1),
        new SongNote("G5", 2, 1)
      ])
    })

    it("rests do not affect relative octave tracking", () => {
      const song = SongParser.load("c5 r d")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 2, 1)
      ])
    })

    it("relative notes work in blocks", () => {
      const song = SongParser.load("c5 { d e } f")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 1),
        new SongNote("E5", 2, 1),
        new SongNote("F5", 3, 1)
      ])
    })

    it("parses relative note with duration", () => {
      const song = SongParser.load("c5 d.2")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 1, 2)
      ])
    })

    it("parses relative note with start position", () => {
      const song = SongParser.load("c5 d@5")
      matchNotes([...song], [
        new SongNote("C5", 0, 1),
        new SongNote("D5", 5, 1)
      ])
    })

    it("uses defaultOctave option", () => {
      const song = SongParser.load("c d e", { defaultOctave: 4 })
      matchNotes([...song], [
        new SongNote("C4", 0, 1),
        new SongNote("D4", 1, 1),
        new SongNote("E4", 2, 1)
      ])
    })

    it("uses defaultOctave 3 for bass clef", () => {
      const song = SongParser.load("c d e f g", { defaultOctave: 3 })
      matchNotes([...song], [
        new SongNote("C3", 0, 1),
        new SongNote("D3", 1, 1),
        new SongNote("E3", 2, 1),
        new SongNote("F3", 3, 1),
        new SongNote("G3", 4, 1)
      ])
    })
  })
})

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("parse errors", () => {
  const parser = new SongParser()

  it("parses note without octave (relative octave)", () => {
    // Notes without octaves are now valid (relative octave mode)
    assert.deepStrictEqual(parser.parse("c"), [["note", "C"]])
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

})

// ============================================================================
// getMeasures() TESTS
// ============================================================================

describe("getMeasures", () => {
  it("returns measures for simple 4/4 song", () => {
    const song = SongParser.load("c5 d e f g a b c")  // 8 beats
    const measures = song.getMeasures()
    assert.deepStrictEqual(measures, [
      { start: 0, beats: 4 },
      { start: 4, beats: 4 }
    ])
  })

  it("returns measures for 3/4 song", () => {
    const song = SongParser.load("ts3/4 c5 d e f g a")  // 6 beats
    const measures = song.getMeasures()
    assert.deepStrictEqual(measures, [
      { start: 0, beats: 3 },
      { start: 3, beats: 3 }
    ])
  })

  it("handles time signature changes", () => {
    const song = SongParser.load(`
      ts4/4 c5 d e f
      ts3/4 g a b
      ts4/4 c d e f
    `)
    const measures = song.getMeasures()
    assert.deepStrictEqual(measures, [
      { start: 0, beats: 4 },
      { start: 4, beats: 3 },
      { start: 7, beats: 4 }
    ])
  })

  it("returns empty array for empty song", () => {
    const song = SongParser.load("ks0")  // ks0 creates a song with no notes
    assert.deepStrictEqual(song.getMeasures(), [])
  })

  it("handles song that doesn't fill complete measures", () => {
    const song = SongParser.load("c5 d e")  // 3 beats, doesn't fill 4/4 measure
    const measures = song.getMeasures()
    assert.deepStrictEqual(measures, [
      { start: 0, beats: 4 }
    ])
  })

  it("tracks timeSignatures array on song", () => {
    const song = SongParser.load("ts3/4 c5 d e ts4/4 f g a b")
    assert.deepStrictEqual(song.timeSignatures, [
      [0, 3],  // 3/4 at beat 0
      [3, 4]   // 4/4 at beat 3
    ])
  })

  it("adds default 4/4 when no time signature specified", () => {
    const song = SongParser.load("c5 d e f")
    assert.deepStrictEqual(song.timeSignatures, [[0, 4]])
  })
})

// ============================================================================
// EXAMPLE FILE TESTS (snapshot testing)
// ============================================================================

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Serialize a song to a comparable JSON object (strips auto-generated IDs and undefined values)
const serializeSong = (song: ReturnType<typeof SongParser.load>) => {
  const result: Record<string, unknown> = {
    notes: [...song].map(n => ({ note: n.note, start: n.start, duration: n.duration })),
    // Handle sparse arrays by explicitly mapping each index
    tracks: Array.from({ length: song.tracks.length }, (_, i) => {
      const t = song.tracks[i]
      if (!t) return null
      const track: Record<string, unknown> = {
        notes: [...t].map(n => ({ note: n.note, start: n.start, duration: n.duration }))
      }
      if (t.clefs !== undefined) track.clefs = t.clefs
      return track
    }),
    metadata: song.metadata
  }
  if (song.autoChords !== undefined) result.autoChords = song.autoChords
  if (song.strings !== undefined) result.strings = song.strings
  return result
}

describe("example files", () => {
  const examplesDir = path.join(__dirname, "../examples")
  const files = fs.readdirSync(examplesDir).filter(f => f.endsWith(".lml"))

  for (const file of files) {
    it(`parses ${file}`, async () => {
      const content = await fs.promises.readFile(path.join(examplesDir, file), "utf-8")
      const song = SongParser.load(content)
      const output = serializeSong(song)

      const expectedPath = path.join(examplesDir, `${file}.expected.json`)
      const expected = JSON.parse(await fs.promises.readFile(expectedPath, "utf-8"))

      assert.deepStrictEqual(output, expected)
    })
  }
})
