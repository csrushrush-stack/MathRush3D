import { useEffect, useRef } from 'react'

const KEYBOARD_SPEED = 4.6

/** Returns a world-space lateral delta, shared by keyboard, mouse, and touch. */
export function useInputController(enabled: boolean) {
  const keys = useRef({ left: false, right: false })
  const pointer = useRef({ active: false, lastX: 0, pendingPixels: 0 })

  useEffect(() => {
    if (!enabled) {
      keys.current = { left: false, right: false }
      pointer.current = { active: false, lastX: 0, pendingPixels: 0 }
      return
    }

    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        keys.current.left = pressed
        event.preventDefault()
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        keys.current.right = pressed
        event.preventDefault()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('button, [role="dialog"]')) return
      pointer.current.active = true
      pointer.current.lastX = event.clientX
      pointer.current.pendingPixels = 0
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer.current.active) return
      pointer.current.pendingPixels += event.clientX - pointer.current.lastX
      pointer.current.lastX = event.clientX
    }
    const onPointerUp = () => { pointer.current.active = false }
    const onBlur = () => {
      keys.current = { left: false, right: false }
      pointer.current.active = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled])

  const tick = (delta: number) => {
    const keyDirection = Number(keys.current.right) - Number(keys.current.left)
    const keyDelta = keyDirection * KEYBOARD_SPEED * delta
    const pixels = pointer.current.pendingPixels
    pointer.current.pendingPixels = 0
    const viewportWidth = Math.max(280, Math.min(window.innerWidth, 600))
    const pointerDelta = pixels * (5 / viewportWidth)
    return keyDelta + pointerDelta
  }

  return { tick }
}
