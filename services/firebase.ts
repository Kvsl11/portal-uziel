
import { initializeApp, getApps, deleteApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  increment, 
  getDoc, 
  serverTimestamp, 
  addDoc, 
  updateDoc, 
  limit,
  getDocs,
  where
} from "firebase/firestore";
import { APP_ID } from "../constants";

// --- DEFAULT CONFIGURATION EXPORT ---
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyASN-L5S6-KexN4OtKUOUrGDU1JaMuVsMY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "portal-uziel-295cb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "portal-uziel-295cb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "portal-uziel-295cb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "98540572300",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:98540572300:web:1277c0ed3a69442d8975a9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-1RTQ4KYFTE"
};

// --- DYNAMIC CONFIGURATION LOADER ---
const loadFirebaseConfig = () => {
    try {
        const stored = localStorage.getItem('uziel_custom_firebase_config');
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn("Invalid custom Firebase config found, reverting to default.");
    }
    
    return DEFAULT_FIREBASE_CONFIG;
};

const firebaseConfig = loadFirebaseConfig();

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true
});

export const auth = getAuth(app);

const getColRef = (collName: string) => collection(db, `artifacts/${APP_ID}/public/data/${collName}`);
const getDocRef = (collName: string, id: string) => doc(db, `artifacts/${APP_ID}/public/data/${collName}`, id);

export const AuthService = {
  login: async (email: string, pass: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return userCredential.user;
    } catch (error: any) {
      console.error("Erro no login:", error.code);
      throw error;
    }
  },
  logout: async () => {
    await signOut(auth);
  },
  updateCurrentUserPassword: async (currentPassword: string, newPassword: string) => {
      if (auth.currentUser && auth.currentUser.email) {
          try {
              await updatePassword(auth.currentUser, newPassword);
          } catch (error: any) {
              if (error.code === 'auth/requires-recent-login') {
                  try {
                      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
                      await reauthenticateWithCredential(auth.currentUser, credential);
                      await updatePassword(auth.currentUser, newPassword);
                  } catch (reauthError: any) {
                      throw reauthError;
                  }
              } else {
                  throw error;
              }
          }
      }
  },
  updateOtherUserPassword: async (email: string, oldPassword: string, newPassword: string) => {
      let secondaryApp: FirebaseApp | null = null;
      try {
          const appName = "SecondaryAppForPasswordUpdate";
          secondaryApp = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
          const secondaryAuth = getAuth(secondaryApp);
          
          // Sign in as the target user using their old password
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, oldPassword);
          
          if (userCredential.user) {
              // Update their password
              await updatePassword(userCredential.user, newPassword);
          }
          
          await signOut(secondaryAuth);
      } catch (error: any) {
          console.error("Error updating other user's password:", error);
          throw error;
      } finally {
          if (secondaryApp) await deleteApp(secondaryApp);
      }
  },
  createAccount: async (email: string, pass: string) => {
    let secondaryApp: FirebaseApp | null = null;
    try {
      const appName = "SecondaryAppForUserCreation";
      secondaryApp = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await signOut(secondaryAuth);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') return; 
      throw error;
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  }
};

export const UserService = {
  subscribe: (callback: (users: any[]) => void) => {
    const q = query(getColRef('users'));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), username: doc.id }));
      callback(users);
    }, (error) => {
      callback([]); 
    });
  },
  saveUser: async (user: any) => {
    const docId = user.username.toLowerCase().trim();
    await setDoc(getDocRef('users', docId), { ...user, username: docId }, { merge: true });
  },
  updateVoicePreference: async (username: string, voice: string) => {
      try {
          await updateDoc(getDocRef('users', username.toLowerCase().trim()), { voicePreference: voice });
      } catch (e) {}
  },
  deleteUser: async (username: string) => {
    await deleteDoc(getDocRef('users', username.toLowerCase().trim()));
  }
};

export const MemberService = {
  subscribe: (callback: (members: any[]) => void) => {
    const q = query(getColRef('members'));
    return onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(members);
    });
  },
  syncLocalUsers: async (users: any[]) => {
    const validMembers = users.filter(u => u.role === 'member' || u.role === 'admin' || u.role === 'super-admin');
    const batch = writeBatch(db);
    validMembers.forEach((u: any) => {
        batch.set(getDocRef('members', u.username.toLowerCase().trim()), { id: u.username.toLowerCase().trim(), name: u.name }, { merge: true });
    });
    try { await batch.commit(); } catch (e) {}
  },
  delete: async (id: string) => {
      await deleteDoc(getDocRef('members', id.toLowerCase().trim()));
  },
  updatePoints: async (memberId: string, pointsDelta: number) => {
      await updateDoc(getDocRef('members', memberId.toLowerCase().trim()), { totalPoints: increment(pointsDelta) });
  }
};

export const AttendanceService = {
    subscribe: (callback: (records: any[]) => void) => {
        const q = query(getColRef('attendance'), orderBy('createdAt', 'desc')); 
        return onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(records);
        });
    },
    getSettings: async () => {
        const snap = await getDoc(getDocRef('settings', 'attendance_rules'));
        return snap.exists() ? snap.data() : { pointsMissa: 5, pointsEnsaio: 4, pointsEvento: 10, pointsJustifiedAbsence: 0, pointsUnjustifiedAbsence: 0 };
    },
    saveSettings: async (settings: any) => {
        await setDoc(getDocRef('settings', 'attendance_rules'), settings, { merge: true });
    },
    register: async (id: string, memberId: string, memberName: string, eventType: string, date: string, status: string, justification: string, points: number, eventId?: string) => {
        const batch = writeBatch(db);
        const data: any = { id, memberId: memberId.toLowerCase().trim(), memberName, eventType, date, status, justification, points, createdAt: new Date().toISOString() };
        if (eventId) data.eventId = eventId;
        
        batch.set(getDocRef('attendance', id), data);
        batch.update(getDocRef('members', memberId.toLowerCase().trim()), { totalPoints: increment(points) });
        await batch.commit();
    },
    updateBatch: async (updates: { recordId: string, memberId: string, newData: any, pointsDelta: number }[]) => {
        const batch = writeBatch(db);
        updates.forEach(u => {
            batch.update(getDocRef('attendance', u.recordId), u.newData);
            if (u.pointsDelta !== 0) batch.update(getDocRef('members', u.memberId.toLowerCase().trim()), { totalPoints: increment(u.pointsDelta) });
        });
        await batch.commit();
    },
    delete: async (recordId: string, memberId: string, pointsToRevert: number) => {
        const batch = writeBatch(db);
        batch.delete(getDocRef('attendance', recordId));
        if (pointsToRevert !== 0) batch.update(getDocRef('members', memberId.toLowerCase().trim()), { totalPoints: increment(-pointsToRevert) });
        await batch.commit();
    },
    deleteBatch: async (items: {id: string, memberId: string, points: number}[]) => {
        const batchSize = 200;
        for (let i = 0; i < items.length; i += batchSize) {
            const chunk = items.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                batch.delete(getDocRef('attendance', item.id)); 
                if (item.points !== 0) batch.update(getDocRef('members', item.memberId.toLowerCase().trim()), { totalPoints: increment(-item.points) });
            });
            await batch.commit();
        }
    }
};

export const RepertoryService = {
    subscribe: (callback: (data: any[]) => void) => {
        const q = query(getColRef('repertory'), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    save: async (data: any, id?: string) => {
        const docId = id || Date.now().toString();
        await setDoc(getDocRef('repertory', docId), { ...data, id: docId }, { merge: true });
    },
    delete: async (id: string) => {
        await deleteDoc(getDocRef('repertory', id));
    }
};

export const PlaylistService = {
    subscribe: (callback: (data: any[]) => void) => {
        const q = query(getColRef('playlists'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    add: async (url: string, addedBy: string, title?: string, image?: string) => {
        const id = Date.now().toString();
        await setDoc(getDocRef('playlists', id), { id, url, addedBy, title, image, createdAt: new Date().toISOString() });
    },
    delete: async (id: string) => {
        await deleteDoc(getDocRef('playlists', id));
    }
};

export const RehearsalService = {
    subscribe: (callback: (data: any[]) => void) => {
        const q = query(getColRef('rehearsals'), orderBy('date', 'asc')); 
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    save: async (data: any, id?: string) => {
        const docId = id || Date.now().toString();
        await setDoc(getDocRef('rehearsals', docId), { ...data, id: docId, createdAt: serverTimestamp() }, { merge: true });
    },
    delete: async (id: string) => {
        await deleteDoc(getDocRef('rehearsals', id));
    }
};

export const ScheduleService = {
    get: async () => {
        const snap = await getDoc(getDocRef('schedules', 'current_rota'));
        return snap.exists() ? snap.data().items || [] : null;
    },
    save: async (scheduleItems: any[]) => {
        await setDoc(getDocRef('schedules', 'current_rota'), { items: scheduleItems, updatedAt: serverTimestamp() });
    }
};

export const JustificationService = {
    subscribe: (callback: (data: any[]) => void) => {
        const q = query(getColRef('justifications'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    submit: async (data: any, id?: string) => {
        const docId = id || Date.now().toString();
        await setDoc(getDocRef('justifications', docId), { ...data, id: docId, status: data.status || 'PENDING', createdAt: data.createdAt || new Date().toISOString() }, { merge: true });
    },
    review: async (id: string, status: 'ACCEPTED' | 'REJECTED', notes?: string) => {
        await updateDoc(getDocRef('justifications', id), { status, adminNotes: notes });
    },
    delete: async (id: string) => {
        await deleteDoc(getDocRef('justifications', id));
    }
};

export const PollService = {
    subscribe: (callback: (data: any[]) => void) => {
        const q = query(getColRef('polls'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    create: async (data: any) => {
        const docId = Date.now().toString();
        await setDoc(getDocRef('polls', docId), { ...data, id: docId, createdAt: serverTimestamp(), status: 'OPEN', votes: [] });
    },
    vote: async (pollId: string, userId: string, userName: string, optionIndex: number) => {
        const pollRef = getDocRef('polls', pollId);
        const pollSnap = await getDoc(pollRef);
        if (pollSnap.exists()) {
            const currentVotes = pollSnap.data().votes || [];
            if (currentVotes.some((v: any) => v.userId === userId)) throw new Error("Você já votou nesta enquete.");
            await updateDoc(pollRef, { votes: [...currentVotes, { userId, userName, optionIndex, timestamp: new Date().toISOString() }] });
        }
    },
    close: async (pollId: string) => {
        const pollRef = getDocRef('polls', pollId);
        await updateDoc(pollRef, { status: 'CLOSED' });
    }
};

export const ChatService = {
    saveHistory: async (userId: string, messages: any[]) => {
        await setDoc(getDocRef('chat_histories', userId.toLowerCase().trim()), { messages, updatedAt: serverTimestamp() }, { merge: true });
    },
    getHistory: async (userId: string) => {
        const docSnap = await getDoc(getDocRef('chat_histories', userId.toLowerCase().trim()));
        return docSnap.exists() ? docSnap.data().messages || [] : [];
    },
    clearHistory: async (userId: string) => {
        await deleteDoc(getDocRef('chat_histories', userId.toLowerCase().trim()));
    }
};

export const AuditService = {
    log: async (user: string, module: string, action: string, details: string, role?: string, userName?: string) => {
        try {
            await setDoc(doc(getColRef('audit_logs')), { user, userName: userName || user, role: role || 'unknown', module, action, details, userAgent: navigator.userAgent, timestamp: serverTimestamp() });
        } catch (e) {}
    },
    subscribe: (callback: (logs: any[]) => void) => {
        const q = query(getColRef('audit_logs'), orderBy('timestamp', 'desc'), limit(300));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date() })));
        });
    },
    deleteLog: async (id: string) => {
        await deleteDoc(getDocRef('audit_logs', id));
    },
    clearAllLogs: async () => {
        const snapshot = await getDocs(getColRef('audit_logs'));
        const batchSize = 500;
        let batch = writeBatch(db);
        let count = 0;
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= batchSize) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
        if (count > 0) await batch.commit();
    }
};

export const DailyImageService = {
    // Robust find: Look for ANY active image for this context/date regardless of generated ID
    findActiveImage: async (context: string, date: string) => {
        const q = query(
            getColRef('daily_images'), 
            where('context', '==', context),
            where('date', '==', date),
            where('isActive', '==', true),
            limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            return snap.docs[0].data() as { imageUrl: string, date: string, createdAt: any, context?: string, isActive?: boolean };
        }
        return null;
    },
    getImage: async (id: string) => {
        const snap = await getDoc(getDocRef('daily_images', id));
        return snap.exists() ? snap.data() as { imageUrl: string, date: string, createdAt: any, context?: string, isActive?: boolean } : null;
    },
    saveImage: async (id: string, imageUrl: string, date: string, context?: string) => {
        // First deactivate any existing image for this slot to ensure uniqueness
        if (context) {
            const q = query(getColRef('daily_images'), where('context', '==', context), where('isActive', '==', true));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.update(d.ref, { isActive: false }));
            batch.set(getDocRef('daily_images', id), { id, imageUrl, date, context, createdAt: serverTimestamp(), isActive: true });
            await batch.commit();
        } else {
            await setDoc(getDocRef('daily_images', id), { id, imageUrl, date, context, createdAt: serverTimestamp(), isActive: true });
        }
    },
    deleteImages: async (ids: string[]) => {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(getDocRef('daily_images', id)));
        await batch.commit();
    },
    setActive: async (id: string, context: string) => {
        const q = query(getColRef('daily_images'), where('context', '==', context), where('isActive', '==', true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.update(d.ref, { isActive: false }));
        batch.update(getDocRef('daily_images', id), { isActive: true, context: context });
        await batch.commit();
    }
};

export const LiturgyCacheService = {
    get: async (dateStr: string) => {
        const docRef = getDocRef('liturgy_cache', `liturgy_${dateStr}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.expiresAt && data.expiresAt > Date.now()) return data.content;
            await deleteDoc(docRef);
        }
        return null;
    },
    getMonthlyKeys: async (year: number, month: number): Promise<string[]> => {
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
        const q = query(getColRef('liturgy_cache'), where('date', '>=', startStr), where('date', '<=', endStr));
        const snapshot = await getDocs(q);
        const validDates: string[] = [];
        const now = Date.now();
        snapshot.forEach(doc => {
            const data = doc.data();
            if ((!data.expiresAt || data.expiresAt > now) && data.date) validDates.push(data.date);
        });
        return validDates;
    },
    save: async (dateStr: string, content: any) => {
        await setDoc(getDocRef('liturgy_cache', `liturgy_${dateStr}`), { date: dateStr, content: content, createdAt: Date.now(), expiresAt: Date.now() + (48 * 60 * 60 * 1000) });
    },
    delete: async (dateStr: string) => {
        await deleteDoc(getDocRef('liturgy_cache', `liturgy_${dateStr}`));
    }
};

export const SystemAdminService = {
    getCollectionPreview: async (collName: string, limitCount = 3) => {
        const q = query(getColRef(collName), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    getFullCollectionData: async (collName: string) => {
        const q = query(getColRef(collName));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
};
