import { useState } from 'react'
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Search, History, User, LogOut, ChevronLeft,
  ChevronRight, Bell, Settings, Shield, Menu, X, ChevronDown, Users, BarChart3, ShieldCheck, ArrowRight, Key
} from 'lucide-react'
import { useAuth }  from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { motion, AnimatePresence } from 'motion/react'
import clsx from 'clsx'
import ConfirmModal from './ConfirmModal'

export default function Navbar() {
  const { user, logout } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isApp = location.pathname.startsWith('/app')

  const navItems = [
    { to: '/',               label: 'Home' },
    { to: '/app/dashboard',  label: 'Dashboard' },
    { to: '/app/detection',  label: 'Scan' },
    { to: '/app/history',    label: 'History' },
    { to: '/app/api-keys',   label: 'API Keys' },
  ]

  const adminNavItems = [
    { to: '/app/admin/users',    label: 'Users' },
    { to: '/app/admin/reports',  label: 'Reports' },
    { to: '/app/admin/settings', label: 'Settings' },
  ]

  const landingNavItems = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#about', label: 'About' },
    { href: '#contact', label: 'Contact' },
  ]

  const allNavItems = user?.role === 'admin' ? [...navItems, ...adminNavItems] : navItems

  const handleLogout = async () => {
    await logout()
    toast.info('You have been signed out successfully.')
    navigate('/')
  }

  const handleLandingNavClick = (sectionId) => {
    // If already on landing page, scroll to section
    if (location.pathname === '/') {
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // Navigate to landing and then scroll
      navigate('/')
      setTimeout(() => {
        const element = document.getElementById(sectionId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    }
  }

  return (
    <>
      <header className="sticky top-0 inset-x-0 h-14 sm:h-16 bg-white/80 backdrop-blur-xl border-b border-navy-100/60 flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-4 z-50 shadow-[0_1px_3px_rgba(13,27,62,0.05)]">
        {/* Hamburger (Mobile Only) */}
        <button onClick={() => setMobileMenuOpen(true)}
          className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-navy-50 flex items-center justify-center text-navy-500 hover:bg-navy-100 transition-all flex-shrink-0">
          <Menu size={18} className="sm:size-5" />
        </button>

        {/* Logo with Container */}
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 mr-2 sm:mr-4 flex-shrink-0 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white border border-navy-100/40 shadow-sm flex items-center justify-center group-hover:shadow-md transition-all overflow-hidden p-1.5">
            <img src="/logo.png" alt="ThreatGuardAI" className="w-full h-full object-contain" />
          </div>
          <p className="hidden sm:block text-navy-900 font-bold text-base sm:text-lg tracking-tight whitespace-nowrap">
            ThreatGuard<span className="text-brand-blue">AI</span>
          </p>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {user ? (
            allNavItems.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-1 px-2 lg:px-3 py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-navy-50 text-brand-blue'
                    : 'text-navy-500 hover:text-navy-900 hover:bg-navy-50/50'
                )}>
                <span>{label}</span>
              </NavLink>
            ))
          ) : (
            landingNavItems.map(({ href, label }) => (
              <button key={href} onClick={() => handleLandingNavClick(href.slice(1))}
                className="px-2 lg:px-4 py-2 text-xs lg:text-sm font-medium text-navy-600 hover:text-navy-900 hover:bg-navy-50 rounded-lg lg:rounded-xl transition-all whitespace-nowrap cursor-pointer">
                {label}
              </button>
            ))
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {user ? (
            <>
              <button className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-navy-50 flex items-center justify-center text-navy-500 hover:bg-navy-100 transition-all relative flex-shrink-0">
                <Bell size={16} className="sm:size-5" />
                <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-1.5 h-1.5 bg-brand-blue rounded-full" />
              </button>
              
              <div className="relative">
                <button onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 sm:gap-2.5 pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl hover:bg-navy-50 transition-all whitespace-nowrap">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white text-xs font-bold shadow-glow-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-navy-800 leading-none whitespace-nowrap">{user?.fullName}</p>
                    <p className="text-[10px] text-navy-400 mt-0.5 capitalize whitespace-nowrap">{user?.role}</p>
                  </div>
                  <ChevronDown size={12} className="text-navy-400 sm:size-3.5 hidden sm:block" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-card-lg border border-navy-100 z-20 py-2 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-navy-50">
                        <p className="text-sm font-semibold text-navy-800">{user?.fullName}</p>
                        <p className="text-xs text-navy-400">{user?.email}</p>
                      </div>
                      <NavLink to="/app/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-600 hover:bg-navy-50 transition-colors">
                        <Settings size={15} /> Settings
                      </NavLink>
                      <button onClick={() => {
                        setUserMenuOpen(false)
                        setShowLogoutConfirm(true)
                      }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full">
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/login" className="btn-ghost text-navy-700 text-xs sm:text-sm">Sign In</Link>
              <Link to="/register" className="btn-primary text-xs sm:text-sm">
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight size={14} className="sm:size-4" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <ConfirmModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        type="danger"
      />

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white z-[70] md:hidden shadow-2xl flex flex-col"
            >
              {/* Mobile Menu Header */}
              <div className="p-6 border-b border-navy-50 flex items-center justify-between">
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-navy-100/40 shadow-sm flex items-center justify-center overflow-hidden p-1">
                    <img src="/logo.png" alt="ThreatGuardAI" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-navy-900 font-bold text-sm">ThreatGuard<span className="text-brand-blue">AI</span></p>
                </Link>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-navy-50 rounded-lg text-navy-400">
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Menu Nav */}
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <p className="px-3 text-[10px] font-bold text-navy-400 uppercase tracking-wider mb-2">Main Navigation</p>
                {user ? (
                  allNavItems.map(({ to, label }) => (
                    <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all',
                        isActive
                          ? 'bg-navy-50 text-brand-blue'
                          : 'text-navy-600 hover:bg-navy-50/50'
                      )}>
                      <span>{label}</span>
                    </NavLink>
                  ))
                ) : (
                  landingNavItems.map(({ href, label }) => (
                    <button key={href} onClick={() => {
                      setMobileMenuOpen(false)
                      handleLandingNavClick(href.slice(1))
                    }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-navy-600 hover:bg-navy-50/50 transition-all w-full text-left cursor-pointer">
                      <span>{label}</span>
                    </button>
                  ))
                )}
              </nav>

              {/* Mobile Menu Footer */}
              <div className="p-4 border-t border-navy-50 bg-navy-50/30">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white text-sm font-bold shadow-glow-sm">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-navy-900 leading-none">{user?.fullName}</p>
                        <p className="text-[10px] text-navy-400 mt-1 capitalize">{user?.role}</p>
                      </div>
                    </div>
                    <button onClick={() => {
                      setMobileMenuOpen(false)
                      setShowLogoutConfirm(true)
                    }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all">
                      <LogOut size={18} />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-secondary w-full justify-center">Sign In</Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full justify-center">Get Started</Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
