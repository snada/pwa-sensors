import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BlowDetector, audioFeatures } from '../lib/blow-detector'

export const Route = createFileRoute('/page-2')({ component: BlowPage })

function BlowPage() {
  const [blowing, setBlowing] = useState(false)
  const [blows, setBlows] = useState<Array<{ id: number; seconds: number }>>([])
  const [status, setStatus] = useState('Checking microphone access…')
  const [action, setAction] = useState<'resume' | 'request' | 'retry' | null>(
    null,
  )
  const [attempt, setAttempt] = useState(0)
  const resumeAudio = useRef<(() => void) | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (
      !window.isSecureContext ||
      typeof navigator.mediaDevices === 'undefined' ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof AudioContext === 'undefined'
    ) {
      setStatus(
        !window.isSecureContext
          ? 'Open this page over HTTPS to use the microphone.'
          : 'This browser does not support microphone analysis.',
      )
      return
    }
    let disposed = false
    const isDisposed = () => disposed
    let released = false
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let frame = 0
    let detector = new BlowDetector()
    let lastFrame = -Infinity
    setAction(null)
    setBlowing(false)
    setStatus('Checking microphone access…')

    const release = () => {
      if (released) return
      released = true
      resumeAudio.current = null
      if (context) context.onstatechange = null
      cancelAnimationFrame(frame)
      source?.disconnect()
      analyser?.disconnect()
      stream?.getTracks().forEach((track) => track.stop())
      if (context && context.state !== 'closed')
        void context.close().catch(() => {})
    }
    const fail = (message: string) => {
      if (disposed || released) return
      release()
      setBlowing(false)
      setStatus(message)
      setAction('retry')
    }
    const checkState = () => {
      if (disposed || released || !context) return
      if (context.state === 'running') {
        setAction(null)
        setStatus('Ready. Blow gently toward your phone’s microphone.')
      } else if (context.state !== 'closed') {
        detector = new BlowDetector()
        setBlowing(false)
        setAction('resume')
        setStatus('Tap to enable microphone analysis in this browser.')
      }
    }
    const onVisibility = () => {
      detector = new BlowDetector()
      setBlowing(false)
      if (!document.hidden) checkState()
    }
    document.addEventListener('visibilitychange', onVisibility)

    async function connect() {
      try {
        // Opening a page must never repeatedly trigger a permission prompt.
        // Only reuse an existing grant automatically; new grants need a tap.
        let permission: PermissionState | null = null
        try {
          const result = await navigator.permissions.query({
            name: 'microphone',
          })
          permission = result.state
        } catch {
          // Some browsers cannot query microphone permissions.
        }
        if (isDisposed()) return
        if (permission === 'denied') {
          setStatus(
            'Microphone access is blocked. In Chrome, open Settings → Site settings → Microphone, select this site and allow access. Also check Android Settings → Apps → Chrome → Permissions → Microphone. Then return here and check again.',
          )
          setAction('retry')
          return
        }
        if (permission !== 'granted' && attempt === 0) {
          setStatus('Allow microphone access to detect blows.')
          setAction('request')
          return
        }
        setStatus('Waiting for microphone permission…')
        const acquired = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
          video: false,
        })
        if (isDisposed()) {
          acquired.getTracks().forEach((track) => track.stop())
          return
        }
        stream = acquired
        context = new AudioContext()
        analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.2
        source = context.createMediaStreamSource(stream)
        source.connect(analyser)
        // No connection to the destination: never play the microphone aloud.
        const wave = new Float32Array(analyser.fftSize)
        const spectrum = new Float32Array(analyser.frequencyBinCount)
        for (const track of stream.getAudioTracks()) {
          track.addEventListener('ended', () =>
            fail('Microphone disconnected. Reconnect it and try again.'),
          )
        }
        context.onstatechange = checkState
        resumeAudio.current = () => {
          if (!context || disposed || released) return
          void context
            .resume()
            .then(checkState)
            .catch(() =>
              fail('Could not resume microphone analysis. Try again.'),
            )
        }
        checkState()
        const tick = (now: number) => {
          if (disposed || released) return
          if (
            !document.hidden &&
            context?.state === 'running' &&
            analyser &&
            now - lastFrame >= 30
          ) {
            lastFrame = now
            analyser.getFloatTimeDomainData(wave)
            analyser.getFloatFrequencyData(spectrum)
            const result = detector.sample(
              audioFeatures(
                wave,
                spectrum,
                context.sampleRate,
                analyser.fftSize,
              ),
              now,
            )
            setBlowing(result.blowing)
            if (result.completedSeconds !== null) {
              const blow = {
                id: ++nextId.current,
                seconds: result.completedSeconds,
              }
              setBlows((previous) => [blow, ...previous])
            }
          }
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        fail(
          name === 'NotAllowedError'
            ? 'Microphone access was not allowed. Chrome may not show another prompt: open Chrome Settings → Site settings → Microphone and allow this site. Also check Android’s microphone permission for Chrome, then check again.'
            : name === 'NotFoundError'
              ? 'No microphone found. Connect one and retry.'
              : 'Could not open the microphone. Check that it is available and try again.',
        )
      }
    }
    void connect()
    return () => {
      disposed = true
      resumeAudio.current = null
      document.removeEventListener('visibilitychange', onVisibility)
      if (context) context.onstatechange = null
      release()
    }
  }, [attempt])

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        to="/"
        className="inline-flex rounded-lg px-3 py-3 text-teal-300 hover:bg-slate-800"
      >
        ← Back
      </Link>
      <h1
        className={`mt-10 text-center text-6xl font-black tracking-tighter transition-colors sm:text-8xl ${blowing ? 'text-teal-300' : 'text-slate-100'}`}
      >
        {blowing ? 'BLOWING!' : 'BLOW!'}
      </h1>
      <p role="status" className="mt-5 text-center text-slate-400">
        {status}
      </p>
      {action && (
        <button
          className="mx-auto mt-5 block rounded-xl bg-teal-300 px-6 py-4 font-semibold text-slate-900"
          onClick={() =>
            action === 'resume'
              ? resumeAudio.current?.()
              : setAttempt((value) => value + 1)
          }
        >
          {action === 'resume'
            ? 'Enable microphone analysis'
            : action === 'request'
              ? 'Allow microphone access'
              : 'Check microphone permission'}
        </button>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        Try a quiet room. Audio is analyzed on this device and is never recorded
        or uploaded.
      </p>
      <section className="mt-12" aria-labelledby="blows-title">
        <h2 id="blows-title" className="text-xl font-semibold">
          Blows <span className="text-slate-400">({blows.length})</span>
        </h2>
        {blows.length === 0 ? (
          <p className="mt-4 text-slate-400">
            Completed blows and their durations will appear here.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {blows.map((blow) => (
              <li
                key={blow.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-5"
              >
                <span className="font-semibold">Blow {blow.id}</span>
                <span className="text-right font-mono text-sm text-teal-300">
                  {blow.seconds.toFixed(2)} seconds
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
