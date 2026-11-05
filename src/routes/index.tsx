import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'

export const Route = createFileRoute('/')({ component: Home })

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const installationKey = 'pwa-sensors:installed'

function remembersInstallation() {
  try {
    return localStorage.getItem(installationKey) === 'true'
  } catch {
    return false
  }
}

function rememberInstallation(installed: boolean) {
  try {
    if (installed) localStorage.setItem(installationKey, 'true')
    else localStorage.removeItem(installationKey)
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}

function Home() {
  const [online, setOnline] = useState(navigator.onLine)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)
  const [installed, setInstalled] = useState(remembersInstallation)
  const [installing, setInstalling] = useState(false)
  const instructions = useRef<HTMLDialogElement>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const connection = () => setOnline(navigator.onLine)
    const markInstalled = () => {
      rememberInstallation(true)
      setInstalled(true)
    }
    if (isStandalone()) markInstalled()
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      // A fresh install offer supersedes a remembered installation (e.g. after uninstall).
      rememberInstallation(false)
      setInstalled(false)
      setInstall(event as InstallEvent)
    }
    const onInstalled = () => {
      markInstalled()
      setInstall(null)
      instructions.current?.close()
    }
    const onDisplayMode = () => {
      const standaloneNow = isStandalone()
      setStandalone(standaloneNow)
      if (standaloneNow) markInstalled()
    }
    displayMode.addEventListener('change', onDisplayMode)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      displayMode.removeEventListener('change', onDisplayMode)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (!install) {
      instructions.current?.showModal()
      return
    }
    setInstalling(true)
    setInstall(null)
    try {
      await install.prompt()
      await install.userChoice
    } catch {
      instructions.current?.showModal()
    } finally {
      setInstalling(false)
    }
  }

  if (!standalone && installed) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md text-center" role="status">
          <h1 className="text-3xl font-bold">You’re all set!</h1>
          <p className="mt-4 text-lg text-slate-300">
            Find PWA Sensors in your app list or on your home screen and open it
            to get started.
          </p>
        </div>
      </main>
    )
  }

  if (!standalone) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <button
          className="w-full max-w-md rounded-3xl bg-teal-300 px-10 py-10 text-3xl font-bold text-slate-900 transition hover:bg-teal-200 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-teal-300 disabled:opacity-60"
          onClick={installApp}
          disabled={installing}
        >
          {installing ? 'Installing…' : 'Install app'}
        </button>
        <dialog
          ref={instructions}
          aria-labelledby="install-title"
          className="m-auto max-w-md rounded-2xl bg-slate-800 p-6 text-slate-100 backdrop:bg-slate-950/80"
        >
          <h1 id="install-title" className="text-xl font-semibold">
            Install PWA Sensors
          </h1>
          <p className="mt-4 text-slate-300">
            Use your browser’s Install app or Add to Home Screen option. On
            iPhone or iPad, open Safari’s Share menu and choose Add to Home
            Screen. If already installed, open the app from your home screen.
          </p>
          <form method="dialog" className="mt-6">
            <button className="rounded-lg bg-teal-300 px-5 py-3 font-semibold text-slate-900">
              Got it
            </button>
          </form>
        </dialog>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div
        role="status"
        className="flex items-center gap-3 rounded-2xl border border-slate-700 p-5"
      >
        <span
          aria-hidden="true"
          className={`h-3 w-3 rounded-full ${online ? 'bg-teal-300' : 'bg-amber-300'}`}
        />
        <span>Connection: {online ? 'Online' : 'Offline'}</span>
      </div>
      <nav aria-label="Pages" className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/page-1"
          className="rounded-2xl bg-slate-800 p-6 text-xl font-semibold transition hover:bg-slate-700"
        >
          Shake detector →
        </Link>
        <Link
          to="/page-2"
          className="rounded-2xl bg-slate-800 p-6 text-xl font-semibold transition hover:bg-slate-700"
        >
          Blow detector →
        </Link>
      </nav>
      {needRefresh && (
        <button
          className="mt-6 rounded-lg bg-teal-300 px-5 py-3 font-semibold text-slate-900"
          onClick={() => void updateServiceWorker(true)}
        >
          Reload to update
        </button>
      )}
    </main>
  )
}
