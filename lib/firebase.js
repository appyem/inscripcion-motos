// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_YH7qLf2ttDtlQQgtV51W9OWQJuhqHZI",
  authDomain: "inscripcion-motos.firebaseapp.com",
  projectId: "inscripcion-motos",
  storageBucket: "inscripcion-motos.firebasestorage.app",
  messagingSenderId: "473784911190",
  appId: "1:473784911190:web:cb34a7dc60510c479f02f7"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const db = getFirestore(app);