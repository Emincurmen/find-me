import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDf_xJEGJ1GYBFuzcD1JetzwheHGcloVRw",
  authDomain: "find-me-a7913.firebaseapp.com",
  projectId: "find-me-a7913",
  storageBucket: "find-me-a7913.firebasestorage.app",
  messagingSenderId: "91331934075",
  appId: "1:91331934075:web:9749a52c2585931bd5efde",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };

// Auth'u tamamen kaldırdık — Firestore open rules ile çalışıyoruz
// Tek kullanıcı uygulaması için Anonymous Auth gereksiz

// --- Logging ---
export const logEventToAdmin = async (tourId: string, eventType: string, details: string) => {
  try {
    const logRef = doc(collection(db, 'logs'));
    await setDoc(logRef, {
      tourId,
      eventType,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log event:", error);
  }
};

// --- Progress: Konum sadece gerçek değer geldiğinde yazılır ---
export const updateTourProgress = async (
  tourId: string,
  stage: string,
  stopIndex: number,
  location: { lat: number; lng: number } | null
) => {
  try {
    const tourRef = doc(db, 'tours', tourId);
    const updateData: Record<string, any> = {
      stage,
      stopIndex,
      lastUpdated: serverTimestamp(),
    };
    if (location !== null) {
      updateData.lastLocation = location;
    }
    await setDoc(tourRef, updateData, { merge: true });
  } catch (err) {
    console.error("Failed to update progress", err);
  }
};

export const getTourProgress = async (tourId: string) => {
  try {
    const tourRef = doc(db, 'tours', tourId);
    const snap = await getDoc(tourRef);
    if (snap.exists()) {
      return snap.data() as { stage: string; stopIndex: number; lastLocation: any };
    }
    return null;
  } catch (err) {
    console.error("Failed to get progress", err);
    return null;
  }
};

export const resetTour = async (tourId: string) => {
  try {
    await deleteDoc(doc(db, 'tours', tourId));
  } catch (err) {
    console.error("Failed to reset tour", err);
  }
};
