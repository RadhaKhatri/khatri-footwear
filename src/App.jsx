import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import AddStock from './pages/AddStock'
import StockList from './pages/StockList'
import VendorBills from './pages/VendorBills'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import ShopSettings from './pages/ShopSettings'
import VendorPurchases from './pages/VendorPurchases'
import Loader from './components/Loader'

function ProtectedRoute({ children }) {
  const { user, loading, setupRequired } = useAuth()
  if (loading) return <Loader />
  if (setupRequired) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading, setupRequired } = useAuth()
  if (loading) return <Loader />
  return (
    <Routes>
      <Route path="/setup" element={setupRequired ? <Setup /> : <Navigate to="/" replace />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="add-stock" element={<AddStock />} />
        <Route path="stock" element={<StockList />} />
        <Route path="vendor-bills" element={<VendorBills />} />
        <Route path="billing" element={<Billing />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<ShopSettings />} />
        <Route path="vendor-purchases" element={<VendorPurchases />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
