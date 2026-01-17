import { parseNote } from '@leafo/lml'

interface ScheduledNote {
  note: string
  start: number
  duration: number
}

function midiToFrequency(midiPitch: number): number {
  // A4 = 440Hz = MIDI 69
  return 440 * Math.pow(2, (midiPitch - 69) / 12)
}

export class AudioScheduler {
  private audioContext: AudioContext | null = null
  private notes: ScheduledNote[] = []
  private bpm: number = 120
  private _isPlaying: boolean = false
  private startTime: number = 0
  private schedulerInterval: number | null = null
  private nextNoteIndex: number = 0
  private activeNodes: Set<{ oscillator: OscillatorNode; gain: GainNode }> = new Set()

  // Lookahead scheduling constants
  private readonly LOOKAHEAD = 0.1 // seconds to look ahead
  private readonly SCHEDULE_INTERVAL = 25 // ms between scheduling calls

  get isPlaying(): boolean {
    return this._isPlaying
  }

  setNotes(notes: ScheduledNote[], bpm: number): void {
    this.notes = [...notes].sort((a, b) => a.start - b.start)
    this.bpm = bpm
  }

  async play(startBeat: number = 0): Promise<void> {
    if (this._isPlaying) return
    if (this.notes.length === 0) return

    // Create or resume audio context
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this._isPlaying = true

    // Adjust startTime so getCurrentBeat() returns correct value relative to startBeat
    const secondsPerBeat = 60 / this.bpm
    this.startTime = this.audioContext.currentTime - (startBeat * secondsPerBeat)

    // Find the first note at or after startBeat
    this.nextNoteIndex = this.notes.findIndex(n => n.start >= startBeat)
    if (this.nextNoteIndex === -1) {
      // All notes are before startBeat, nothing to play
      this._isPlaying = false
      return
    }

    // Start scheduler loop
    this.scheduleNotes()
    this.schedulerInterval = window.setInterval(() => {
      this.scheduleNotes()
    }, this.SCHEDULE_INTERVAL)
  }

  stop(): void {
    this._isPlaying = false

    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }

    // Fade out active sounds quickly to avoid click/pop
    const fadeTime = 0.015 // 15ms fade to avoid audible pop
    const now = this.audioContext?.currentTime ?? 0

    for (const node of this.activeNodes) {
      try {
        node.gain.gain.cancelScheduledValues(now)
        node.gain.gain.setValueAtTime(node.gain.gain.value, now)
        node.gain.gain.linearRampToValueAtTime(0, now + fadeTime)
        node.oscillator.stop(now + fadeTime)
      } catch {
        // Ignore errors from already-stopped nodes
      }
    }
    this.activeNodes.clear()

    this.nextNoteIndex = 0
  }

  getCurrentBeat(): number {
    if (!this.audioContext || !this._isPlaying) return 0

    const elapsed = this.audioContext.currentTime - this.startTime
    const secondsPerBeat = 60 / this.bpm
    return elapsed / secondsPerBeat
  }

  dispose(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  private scheduleNotes(): void {
    if (!this.audioContext || !this._isPlaying) return

    const currentTime = this.audioContext.currentTime
    const lookAheadTime = currentTime + this.LOOKAHEAD
    const secondsPerBeat = 60 / this.bpm

    // Calculate current beat position
    const currentBeat = (currentTime - this.startTime) / secondsPerBeat
    const lookAheadBeat = (lookAheadTime - this.startTime) / secondsPerBeat

    // Schedule all notes within our lookahead window
    while (this.nextNoteIndex < this.notes.length) {
      const note = this.notes[this.nextNoteIndex]
      if (note.start > lookAheadBeat) break

      // Only schedule if note hasn't already passed
      if (note.start >= currentBeat - 0.1) {
        const noteStartTime = this.startTime + note.start * secondsPerBeat
        const noteDuration = note.duration * secondsPerBeat
        this.playNote(note.note, noteStartTime, noteDuration)
      }

      this.nextNoteIndex++
    }

    // Check if song is complete
    if (this.notes.length > 0) {
      const lastNote = this.notes[this.notes.length - 1]
      const endBeat = lastNote.start + lastNote.duration
      if (currentBeat >= endBeat) {
        this.stop()
      }
    }
  }

  private playNote(noteName: string, startTime: number, duration: number): void {
    if (!this.audioContext) return

    const pitch = parseNote(noteName)
    const frequency = midiToFrequency(pitch)

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency

    // Simple envelope: quick attack, sustain, quick release
    const attackTime = 0.01
    const releaseTime = Math.min(0.05, duration * 0.1)

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + attackTime)
    gainNode.gain.setValueAtTime(0.3, startTime + duration - releaseTime)
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Track active nodes for immediate stop capability
    const nodeRef = { oscillator, gain: gainNode }
    this.activeNodes.add(nodeRef)

    oscillator.onended = () => {
      this.activeNodes.delete(nodeRef)
    }

    oscillator.start(startTime)
    oscillator.stop(startTime + duration)
  }
}
