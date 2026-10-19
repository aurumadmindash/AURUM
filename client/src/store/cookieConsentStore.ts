import { create } from 'zustand'

const KEY = 'aurum-cookie-preference'
const DURATION = 180 * 24 * 60 * 60 * 1000
function storedChoice() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const choice = JSON.parse(raw)
    if (choice.version === 1 && typeof choice.enabled === 'boolean' && Number.isFinite(choice.expiresAt) && choice.expiresAt > Date.now()) return choice.enabled
    localStorage.removeItem(KEY)
  } catch { /* When storage is unavailable, the choice applies only to this visit. */ }
  return null
}
try { localStorage.removeItem('aurum-media-preference') } catch { /* Storage may be unavailable. */ }
const initialChoice = storedChoice()
export const useCookieConsentStore = create<{
  enabled: boolean; hasChoice: boolean; settingsOpen: boolean
  setEnabled: (enabled: boolean) => void; openSettings: () => void; closeSettings: () => void
}>((set) => ({
  enabled: initialChoice === true,
  hasChoice: initialChoice !== null,
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setEnabled: enabled => {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, enabled, expiresAt: Date.now() + DURATION })) } catch { /* The choice still applies to this visit. */ }
    set({ enabled, hasChoice: true, settingsOpen: false })
  },
}))
window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) {
    const choice = storedChoice()
    useCookieConsentStore.setState({ enabled: choice === true, hasChoice: choice !== null })
  }
})
