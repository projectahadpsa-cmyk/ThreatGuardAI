import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { apiLogin, apiRegister } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          let profile = { fullName: fbUser.displayName, email: fbUser.email, role: 'user' };
          try {
            const firestorePromise = getDoc(doc(db, 'users', fbUser.uid));
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Firestore timeout')), 3000)
            );
            
            const userDoc = await Promise.race([firestorePromise, timeoutPromise]);
            if (userDoc.exists()) {
              profile = userDoc.data();
            }
          } catch (err) {
            console.warn('⚠️ Firestore offline, using basic profile:', err.message);
            // Continue with basic profile if Firestore is unavailable
          }
          
          const t = await fbUser.getIdToken();
          setUser({ id: fbUser.uid, ...profile });
          setToken(t);
        } catch (error) {
          console.error('Error in auth state change:', error);
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [])

  const login = useCallback(async (email, password) => {
    const { user: u, token: t } = await apiLogin(email, password)
    setUser(u)
    setToken(t)
    return u
  }, [])

  const register = useCallback(async ({ fullName, email, password }) => {
    const { user: u, token: t } = await apiRegister({ fullName, email, password })
    setUser(u)
    setToken(t)
    return u
  }, [])

  const logout = useCallback(async () => {
    await auth.signOut()
    setUser(null)
    setToken(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return
    try {
      const firestorePromise = getDoc(doc(db, 'users', auth.currentUser.uid))
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore timeout')), 3000)
      )
      
      const userDoc = await Promise.race([firestorePromise, timeoutPromise])
      if (userDoc.exists()) {
        setUser({ id: auth.currentUser.uid, ...userDoc.data() })
      }
    } catch (err) {
      console.warn('⚠️ Could not refresh user profile:', err.message)
      // Continue with existing user data if Firestore is unavailable
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
