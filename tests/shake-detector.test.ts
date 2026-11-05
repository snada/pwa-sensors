import assert from 'node:assert/strict'
import test from 'node:test'
import { ShakeDetector } from '../src/lib/shake-detector.ts'

const still = { x: 0, y: 0, z: 0 }
const peak = { x: 18, y: 0, z: 0 }

test('logs only after settling, once, with duration excluding quiet time', () => {
  const detector = new ShakeDetector()
  assert.deepEqual(detector.sample(peak, null, 0), {
    shaking: false,
    completedSeconds: null,
  })
  detector.sample(still, null, 50)
  assert.deepEqual(detector.sample(peak, null, 150), {
    shaking: true,
    completedSeconds: null,
  })
  detector.sample(still, null, 200)
  detector.sample(peak, null, 300)
  assert.deepEqual(detector.expire(999), {
    shaking: true,
    completedSeconds: null,
  })
  assert.deepEqual(detector.expire(1000), {
    shaking: false,
    completedSeconds: 0.3,
  })
  assert.equal(detector.expire(1100).completedSeconds, null)
  detector.sample(peak, null, 1200)
  detector.sample(still, null, 1250)
  detector.sample(peak, null, 1350)
  assert.equal(detector.expire(2050).completedSeconds, 0.15)
})

test('recognizes gentler reversals without requiring low magnitude between peaks', () => {
  const detector = new ShakeDetector()
  detector.sample({ x: 8, y: 0, z: 0 }, null, 0)
  assert.equal(detector.sample({ x: -8, y: 0, z: 0 }, null, 80).shaking, true)
  detector.sample({ x: 5, y: 0, z: 0 }, null, 200)
  assert.equal(detector.expire(900).completedSeconds, 0.2)
})

test('ignores isolated bumps, small noise, and steady acceleration', () => {
  const detector = new ShakeDetector()
  detector.sample(peak, null, 0)
  detector.sample(still, null, 100)
  assert.equal(detector.sample(peak, null, 800).shaking, false)
  for (let time = 900; time < 3000; time += 100) {
    assert.equal(detector.sample(peak, null, time).shaking, false)
  }
  for (let time = 3000; time < 4000; time += 100) {
    assert.equal(
      detector.sample({ x: 3 * Math.sin(time), y: 0, z: 0 }, null, time)
        .shaking,
      false,
    )
  }
})

test('gravity fallback ignores rest and detects repeated movement', () => {
  const detector = new ShakeDetector()
  const gravity = { x: 0, y: 0, z: 9.81 }
  for (let time = 0; time <= 1000; time += 100) {
    assert.equal(detector.sample(null, gravity, time).shaking, false)
  }
  detector.sample(null, { x: 15, y: 0, z: 9.81 }, 1100)
  assert.equal(
    detector.sample(null, { x: -15, y: 0, z: 9.81 }, 1200).shaking,
    true,
  )
})

test('completion is delivered by a new sample if the timer has not run', () => {
  const detector = new ShakeDetector()
  detector.sample(peak, null, 0)
  detector.sample({ x: -18, y: 0, z: 0 }, null, 100)
  assert.equal(detector.sample(still, null, 900).completedSeconds, 0.1)
  assert.equal(detector.expire(1000).completedSeconds, null)
})
