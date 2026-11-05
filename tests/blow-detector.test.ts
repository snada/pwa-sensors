import assert from 'node:assert/strict'
import test from 'node:test'
import { BlowDetector, audioFeatures } from '../src/lib/blow-detector.ts'

const wind = { rms: 0.12, flatness: 0.5, lowRatio: 0.4 }
const quiet = { rms: 0.002, flatness: 0.5, lowRatio: 0.4 }

test('sustained blow produces one completed duration without the settling delay', () => {
  const detector = new BlowDetector()
  for (let now = 0; now <= 600; now += 30) {
    const result = detector.sample(wind, now)
    assert.equal(result.blowing, now >= 180)
    assert.equal(result.completedSeconds, null)
  }
  assert.equal(detector.sample(quiet, 900).blowing, true)
  assert.deepEqual(detector.sample(quiet, 1050), {
    blowing: false,
    completedSeconds: 0.6,
  })
  assert.equal(detector.expire(1100).completedSeconds, null)
})

test('ignores brief clicks, quiet noise, and loud tonal sounds', () => {
  for (const features of [quiet, { ...wind, flatness: 0.01 }]) {
    const detector = new BlowDetector()
    for (let now = 0; now < 1000; now += 30)
      assert.equal(detector.sample(features, now).blowing, false)
  }
  const detector = new BlowDetector()
  detector.sample(wind, 0)
  detector.sample(quiet, 150)
  assert.equal(detector.sample(wind, 200).blowing, false)
})

test('separate blows create separate durations', () => {
  const detector = new BlowDetector()
  for (let now = 0; now <= 300; now += 30) detector.sample(wind, now)
  assert.equal(detector.expire(750).completedSeconds, 0.3)
  for (let now = 900; now <= 1200; now += 30) detector.sample(wind, now)
  assert.equal(detector.expire(1650).completedSeconds, 0.3)
})

test('audio feature extraction distinguishes broadband noise from a single tone', () => {
  const wave = new Float32Array(2048).fill(0.1)
  const noise = new Float32Array(1024).fill(-30)
  const features = audioFeatures(wave, noise, 48000, 2048)
  assert.ok(Math.abs(features.rms - 0.1) < 0.001)
  assert.ok(features.flatness > 0.9)
  const tone = new Float32Array(1024).fill(-100)
  tone[20] = -10
  assert.ok(audioFeatures(wave, tone, 48000, 2048).flatness < 0.12)
})
