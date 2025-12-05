
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

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

async function auditTobin() {
    console.log("Auditing Tobin's transactions...");

    try {
        const transactionsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions');
        // Query for Tobin's transactions
        // Query for Tobin's transactions (Client-side sort to avoid index requirement)
        const q = query(
            transactionsRef,
            where("toName", "==", "Tobin")
        );

        const snapshot = await getDocs(q);

        let totalDonuts = 0;
        let clawMachineWins = 0;
        let transactions = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Check if it's a Claw Machine win (based on message content or logic)
            // Previous messages were "Won a ... playing the Claw Machine!"
            // New messages are "Won a ... playing the Claw Machine!" (with gameName param)

            if (data.message && data.message.includes("Claw Machine")) {
                const amount = data.amount || 0;
                totalDonuts += amount;
                clawMachineWins++;

                transactions.push({
                    time: data.timestamp?.toDate(), // Keep as Date object for sorting
                    timeString: data.timestamp?.toDate().toLocaleString(),
                    message: data.message,
                    amount: amount
                });
            }
        });

        // Sort in memory
        transactions.sort((a, b) => b.time - a.time);

        console.log(`\nFound ${clawMachineWins} Claw Machine wins for Tobin.`);
        console.log(`Total Donuts Won: ${totalDonuts}`);
        console.log("\nRecent Transactions:");
        transactions.slice(0, 10).forEach(t => {
            console.log(`[${t.timeString}] ${t.message} (+${t.amount})`);
        });

    } catch (error) {
        console.error("Error auditing:", error);
    }
    process.exit(0);
}

auditTobin();
