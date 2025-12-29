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
  / white ? {
    return []
  }

command
  = keySignature / timeSignature / halfTime / doubleTime / tripleTime / measure / block / restoreStartPosition / setTrack / macro / setClef / string / note / rest

keySignature
  = "ks" mod:$( "-"? [0-9]+) {
    let loc = location()
    return ["keySignature", +mod, [loc.start.offset, loc.end.offset]]
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
  = name:[a-gA-G] accidental:[+=-] ? octave:[0-9]? timing:noteTiming ? {
    let loc = location()
    let opts = {
      ...timing,
      location: [loc.start.offset, loc.end.offset]
    }

    if (accidental == "+") {
      opts.sharp = true
    } else if (accidental == "-") {
      opts.flat = true
    } else if (accidental == "=") {
      opts.natural = true
    }

    return ["note", `${name.toUpperCase()}${octave ?? ""}`, opts]
  }

rest
  = [rR_] timing:restTiming? {
    let rest = ["rest"]
    if (timing) { rest.push(timing) }
    return rest
  }

noteTiming
  = duration:("*" d:$([0-9] |1..3|) { return +d } / "/" d:$([0-9] |1..3|) { return 1/+d })? dots:($"."+)? start:("@" s:$[0-9]+ { return +s })? &{ return duration !== null || dots || start !== null } {
    let timing = {}
    if (duration !== null) timing.duration = duration
    if (dots) timing.dots = dots.length
    if (start !== null) timing.start = start
    return timing
  }

restTiming
  = duration:("*"? d:$([0-9] |1..3|) { return +d } / "/" d:$([0-9] |1..3|) { return 1/+d })? dots:($"."+)? start:("@" s:$[0-9]+ { return +s })? &{ return duration !== null || dots || start !== null } {
    let timing = {}
    if (duration !== null) timing.duration = duration
    if (dots) timing.dots = dots.length
    if (start !== null) timing.start = start
    return timing
  }

halfTime
  = "ht" count:$[0-9]* { return count ? ["halfTime", +count] : ["halfTime"] }

doubleTime
  = "dt" count:$[0-9]* { return count ? ["doubleTime", +count] : ["doubleTime"] }

tripleTime
  = "tt" count:$[0-9]* { return count ? ["tripleTime", +count] : ["tripleTime"] }

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
