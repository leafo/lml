// Test script for LML compression
// Run with: npx tsx editor/src/compression/compression.test.ts

import { compress, decompress } from './index.js'
import { tokenize, reconstruct } from './tokenizer.js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const examplesDir = join(__dirname, '../../../examples')

function normalizeWhitespace(s: string): string {
  // Normalize LML for comparison (semantic equivalence)
  return s
    .split('\n')
    .map(line => {
      // Remove inline comments (but keep frontmatter)
      if (!line.trim().match(/^#\s*\w+:/)) {
        line = line.replace(/#[^\n]*$/, '')
      }
      return line.trim()
    })
    .filter(line => line && !line.startsWith('#') || line.match(/^#\s*\w+:/))
    .join('\n')
    .replace(/\s+/g, ' ')
    // Normalize octave 5 (remove explicit 5 after note letters with optional accidentals)
    .replace(/([a-g][+\-=]?)5(?=[*\/\.\s@}|]|$)/gi, '$1')
    // Normalize rest durations (r4 -> r*4)
    .replace(/\br(\d)/g, 'r*$1')
    // Normalize brace spacing
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .trim()
}

function testTokenizer(name: string, lml: string) {
  console.log(`\n--- Tokenizer test: ${name} ---`)
  try {
    const tokens = tokenize(lml)
    const reconstructed = reconstruct(tokens)
    console.log(`  Tokens: ${tokens.length}`)
    console.log(`  Original length: ${lml.length}`)
    console.log(`  Reconstructed length: ${reconstructed.length}`)

    // Check that tokenize->reconstruct produces valid LML
    const tokens2 = tokenize(reconstructed)
    console.log(`  Re-tokenized: ${tokens2.length} tokens`)
    console.log(`  ✓ Tokenizer OK`)
    return true
  } catch (e) {
    console.log(`  ✗ Tokenizer FAILED: ${e}`)
    return false
  }
}

function testCompression(name: string, lml: string) {
  console.log(`\n--- Compression test: ${name} ---`)
  try {
    const compressed = compress(lml)
    const decompressed = decompress(compressed)

    console.log(`  Original: ${lml.length} bytes`)
    console.log(`  Compressed: ${compressed.length} chars (base64url)`)
    console.log(`  Ratio: ${((compressed.length / lml.length) * 100).toFixed(1)}%`)

    // Normalize for comparison
    const origNorm = normalizeWhitespace(lml)
    const decNorm = normalizeWhitespace(decompressed)

    if (origNorm === decNorm) {
      console.log(`  ✓ Round-trip OK (normalized match)`)
      return true
    } else {
      console.log(`  ✗ Round-trip FAILED`)
      console.log(`  Original (norm): ${origNorm.slice(0, 100)}...`)
      console.log(`  Decompressed (norm): ${decNorm.slice(0, 100)}...`)
      // Find first difference
      for (let i = 0; i < Math.min(origNorm.length, decNorm.length); i++) {
        if (origNorm[i] !== decNorm[i]) {
          console.log(`  First diff at pos ${i}: orig='${origNorm.slice(i, i+20)}' dec='${decNorm.slice(i, i+20)}'`)
          break
        }
      }
      if (origNorm.length !== decNorm.length) {
        console.log(`  Length diff: orig=${origNorm.length} dec=${decNorm.length}`)
      }
      return false
    }
  } catch (e) {
    console.log(`  ✗ Compression FAILED: ${e}`)
    if (e instanceof Error) {
      console.log(`  Stack: ${e.stack}`)
    }
    return false
  }
}

function testUrlSafety(compressed: string): boolean {
  // Check that output is URL-safe (base64url alphabet only)
  const urlSafe = /^[A-Za-z0-9_-]*$/
  return urlSafe.test(compressed)
}

// Run tests
console.log('=== LML Compression Tests ===\n')

// Test simple strings
const simpleTests = [
  { name: 'Single note', lml: 'c5' },
  { name: 'Notes with octave 5', lml: 'c5 d e f g a b' },
  { name: 'Notes with other octaves', lml: 'c3 d4 e5 f6 g7' },
  { name: 'Key signature', lml: 'ks2' },
  { name: 'Time signature', lml: 'ts4/4' },
  { name: 'Duration modifiers', lml: 'c*2 d*3 e/2 f/4' },
  { name: 'Accidentals', lml: 'c+ d- e= f+5' },
  { name: 'Rests', lml: 'r r*2 r/4' },
  { name: 'Double time', lml: 'dt c d e f' },
  { name: 'Block', lml: '{ dt c d e } f g' },
  { name: 'Measure', lml: 'm1 c d e f m2 g a b c' },
  { name: 'Pipe (restore position)', lml: 'c d e | f g a' },
  { name: 'Frontmatter', lml: '# title: Test\n# bpm: 120\nc d e f' },
  { name: 'Complex', lml: '# title: Test\nks1 ts4/4\nm1 { dt c5 d e*2 f- } | g a b\nm2 r*4' },
]

let passed = 0
let failed = 0

for (const test of simpleTests) {
  if (testTokenizer(test.name, test.lml)) {
    passed++
  } else {
    failed++
  }

  if (testCompression(test.name, test.lml)) {
    passed++
  } else {
    failed++
  }
}

// Test example files
console.log('\n\n=== Example Files ===')

try {
  const files = readdirSync(examplesDir).filter(f => f.endsWith('.lml'))

  for (const file of files) {
    const path = join(examplesDir, file)
    const content = readFileSync(path, 'utf-8')

    if (testTokenizer(file, content)) {
      passed++
    } else {
      failed++
    }

    if (testCompression(file, content)) {
      passed++
    } else {
      failed++
    }

    // Test URL safety
    try {
      const compressed = compress(content)
      if (testUrlSafety(compressed)) {
        console.log(`  ✓ URL-safe`)
        passed++
      } else {
        console.log(`  ✗ NOT URL-safe: ${compressed.slice(0, 50)}...`)
        failed++
      }
    } catch {
      // Already counted in compression test
    }
  }
} catch (e) {
  console.log(`Could not read examples: ${e}`)
}

console.log(`\n\n=== Summary ===`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
}
