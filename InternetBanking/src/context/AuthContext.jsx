import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null)
  const [menuRights, setMenuRights] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ib_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => localStorage.removeItem('ib_token'))
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('ib_token', data.token)
    setUser(data.user)
    setMenuRights(data.menuRights || [])
    return data
  }

  function logout() {
    localStorage.removeItem('ib_token')
    setUser(null)
    setMenuRights([])
  }

  function canView(menuKey) {
    if (!user) return false
    if (user.userRole === 'OWNER') return true
    return menuRights.some(m => m.menuKey === menuKey && m.canView)
  }

  function canAct(menuKey) {
    if (!user) return false
    if (user.viewOnly) return false
    if (user.userRole === 'OWNER') return true
    return menuRights.some(m => m.menuKey === menuKey && m.canAct)
  }

  return (
    <AuthCtx.Provider value={{ user, menuRights, loading, login, logout, canView, canAct }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
