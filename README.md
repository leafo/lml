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
  c5 d e f
  g.2 g.2
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
const ast = parser.parse("c5 d e")
// [["note", "C5"], ["note", "D"], ["note", "E"]]

// Phase 2: Compile AST to song
const song = parser.compile(ast)
```

### Parser Options

Both `SongParser.load()` and `parser.compile()` accept an options object:

```typescript
const song = SongParser.load("c d e f g", {
  defaultOctave: 4,  // Default octave for relative notes (default: 5)
})
```

This is useful for bass clef or other instruments that typically play in different registers.

## LML Syntax

### Notes

Notes are written as letter names (`a` through `g`) and placed sequentially, separated by whitespace. The octave is automatically determined by finding the closest one to the previous note. The first note defaults to octave 5 (configurable via `defaultOctave` option).

```
c d e f g a b c    # c5 d5 e5 f5 g5 a5 b5 c6
```

The algorithm picks the octave that minimizes the distance in semitones:

```
c d e f g a b c    # Ascending: c5 → c6
c6 b a g f e d c   # Descending: c6 → c5
```

Duration can be modified with `.` (multiply) or `/` (divide). The default duration is 1 beat.

```
c.2 d d e.4        # c is 2 beats, d is 1 beat each, e is 4 beats
c/2 d/2 e/4        # c and d are 0.5 beats, e is 0.25 beats
```

An explicit start position can be specified with `@` followed by the beat number. This places notes at absolute positions rather than sequentially.

```
c@0 d@4 e@8        # Notes at beats 0, 4, and 8
c.2@0 d.2@2        # Duration 2, at beats 0 and 2
```

Notes can be made sharp with `+`, flat with `-`, or natural with `=`:

```
c c+ d- e          # c c# db e
```

### Explicit Octaves

When you need precise control, add an octave number (0-9) after the note name:

```
c5 d5 e5           # Explicit octaves
c3 d e f           # Start at c3, then continue relatively: c3 d3 e3 f3
g4 c               # Jump to g4, then c5 (closest to g4)
```

This is useful for:
- Setting the starting octave
- Jumping to a different register
- Writing music that spans multiple octaves

```
# Two octave arpeggio
c4 e g c5 e g c6

# Jump between registers
c5 d e g3 a b
```

### Rests

Insert silence using the rest command `r`, optionally with a duration multiplier. Like notes, rests can also use `@` for explicit positioning.

```
c r d.2
d r2 a
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
c d c d c d e.2
```

Time commands stack when repeated:

```
dt dt c d    # Each note is 0.25 beats
```

### Position Restore

Move the position back to the start using `|`. This is useful for writing chords or multiple voices.

```
c5 | e | g     # C major chord (c5 e5 g5)
```

Two voices:

```
| c5 g e.2
| c4.2 f.2
```

### Blocks

Blocks are delimited with `{` and `}`. They affect how commands work:

- `|` moves position back to the start of the block
- Time commands (`dt`, `ht`, `tt`) reset after the block
- Track selection resets after the block

```
{
  dt
  c5 { dt e f } d.2 e g a c
}
|
{ ht g4 f }
```

### Measures

The `m` command moves the position to a measure. Use `m` alone to auto-increment to the next measure, or `m0`, `m1`, etc. for explicit positioning:

```
m {
  | c5 c a g
  | g4.4
}

m {
  | d5 d a e
  | f4.4
}
```

The first `m` goes to measure 0, then each subsequent `m` increments. Explicit measure numbers also update the counter:

```
m { c d }      # measure 0
m { e f }      # measure 1
m5 { g a }     # measure 5
m { b c }      # measure 6
```

### Key Signature

Set the key signature with `ks` followed by the number of sharps (positive) or flats (negative). Notes are automatically adjusted to match the key.

```
ks2          # D major (2 sharps: F#, C#)
c d e f      # F becomes F#, C becomes C#
```

Use `=` to override the key signature with a natural:

```
ks-2
b c b=       # B natural
```

### Time Signature

Set the time signature with `ts`:

```
ts3/4
c d e
```

This affects beats per measure and where measure lines appear.

### Chords

The `$` command specifies a chord symbol for auto-chord generation:

```
{$G c5.2 a d}
{$Dm e f g.2}
```

Supported chord types: `M`, `m`, `dim`, `dim7`, `dimM7`, `aug`, `augM7`, `M6`, `m6`, `M7`, `7`, `m7`, `m7b5`, `mM7`

### Tracks

Songs can have multiple tracks, numbered starting from 0. Use `t` to switch tracks:

```
t0 c5 d e
t1 g3 g g
```

### Clefs

Set the clef with `/g` (treble), `/f` (bass), or `/c` (alto):

```
/g c5 d e
/f c3 d e
```

### Strings

Quoted strings can be placed anywhere in a song. They are tagged with their position in beats and stored separately from notes. This is useful for lyrics or annotations.

```
c "hel" d "lo" e "world"
```

Both single and double quotes are supported. Strings can span multiple lines:

```
c.2 'First verse
continues here' d.2
```

Escape sequences are supported: `\"`, `\'`, `\\`, `\n`.

```
"say \"hello\""
'it\'s working'
```

Strings are accessible via `song.strings`:

```typescript
const song = SongParser.load('c "la" d "la"')
console.log(song.strings)
// [[1, "la"], [2, "la"]]  // [position, text]
```

### Comments

Text after `#` is ignored:

```
c d    # this is a comment
# full line comment
e f
```

### Frontmatter

Metadata can be embedded at the start of a file using comment-style frontmatter. Lines matching `# key: value` at the very beginning (before any commands) are parsed as metadata:

```
# title: Moonlight Sonata
# author: Beethoven
# bpm: 120
# difficulty: intermediate

ts4/4 ks-3
c d e f
```

The convention is to use lowercase key names. Frontmatter is accessible via `song.metadata.frontmatter`:

```typescript
const song = SongParser.load(`
# title: My Song
# bpm: 90
c d e
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
