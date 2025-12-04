import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCCnUYQOQug0OfyIW2mHoEzKM4nAMe8CN4",
    authDomain: "plastimarket2025.firebaseapp.com",
    projectId: "plastimarket2025",
    storageBucket: "plastimarket2025.firebasestorage.app",
    messagingSenderId: "948721167454",
    appId: "1:948721167454:web:b150ab2d840498f17158cf",
    measurementId: "G-WLW6K05BY5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };
