
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
const CHARLOTTE_UID = 'E30uiPBMlJSRuFyATLVafXWfZ9s1';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkBothProfiles() {
    console.log("--- Comparing Charlotte's PUBLIC vs PRIVATE profiles ---\n");

    // Public profile
    const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', 'Charlotte');
    const publicSnap = await getDoc(publicRef);

    // Private profile
    const privateRef = doc(db, 'artifacts', APP_ID, 'users', CHARLOTTE_UID, 'profile', 'data');
    const privateSnap = await getDoc(privateRef);

    if (publicSnap.exists()) {
        const pub = publicSnap.data();
        console.log("PUBLIC PROFILE:");
        console.log("- balance:", pub.balance);
        console.log("- bank_balance:", pub.bank_balance);
        console.log("- lifetime_received:", pub.lifetime_received);
    } else {
        console.log("PUBLIC profile NOT FOUND!");
    }

    console.log("");

    if (privateSnap.exists()) {
        const priv = privateSnap.data();
        console.log("PRIVATE PROFILE:");
        console.log("- balance:", priv.balance);
        console.log("- bank_balance:", priv.bank_balance);
        console.log("- name:", priv.name);
    } else {
        console.log("PRIVATE profile NOT FOUND!");
    }

    // Compare
    if (publicSnap.exists() && privateSnap.exists()) {
        const pub = publicSnap.data();
        const priv = privateSnap.data();
        console.log("\n--- SYNC CHECK ---");
        console.log("Balance match?", pub.balance === priv.balance, `(public: ${pub.balance}, private: ${priv.balance})`);
    }

    process.exit(0);
}

checkBothProfiles();
