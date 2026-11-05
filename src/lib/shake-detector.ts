export type Vector = { x: number; y: number; z: number }
export type ShakeResult = { shaking: boolean; completedSeconds: number | null }

const QUIET_MS = 700
const START_THRESHOLD = 7
const CONTINUE_THRESHOLD = 4

// Confirm repeated movement, including reversals whose magnitude never falls low.
export class ShakeDetector {
  private gravity: Vector | null = null
  private previousTime: number | null = null
  private candidateTime: number | null = null
  private previousPeak: Vector | null = null
  private lastPeak = -Infinity
  private released = true
  private startedAt: number | null = null
  private lastMotion = -Infinity

  sample(linear: Vector | null, raw: Vector | null, now: number): ShakeResult {
    const expired = this.expire(now)
    const elapsed = this.previousTime === null ? 0 : now - this.previousTime
    if (elapsed > 1000) {
      this.gravity = null
      this.resetCandidate()
    }
    this.previousTime = now
    let acceleration = linear
    if (!acceleration && raw) {
      if (!this.gravity) this.gravity = { ...raw }
      const alpha = 1 - Math.exp(-Math.max(elapsed, 0) / 300)
      for (const axis of ['x', 'y', 'z'] as const) {
        this.gravity[axis] += alpha * (raw[axis] - this.gravity[axis])
      }
      acceleration = {
        x: raw.x - this.gravity.x,
        y: raw.y - this.gravity.y,
        z: raw.z - this.gravity.z,
      }
    }
    if (!acceleration) return expired
    const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z)
    if (this.startedAt !== null && magnitude >= CONTINUE_THRESHOLD) {
      this.lastMotion = now
    }
    if (magnitude >= START_THRESHOLD) {
      const reversed =
        this.previousPeak !== null &&
        acceleration.x * this.previousPeak.x +
          acceleration.y * this.previousPeak.y +
          acceleration.z * this.previousPeak.z <
          0
      if ((this.released || reversed) && now - this.lastPeak >= 40) {
        if (this.startedAt === null) {
          if (this.candidateTime !== null && now - this.candidateTime <= 600) {
            this.startedAt = this.candidateTime
            this.lastMotion = now
          } else {
            this.candidateTime = now
          }
        }
        this.previousPeak = { ...acceleration }
        this.lastPeak = now
        this.released = false
      }
    } else if (magnitude < CONTINUE_THRESHOLD) {
      this.released = true
    }
    return {
      shaking: this.startedAt !== null,
      completedSeconds: expired.completedSeconds,
    }
  }

  expire(now: number): ShakeResult {
    let completedSeconds: number | null = null
    if (this.startedAt !== null && now - this.lastMotion >= QUIET_MS) {
      // The quiet period confirms the end; it is not part of the shake duration.
      completedSeconds = (this.lastMotion - this.startedAt) / 1000
      this.startedAt = null
      this.resetCandidate()
    } else if (
      this.startedAt === null &&
      this.candidateTime !== null &&
      now - this.candidateTime > 600
    ) {
      this.resetCandidate()
    }
    return { shaking: this.startedAt !== null, completedSeconds }
  }

  private resetCandidate() {
    this.candidateTime = null
    this.previousPeak = null
    this.lastPeak = -Infinity
    this.released = true
  }
}
