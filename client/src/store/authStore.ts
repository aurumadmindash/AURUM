import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Remove credentials retained by older builds; users sign in again in this tab.
try { localStorage.removeItem('aurum-auth') } catch { /* Storage may be blocked. */ }

export function tokenExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch { return false } // The server remains responsible for validating tokens.
}

interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'COMMERCIAL_MANAGER' | 'VIEWER'
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => {
        set({ user: null, token: null })
        useAuthStore.persist?.clearStorage()
      },
    }),
    {
      name: 'aurum-auth',
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AuthState> | undefined
        if (saved?.token && tokenExpired(saved.token)) {
          sessionStorage.removeItem('aurum-auth')
          return current
        }
        return { ...current, ...saved }
      },
    },
  ),
)
