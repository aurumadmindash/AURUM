import axios from 'axios'
import { tokenExpired, useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token && tokenExpired(token)) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    return Promise.reject(new Error('Your session has expired. Please sign in again.'))
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Tear down the session only when an authenticated request is rejected
    // (expired token). A 401 from the sign-in form itself just means wrong
    // credentials — redirecting there would reload the page and wipe the
    // error message the form is about to show.
    if (
      err.response?.status === 401 &&
      useAuthStore.getState().token &&
      !String(err.config?.url ?? '').includes('/auth/login')
    ) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api
