import { describe, it } from "node:test"
import assert from "node:assert"

import {
  parseNoteString,
  serializeNote,
  stepDuration,
} from "../src/index.js"

describe("parseNoteString", () => {
  it("parses simple note", () => {
    const result = parseNoteString("c5")
    assert.deepStrictEqual(result, {
      name: "C",
      octave: "5",
      accidental: undefined,
      duration: undefined,
      start: undefined,
    })
  })

  it("parses note with sharp accidental", () => {
    const result = parseNoteString("c+5")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.accidental, "+")
    assert.strictEqual(result?.octave, "5")
  })

  it("parses note with flat accidental", () => {
    const result = parseNoteString("c-5")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.accidental, "-")
    assert.strictEqual(result?.octave, "5")
  })

  it("parses note with natural accidental", () => {
    const result = parseNoteString("c=5")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.accidental, "=")
    assert.strictEqual(result?.octave, "5")
  })

  it("parses note with star duration", () => {
    const result = parseNoteString("c5*2")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.octave, "5")
    assert.strictEqual(result?.duration, 2)
  })

  it("parses note with slash duration", () => {
    const result = parseNoteString("c5/4")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.octave, "5")
    assert.strictEqual(result?.duration, 0.25)
  })

  it("parses note with start position", () => {
    const result = parseNoteString("c5@2")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.octave, "5")
    assert.strictEqual(result?.start, 2)
  })

  it("parses note with all modifiers", () => {
    const result = parseNoteString("c+5*2@1")
    assert.deepStrictEqual(result, {
      name: "C",
      octave: "5",
      accidental: "+",
      duration: 2,
      start: 1,
    })
  })

  it("parses dotted note", () => {
    const result = parseNoteString("c5.")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.octave, "5")
    assert.strictEqual(result?.dots, 1)
  })

  it("parses double-dotted note", () => {
    const result = parseNoteString("c5..")
    assert.strictEqual(result?.dots, 2)
  })

  it("parses dotted note with duration", () => {
    const result = parseNoteString("c5*2.")
    assert.strictEqual(result?.duration, 2)
    assert.strictEqual(result?.dots, 1)
  })

  it("parses note with all modifiers including dots", () => {
    const result = parseNoteString("c+5*2..@1")
    assert.deepStrictEqual(result, {
      name: "C",
      octave: "5",
      accidental: "+",
      duration: 2,
      dots: 2,
      start: 1,
    })
  })

  it("parses relative note (no octave)", () => {
    const result = parseNoteString("c")
    assert.strictEqual(result?.name, "C")
    assert.strictEqual(result?.octave, undefined)
  })

  it("returns null for invalid input", () => {
    assert.strictEqual(parseNoteString("xyz"), null)
    assert.strictEqual(parseNoteString(""), null)
  })

  it("parses 3-digit duration", () => {
    const result = parseNoteString("c5*999")
    assert.strictEqual(result?.duration, 999)
  })

  it("rejects 4+ digit duration", () => {
    // 4-digit duration should fail to parse (only first 3 digits match)
    assert.strictEqual(parseNoteString("c5*1234"), null)
    assert.strictEqual(parseNoteString("c5/1234"), null)
  })
})

describe("serializeNote", () => {
  it("serializes simple note", () => {
    const result = serializeNote({ name: "C", octave: "5" })
    assert.strictEqual(result, "c5")
  })

  it("serializes note with accidental", () => {
    const result = serializeNote({ name: "C", octave: "5", accidental: "+" })
    assert.strictEqual(result, "c+5")
  })

  it("serializes note with star duration", () => {
    const result = serializeNote({ name: "C", octave: "5", duration: 2 })
    assert.strictEqual(result, "c5*2")
  })

  it("serializes note with slash duration", () => {
    const result = serializeNote({ name: "C", octave: "5", duration: 0.25 })
    assert.strictEqual(result, "c5/4")
  })

  it("serializes dotted note", () => {
    const result = serializeNote({ name: "C", octave: "5", dots: 1 })
    assert.strictEqual(result, "c5.")
  })

  it("serializes double-dotted note", () => {
    const result = serializeNote({ name: "C", octave: "5", dots: 2 })
    assert.strictEqual(result, "c5..")
  })

  it("serializes dotted note with duration", () => {
    const result = serializeNote({ name: "C", octave: "5", duration: 2, dots: 1 })
    assert.strictEqual(result, "c5*2.")
  })

  it("serializes note with start position", () => {
    const result = serializeNote({ name: "C", octave: "5", start: 2 })
    assert.strictEqual(result, "c5@2")
  })

  it("preserves lowercase when requested", () => {
    const result = serializeNote({ name: "C", octave: "5" }, true)
    assert.strictEqual(result, "c5")
  })

  it("preserves uppercase when requested", () => {
    const result = serializeNote({ name: "C", octave: "5" }, false)
    assert.strictEqual(result, "C5")
  })

  it("omits duration suffix when duration is 1", () => {
    const result = serializeNote({ name: "C", octave: "5", duration: 1 })
    assert.strictEqual(result, "c5")
  })

  it("serializes note with all modifiers", () => {
    const result = serializeNote({
      name: "C",
      octave: "5",
      accidental: "+",
      duration: 2,
      start: 1,
    })
    assert.strictEqual(result, "c+5*2@1")
  })

  it("serializes note with all modifiers including dots", () => {
    const result = serializeNote({
      name: "C",
      octave: "5",
      accidental: "+",
      duration: 2,
      dots: 2,
      start: 1,
    })
    assert.strictEqual(result, "c+5*2..@1")
  })
})

describe("stepDuration", () => {
  it("steps from default to .2 with delta +1", () => {
    assert.strictEqual(stepDuration(undefined, 1), 2)
    assert.strictEqual(stepDuration(1, 1), 2)
  })

  it("steps from default to /2 with delta -1", () => {
    assert.strictEqual(stepDuration(undefined, -1), 0.5)
    assert.strictEqual(stepDuration(1, -1), 0.5)
  })

  it("steps from .2 to .3 with delta +1", () => {
    assert.strictEqual(stepDuration(2, 1), 3)
  })

  it("steps from .3 to .2 with delta -1", () => {
    assert.strictEqual(stepDuration(3, -1), 2)
  })

  it("steps from .2 to default with delta -1", () => {
    assert.strictEqual(stepDuration(2, -1), undefined)
  })

  it("steps from /2 to default with delta +1", () => {
    assert.strictEqual(stepDuration(0.5, 1), undefined)
  })

  it("steps from /2 to /3 with delta -1", () => {
    assert.strictEqual(stepDuration(0.5, -1), 1/3)
  })

  it("steps from /3 to /2 with delta +1", () => {
    assert.strictEqual(stepDuration(1/3, 1), 0.5)
  })

  it("steps from /4 to /3 with delta +1", () => {
    assert.strictEqual(stepDuration(0.25, 1), 1/3)
  })

  // pow2 mode tests
  it("pow2: steps from default to .2 with delta +1", () => {
    assert.strictEqual(stepDuration(undefined, 1, true), 2)
  })

  it("pow2: steps from default to /2 with delta -1", () => {
    assert.strictEqual(stepDuration(undefined, -1, true), 0.5)
  })

  it("pow2: steps from .2 to .4 with delta +1", () => {
    assert.strictEqual(stepDuration(2, 1, true), 4)
  })

  it("pow2: steps from .4 to .2 with delta -1", () => {
    assert.strictEqual(stepDuration(4, -1, true), 2)
  })

  it("pow2: steps from .2 to default with delta -1", () => {
    assert.strictEqual(stepDuration(2, -1, true), undefined)
  })

  it("pow2: steps from /2 to default with delta +1", () => {
    assert.strictEqual(stepDuration(0.5, 1, true), undefined)
  })

  it("pow2: steps from /2 to /4 with delta -1", () => {
    assert.strictEqual(stepDuration(0.5, -1, true), 0.25)
  })

  it("pow2: steps from /4 to /2 with delta +1", () => {
    assert.strictEqual(stepDuration(0.25, 1, true), 0.5)
  })

  it("pow2: steps from /8 to /4 with delta +1", () => {
    assert.strictEqual(stepDuration(0.125, 1, true), 0.25)
  })

  it("pow2: steps from .4 to .8 with delta +1", () => {
    assert.strictEqual(stepDuration(4, 1, true), 8)
  })
})
