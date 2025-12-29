import { describe, it } from "node:test"
import assert from "node:assert"

import {
  SongNoteList,
  MultiTrackSong,
  SongNote,
  parseNote,
} from "../src/index.js"

describe("SongNoteList.transpose", () => {
  it("returns this when amount is 0", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    assert.strictEqual(song.transpose(0), song)
  })

  it("transposes notes by semitones", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.push(new SongNote("E4", 1, 1))
    song.push(new SongNote("G4", 2, 1))

    const transposed = song.transpose(2)

    assert.strictEqual(parseNote(transposed[0].note), parseNote("D4"))
    assert.strictEqual(parseNote(transposed[1].note), parseNote("F#4"))
    assert.strictEqual(parseNote(transposed[2].note), parseNote("A4"))
  })

  it("transposes metadata.keySignature using circle of fifths", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.metadata = { keySignature: 0 } // C major

    // +1 semitone: C major -> Db major (ks-5)
    const transposed = song.transpose(1)
    assert.strictEqual(transposed.metadata?.keySignature, -5)
  })

  it("transposes keySignatures array using circle of fifths", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.keySignatures = [
      [0, 0, [0, 3]],   // C major at beat 0
      [4, 1, [10, 13]], // G major at beat 4
    ]

    const transposed = song.transpose(1)

    assert.strictEqual(transposed.keySignatures?.[0][1], -5) // C -> Db
    assert.strictEqual(transposed.keySignatures?.[1][1], -4) // G -> Ab
    // Beat positions unchanged
    assert.strictEqual(transposed.keySignatures?.[0][0], 0)
    assert.strictEqual(transposed.keySignatures?.[1][0], 4)
  })

  it("does not change key signature for octave transposition", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.metadata = { keySignature: 2 } // D major
    song.keySignatures = [[0, 2, [0, 3]]]

    const transposed = song.transpose(12)

    assert.strictEqual(transposed.metadata?.keySignature, 2)
    assert.strictEqual(transposed.keySignatures?.[0][1], 2)
  })

  it("copies unchanged properties by reference", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.timeSignatures = [[0, 4]]
    song.clefs = [[0, "g"]]
    song.strings = [[0, "test"]]
    song.autoChords = [[0, ["C", "M"]]]
    song.trackName = "Test Track"

    const transposed = song.transpose(1)

    assert.strictEqual(transposed.timeSignatures, song.timeSignatures)
    assert.strictEqual(transposed.clefs, song.clefs)
    assert.strictEqual(transposed.strings, song.strings)
    assert.strictEqual(transposed.autoChords, song.autoChords)
    assert.strictEqual(transposed.trackName, song.trackName)
  })

  it("creates new metadata object (not reference)", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.metadata = { keySignature: 0, beatsPerMeasure: 4 }

    const transposed = song.transpose(1)

    assert.notStrictEqual(transposed.metadata, song.metadata)
    assert.strictEqual(transposed.metadata?.beatsPerMeasure, 4) // Other fields preserved
  })

  it("creates new keySignatures array (not reference)", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.keySignatures = [[0, 0, [0, 3]]]

    const transposed = song.transpose(1)

    assert.notStrictEqual(transposed.keySignatures, song.keySignatures)
  })

  it("handles negative transposition", () => {
    const song = new SongNoteList()
    song.push(new SongNote("C4", 0, 1))
    song.metadata = { keySignature: 0 } // C major

    // -1 semitone: C major -> B major (ks5)
    const transposed = song.transpose(-1)

    assert.strictEqual(parseNote(transposed[0].note), parseNote("B3"))
    assert.strictEqual(transposed.metadata?.keySignature, 5)
  })
})

describe("MultiTrackSong.transpose", () => {
  it("returns this when amount is 0", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    assert.strictEqual(song.transpose(0), song)
  })

  it("returns a MultiTrackSong instance", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)

    const transposed = song.transpose(1)

    assert.ok(transposed instanceof MultiTrackSong)
  })

  it("transposes notes in all tracks", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    song.pushWithTrack(new SongNote("E4", 1, 1), 0)
    song.pushWithTrack(new SongNote("G4", 0, 1), 1)

    const transposed = song.transpose(2)

    // Check main list
    assert.strictEqual(transposed.length, 3)

    // Check track 0
    assert.strictEqual(transposed.tracks[0].length, 2)
    assert.strictEqual(parseNote(transposed.tracks[0][0].note), parseNote("D4"))
    assert.strictEqual(parseNote(transposed.tracks[0][1].note), parseNote("F#4"))

    // Check track 1
    assert.strictEqual(transposed.tracks[1].length, 1)
    assert.strictEqual(parseNote(transposed.tracks[1][0].note), parseNote("A4"))
  })

  it("maintains note references between main list and tracks", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    song.pushWithTrack(new SongNote("G4", 0, 1), 1)

    const transposed = song.transpose(1)

    // Notes in tracks should be the same objects as notes in main list
    assert.ok(transposed.some(note => note === transposed.tracks[0][0]))
    assert.ok(transposed.some(note => note === transposed.tracks[1][0]))
  })

  it("transposes key signatures", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    song.metadata = { keySignature: 0 }
    song.keySignatures = [[0, 0, [0, 3]]]

    const transposed = song.transpose(1)

    assert.strictEqual(transposed.metadata?.keySignature, -5)
    assert.strictEqual(transposed.keySignatures?.[0][1], -5)
  })

  it("copies unchanged properties", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    song.timeSignatures = [[0, 4]]
    song.clefs = [[0, "g"]]
    song.trackName = "Test"

    const transposed = song.transpose(1)

    assert.strictEqual(transposed.timeSignatures, song.timeSignatures)
    assert.strictEqual(transposed.clefs, song.clefs)
    assert.strictEqual(transposed.trackName, song.trackName)
  })

  it("preserves sparse track array", () => {
    const song = new MultiTrackSong()
    song.pushWithTrack(new SongNote("C4", 0, 1), 0)
    song.pushWithTrack(new SongNote("G4", 0, 1), 5) // Sparse: track 5, skipping 1-4

    const transposed = song.transpose(1)

    assert.strictEqual(transposed.tracks[0].length, 1)
    assert.strictEqual(transposed.tracks[5].length, 1)
    assert.strictEqual(transposed.tracks[1], undefined)
  })
})
