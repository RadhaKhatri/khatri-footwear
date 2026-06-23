import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, PackagePlus, Package, FileText,
  Receipt, BarChart3, Settings, LogOut, Menu, X, ChevronDown
} from 'lucide-react'

const NAV = [
  { section: 'Overview' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { section: 'Inventory' },
  { to: '/stock', icon: Package, label: 'Stock List' },
  { to: '/add-stock', icon: PackagePlus, label: 'Add Stock' },
  { to: '/vendor-bills', icon: FileText, label: 'Vendor Bills' },
  { section: 'Sales' },
  { to: '/billing', icon: Receipt, label: 'Billing' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { section: 'System' },
  { to: '/settings', icon: Settings, label: 'Shop Settings' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-blue-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-xl">👟</div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Khatri Footwear</div>
            <div className="text-blue-300 text-xs">Management System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} className="text-blue-400/70 text-[10px] font-bold uppercase tracking-widest px-3 pt-4 pb-1.5">
                {item.section}
              </div>
            )
          }
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-blue-200/80 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <Icon size={16} strokeWidth={isActiveCheck(item.to) ? 2.5 : 1.8} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-blue-800/60">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {(user?.username?.[0] || 'B').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.username || 'bhavarlal'}</div>
            <div className="text-blue-300/70 text-xs">Owner</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-blue-300/70 hover:text-white text-xs transition-colors w-full rounded-lg px-2 py-1.5 hover:bg-white/8"
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="w-56 bg-blue-900 flex-shrink-0 hidden lg:flex flex-col shadow-xl">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-60 bg-blue-900 flex flex-col shadow-2xl z-10">
            <button
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="text-sm font-semibold text-blue-900">Khatri Footwear</span>
              <span className="text-gray-300 mx-2 hidden sm:inline">|</span>
              <span className="text-xs text-gray-400 hidden sm:inline">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400 bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full font-medium hidden sm:block">
              ● Online
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Helper for stroke width in nav
function isActiveCheck(path) {
  return window.location.pathname === path || (path !== '/' && window.location.pathname.startsWith(path))
}
