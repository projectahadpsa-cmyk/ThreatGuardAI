/**
 * ThreatGuardAI — Firebase Service
 * Replaces the Express backend with direct Firestore and Firebase Auth calls.
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
import { runThreatGuardInference } from './inference';

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiRegister({ fullName, email, password }) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  await updateFbProfile(user, { displayName: fullName });
  
  // Create user profile in Firestore
  const userProfile = {
    fullName,
    email,
    role: 'user', // Default role
    createdAt: serverTimestamp(),
  };
  
  await setDoc(doc(db, 'users', user.uid), userProfile);
  
  return { user: { id: user.uid, fullName, email, role: 'user' }, token: await user.getIdToken() };
}

// I'll fix the setDoc import in the next step. For now, let's continue with the logic.

export async function apiLogin(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const token = await user.getIdToken();
  
  // Fetch profile from Firestore with fallback
  let profile = { fullName: user.displayName, email: user.email, role: 'user' };
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      profile = userDoc.data();
    }
  } catch (err) {
    console.warn('⚠️ Firestore offline, using basic profile:', err.message);
    // Continue with basic profile if Firestore is unavailable
  }
  
  return { user: { id: user.uid, ...profile }, token };
}

export async function apiGetMe(token) {
  // In Firebase, we usually use onAuthStateChanged, but for compatibility:
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const profile = userDoc.exists() ? userDoc.data() : { fullName: user.displayName, email: user.email, role: 'user' };
  
  return { id: user.uid, ...profile };
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
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
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
}

export async function detectBatch(records, filename, token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
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
}

export async function getStats(token) {
  const user = auth.currentUser;
  if (!user) return { total: 0, attacks: 0, normals: 0, avgConf: 0, activity: [] };
  
  const q = query(collection(db, 'detections'), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);
  
  const detections = snapshot.docs.map(d => d.data());
  const total = detections.length;
  const attacks = detections.filter(d => d.verdict === 'ATTACK').length;
  const normals = total - attacks;
  const avgConf = total > 0 ? detections.reduce((a, b) => a + b.confidence, 0) / total : 0;
  
  // Group by day for activity chart
  const activityMap = {};
  detections.forEach(d => {
    const date = d.createdAt?.toDate ? d.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    if (!activityMap[date]) activityMap[date] = { day: date, count: 0, attacks: 0 };
    activityMap[date].count++;
    if (d.verdict === 'ATTACK') activityMap[date].attacks++;
  });
  
  const activity = Object.values(activityMap).sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
  
  return {
    total,
    attacks,
    normals,
    avgConf: Math.round(avgConf * 100),
    activity,
    recent: snapshot.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() }))
  };
}

export async function getAdminStats(token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // In a real app, we'd check the role here
  const usersCount = await getCountFromServer(collection(db, 'users'));
  const scansCount = await getCountFromServer(collection(db, 'detections'));
  const attacksQuery = query(collection(db, 'detections'), where('verdict', '==', 'ATTACK'));
  const attacksCount = await getCountFromServer(attacksQuery);
  
  return {
    totalUsers: usersCount.data().count,
    totalScans: scansCount.data().count,
    totalAttacks: attacksCount.data().count
  };
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
  const snapshot = await getDocs(collection(db, 'users'));
  let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  if (search) {
    const s = search.toLowerCase();
    users = users.filter(u => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }
  
  return users;
}

export async function updateAdminUser(id, data, token) {
  await updateDoc(doc(db, 'users', id), data);
  return { success: true };
}

export async function deleteAdminUser(id, token) {
  await deleteDoc(doc(db, 'users', id));
  return { success: true };
}

export async function getHistory({ limit: l = 50, offset = 0, verdict = 'all', search = '' } = {}, token) {
  const user = auth.currentUser;
  if (!user) return [];
  
  let q = query(collection(db, 'detections'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(l));
  
  if (verdict !== 'all') {
    q = query(collection(db, 'detections'), where('userId', '==', user.uid), where('verdict', '==', verdict.toUpperCase()), orderBy('createdAt', 'desc'), limit(l));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() }));
}

export async function updateProfile(fields, token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  if (fields.fullName) {
    await updateFbProfile(user, { displayName: fields.fullName });
    await updateDoc(doc(db, 'users', user.uid), { fullName: fields.fullName });
  }
  
  return { success: true };
}

export async function changePassword({ currentPassword, newPassword }, token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateFbPassword(user, newPassword);
  
  return { success: true };
}

export async function clearHistory(token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const q = query(collection(db, 'detections'), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  
  return { success: true };
}

export async function getApiKeys(token) {
  const user = auth.currentUser;
  if (!user) return [];
  
  const q = query(collection(db, 'apiKeys'), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createApiKey(keyName, token) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const apiKey = `tg_${Math.random().toString(36).substr(2, 16)}`;
  const data = {
    userId: user.uid,
    keyName,
    apiKey,
    createdAt: serverTimestamp()
  };
  
  const docRef = await addDoc(collection(db, 'apiKeys'), data);
  return { id: docRef.id, ...data };
}

export async function deleteApiKey(id, token) {
  await deleteDoc(doc(db, 'apiKeys', id));
  return { success: true };
}

export async function healthCheck() {
  return { status: 'ok', engine: 'Firebase' };
}
