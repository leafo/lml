---
title: Migration Guide
group: Guides
---

# LML Migration Guide: v0.2 to v0.3

This guide covers syntax changes from version 0.2 to 0.3. Version 0.3 introduces dotted durations and changes the duration operator.

## Breaking Changes

### 1. Duration Operator Changed from `.` to `*`

The duration multiplier operator has changed from `.` to `*`. This frees up `.` for dotted rhythm notation.

```
# v0.2
c.2        # duration 2
c.4@8      # duration 4, start at beat 8

# v0.3
c*2        # duration 2
c*4@8      # duration 4, start at beat 8
```

The division operator `/` remains unchanged:

```
c/2        # half a beat (0.5) - same in both versions
```

## New Features

### 1. Dotted Durations

Notes and rests can now use `.` for dotted rhythms. A dot adds half the note's value.

```
c.         # dotted quarter: 1.5 beats (1 + 0.5)
c..        # double-dotted: 1.75 beats (1 + 0.5 + 0.25)
c*2.       # dotted half: 3 beats (2 + 1)
c/2.       # dotted eighth: 0.75 beats (0.5 + 0.25)
```

Rests also support dotting:

```
r.         # dotted rest: 1.5 beats
r*2.       # dotted half rest: 3 beats
r/2.       # dotted eighth rest: 0.75 beats
```

### 2. Dividing Rests

Rests now support the `/` operator for fractional durations:

```
r/2        # half-beat rest (0.5 beats)
r/4        # quarter-beat rest (0.25 beats)
```

## Quick Reference

| Feature | v0.2 | v0.3 |
|---------|------|------|
| Duration multiply | `c.2` | `c*2` |
| Duration divide | `c/2` | `c/2` (unchanged) |
| Duration + position | `c.2@4` | `c*2@4` |
| Dotted note | Not supported | `c.` |
| Double-dotted | Not supported | `c..` |
| Dotted with duration | Not supported | `c*2.` or `c/2.` |
| Fractional rest | Not supported | `r/2` |
| Dotted rest | Not supported | `r.` |

## Migration Examples

### Example 1: Simple Melody with Durations

```
# v0.2
c5 d e f g.2 g.2

# v0.3
c5 d e f g*2 g*2
```

### Example 2: Mixed Durations

```
# v0.2
c5.2 d e.4 f/2

# v0.3
c5*2 d e*4 f/2
```

### Example 3: With Start Positions

```
# v0.2
c5.2@0 e.2@0 g.2@0

# v0.3
c5*2@0 e*2@0 g*2@0
```

### Example 4: Using New Dotted Rhythms

```
# v0.3 only - dotted rhythms
c. d/2 e.       # dotted quarter, eighth, dotted quarter
c*2. d          # dotted half, quarter
```

---

# LML Migration Guide: v0.1 to v0.2

This guide helps you update LML music files from version 0.1 to 0.2. Version 0.2 introduces several syntax changes and new features that make writing music more concise.

## Breaking Changes

### 1. Note Duration and Start Position Syntax

The syntax for specifying note duration and start position has changed.

**Duration:**
- Old: `.N` where N is the duration multiplier
- New: `.N` to multiply duration, `/N` to divide duration

**Start position:**
- Old: `.duration.start` (start after duration, separated by `.`)
- New: `@start` (explicit `@` prefix)

```
# v0.1
c5.2       # duration 2
c5.4.8     # duration 4, start at beat 8
c5.1.0     # duration 1, start at beat 0

# v0.2
c5.2       # duration 2 (same)
c5.4@8     # duration 4, start at beat 8
c5@0       # start at beat 0 (duration is default)
```

The new `/N` syntax divides duration instead of multiplying:

```
# v0.2 only
c/2        # half a beat (0.5)
c/4        # quarter beat (0.25)
```

### 2. Rest Syntax

Rests follow the same pattern change for start position:

```
# v0.1
r.2.4      # rest duration 2, at beat 4

# v0.2
r2@4       # rest duration 2, at beat 4
r@4        # rest at beat 4 (default duration)
```

### 3. Octave Numbering (MIDI Mapping)

The octave numbering now follows the standard MIDI convention where C4 = 60.

```
# v0.1: C5 = MIDI 60 (middle C)
# v0.2: C4 = MIDI 60 (middle C)
```

If your music was written for v0.1, you may need to adjust octave numbers down by 1 to sound the same. However, if you're using relative octaves (see below), this may not matter.

## New Features to Simplify Your Code

### 1. Relative Octaves (Octaveless Notes)

Notes no longer require explicit octave numbers. The parser automatically finds the closest octave to the previous note.

```
# v0.1 (explicit octaves required)
c5 d5 e5 f5 g5 a5 b5 c6

# v0.2 (relative octaves)
c5 d e f g a b c

# Even simpler - just set the starting octave
c5 d e f g a b c    # ascending: c5 d5 e5 f5 g5 a5 b5 c6
c6 b a g f e d c    # descending: c6 b5 a5 g5 f5 e5 d5 c5
```

The algorithm picks the octave that minimizes semitone distance:
- From C5, going to D picks D5 (2 semitones) not D4 (10 semitones)
- From C5, going to G picks G4 (5 semitones down) not G5 (7 semitones up)

Use explicit octaves when you need to jump registers:

```
c5 d e g3 a b      # Jump from e5 down to g3, then continue relatively
```

### 2. Auto-Incrementing Measures

The `m` command without a number now auto-increments to the next measure.

```
# v0.1
m0 { c5 d e f }
m1 { g a b c }
m2 { d e f g }

# v0.2
m { c5 d e f }     # measure 0
m { g a b c }      # measure 1
m { d e f g }      # measure 2
```

You can still use explicit measure numbers, which also update the counter:

```
m { c d }          # measure 0
m { e f }          # measure 1
m5 { g a }         # jump to measure 5
m { b c }          # measure 6 (continues from 5)
```

### 3. Time Command Multipliers

Time commands (`dt`, `ht`, `tt`) now accept a count to apply multiple times:

```
# v0.1
dt dt c d e        # each note is 0.25 beats

# v0.2
dt2 c d e          # same result, more concise
ht3 c              # 8-beat note (2^3)
```

### 4. Frontmatter for Metadata

You can now embed metadata at the start of your files:

```
# title: My Song
# author: Composer Name
# bpm: 120
# difficulty: beginner

ts4/4 ks0
c d e f g a b c
```

Access via `song.metadata.frontmatter` in code.

### 5. String Literals

Embed text (lyrics, annotations) directly in your music:

```
c "hel" d "lo" e "world"
```

Both single and double quotes work:

```
c 'la' d "la"
```

## Migration Examples

### Example 1: Simple Melody

```
# v0.1
c5 d5 e5 f5 g5.2 g5.2

# v0.2
c5 d e f g.2 g.2
```

### Example 2: With Timing

```
# v0.1
c5.2.0 e5.2.0 g5.2.0    # chord at beat 0
d5.1.2 e5.1.3           # notes at beats 2 and 3

# v0.2
c5.2@0 e.2@0 g.2@0      # chord at beat 0
d@2 e@3                 # notes at beats 2 and 3
```

### Example 3: Multi-Measure Song

```
# v0.1
ts4/4
m0 { | c5 d e f | c4.4 }
m1 { | g5 a b c | d4.4 }
m2 { | e5 f g a | e4.4 }

# v0.2
ts4/4
m { | c5 d e f | c4.4 }
m { | g5 a b c | d4.4 }
m { | e5 f g a | e4.4 }
```

### Example 4: Two-Voice Passage

```
# v0.1
m0 {
  | c5 d5 e5 f5
  | c4.4
}
m1 {
  | g5 a5 b5 c6
  | g4.4
}

# v0.2
m {
  | c5 d e f
  | c4.4
}
m {
  | g5 a b c        # g5 sets new reference, then a5 b5 c6
  | g4.4
}
```

### Example 5: Fast Passages

```
# v0.1
dt dt
c5 d5 e5 f5 g5 a5 b5 c6

# v0.2
dt2
c5 d e f g a b c
```

## Quick Reference

| Feature | v0.1 | v0.2 |
|---------|------|------|
| Note with duration | `c5.2` | `c5.2` or `c5/2` |
| Note at position | `c5.1.4` | `c5@4` |
| Duration + position | `c5.2.4` | `c5.2@4` |
| Rest at position | `r.1.4` | `r@4` |
| Rest with duration | `r.2` | `r2` |
| Explicit octave | Required | Optional |
| Relative octave | Not supported | Default behavior |
| Measure increment | `m0`, `m1`, `m2` | `m`, `m`, `m` |
| Double double time | `dt dt` | `dt2` |
| Metadata | Not supported | `# key: value` |
| Text/lyrics | Not supported | `"text"` |

## API Changes

If you're using the library programmatically:

- `SongNote` now has an optional `sourceLocation` property
- `song.timeSignatures` tracks time signature changes
- `song.getMeasures()` returns computed measure boundaries
- `song.strings` contains positioned text literals
- `song.metadata.frontmatter` contains parsed frontmatter
- New exports: `parseNoteString`, `serializeNote`, `stepDuration`
- `KeySignature.noteName(pitch)` converts MIDI pitch with correct enharmonic spelling
