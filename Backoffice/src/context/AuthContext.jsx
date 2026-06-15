import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null)
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('bo_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(r => { setUser(r.data); })
      .catch(() => { localStorage.removeItem('bo_token') })
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('bo_token', data.token)
    setUser(data.user)
    setMenus(data.menus || [])
    return data
  }

  function logout() {
    localStorage.removeItem('bo_token')
    setUser(null)
    setMenus([])
  }

  return (
    <AuthCtx.Provider value={{ user, menus, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
