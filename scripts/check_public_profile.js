
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAnjuK_F8ZO3WqTfCEeXEF5J84CG8Irjq4",
    authDomain: "yum-donut-school.firebaseapp.com",
    projectId: "yum-donut-school",
    storageBucket: "yum-donut-school.firebasestorage.app",
    messagingSenderId: "910400935670",
    appId: "1:910400935670:web:8f196e7da498d67ca17ed7"
};

const APP_ID = 'yum-donut-school';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkProfile() {
    const publicTobinRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', 'Tobin');
    const snap = await getDoc(publicTobinRef);

    if (snap.exists()) {
        console.log("Keys in Tobin's public profile:", Object.keys(snap.data()));
        console.log("Full Data:", JSON.stringify(snap.data(), null, 2));
    } else {
        console.log("Profile not found.");
    }
    process.exit(0);
}

checkProfile();
