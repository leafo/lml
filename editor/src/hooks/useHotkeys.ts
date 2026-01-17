import { useEffect, useCallback } from 'react'

interface HotkeyConfig {
  key: string
  ctrlKey?: boolean
  handler: () => void
}

export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const hotkey of hotkeys) {
      const keyMatch = e.key === hotkey.key
      const ctrlMatch = !!hotkey.ctrlKey === (e.ctrlKey || e.metaKey)

      if (keyMatch && ctrlMatch) {
        e.preventDefault()
        hotkey.handler()
        return
      }
    }
  }, [hotkeys])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
