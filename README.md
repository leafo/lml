# @leafo/lml

LML (Leaf's Music Language) is a text-based notation for writing music. It's designed to be easy to write by hand and parse programmatically.

WARNING: this is work in progress, expect interfaces to change. This was created for use in <https://sightreading.training>.

## Installation

```bash
npm install @leafo/lml
```

## Usage

```typescript
import SongParser from "@leafo/lml"

// Parse and compile LML to a song
const song = SongParser.load(`
  ks0 ts4/4
  c5 d5 e5 f5
  g5.2 g5.2
`)

// Access the notes
for (const note of song) {
  console.log(`${note.note} at beat ${note.start} for ${note.duration} beats`)
}

// Access metadata
console.log(song.metadata.keySignature)  // 0
console.log(song.metadata.beatsPerMeasure)  // 4
```

### Two-phase parsing

```typescript
import SongParser from "@leafo/lml"

const parser = new SongParser()

// Phase 1: Parse text to AST
const ast = parser.parse("c5 d5 e5")
// [["note", "C5"], ["note", "D5"], ["note", "E5"]]

// Phase 2: Compile AST to song
const song = parser.compile(ast)
```

## LML Syntax

### Notes

A note is written as the note name followed by the octave. Notes are placed sequentially and must be separated by whitespace.

```
c5 d5 e5
```

A duration multiplier can be specified by appending a period and a number. The default duration is 1 beat.

```
c5.2 d5 d5 e5.4
```

An explicit start position can be specified with `@` followed by the beat number. This places notes at absolute positions rather than sequentially.

```
c5@0 d5@4 e5@8      # Notes at beats 0, 4, and 8
c5.2@0 d5.2@2       # Duration 2, at beats 0 and 2
```

Notes can be made sharp with `+`, flat with `-`, or natural with `=`. These modifiers appear after the note name but before the octave.

```
c+5 c-5 b=4
```

### Rests

Insert silence using the rest command `r`, optionally with a duration multiplier. Like notes, rests can also use `@` for explicit positioning.

```
c5 r d5.2
d5 r2 a4
r@4         # Rest at beat 4
r2@4        # Rest with duration 2 at beat 4
```

### Time Commands

Change the base duration using time commands. These take effect until the end of the song or block.

- `dt` — Double time (notes become half as long)
- `ht` — Half time (notes become twice as long)
- `tt` — Triple time (notes become one-third as long)

```
dt
c5 d5 c5 d5 c5 d5 e5.2
```

Time commands stack when repeated:

```
dt dt c5 d5  # Each note is 0.25 beats
```

### Position Restore

Move the position back to the start using `|`. This is useful for writing chords or multiple voices.

```
c5 | e5 | g5   # C major chord
```

Two voices:

```
| c5 g5 e5.2
| c4.2 f4.2
```

### Blocks

Blocks are delimited with `{` and `}`. They affect how commands work:

- `|` moves position back to the start of the block
- Time commands (`dt`, `ht`, `tt`) reset after the block
- Track selection resets after the block

```
{
  dt
  c5 { dt e5 f5 } d5.2 e5 g5 a5 c6
}
|
{ ht g4 f4 }
```

### Measures

The `m` command moves the position to a measure. Use `m` alone to auto-increment to the next measure, or `m0`, `m1`, etc. for explicit positioning:

```
m {
  | c5 c5 a5 g5
  | g4.4
}

m {
  | d5 d5 a5 e5
  | f4.4
}
```

The first `m` goes to measure 0, then each subsequent `m` increments. Explicit measure numbers also update the counter:

```
m { c5 d5 }    # measure 0
m { e5 f5 }    # measure 1
m5 { g5 a5 }   # measure 5
m { b5 c6 }    # measure 6
```

### Key Signature

Set the key signature with `ks` followed by the number of sharps (positive) or flats (negative). Notes are automatically adjusted to match the key.

```
ks2      # D major (2 sharps: F#, C#)
c5 d5 e5 f5   # F becomes F#, C becomes C#
```

Use `=` to override the key signature with a natural:

```
ks-2
b5 c5 b=5   # B natural
```

### Time Signature

Set the time signature with `ts`:

```
ts3/4
c5 d5 e5
```

This affects beats per measure and where measure lines appear.

### Chords

The `$` command specifies a chord symbol for auto-chord generation:

```
{$G c5.2 a5 d5}
{$Dm e5 f5 g5.2}
```

Supported chord types: `M`, `m`, `dim`, `dim7`, `dimM7`, `aug`, `augM7`, `M6`, `m6`, `M7`, `7`, `m7`, `m7b5`, `mM7`

### Tracks

Songs can have multiple tracks, numbered starting from 0. Use `t` to switch tracks:

```
t0 c5 d5 e5
t1 g3 g3 g3
```

### Clefs

Set the clef with `/g` (treble), `/f` (bass), or `/c` (alto):

```
/g c5 d5 e5
/f c3 d3 e3
```

### Strings

Quoted strings can be placed anywhere in a song. They are tagged with their position in beats and stored separately from notes. This is useful for lyrics or annotations.

```
c5 "hel" d5 "lo" e5 "world"
```

Both single and double quotes are supported. Strings can span multiple lines:

```
c5.2 'First verse
continues here' d5.2
```

Escape sequences are supported: `\"`, `\'`, `\\`, `\n`.

```
"say \"hello\""
'it\'s working'
```

Strings are accessible via `song.strings`:

```typescript
const song = SongParser.load('c5 "la" d5 "la"')
console.log(song.strings)
// [[1, "la"], [2, "la"]]  // [position, text]
```

### Comments

Text after `#` is ignored:

```
c5 d5  # this is a comment
# full line comment
e5 f5
```

### Frontmatter

Metadata can be embedded at the start of a file using comment-style frontmatter. Lines matching `# key: value` at the very beginning (before any commands) are parsed as metadata:

```
# title: Moonlight Sonata
# author: Beethoven
# bpm: 120
# difficulty: intermediate

ts4/4 ks-3
c5 d5 e5 f5
```

The convention is to use lowercase key names. Frontmatter is accessible via `song.metadata.frontmatter`:

```typescript
const song = SongParser.load(`
# title: My Song
# bpm: 90
c5 d5 e5
`)

console.log(song.metadata.frontmatter)
// { title: "My Song", bpm: "90" }
```

Notes:
- Frontmatter must appear at the start of the file, before any music commands
- Keys are case-sensitive
- All values are stored as strings
- Once a non-frontmatter line is encountered, subsequent `# key: value` lines are treated as regular comments

## Music Theory Utilities

The library also exports music theory utilities:

```typescript
import {
  parseNote,
  noteName,
  Chord,
  MajorScale,
  MinorScale,
  KeySignature,
} from "@leafo/lml"

// Note conversion
parseNote("C5")  // 60 (MIDI pitch)
noteName(60)     // "C5"

// Scales
const scale = new MajorScale("C")
scale.getRange(5, 8)  // ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6"]

// Chords
const chord = new Chord("C", "M")
chord.getRange(5, 3)  // ["C5", "E5", "G5"]

// Key signatures
const key = new KeySignature(2)  // D major
key.name()  // "D"
key.accidentalNotes()  // ["F", "C"]
```

## License

MIT
