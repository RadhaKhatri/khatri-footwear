import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('kf_token')
    if (token) {
      api.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('kf_token'))
        .finally(() => setLoading(false))
    } else {
      // Check if setup is needed
      api.get('/api/auth/setup-status')
        .then(r => setSetupRequired(r.data.setupRequired))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [])

  const login = async (username, password) => {
    const r = await api.post('/api/auth/login', { username, password })
    localStorage.setItem('kf_token', r.data.token)
    setUser(r.data.user)
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('kf_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, setSetupRequired, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
