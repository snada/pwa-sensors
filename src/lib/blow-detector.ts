export type BlowFeatures = { rms: number; flatness: number; lowRatio: number }
export type BlowResult = { blowing: boolean; completedSeconds: number | null }

export function audioFeatures(
  wave: Float32Array,
  spectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
): BlowFeatures {
  let squareSum = 0
  for (const value of wave) squareSum += value * value
  let power = 0
  let lowPower = 0
  let logPower = 0
  let bins = 0
  for (let i = 0; i < spectrum.length; i++) {
    const frequency = (i * sampleRate) / fftSize
    if (frequency < 80 || frequency > 4000) continue
    const energy = Math.max(1e-12, 10 ** (spectrum[i] / 10))
    power += energy
    logPower += Math.log(energy)
    if (frequency < 1000) lowPower += energy
    bins++
  }
  return {
    rms: Math.sqrt(squareSum / Math.max(1, wave.length)),
    flatness: bins ? Math.exp(logPower / bins) / (power / bins) : 0,
    lowRatio: power ? lowPower / power : 0,
  }
}

// Sustained, noisy airflow near the mic; this is a heuristic, not speech recognition.
export class BlowDetector {
  private candidate: number | null = null
  private started: number | null = null
  private lastSignal = -Infinity
  private noiseFloor = 0.003

  sample(features: BlowFeatures, now: number): BlowResult {
    const result = this.expire(now)
    const threshold = Math.max(0.025, this.noiseFloor * 3)
    const signal =
      features.rms >= threshold * (this.started === null ? 1 : 0.65) &&
      features.flatness >= 0.12 &&
      features.lowRatio >= 0.12
    if (signal) {
      if (this.candidate === null) this.candidate = now
      this.lastSignal = now
      if (this.started === null && now - this.candidate >= 180)
        this.started = this.candidate
    } else if (this.started === null) {
      if (now - this.lastSignal > 100) this.candidate = null
      if (features.rms < threshold)
        this.noiseFloor += 0.02 * (features.rms - this.noiseFloor)
    }
    return {
      blowing: this.started !== null,
      completedSeconds: result.completedSeconds,
    }
  }

  expire(now: number): BlowResult {
    let completedSeconds: number | null = null
    if (this.started !== null && now - this.lastSignal >= 450) {
      completedSeconds = (this.lastSignal - this.started) / 1000
      this.started = null
      this.candidate = null
    } else if (this.started === null && now - this.lastSignal > 100) {
      this.candidate = null
    }
    return { blowing: this.started !== null, completedSeconds }
  }
}
