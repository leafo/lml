// LML Compression - Main API
// Compresses LML text to URL-safe strings and back

import { tokenize, reconstruct, Token } from './tokenizer'
import {
  COMMANDS, NOTES_OCT5, NOTE_INDICES, encodeNoteOctave, decodeNoteOctave,
  MODIFIERS, SPECIAL, REVERSE_COMMANDS, REVERSE_NOTES_OCT5, REVERSE_MODIFIERS,
  isCommand, isNoteOct5, isNoteWithOctave, isModifier, isSpecial, LITERAL_ESCAPE
} from './dictionary'
import { compressLz77, decompressLz77 } from './lz77'

// Header magic bytes
const MAGIC = [0x4C, 0x4D] // "LM"
const VERSION = 1

// Flags
const FLAG_HAS_FRONTMATTER = 0x01

// Base64url encoding (RFC 4648)
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(bytes: Uint8Array): string {
  let result = ''
  let i = 0

  while (i < bytes.length) {
    const b0 = bytes[i++]
    const b1 = i < bytes.length ? bytes[i++] : 0
    const b2 = i < bytes.length ? bytes[i++] : 0

    result += BASE64URL_CHARS[(b0 >> 2) & 0x3F]
    result += BASE64URL_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3F]

    if (i > bytes.length + 1) break
    result += BASE64URL_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3F]

    if (i > bytes.length) break
    result += BASE64URL_CHARS[b2 & 0x3F]
  }

  return result
}

function fromBase64Url(str: string): Uint8Array {
  const bytes: number[] = []

  // Build lookup table
  const lookup: Record<string, number> = {}
  for (let i = 0; i < BASE64URL_CHARS.length; i++) {
    lookup[BASE64URL_CHARS[i]] = i
  }

  let i = 0
  while (i < str.length) {
    const c0 = lookup[str[i++]] ?? 0
    const c1 = lookup[str[i++]] ?? 0
    const c2 = lookup[str[i++]] ?? 0
    const c3 = lookup[str[i++]] ?? 0

    bytes.push((c0 << 2) | (c1 >> 4))
    if (i > str.length + 1) break
    bytes.push(((c1 << 4) | (c2 >> 2)) & 0xFF)
    if (i > str.length) break
    bytes.push(((c2 << 6) | c3) & 0xFF)
  }

  // Remove padding bytes
  while (bytes.length > 0 && bytes[bytes.length - 1] === 0 && str.length % 4 !== 0) {
    bytes.pop()
  }

  return new Uint8Array(bytes)
}

// Encode variable-length integer
function encodeVarInt(n: number): number[] {
  if (n < 0) {
    return [SPECIAL.NEGATIVE, ...encodeVarInt(-n)]
  }
  if (n < 128) {
    return [n]
  }
  const bytes: number[] = []
  while (n > 0) {
    let byte = n & 0x7F
    n >>= 7
    if (n > 0) byte |= 0x80
    bytes.push(byte)
  }
  return bytes
}

// Decode variable-length integer
function decodeVarInt(data: Uint8Array, pos: number): { value: number, bytesRead: number } {
  let negative = false
  if (data[pos] === SPECIAL.NEGATIVE) {
    negative = true
    pos++
  }

  let value = 0
  let shift = 0
  let bytesRead = negative ? 1 : 0

  while (pos < data.length) {
    const byte = data[pos++]
    bytesRead++
    value |= (byte & 0x7F) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }

  return { value: negative ? -value : value, bytesRead }
}

// Encode tokens to bytes
function encodeTokens(tokens: Token[]): Uint8Array {
  const bytes: number[] = []
  const frontmatter: Token[] = []
  const commands: Token[] = []

  // Separate frontmatter from commands
  for (const token of tokens) {
    if (token.type === 'frontmatter') {
      frontmatter.push(token)
    } else {
      commands.push(token)
    }
  }

  // Header
  bytes.push(...MAGIC)
  let flags = 0
  if (frontmatter.length > 0) flags |= FLAG_HAS_FRONTMATTER
  bytes.push((VERSION << 4) | flags)

  // Frontmatter
  if (frontmatter.length > 0) {
    bytes.push(frontmatter.length)
    for (const fm of frontmatter) {
      const key = fm.key || ''
      const value = extractFrontmatterValue(fm.value)
      bytes.push(key.length)
      for (const c of key) bytes.push(c.charCodeAt(0))
      bytes.push(value.length)
      for (const c of value) bytes.push(c.charCodeAt(0))
    }
  }

  // Encode command tokens
  for (const token of commands) {
    switch (token.type) {
      case 'block_start':
        bytes.push(COMMANDS['{'])
        break

      case 'block_end':
        bytes.push(COMMANDS['}'])
        break

      case 'pipe':
        bytes.push(COMMANDS['|'])
        break

      case 'note': {
        const name = token.noteName!.toLowerCase()
        const octave = token.octave

        // Encode accidental first if present
        if (token.accidental && MODIFIERS[token.accidental]) {
          bytes.push(MODIFIERS[token.accidental])
        }

        // Encode note
        if (octave === undefined) {
          // Note without explicit octave
          bytes.push(NOTES_OCT5[name])
        } else {
          // Explicit octave
          bytes.push(encodeNoteOctave(name, octave))
        }

        // Duration
        if (token.duration) {
          const durCode = MODIFIERS[token.duration]
          if (durCode) {
            bytes.push(durCode)
          } else {
            // Arbitrary duration
            const isDivision = token.duration.startsWith('/')
            const num = parseInt(token.duration.slice(1))
            bytes.push(isDivision ? MODIFIERS['/'] : MODIFIERS['*'])
            bytes.push(...encodeVarInt(num))
          }
        }

        // Dots
        if (token.dots === 1) {
          bytes.push(MODIFIERS['.'])
        } else if (token.dots === 2) {
          bytes.push(MODIFIERS['..'])
        } else if (token.dots && token.dots > 2) {
          bytes.push(MODIFIERS['.'])
          bytes.push(...encodeVarInt(token.dots))
        }

        // Start position
        if (token.start !== undefined) {
          bytes.push(MODIFIERS['@'])
          bytes.push(...encodeVarInt(token.start))
        }
        break
      }

      case 'rest': {
        bytes.push(COMMANDS['r'])

        // Duration
        if (token.duration) {
          const durCode = MODIFIERS[token.duration]
          if (durCode) {
            bytes.push(durCode)
          } else {
            // Arbitrary duration
            const isDivision = token.duration.startsWith('/')
            const durStr = token.duration.replace(/^\*/, '')
            const num = parseInt(isDivision ? durStr.slice(1) : durStr)
            bytes.push(isDivision ? MODIFIERS['/'] : MODIFIERS['*'])
            bytes.push(...encodeVarInt(num))
          }
        }

        // Dots
        if (token.dots === 1) {
          bytes.push(MODIFIERS['.'])
        } else if (token.dots === 2) {
          bytes.push(MODIFIERS['..'])
        }

        // Start position
        if (token.start !== undefined) {
          bytes.push(MODIFIERS['@'])
          bytes.push(...encodeVarInt(token.start))
        }
        break
      }

      case 'command': {
        const cmd = token.value

        // Key signature: ks-2, ks0, ks2, etc
        if (cmd.startsWith('ks')) {
          bytes.push(COMMANDS['ks'])
          const num = parseInt(cmd.slice(2))
          bytes.push(...encodeVarInt(num))
        }
        // Time signature: ts4/4, ts3/4, etc
        else if (cmd.startsWith('ts')) {
          bytes.push(COMMANDS['ts'])
          const parts = cmd.slice(2).split('/')
          bytes.push(...encodeVarInt(parseInt(parts[0])))
          bytes.push(...encodeVarInt(parseInt(parts[1])))
        }
        // Double time: dt, dt2, etc
        else if (cmd.startsWith('dt')) {
          bytes.push(COMMANDS['dt'])
          const count = cmd.slice(2)
          if (count) {
            bytes.push(SPECIAL.HAS_COUNT)
            bytes.push(...encodeVarInt(parseInt(count)))
          }
        }
        // Half time: ht, ht2, etc
        else if (cmd.startsWith('ht')) {
          bytes.push(COMMANDS['ht'])
          const count = cmd.slice(2)
          if (count) {
            bytes.push(SPECIAL.HAS_COUNT)
            bytes.push(...encodeVarInt(parseInt(count)))
          }
        }
        // Triple time: tt, tt2, etc
        else if (cmd.startsWith('tt')) {
          bytes.push(COMMANDS['tt'])
          const count = cmd.slice(2)
          if (count) {
            bytes.push(SPECIAL.HAS_COUNT)
            bytes.push(...encodeVarInt(parseInt(count)))
          }
        }
        // Measure: m, m1, m2, etc
        else if (cmd.startsWith('m')) {
          bytes.push(COMMANDS['m'])
          const num = cmd.slice(1)
          if (num) {
            bytes.push(SPECIAL.HAS_COUNT)
            bytes.push(...encodeVarInt(parseInt(num)))
          }
        }
        // Track: t0, t1, etc
        else if (cmd.startsWith('t') && /^t\d+$/.test(cmd)) {
          bytes.push(COMMANDS['t'])
          bytes.push(...encodeVarInt(parseInt(cmd.slice(1))))
        }
        // Clef: /g, /c, /f
        else if (cmd.startsWith('/')) {
          const clef = cmd.toLowerCase()
          if (COMMANDS[clef]) {
            bytes.push(COMMANDS[clef])
          }
        }
        break
      }

      case 'macro': {
        bytes.push(COMMANDS['$'])
        const name = token.value.slice(1) // Remove $
        bytes.push(name.length)
        for (const c of name) bytes.push(c.charCodeAt(0))
        break
      }

      case 'string': {
        bytes.push(SPECIAL.STRING_START)
        // Remove quotes and unescape
        const content = token.value.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\')
        bytes.push(content.length & 0xFF)
        bytes.push((content.length >> 8) & 0xFF)
        for (const c of content) bytes.push(c.charCodeAt(0))
        break
      }
    }
  }

  return new Uint8Array(bytes)
}

// Decode bytes back to tokens
function decodeTokens(data: Uint8Array): Token[] {
  const tokens: Token[] = []
  let pos = 0

  // Verify magic
  if (data[pos++] !== MAGIC[0] || data[pos++] !== MAGIC[1]) {
    throw new Error('Invalid LML compressed data: bad magic')
  }

  // Read version and flags
  const versionFlags = data[pos++]
  const version = versionFlags >> 4
  const flags = versionFlags & 0x0F

  if (version > VERSION) {
    throw new Error(`Unsupported compression version: ${version}`)
  }

  // Read frontmatter
  if (flags & FLAG_HAS_FRONTMATTER) {
    const count = data[pos++]
    for (let i = 0; i < count; i++) {
      const keyLen = data[pos++]
      let key = ''
      for (let j = 0; j < keyLen; j++) key += String.fromCharCode(data[pos++])
      const valLen = data[pos++]
      let value = ''
      for (let j = 0; j < valLen; j++) value += String.fromCharCode(data[pos++])
      tokens.push({
        type: 'frontmatter',
        value: `# ${key}: ${value}`,
        key
      })
    }
  }

  // Decode command tokens
  while (pos < data.length) {
    const byte = data[pos++]

    // Handle literal escape
    if (byte === LITERAL_ESCAPE) {
      // This shouldn't happen after LZ77 decompression in normal flow
      // but handle it for robustness
      pos++
      continue
    }

    // Command
    if (isCommand(byte)) {
      const cmd = REVERSE_COMMANDS.get(byte)

      if (cmd === '{') {
        tokens.push({ type: 'block_start', value: '{' })
      } else if (cmd === '}') {
        tokens.push({ type: 'block_end', value: '}' })
      } else if (cmd === '|') {
        tokens.push({ type: 'pipe', value: '|' })
      } else if (cmd === 'r') {
        const token: Token = { type: 'rest', value: 'r' }
        // Check for duration/modifiers (but NOT accidentals)
        while (pos < data.length && isModifier(data[pos])) {
          const nextMod = REVERSE_MODIFIERS.get(data[pos])
          // Stop if this is an accidental (shouldn't happen for rest, but be safe)
          if (nextMod === '+' || nextMod === '-' || nextMod === '=') break
          pos++ // consume the modifier
          if (nextMod === '*' || nextMod === '/') {
            const { value, bytesRead } = decodeVarInt(data, pos)
            pos += bytesRead
            token.duration = `${nextMod}${value}`
          } else if (nextMod === '.') {
            token.dots = 1
          } else if (nextMod === '..') {
            token.dots = 2
          } else if (nextMod === '@') {
            const { value, bytesRead } = decodeVarInt(data, pos)
            pos += bytesRead
            token.start = value
          } else if (nextMod && /^\*\d+$/.test(nextMod)) {
            token.duration = nextMod
          } else if (nextMod && /^\/\d+$/.test(nextMod)) {
            token.duration = nextMod
          }
        }
        token.value = reconstructRestValue(token)
        tokens.push(token)
      } else if (cmd === 'ks') {
        const { value, bytesRead } = decodeVarInt(data, pos)
        pos += bytesRead
        tokens.push({ type: 'command', value: `ks${value}` })
      } else if (cmd === 'ts') {
        const upper = decodeVarInt(data, pos)
        pos += upper.bytesRead
        const lower = decodeVarInt(data, pos)
        pos += lower.bytesRead
        tokens.push({ type: 'command', value: `ts${upper.value}/${lower.value}` })
      } else if (cmd === 'dt' || cmd === 'ht' || cmd === 'tt') {
        let value = cmd
        if (pos < data.length && data[pos] === SPECIAL.HAS_COUNT) {
          pos++ // consume the HAS_COUNT marker
          const { value: count, bytesRead } = decodeVarInt(data, pos)
          value += count
          pos += bytesRead
        }
        tokens.push({ type: 'command', value })
      } else if (cmd === 'm') {
        let value = 'm'
        if (pos < data.length && data[pos] === SPECIAL.HAS_COUNT) {
          pos++ // consume the HAS_COUNT marker
          const { value: num, bytesRead } = decodeVarInt(data, pos)
          value += num
          pos += bytesRead
        }
        tokens.push({ type: 'command', value })
      } else if (cmd === 't') {
        const { value: track, bytesRead } = decodeVarInt(data, pos)
        pos += bytesRead
        tokens.push({ type: 'command', value: `t${track}` })
      } else if (cmd === '/g' || cmd === '/c' || cmd === '/f') {
        tokens.push({ type: 'command', value: cmd })
      } else if (cmd === '$') {
        const nameLen = data[pos++]
        let name = ''
        for (let i = 0; i < nameLen; i++) name += String.fromCharCode(data[pos++])
        tokens.push({ type: 'macro', value: `$${name}` })
      }
      continue
    }

    // Check for accidental before note
    let accidental: string | undefined
    let notePos = pos - 1
    if (isModifier(byte)) {
      const mod = REVERSE_MODIFIERS.get(byte)
      if (mod === '+' || mod === '-' || mod === '=') {
        accidental = mod
        notePos = pos
        // Check if next byte is a note
        if (pos >= data.length) continue
        const nextByte = data[pos]
        if (!isNoteOct5(nextByte) && !isNoteWithOctave(nextByte)) {
          // Not followed by note, treat as standalone modifier (shouldn't happen)
          continue
        }
        pos++
      }
    }

    // Note without explicit octave
    if (isNoteOct5(accidental ? data[notePos] : byte)) {
      const noteByte = accidental ? data[notePos] : byte
      const note = REVERSE_NOTES_OCT5.get(noteByte)!
      const token: Token = {
        type: 'note',
        value: note,
        noteName: note,
        // No octave - uses LML default
      }
      if (accidental) token.accidental = accidental

      // Check for duration/modifiers (but NOT accidentals - those belong to the next note)
      while (pos < data.length && isModifier(data[pos])) {
        const nextMod = REVERSE_MODIFIERS.get(data[pos])
        // Stop if this is an accidental (belongs to next note)
        if (nextMod === '+' || nextMod === '-' || nextMod === '=') break
        pos++ // consume the modifier
        if (nextMod === '*') {
          const { value, bytesRead } = decodeVarInt(data, pos)
          pos += bytesRead
          token.duration = `*${value}`
        } else if (nextMod === '/') {
          const { value, bytesRead } = decodeVarInt(data, pos)
          pos += bytesRead
          token.duration = `/${value}`
        } else if (nextMod === '.') {
          token.dots = 1
        } else if (nextMod === '..') {
          token.dots = 2
        } else if (nextMod === '@') {
          const { value, bytesRead } = decodeVarInt(data, pos)
          pos += bytesRead
          token.start = value
        } else if (nextMod && /^\*\d+$/.test(nextMod)) {
          token.duration = nextMod
        } else if (nextMod && /^\/\d+$/.test(nextMod)) {
          token.duration = nextMod
        }
      }

      token.value = reconstructNoteValue(token)
      tokens.push(token)
      continue
    }

    // Note with explicit octave
    if (isNoteWithOctave(accidental ? data[notePos] : byte)) {
      const noteByte = accidental ? data[notePos] : byte
      const decoded = decodeNoteOctave(noteByte)
      if (decoded) {
        const token: Token = {
          type: 'note',
          value: decoded.note,
          noteName: decoded.note,
          octave: decoded.octave
        }
        if (accidental) token.accidental = accidental

        // Check for duration/modifiers (but NOT accidentals - those belong to the next note)
        while (pos < data.length && isModifier(data[pos])) {
          const nextMod = REVERSE_MODIFIERS.get(data[pos])
          // Stop if this is an accidental (belongs to next note)
          if (nextMod === '+' || nextMod === '-' || nextMod === '=') break
          pos++ // consume the modifier
          if (nextMod === '*') {
            const { value, bytesRead } = decodeVarInt(data, pos)
            pos += bytesRead
            token.duration = `*${value}`
          } else if (nextMod === '/') {
            const { value, bytesRead } = decodeVarInt(data, pos)
            pos += bytesRead
            token.duration = `/${value}`
          } else if (nextMod === '.') {
            token.dots = 1
          } else if (nextMod === '..') {
            token.dots = 2
          } else if (nextMod === '@') {
            const { value, bytesRead } = decodeVarInt(data, pos)
            pos += bytesRead
            token.start = value
          } else if (nextMod && /^\*\d+$/.test(nextMod)) {
            token.duration = nextMod
          } else if (nextMod && /^\/\d+$/.test(nextMod)) {
            token.duration = nextMod
          }
        }

        token.value = reconstructNoteValue(token)
        tokens.push(token)
        continue
      }
    }

    // String
    if (byte === SPECIAL.STRING_START) {
      const lenLow = data[pos++]
      const lenHigh = data[pos++]
      const len = lenLow | (lenHigh << 8)
      let content = ''
      for (let i = 0; i < len; i++) content += String.fromCharCode(data[pos++])
      // Escape special characters
      const escaped = content
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/"/g, '\\"')
      tokens.push({ type: 'string', value: `"${escaped}"` })
      continue
    }
  }

  return tokens
}

function reconstructNoteValue(token: Token): string {
  let s = token.noteName!
  if (token.accidental) s += token.accidental
  if (token.octave !== undefined) s += token.octave
  if (token.duration) s += token.duration
  if (token.dots) s += '.'.repeat(token.dots)
  if (token.start !== undefined) s += `@${token.start}`
  return s
}

function reconstructRestValue(token: Token): string {
  let s = 'r'
  if (token.duration) s += token.duration
  if (token.dots) s += '.'.repeat(token.dots)
  if (token.start !== undefined) s += `@${token.start}`
  return s
}

function extractFrontmatterValue(line: string): string {
  const match = line.match(/^#\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*(.*)$/)
  return match ? match[1].trim() : ''
}

/**
 * Compress LML text to a URL-safe string
 */
export function compress(lml: string, useLz77 = true): string {
  // Tokenize
  const tokens = tokenize(lml)

  // Encode to bytes
  const bytes = encodeTokens(tokens)

  // Apply LZ77 compression (optional)
  const compressed = useLz77 ? compressLz77(bytes) : bytes

  // Convert to base64url
  return toBase64Url(compressed)
}

/**
 * Decompress a URL-safe string back to LML text
 */
export function decompress(compressed: string, useLz77 = true): string {
  // Decode base64url
  const bytes = fromBase64Url(compressed)

  // Decompress LZ77 (optional)
  const decompressed = useLz77 ? decompressLz77(bytes) : bytes

  // Decode tokens
  const tokens = decodeTokens(decompressed)

  // Reconstruct LML
  return reconstruct(tokens)
}
