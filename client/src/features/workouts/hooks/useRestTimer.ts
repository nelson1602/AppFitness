import { useState, useEffect, useCallback, useRef } from 'react'

export const useRestTimer = (defaultDuration = 90) => {
  const [duration, setDuration] = useState(defaultDuration)
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const start = useCallback(
    (secs?: number) => {
      clear()
      const d = secs ?? duration
      setDuration(d)
      setRemaining(d)
      setIsRunning(true)
    },
    [duration],
  )

  const stop = useCallback(() => {
    clear()
    setIsRunning(false)
    setRemaining(0)
  }, [])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return clear
  }, [isRunning])

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return { remaining, duration, isRunning, start, stop, setDuration, fmt }
}
