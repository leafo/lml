import { useState, useCallback, useEffect, useRef } from 'react'
import { SongNoteList } from '@leafo/lml'
import { AudioScheduler } from '../audio/AudioScheduler'

interface UsePlaybackOptions {
  songObj: SongNoteList | null
}

interface UsePlaybackReturn {
  isPlaying: boolean
  currentBeat: number | null
  play: () => void
  stop: () => void
}

function getBpm(songObj: SongNoteList): number {
  const bpmStr = songObj.metadata?.frontmatter?.bpm
  if (bpmStr) {
    const parsed = parseInt(bpmStr, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 120
}

export function usePlayback({ songObj }: UsePlaybackOptions): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState<number | null>(null)
  const schedulerRef = useRef<AudioScheduler | null>(null)
  const animationRef = useRef<number | null>(null)

  const updatePlayhead = useCallback(() => {
    if (schedulerRef.current && schedulerRef.current.isPlaying) {
      setCurrentBeat(schedulerRef.current.getCurrentBeat())
      animationRef.current = requestAnimationFrame(updatePlayhead)
    } else {
      // Scheduler stopped (song ended)
      setIsPlaying(false)
      setCurrentBeat(null)
    }
  }, [])

  const play = useCallback(() => {
    if (!songObj || songObj.length === 0) return

    const bpm = getBpm(songObj)

    // Create scheduler if needed
    if (!schedulerRef.current) {
      schedulerRef.current = new AudioScheduler()
    }

    // Load notes from song
    const notes = [...songObj].map(n => ({
      note: n.note,
      start: n.start,
      duration: n.duration,
    }))

    schedulerRef.current.setNotes(notes, bpm)
    schedulerRef.current.play()
    setIsPlaying(true)
    setCurrentBeat(0)

    // Start animation loop
    animationRef.current = requestAnimationFrame(updatePlayhead)
  }, [songObj, updatePlayhead])

  const stop = useCallback(() => {
    schedulerRef.current?.stop()
    setIsPlaying(false)
    setCurrentBeat(null)

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Stop playback when song changes
  useEffect(() => {
    if (isPlaying) {
      stop()
    }
  }, [songObj]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isPlaying, currentBeat, play, stop }
}
