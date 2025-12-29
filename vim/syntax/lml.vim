" Vim syntax file for LML (Leaf's Music Language)
" Language: LML
" Maintainer: leafo

if exists("b:current_syntax")
  finish
endif

" Comments (# followed by any characters to end of line)
" Defined early so more specific patterns can override
syn match lmlComment /#.*$/ contains=@Spell

" Frontmatter (# key: value) - defined after comment to take priority
syn match lmlFrontmatter /^#\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:.*$/ contains=lmlFrontmatterKey,lmlFrontmatterValue
syn match lmlFrontmatterKey /^#\s*[a-zA-Z_][a-zA-Z0-9_]*/ contained
syn match lmlFrontmatterValue /:\s*.*$/ contained

" Strings with escape sequences
syn region lmlString start=/"/ skip=/\\"/ end=/"/ contains=lmlEscape
syn region lmlString start=/'/ skip=/\\'/ end=/'/ contains=lmlEscape
syn match lmlEscape /\\[\\'"n]/ contained

" Notes: a-g with optional accidental, octave, and timing
" Defined early so commands like dt/ht/tt can override
syn match lmlNote /[a-gA-G][+\-=]\?[0-9]\?\(\*[0-9]\+\|\/[0-9]\+\)\?\.*\(@[0-9]\+\)\?/
  \ contains=lmlNoteAccidental,lmlNoteDuration,lmlNoteDot,lmlNotePosition

" Note components (contained within lmlNote)
syn match lmlNoteAccidental /[+\-=]/ contained
syn match lmlNoteDuration /[\*\/][0-9]\+/ contained
syn match lmlNoteDot /\./ contained
syn match lmlNotePosition /@[0-9]\+/ contained

" Rests: r, R, or _ with optional timing
" Defined early so commands can override
syn match lmlRest /[rR_]\(\*\?[0-9]\+\|\/[0-9]\+\)\?\.*\(@[0-9]\+\)\?/

" Macros/Chords: $name
syn match lmlMacro /\$[a-zA-Z0-9_]\+/

" Key signature: ks followed by optional negative and digits
syn match lmlKeySignature /\<ks-\?[0-9]\+/

" Time signature: ts followed by num/denom
syn match lmlTimeSignature /\<ts[0-9]\+\/[0-9]\+/

" Time modifiers: dt, ht, tt with optional count
" Defined after notes so dt wins over note d
syn match lmlTimeModifier /\<\(dt\|ht\|tt\)[0-9]*/

" Measure: m with optional number
syn match lmlMeasure /\<m[0-9]*/

" Track: t with number
syn match lmlTrack /\<t[0-9]\+/

" Clef: / followed by g, c, or f
syn match lmlClef /\/[gcfGCF]/

" Unmatched braces show as error
syn match lmlBraceError /[{}]/

" Block region - properly matched braces override the error
syn region lmlBlock matchgroup=lmlBlockDelim start=/{/ end=/}/ contains=TOP

" Pipe (restore position)
syn match lmlPipe /|/

" Define highlight links
hi def link lmlFrontmatter PreProc
hi def link lmlFrontmatterKey Define
hi def link lmlFrontmatterValue String
hi def link lmlComment Comment
hi def link lmlString String
hi def link lmlEscape SpecialChar
hi def link lmlMacro PreProc
hi def link lmlKeySignature Keyword
hi def link lmlTimeSignature Keyword
hi def link lmlTimeModifier Keyword
hi def link lmlMeasure Function
hi def link lmlTrack Type
hi def link lmlClef Type
hi def link lmlRest Comment
hi def link lmlNote Constant
hi def link lmlNoteAccidental SpecialChar
hi def link lmlNoteDuration Special
hi def link lmlNoteDot Special
hi def link lmlNotePosition Special
hi def link lmlBlockDelim Delimiter
hi def link lmlBraceError Error
hi def link lmlPipe Special

let b:current_syntax = "lml"
