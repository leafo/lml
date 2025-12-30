// LZ77-style compression for dictionary-encoded LML bytes

import { LZ77, LITERAL_ESCAPE, isLz77 } from './dictionary'

const WINDOW_SIZE = 4096  // 12-bit offset
const MIN_MATCH = 3
const MAX_MATCH_SHORT = 10    // For short encoding (offset 1-32)
const MAX_MATCH_MEDIUM = 34   // For medium encoding (any offset)
// Long encoding removed - was buggy and not needed for LML

interface Match {
  offset: number
  length: number
}

// Find the longest match in the sliding window
function findMatch(data: Uint8Array, pos: number, windowStart: number): Match | null {
  let bestMatch: Match | null = null

  for (let i = Math.max(windowStart, 0); i < pos; i++) {
    let length = 0
    while (
      pos + length < data.length &&
      length < MAX_MATCH_MEDIUM &&  // Cap at medium encoding max
      data[i + length] === data[pos + length]
    ) {
      length++
    }

    if (length >= MIN_MATCH && (!bestMatch || length > bestMatch.length)) {
      bestMatch = { offset: pos - i, length }
    }
  }

  return bestMatch
}

// Encode a back-reference
function encodeBackRef(offset: number, length: number): number[] {
  // Short encoding: offset 1-32, length 3-10 (2 bytes total)
  if (offset <= 32 && length <= MAX_MATCH_SHORT) {
    const code = LZ77.SHORT_MIN + (offset - 1)
    const lenByte = length - MIN_MATCH
    return [code, lenByte]
  }

  // Medium encoding: offset 1-4096, length 3-34 (3 bytes)
  // Note: length is capped at MAX_MATCH_MEDIUM by findMatch
  const code = LZ77.MEDIUM_MIN + (length - MIN_MATCH)
  const offsetHigh = (offset >> 8) & 0x0F
  const offsetLow = offset & 0xFF
  return [code, offsetHigh, offsetLow]
}

// Compress data using LZ77
export function compressLz77(data: Uint8Array): Uint8Array {
  const output: number[] = []
  let pos = 0

  while (pos < data.length) {
    const windowStart = Math.max(0, pos - WINDOW_SIZE)
    const match = findMatch(data, pos, windowStart)

    if (match && match.length >= MIN_MATCH) {
      // Encode back-reference
      const encoded = encodeBackRef(match.offset, match.length)
      output.push(...encoded)
      pos += match.length
    } else {
      // Literal byte
      const byte = data[pos]
      // If the byte looks like an LZ77 code, escape it
      if (isLz77(byte) || byte === LITERAL_ESCAPE) {
        output.push(LITERAL_ESCAPE, byte)
      } else {
        output.push(byte)
      }
      pos++
    }
  }

  return new Uint8Array(output)
}

// Decode a back-reference, returns [offset, length]
function decodeBackRef(data: Uint8Array, pos: number): { offset: number, length: number, bytesRead: number } {
  const code = data[pos]

  // Short encoding
  if (code >= LZ77.SHORT_MIN && code <= LZ77.SHORT_MAX) {
    const offset = (code - LZ77.SHORT_MIN) + 1
    const length = data[pos + 1] + MIN_MATCH
    return { offset, length, bytesRead: 2 }
  }

  // Medium encoding
  if (code >= LZ77.MEDIUM_MIN && code <= LZ77.MEDIUM_MAX) {
    const length = (code - LZ77.MEDIUM_MIN) + MIN_MATCH
    const offsetHigh = data[pos + 1]
    const offsetLow = data[pos + 2]
    const offset = (offsetHigh << 8) | offsetLow
    return { offset, length, bytesRead: 3 }
  }

  throw new Error(`Invalid LZ77 code: ${code}`)
}

// Decompress LZ77-compressed data
export function decompressLz77(data: Uint8Array): Uint8Array {
  const output: number[] = []
  let pos = 0

  while (pos < data.length) {
    const byte = data[pos]

    // Literal escape
    if (byte === LITERAL_ESCAPE) {
      output.push(data[pos + 1])
      pos += 2
      continue
    }

    // LZ77 back-reference
    if (isLz77(byte)) {
      const { offset, length, bytesRead } = decodeBackRef(data, pos)
      const startPos = output.length - offset
      for (let i = 0; i < length; i++) {
        output.push(output[startPos + i])
      }
      pos += bytesRead
      continue
    }

    // Regular literal
    output.push(byte)
    pos++
  }

  return new Uint8Array(output)
}
