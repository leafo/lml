import { parse } from './grammar.js'

export interface ParsedNote {
  name: string          // "C", "D", etc. (uppercase)
  accidental?: '+' | '-' | '='
  octave?: string
  duration?: number     // .N gives N, /N gives 1/N
  start?: number
}

/**
 * Parse a note string using the grammar.
 * Returns null if parsing fails.
 */
export function parseNoteString(noteStr: string): ParsedNote | null {
  try {
    const result = parse(noteStr, { startRule: 'note' }) as [string, string, {
      sharp?: boolean
      flat?: boolean
      natural?: boolean
      duration?: number
      start?: number
    }]

    const [, noteName, opts] = result

    return {
      name: noteName[0],  // Just the letter (already uppercase from grammar)
      octave: noteName.slice(1) || undefined,
      accidental: opts.sharp ? '+' : opts.flat ? '-' : opts.natural ? '=' : undefined,
      duration: opts.duration,
      start: opts.start,
    }
  } catch {
    return null
  }
}

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
      result += `.${note.duration}`
    } else if (note.duration < 1 && note.duration > 0) {
      result += `/${Math.round(1 / note.duration)}`
    }
    // duration === 1 or not set → no suffix
  }

  if (note.start !== undefined) {
    result += `@${note.start}`
  }

  return result
}

/**
 * Step the duration value by delta.
 * Sequence: ... /4 → /3 → /2 → (default=1) → .2 → .3 → .4 ...
 */
export function stepDuration(currentDuration: number | undefined, delta: number): number | undefined {
  if (currentDuration === undefined || currentDuration === 1) {
    // Default duration
    if (delta > 0) {
      return 2  // → .2
    } else {
      return 0.5  // → /2
    }
  } else if (currentDuration >= 2) {
    // .N format (currentDuration is N)
    if (delta > 0) {
      return currentDuration + 1
    } else {
      // .2 - 1 = default, .3 - 1 = .2
      if (currentDuration > 2) {
        return currentDuration - 1
      } else {
        return undefined  // back to default
      }
    }
  } else {
    // /N format (currentDuration is 1/N)
    const n = Math.round(1 / currentDuration)
    if (delta > 0) {
      // /2 + 1 = default, /3 + 1 = /2
      if (n > 2) {
        return 1 / (n - 1)
      } else {
        return undefined  // back to default
      }
    } else {
      return 1 / (n + 1)
    }
  }
}
