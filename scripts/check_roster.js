
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

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

async function checkRoster() {
    console.log("--- Checking Roster ---");

    try {
        const rosterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'roster');
        const snap = await getDoc(rosterRef);

        if (snap.exists()) {
            const data = snap.data();
            const names = data.names || [];
            console.log(`Found ${names.length} names.`);
            console.log("Contains 'Ashley'?", names.includes("Ashley"));

            if (!names.includes("Ashley")) {
                console.log("Attempting to add 'Ashley'...");
                await updateDoc(rosterRef, {
                    names: arrayUnion("Ashley")
                });
                console.log("Update sent. Re-checking...");

                const snap2 = await getDoc(rosterRef);
                const names2 = snap2.data().names;
                console.log("Contains 'Ashley' now?", names2.includes("Ashley"));
            } else {
                console.log("Ashley is already in the roster.");
            }
        } else {
            console.log("Roster document does NOT exist!");
        }

    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

checkRoster();
