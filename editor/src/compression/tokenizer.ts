// LML tokenizer for compression - extracts tokens from LML text

export type TokenType =
  | 'frontmatter'
  | 'command'
  | 'note'
  | 'rest'
  | 'number'
  | 'string'
  | 'macro'
  | 'block_start'
  | 'block_end'
  | 'pipe'

export interface Token {
  type: TokenType
  value: string
  // For notes
  noteName?: string
  octave?: number
  accidental?: string // '+', '-', '='
  duration?: string   // '*2', '/4', etc
  dots?: number
  start?: number      // @N position
  // For frontmatter
  key?: string
}

// Regex patterns for LML tokens
const FRONTMATTER_RE = /^#\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/
const NOTE_RE = /^([a-gA-G])([+\-=])?(\d)?(\*\d+|\/\d+)?(\.+)?(@\d+)?/
const REST_RE = /^[rR_](\*?\d+|\/\d+)?(\.+)?(@\d+)?/
const COMMAND_RE = /^(ks-?\d+|ts\d+\/\d+|dt\d*|ht\d*|tt\d*|m\d*|t\d+|\/[gcfGCF])/
const MACRO_RE = /^\$([a-zA-Z0-9_]+)/
const STRING_RE = /^"([^"\\]|\\.)*"|^'([^'\\]|\\.)*'/
const WHITESPACE_RE = /^[\s]+/
const COMMENT_RE = /^#[^\n]*/

export function tokenize(lml: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let inFrontmatter = true

  while (pos < lml.length) {
    // Skip whitespace
    const wsMatch = lml.slice(pos).match(WHITESPACE_RE)
    if (wsMatch) {
      pos += wsMatch[0].length
      continue
    }

    // Check for frontmatter (only at start of lines, before any commands)
    if (inFrontmatter) {
      const lineEnd = lml.indexOf('\n', pos)
      const line = lineEnd === -1 ? lml.slice(pos) : lml.slice(pos, lineEnd)
      const fmMatch = line.match(FRONTMATTER_RE)
      if (fmMatch) {
        tokens.push({
          type: 'frontmatter',
          value: line,
          key: fmMatch[1],
        })
        pos = lineEnd === -1 ? lml.length : lineEnd + 1
        continue
      }
      // Not frontmatter, switch mode
      inFrontmatter = false
    }

    // Skip comments (non-frontmatter)
    const commentMatch = lml.slice(pos).match(COMMENT_RE)
    if (commentMatch) {
      pos += commentMatch[0].length
      continue
    }

    const remaining = lml.slice(pos)

    // Block delimiters
    if (remaining[0] === '{') {
      tokens.push({ type: 'block_start', value: '{' })
      pos++
      continue
    }
    if (remaining[0] === '}') {
      tokens.push({ type: 'block_end', value: '}' })
      pos++
      continue
    }
    if (remaining[0] === '|') {
      tokens.push({ type: 'pipe', value: '|' })
      pos++
      continue
    }

    // Macro
    const macroMatch = remaining.match(MACRO_RE)
    if (macroMatch) {
      tokens.push({ type: 'macro', value: macroMatch[0] })
      pos += macroMatch[0].length
      continue
    }

    // String literal
    const stringMatch = remaining.match(STRING_RE)
    if (stringMatch) {
      tokens.push({ type: 'string', value: stringMatch[0] })
      pos += stringMatch[0].length
      continue
    }

    // Commands (ks, ts, dt, ht, tt, m, t, clefs)
    const cmdMatch = remaining.match(COMMAND_RE)
    if (cmdMatch) {
      tokens.push({ type: 'command', value: cmdMatch[0] })
      pos += cmdMatch[0].length
      continue
    }

    // Rest
    const restMatch = remaining.match(REST_RE)
    if (restMatch) {
      const token: Token = { type: 'rest', value: restMatch[0] }
      // Parse duration if present
      if (restMatch[1]) {
        token.duration = restMatch[1]
      }
      if (restMatch[2]) {
        token.dots = restMatch[2].length
      }
      if (restMatch[3]) {
        token.start = parseInt(restMatch[3].slice(1))
      }
      tokens.push(token)
      pos += restMatch[0].length
      continue
    }

    // Note
    const noteMatch = remaining.match(NOTE_RE)
    if (noteMatch) {
      const token: Token = {
        type: 'note',
        value: noteMatch[0],
        noteName: noteMatch[1].toLowerCase(),
      }
      if (noteMatch[2]) {
        token.accidental = noteMatch[2]
      }
      if (noteMatch[3]) {
        token.octave = parseInt(noteMatch[3])
      }
      if (noteMatch[4]) {
        token.duration = noteMatch[4]
      }
      if (noteMatch[5]) {
        token.dots = noteMatch[5].length
      }
      if (noteMatch[6]) {
        token.start = parseInt(noteMatch[6].slice(1))
      }
      tokens.push(token)
      pos += noteMatch[0].length
      continue
    }

    // Unknown character - skip
    pos++
  }

  return tokens
}

// Reconstruct LML from tokens (normalized form)
export function reconstruct(tokens: Token[]): string {
  const parts: string[] = []
  let lastType: TokenType | null = null

  for (const token of tokens) {
    // Add space between most tokens, but not after { or before }
    if (lastType !== null && lastType !== 'block_start' && token.type !== 'block_end') {
      // Add newline after frontmatter
      if (lastType === 'frontmatter') {
        parts.push('\n')
      } else {
        parts.push(' ')
      }
    }

    switch (token.type) {
      case 'frontmatter':
        parts.push(`# ${token.key}: ${extractFrontmatterValue(token.value)}`)
        break

      case 'note': {
        let s = token.noteName!
        if (token.accidental) s += token.accidental
        if (token.octave !== undefined) s += token.octave
        if (token.duration) s += token.duration
        if (token.dots) s += '.'.repeat(token.dots)
        if (token.start !== undefined) s += `@${token.start}`
        parts.push(s)
        break
      }

      case 'rest': {
        let s = 'r'
        if (token.duration) s += token.duration
        if (token.dots) s += '.'.repeat(token.dots)
        if (token.start !== undefined) s += `@${token.start}`
        parts.push(s)
        break
      }

      case 'command':
      case 'macro':
      case 'string':
      case 'block_start':
      case 'block_end':
      case 'pipe':
        parts.push(token.value)
        break
    }

    lastType = token.type
  }

  return parts.join('')
}

function extractFrontmatterValue(line: string): string {
  const match = line.match(FRONTMATTER_RE)
  return match ? match[2].trim() : ''
}
