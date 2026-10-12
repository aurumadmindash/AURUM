import { create } from 'zustand'

const KEY = 'aurum-media-preference'
const DURATION = 180 * 24 * 60 * 60 * 1000
function storedChoice() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const choice = JSON.parse(raw)
    if (choice.version === 1 && typeof choice.enabled === 'boolean' && Number.isFinite(choice.expiresAt) && choice.expiresAt > Date.now()) return choice.enabled
    localStorage.removeItem(KEY)
  } catch { /* When storage is unavailable, external video stays disabled. */ }
  return false
}
export const useMediaConsentStore = create<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>((set) => ({
  enabled: storedChoice(),
  setEnabled: enabled => {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, enabled, expiresAt: Date.now() + DURATION })) } catch { /* The choice still applies to this visit. */ }
    set({ enabled })
  },
}))
