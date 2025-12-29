import type { ParsedNote } from './parser.js'

/**
 * Serialize a ParsedNote back to a string.
 * Preserves original case if lowercase is passed for name.
 */
export function serializeNote(note: ParsedNote, lowercase = true): string {
  let result = lowercase ? note.name.toLowerCase() : note.name

  if (note.accidental) result += note.accidental
  if (note.octave) result += note.octave

  if (note.duration !== undefined) {
    if (note.duration >= 2 && Number.isInteger(note.duration)) {
      result += `*${note.duration}`
    } else if (note.duration < 1 && note.duration > 0) {
      result += `/${Math.round(1 / note.duration)}`
    }
    // duration === 1 or not set → no suffix
  }

  if (note.dots) {
    result += '.'.repeat(note.dots)
  }

  if (note.start !== undefined) {
    result += `@${note.start}`
  }

  return result
}

/**
 * Step the duration value by delta.
 * Linear: ... /4 → /3 → /2 → (default=1) → .2 → .3 → .4 ...
 * Pow2:   ... /16 → /8 → /4 → /2 → (default=1) → .2 → .4 → .8 → .16 ...
 */
export function stepDuration(currentDuration: number | undefined, delta: number, pow2 = false): number | undefined {
  const stepUp = (n: number) => pow2 ? n * 2 : n + 1
  const stepDown = (n: number) => pow2 ? n / 2 : n - 1

  if (currentDuration === undefined || currentDuration === 1) {
    // Default duration
    return delta > 0 ? 2 : 0.5
  } else if (currentDuration >= 2) {
    // .N format (currentDuration is N)
    if (delta > 0) {
      return stepUp(currentDuration)
    } else {
      const next = stepDown(currentDuration)
      return next > 1 ? next : undefined  // back to default if <= 1
    }
  } else {
    // /N format (currentDuration is 1/N)
    const n = Math.round(1 / currentDuration)
    if (delta > 0) {
      const next = stepDown(n)
      return next > 1 ? 1 / next : undefined  // back to default if <= 1
    } else {
      return 1 / stepUp(n)
    }
  }
}
