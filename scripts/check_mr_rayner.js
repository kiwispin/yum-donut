
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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

async function checkMrRayner() {
    console.log("Checking Mr Rayner's transactions...");

    try {
        const transactionsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions');
        const q = query(
            transactionsRef,
            where("toName", "==", "Mr Rayner")
        );

        const snapshot = await getDocs(q);
        const transactions = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Include ALL transactions to see context, but flag Claw ones
            if (data.message && data.message.includes("Claw Machine")) {
                transactions.push({
                    time: data.timestamp?.toDate(),
                    timeString: data.timestamp?.toDate().toLocaleString(),
                    message: data.message,
                    amount: data.amount,
                    isClaw: true
                });
            } else {
                transactions.push({
                    time: data.timestamp?.toDate(),
                    timeString: data.timestamp?.toDate().toLocaleString(),
                    message: data.message,
                    amount: data.amount,
                    isClaw: false
                });
            }
        });

        // Sort desc
        transactions.sort((a, b) => b.time - a.time);

        console.log(`\nFound ${transactions.length} total transactions for Mr Rayner.`);

        const clawWins = transactions.filter(t => t.isClaw);
        console.log(`Found ${clawWins.length} Claw Machine wins.`);

        console.log("\nRecent 10 Transactions:");
        transactions.slice(0, 10).forEach(t => {
            const prefix = t.isClaw ? "Make -> [CLAW WIN] " : "      ";
            console.log(`${prefix}[${t.timeString}] ${t.message} (+${t.amount})`);
        });

    } catch (error) {
        console.error("Error checking:", error);
    }
    process.exit(0);
}

checkMrRayner();
