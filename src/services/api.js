/**
 * ThreatGuardAI — Firebase Service
 * Replaces the Express backend with direct Firestore and Firebase Auth calls.
 * Includes comprehensive error handling with user-friendly messages.
 */
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getCountFromServer,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile as updateFbProfile,
  updatePassword as updateFbPassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { getErrorMessage, successMessages } from './errorMessages';
import { runThreatGuardInference } from './inference';

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiRegister({ fullName, email, password }) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateFbProfile(user, { displayName: fullName });
    
    const token = await user.getIdToken();
    
    // Create user profile in Firestore (non-blocking - fire and forget with error logging)
    const userProfile = {
      fullName,
      email,
      role: 'user',
      createdAt: serverTimestamp(),
    };
    
    setDoc(doc(db, 'users', user.uid), userProfile).catch(err => {
      console.warn('⚠️ Could not save user profile to Firestore:', err.message);
      // Don't throw - user is still authenticated
    });
    
    return { user: { id: user.uid, fullName, email, role: 'user' }, token };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function apiLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    // Fetch profile from Firestore with immediate timeout fallback
    let profile = { fullName: user.displayName, email: user.email, role: 'user' };
    
    // Use Promise.race to fallback after 3 seconds if Firestore is slow
    try {
      const firestorePromise = getDoc(doc(db, 'users', user.uid));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore timeout')), 3000)
      );
      
      const userDoc = await Promise.race([firestorePromise, timeoutPromise]);
      if (userDoc.exists()) {
        profile = userDoc.data();
      }
    } catch (err) {
      console.warn('⚠️ Firestore unavailable, using basic profile:', err.message);
      // Continue with basic profile if Firestore is unavailable or times out
    }
    
    return { user: { id: user.uid, ...profile }, token };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function apiGetMe(token) {
  try {
    // In Firebase, we usually use onAuthStateChanged, but for compatibility:
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to continue.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const profile = userDoc.exists() ? userDoc.data() : { fullName: user.displayName, email: user.email, role: 'user' };
    
    return { id: user.uid, ...profile };
  } catch (error) {
    if (error.title) throw error; // Already a formatted error
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

// ── Seeding ──────────────────────────────────────────────────────────────────

export async function seedDefaultUsers() {
  try {
    const defaults = [
      { fullName: 'System Administrator', email: 'admin@threatguard.ai', password: 'Admin@123', role: 'admin' },
      { fullName: 'Standard User', email: 'user@threatguard.ai', password: 'User@123', role: 'user' }
    ];

    for (const u of defaults) {
      try {
        // Check if user exists in Firestore
        const q = query(collection(db, 'users'), where('email', '==', u.email));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          console.log(`Seeding default user: ${u.email}`);
          const userCredential = await createUserWithEmailAndPassword(auth, u.email, u.password);
          const user = userCredential.user;
          
          await updateFbProfile(user, { displayName: u.fullName });
          
          const userProfile = {
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            createdAt: serverTimestamp(),
          };
          
          await setDoc(doc(db, 'users', user.uid), userProfile);
          console.log(`Successfully seeded: ${u.email}`);
        }
      } catch (err) {
        // Ignore if user already exists in Auth but not Firestore (unlikely) or other errors
        if (err.code !== 'auth/email-already-in-use') {
          console.warn(`Note: Default user ${u.email} not available:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('Seeding process encountered an issue:', err.message);
    // Don't throw - allow app to continue
  }
}

// ── Detection ─────────────────────────────────────────────────────────────────

export async function detectSingle(features, token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to run a detection scan.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    const result = await runThreatGuardInference(features);
    
    const detectionData = {
      userId: user.uid,
      inputMode: 'manual',
      verdict: result.verdict,
      confidence: result.confidence,
      features,
      topFeaturesJson: JSON.stringify(result.topFeatures),
      engine: result.engine,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'detections'), detectionData);
    const saved = { id: docRef.id, ...detectionData, timestamp: new Date().toISOString() };
    
    return { ...result, detection: saved };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function detectBatch(records, filename, token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to run a detection scan.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    const results = await Promise.all(records.map(r => runThreatGuardInference(r)));
    const attackCount = results.filter(r => r.verdict === 'ATTACK').length;
    const avgConf = results.reduce((a, b) => a + b.confidence, 0) / results.length;
    
    const summary = {
      total: records.length,
      attack_count: attackCount,
      normal_count: records.length - attackCount,
      summary_verdict: attackCount > 0 ? 'ATTACK' : 'NORMAL',
      confidence: avgConf,
      results
    };

    const detectionData = {
      userId: user.uid,
      inputMode: 'csv',
      verdict: summary.summary_verdict,
      confidence: summary.confidence,
      filename,
      totalRecords: summary.total,
      attackCount: summary.attack_count,
      normalCount: summary.normal_count,
      topFeaturesJson: JSON.stringify(results[0]?.topFeatures || []),
      engine: results[0]?.engine || 'Heuristic',
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'detections'), detectionData);
    const saved = { id: docRef.id, ...detectionData, timestamp: new Date().toISOString() };
    
    return { ...summary, detection: saved };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function getStats(token) {
  try {
    const user = auth.currentUser;
    if (!user) return { total: 0, attacks: 0, normals: 0, avgConf: 0, activity: [], recent: [] };
    
    const q = query(collection(db, 'detections'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    
    const detections = snapshot.docs.map(d => d.data());
    const total = detections.length;
    const attacks = detections.filter(d => d.verdict === 'ATTACK').length;
    const normals = total - attacks;
    const totalConfidence = detections.reduce((sum, d) => sum + (d.confidence || 0), 0);
    const avgConf = total > 0 ? totalConfidence / total : 0;
    
    // Group by day for activity chart
    const activityMap = {};
    detections.forEach(d => {
      try {
        const date = d.createdAt?.toDate 
          ? d.createdAt.toDate().toISOString().split('T')[0] 
          : d.createdAt instanceof Date 
          ? d.createdAt.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        if (!activityMap[date]) activityMap[date] = { day: date, count: 0, attacks: 0 };
        activityMap[date].count++;
        if (d.verdict === 'ATTACK') activityMap[date].attacks++;
      } catch (err) {
        console.warn('Date conversion error:', err);
      }
    });
    
    const activity = Object.values(activityMap)
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-7);
    
    const recent = snapshot.docs.slice(0, 5).map(doc => {
      try {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate 
          ? data.createdAt.toDate().toISOString()
          : data.createdAt instanceof Date
          ? data.createdAt.toISOString()
          : new Date().toISOString();
        return { id: doc.id, ...data, createdAt };
      } catch (err) {
        console.warn('Recent data transformation error:', err);
        return { id: doc.id, ...doc.data() };
      }
    });
    
    return {
      total,
      attacks,
      normals,
      avgConf: Math.round(avgConf * 100),
      activity,
      recent
    };
  } catch (err) {
    console.error('Error fetching stats:', err);
    return { total: 0, attacks: 0, normals: 0, avgConf: 0, activity: [], recent: [] };
  }
}

export async function getAdminStats(token) {
  const user = auth.currentUser;
  if (!user) return { total_users: 0, total_scans: 0, total_attacks: 0, roles: [], user_activity: [] };
  
  try {
    // Get counts with proper error handling
    let total_users = 0, total_scans = 0, total_attacks = 0;
    
    try {
      const usersCount = await getCountFromServer(collection(db, 'users'));
      total_users = usersCount.data()?.count || 0;
    } catch (err) {
      console.warn('Error counting users:', err);
      total_users = 0;
    }
    
    try {
      const scansCount = await getCountFromServer(collection(db, 'detections'));
      total_scans = scansCount.data()?.count || 0;
    } catch (err) {
      console.warn('Error counting scans:', err);
      total_scans = 0;
    }
    
    try {
      const attacksQuery = query(collection(db, 'detections'), where('verdict', '==', 'ATTACK'));
      const attacksCount = await getCountFromServer(attacksQuery);
      total_attacks = attacksCount.data()?.count || 0;
    } catch (err) {
      console.warn('Error counting attacks:', err);
      total_attacks = 0;
    }
    
    // Get users with role distribution
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const roleMap = {};
    const userActivityMap = {};
    
    usersSnapshot.docs.forEach(doc => {
      try {
        const data = doc.data();
        const role = data.role || 'user';
        roleMap[role] = (roleMap[role] || 0) + 1;
        
        // Track user registrations by day
        if (data.createdAt) {
          const createdDate = data.createdAt?.toDate 
            ? data.createdAt.toDate().toISOString().split('T')[0]
            : data.createdAt instanceof Date
            ? data.createdAt.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          userActivityMap[createdDate] = (userActivityMap[createdDate] || 0) + 1;
        }
      } catch (err) {
        console.warn('Error processing user data:', err);
      }
    });
    
    // Convert to arrays sorted
    const roles = Object.entries(roleMap).map(([role, count]) => ({ role, count }));
    const user_activity = Object.entries(userActivityMap)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 7)
      .reverse();
    
    return {
      total_users,
      total_scans,
      total_attacks,
      roles: roles || [],
      user_activity: user_activity || []
    };
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return {
      total_users: 0,
      total_scans: 0,
      total_attacks: 0,
      roles: [],
      user_activity: []
    };
  }
}

export async function getAdminReportsSummary(token) {
  const usersCount = await getCountFromServer(collection(db, 'users'));
  const scansCount = await getCountFromServer(collection(db, 'detections'));
  const attacksQuery = query(collection(db, 'detections'), where('verdict', '==', 'ATTACK'));
  const attacksCount = await getCountFromServer(attacksQuery);
  
  // Get attacks by mode
  const detectionsSnapshot = await getDocs(collection(db, 'detections'));
  const modeMap = {};
  detectionsSnapshot.docs.forEach(d => {
    const data = d.data();
    if (data.verdict === 'ATTACK') {
      const mode = data.inputMode || 'manual';
      modeMap[mode] = (modeMap[mode] || 0) + 1;
    }
  });
  
  const attacks_by_mode = Object.entries(modeMap).map(([inputMode, val]) => ({ inputMode, val }));
  
  // Get top users
  const userMap = {};
  detectionsSnapshot.docs.forEach(d => {
    const data = d.data();
    userMap[data.userId] = (userMap[data.userId] || 0) + 1;
  });
  
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const top_users = usersSnapshot.docs.map(d => ({
    fullName: d.data().fullName,
    scanCount: userMap[d.id] || 0
  })).sort((a, b) => b.scanCount - a.scanCount).slice(0, 5);

  return {
    total_users: [{ val: usersCount.data().count }],
    total_scans: [{ val: scansCount.data().count }],
    total_attacks: [{ val: attacksCount.data().count }],
    attacks_by_mode,
    top_users
  };
}

export async function getAdminDetections({ limit: l = 50 } = {}, token) {
  const q = query(collection(db, 'detections'), orderBy('createdAt', 'desc'), limit(l));
  const snapshot = await getDocs(q);
  
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const userLookup = {};
  usersSnapshot.docs.forEach(d => {
    userLookup[d.id] = d.data();
  });

  const rows = snapshot.docs.map(d => {
    const data = d.data();
    const user = userLookup[data.userId] || {};
    return {
      id: d.id,
      ...data,
      userName: user.fullName || 'Unknown',
      userEmail: user.email || 'Unknown',
      createdAt: data.createdAt?.toDate?.()?.toISOString()
    };
  });

  return { rows };
}

export async function getAdminLogs(l = 100, token) {
  // We don't have a logs collection yet, let's return empty for now
  // or we could use a 'logs' collection if we implement it.
  return [];
}

export async function getAdminUsers(search, token) {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }
    
    return users;
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function updateAdminUser(id, data, token) {
  try {
    await updateDoc(doc(db, 'users', id), data);
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    if (error.code === 'not-found') {
      const err = new Error('The user could not be found. They may have been deleted.');
      err.title = 'User Not Found';
      throw err;
    }
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function deleteAdminUser(id, token) {
  try {
    // Delete user from Firestore
    await deleteDoc(doc(db, 'users', id));
    
    // Also delete their detections
    const detectionsQuery = query(collection(db, 'detections'), where('userId', '==', id));
    const snapshot = await getDocs(detectionsQuery);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    if (error.code === 'not-found') {
      const err = new Error('The user could not be found. They may have already been deleted.');
      err.title = 'User Not Found';
      throw err;
    }
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function getHistory({ limit: l = 50, offset = 0, verdict = 'all', search = '' } = {}, token) {
  try {
    const user = auth.currentUser;
    if (!user) return [];
    
    let q = query(collection(db, 'detections'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(l));
    
    if (verdict !== 'all') {
      q = query(collection(db, 'detections'), where('userId', '==', user.uid), where('verdict', '==', verdict.toUpperCase()), orderBy('createdAt', 'desc'), limit(l));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() }));
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function updateProfile(fields, token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to perform this action.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    if (fields.fullName) {
      await updateFbProfile(user, { displayName: fields.fullName });
      await updateDoc(doc(db, 'users', user.uid), { fullName: fields.fullName });
    }
    
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function changePassword({ currentPassword, newPassword }, token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to perform this action.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        const error = new Error('Your current password is incorrect. Please try again.');
        error.title = 'Invalid Password';
        throw error;
      }
      throw err;
    }
    
    await updateFbPassword(user, newPassword);
    
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function clearHistory(token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to perform this action.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    const q = query(collection(db, 'detections'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function getApiKeys(token) {
  try {
    const user = auth.currentUser;
    if (!user) return [];
    
    const q = query(collection(db, 'apiKeys'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return [];
  }
}

export async function createApiKey(keyName, token) {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error('Please sign in to create an API key.');
      err.title = 'Authentication Required';
      throw err;
    }
    
    const apiKey = `tg_${Math.random().toString(36).substr(2, 16)}`;
    const data = {
      userId: user.uid,
      keyName,
      apiKey,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'apiKeys'), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    if (error.title) throw error;
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function deleteApiKey(id, token) {
  try {
    await deleteDoc(doc(db, 'apiKeys', id));
    return { success: true };
  } catch (error) {
    if (error.title) throw error;
    if (error.code === 'not-found') {
      const err = new Error('The API key could not be found. It may have already been deleted.');
      err.title = 'Not Found';
      throw err;
    }
    const errorMsg = getErrorMessage(error);
    const err = new Error(errorMsg.message);
    err.title = errorMsg.title;
    throw err;
  }
}

export async function healthCheck() {
  return { status: 'ok', engine: 'Firebase' };
}
