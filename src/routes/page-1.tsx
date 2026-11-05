import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ShakeDetector } from '../lib/shake-detector'
import type { ShakeResult, Vector } from '../lib/shake-detector'

export const Route = createFileRoute('/page-1')({ component: ShakePage })

type MotionAPI = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function vector(value: DeviceMotionEventAcceleration | null): Vector | null {
  if (!value) return null
  const { x, y, z } = value
  return typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof z === 'number' &&
    Number.isFinite(z)
    ? { x, y, z }
    : null
}

function ShakePage() {
  const [shaking, setShaking] = useState(false)
  const [shakes, setShakes] = useState<Array<{ id: number; seconds: number }>>(
    [],
  )
  const [status, setStatus] = useState('Connecting to motion sensors…')
  const [needsPermission, setNeedsPermission] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const mounted = useRef(false)
  const nextId = useRef(0)

  useEffect(() => {
    mounted.current = true
    if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
      setStatus(
        !window.isSecureContext
          ? 'Open this page over HTTPS to detect shakes.'
          : 'This browser does not support motion sensors.',
      )
      return () => {
        mounted.current = false
      }
    }

    let detector = new ShakeDetector()
    let received = false
    let disposed = false
    const noData = window.setTimeout(() => {
      if (!received)
        setStatus(
          'No motion data received. Check browser permissions or try a phone with motion sensors.',
        )
    }, 5000)
    const applyResult = (result: ShakeResult) => {
      setShaking(result.shaking)
      if (result.completedSeconds !== null) {
        const shake = { id: ++nextId.current, seconds: result.completedSeconds }
        setShakes((previous) => [shake, ...previous])
      }
    }
    const onMotion = (event: DeviceMotionEvent) => {
      if (document.hidden) return
      const linear = vector(event.acceleration)
      const raw = vector(event.accelerationIncludingGravity)
      if (!linear && !raw) return
      if (!received) {
        received = true
        window.clearTimeout(noData)
        setNeedsPermission(false)
        setStatus('Ready. Give your phone a shake.')
      }
      applyResult(detector.sample(linear, raw, performance.now()))
    }
    const onVisibility = () => {
      detector = new ShakeDetector()
      setShaking(false)
    }
    window.addEventListener('devicemotion', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    const settling = window.setInterval(() => {
      applyResult(detector.expire(performance.now()))
    }, 100)

    // Existing grants can work automatically; a first-time grant may need a tap.
    const api = DeviceMotionEvent as MotionAPI
    if (api.requestPermission) {
      void api
        .requestPermission()
        .then((permission) => {
          if (disposed || received) return
          setNeedsPermission(true)
          setStatus(
            permission === 'denied'
              ? 'Motion access is blocked. Allow it in browser settings, then retry.'
              : 'Waiting for motion data…',
          )
          if (permission === 'granted') setNeedsPermission(false)
        })
        .catch(() => {
          if (disposed || received) return
          setNeedsPermission(true)
          setStatus('Your browser requires a tap to allow motion access.')
        })
    }

    return () => {
      disposed = true
      mounted.current = false
      window.clearTimeout(noData)
      window.clearInterval(settling)
      window.removeEventListener('devicemotion', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function allowMotion() {
    setRequesting(true)
    try {
      const permission = await (
        DeviceMotionEvent as MotionAPI
      ).requestPermission?.()
      if (!mounted.current) return
      setNeedsPermission(permission !== 'granted')
      setStatus(
        permission === 'granted'
          ? 'Ready. Give your phone a shake.'
          : 'Motion access is blocked. Allow it in browser settings, then retry.',
      )
    } catch {
      if (mounted.current)
        setStatus(
          'Could not access motion sensors. Check browser permissions and try again.',
        )
    } finally {
      if (mounted.current) setRequesting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        to="/"
        className="inline-flex rounded-lg px-3 py-3 text-teal-300 hover:bg-slate-800"
      >
        ← Back
      </Link>
      <h1
        className={`mt-10 text-center text-6xl font-black tracking-tighter transition-colors sm:text-8xl ${shaking ? 'text-teal-300' : 'text-slate-100'}`}
      >
        {shaking ? 'SHAKING!' : 'SHAKE!'}
      </h1>
      <p role="status" className="mt-5 text-center text-slate-400">
        {status}
      </p>
      {needsPermission && (
        <button
          className="mx-auto mt-5 block rounded-xl bg-teal-300 px-6 py-4 font-semibold text-slate-900 disabled:opacity-50"
          disabled={requesting}
          onClick={allowMotion}
        >
          {requesting ? 'Requesting permission…' : 'Allow motion access'}
        </button>
      )}
      <section className="mt-12" aria-labelledby="shakes-title">
        <h2 id="shakes-title" className="text-xl font-semibold">
          Shakes <span className="text-slate-400">({shakes.length})</span>
        </h2>
        {shakes.length === 0 ? (
          <p className="mt-4 text-slate-400">
            Completed shakes and their durations will appear here.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {shakes.map((shake) => (
              <li
                key={shake.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-5"
              >
                <span className="font-semibold">Shake {shake.id}</span>
                <span className="text-right font-mono text-sm text-teal-300">
                  {shake.seconds.toFixed(2)} seconds
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
