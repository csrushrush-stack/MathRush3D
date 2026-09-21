/**
 * audioManager.ts – Procedural sound effects for Math Rush 3D.
 *
 * Uses the Web Audio API to synthesise all sounds at runtime.
 * No external audio files required — all tones are generated on-the-fly.
 * The system is designed to be easily replaced with real audio assets later
 * by swapping the play* methods to use HTMLAudioElement instead.
 *
 * Usage:
 *   import { audioManager } from '../utils/audioManager'
 *   audioManager.playGateHit()
 *   audioManager.playObstacleHit()
 *   audioManager.playBossDefeat()
 *   audioManager.playGameOver()
 *   audioManager.playWin()
 *   audioManager.playButtonClick()
 *
 * All methods are safe to call before user interaction — the AudioContext is
 * created lazily on first call (browsers require a user gesture before audio).
 */

class AudioManager {
  private ctx: AudioContext | null = null
  private enabled = true

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  // ── Lazy AudioContext ─────────────────────────────────────────────────────
  private getCtx(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      // Resume if suspended (e.g. tab was backgrounded)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => null)
      }
      return this.ctx
    } catch {
      return null  // No Web Audio support (very rare)
    }
  }

  // ── Low-level tone builder ────────────────────────────────────────────────
  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.28,
    startOffset = 0,
    freqEnd?: number,
  ) {
    if (!this.enabled) return
    const ctx = this.getCtx()
    if (!ctx) return

    const osc     = ctx.createOscillator()
    const gainNode = ctx.createGain()
    const now     = ctx.currentTime + startOffset

    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration)
    }

    gainNode.gain.setValueAtTime(gain, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + duration + 0.01)
    osc.addEventListener('ended', () => {
      osc.disconnect()
      gainNode.disconnect()
    }, { once: true })
  }

  // ── Sound effects ─────────────────────────────────────────────────────────

  /**
   * Gate chosen — bright ascending ping.
   * Plays a quick two-note ding: root then fifth above.
   */
  playGateHit() {
    this.tone(440, 0.12, 'sine',     0.30)
    this.tone(660, 0.14, 'sine',     0.22, 0.08)
    this.tone(880, 0.10, 'triangle', 0.12, 0.16)
  }

  /**
   * Obstacle hit — heavy impact thud + noise burst.
   */
  playObstacleHit() {
    // Low thud
    this.tone(80,  0.35, 'triangle', 0.45, 0, 40)
    // Crunch overtone
    this.tone(200, 0.15, 'sawtooth', 0.18, 0)
    // High-freq noise click
    this.tone(3000, 0.04, 'square', 0.06, 0)
  }

  /**
   * Boss defeated — triumphant rising chord.
   */
  playBossDefeat() {
    const notes = [262, 330, 392, 524, 660, 784]
    notes.forEach((f, i) => this.tone(f, 0.40, 'sine', 0.28, i * 0.07))
  }

  playBossHit() {
    this.tone(150, 0.08, 'square', 0.12, 0, 95)
  }

  /**
   * Game over — sombre descending minor phrase.
   */
  playGameOver() {
    const notes = [392, 330, 294, 220]
    notes.forEach((f, i) => this.tone(f, 0.30, 'triangle', 0.32, i * 0.14))
  }

  /**
   * Win — upbeat multi-note fanfare.
   */
  playWin() {
    const notes = [330, 392, 440, 524, 660, 784, 1046]
    notes.forEach((f, i) => this.tone(f, 0.22, 'sine', 0.28, i * 0.065))
  }

  /**
   * UI button click — short, clean tick.
   */
  playButtonClick() {
    this.tone(900, 0.06, 'sine', 0.18)
    this.tone(700, 0.04, 'sine', 0.10, 0.04)
  }

  /**
   * Safe blocker dodge — light whoosh reward.
   */
  playDodge() {
    this.tone(660, 0.10, 'sine', 0.15, 0, 880)
  }

  /**
   * Crowd grows — gentle positive chime.
   */
  playCrowdGrow() {
    this.tone(523, 0.12, 'sine', 0.18)
    this.tone(659, 0.12, 'sine', 0.14, 0.06)
  }
}

// Singleton – import this everywhere
export const audioManager = new AudioManager()
