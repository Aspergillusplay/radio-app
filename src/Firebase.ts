// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, FacebookAuthProvider, GoogleAuthProvider } from "firebase/auth";
import "firebase/compat/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_REACT_APP_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const fbAuthProvider = new FacebookAuthProvider();
export const auth = getAuth(app);
auth.languageCode = "en";
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
    return signInWithPopup(auth, provider);
};

export const signInWithFacebook = async () => {
    return signInWithPopup(auth, fbAuthProvider);
};