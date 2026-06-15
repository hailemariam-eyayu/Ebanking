import axios from 'axios'

const api = axios.create({ baseURL: '/api/ib' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('ib_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ib_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
