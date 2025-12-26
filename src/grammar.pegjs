start
  = frontmatter:frontmatterLine* commands:commands {
    return frontmatter.concat(commands)
  }

frontmatterLine
  = "#" [ \t]* key:$([a-zA-Z_][a-zA-Z0-9_]*) [ \t]* ":" value:$[^\n]* "\n" {
    return ["frontmatter", key, value.trim()]
  }

commands
  = white ? head:command rest:(white command) * white ? {
    return [head].concat(rest.map((m) => m[1]))
  }

command
  = note / rest / keySignature / timeSignature / halfTime / doubleTime / tripleTime / measure / block / restoreStartPosition / setTrack / macro / setClef / string

keySignature
  = "ks" mod:$( "-"? [0-9]+) {
    return ["keySignature", +mod]
  }

timeSignature
  = "ts" upper:$[0-9]+ "/" lower:$[0-9]+ {
    return ["timeSignature", +upper, +lower]
  }

setTrack
  = "t" track:$[0-9]+ {
    return ["setTrack", +track]
  }

setClef
  = "/" clef:[gcfGCF] {
    return ["clef", clef.toLowerCase()]
  }

macro
  = "$" name:[a-zA-Z0-9_]+ {
    return ["macro", name.join("")]
  }

restoreStartPosition
  = "|" {
    return ["restoreStartPosition"]
  }

note
  = name:[a-gA-G] accidental:[+=-] ? octave:[0-9] timing:noteTiming ? {
    let opts = {
      ...timing
    }

    if (accidental == "+") {
      opts.sharp = true
    } else if (accidental == "-") {
      opts.flat = true
    } else if (accidental == "=") {
      opts.natural = true
    }

    let note = ["note", `${name.toUpperCase()}${octave}`]
    if (timing || accidental) {
     note.push(opts)
    }
    return note
  }

rest
  = [rR] timing:restTiming ? {
    let rest = ["rest"]
    if (timing) { rest.push(timing) }
    return rest
  }

noteTiming
  = duration:("." d:$[0-9]+ { return +d })? start:("@" s:$[0-9]+ { return +s })? &{ return duration !== null || start !== null } {
    let timing = {}
    if (duration !== null) timing.duration = duration
    if (start !== null) timing.start = start
    return timing
  }

restTiming
  = duration:$[0-9]+ start:("@" s:$[0-9]+ { return +s })? {
    let timing = { duration: +duration }
    if (start !== null) timing.start = start
    return timing
  }
  / "@" start:$[0-9]+ {
    return { start: +start }
  }

halfTime
  = "ht" { return ["halfTime"] }

doubleTime
  = "dt" { return ["doubleTime"] }

tripleTime
  = "tt" { return ["tripleTime"] }

measure
  = "m" measure:$[0-9]+ { return ["measure", +measure] }
  / "m" { return ["measure"] }

block
  = "{" commands:commands "}" {
    return ["block", commands]
  }

comment
  = "#" [^\n]+

white
  = ([\t\r\n ]+ / comment)+

string
  = '"' chars:doubleStringChar* '"' {
    return ["string", chars.join("")]
  }
  / "'" chars:singleStringChar* "'" {
    return ["string", chars.join("")]
  }

doubleStringChar
  = !('"' / "\\") char:. { return char }
  / "\\" escape:escapeChar { return escape }

singleStringChar
  = !("'" / "\\") char:. { return char }
  / "\\" escape:escapeChar { return escape }

escapeChar
  = '"' { return '"' }
  / "'" { return "'" }
  / "\\" { return "\\" }
  / "n" { return "\n" }
