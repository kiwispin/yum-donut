
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

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

async function checkAmeliaDetailed() {
    console.log("--- Checking Amelia (Detailed) ---");

    try {
        // 1. Check Current Balances (Wallet & Bank)
        console.log("Fetching profile...");
        const publicUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', 'Amelia');
        const publicSnap = await getDoc(publicUserRef);

        if (publicSnap.exists()) {
            const data = publicSnap.data();
            console.log("\nCurrent Status:");
            console.log(`- Wallet Balance: ${data.balance}`);
            console.log(`- Bank Balance:   ${data.bank_balance || 0}`);
            console.log(`- Lifetime Given: ${data.lifetime_given}`);
            console.log(`- Lifetime Recv:  ${data.lifetime_received}`);
        } else {
            console.log("User 'Amelia' not found in public data!");
        }

        // 2. Audit Transactions
        console.log("\nFetching transactions...");
        const transactionsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions');

        // Check latest system activity
        console.log("Checking latest system activity...");
        const qLatest = query(transactionsRef, orderBy('timestamp', 'desc'), limit(5));
        const snapLatest = await getDocs(qLatest);
        snapLatest.forEach(d => {
            console.log(`LATEST: ${d.data().timestamp?.toDate().toLocaleString()} | ${d.data().fromName} -> ${d.data().toName} | ${d.data().message}`);
        });

        const qFrom = query(transactionsRef, where("fromName", "==", "Amelia"));
        const snapFrom = await getDocs(qFrom);

        // TO Amelia
        const qTo = query(transactionsRef, where("toName", "==", "Amelia"));
        const snapTo = await getDocs(qTo);

        let history = [];

        snapFrom.forEach(d => {
            const t = d.data();
            history.push({
                type: 'OUT',
                timestamp: t.timestamp?.toDate(),
                dateStr: t.timestamp?.toDate().toLocaleString(),
                from: t.fromName,
                to: t.toName,
                msg: t.message,
                amount: t.amount || 0
            });
        });

        snapTo.forEach(d => {
            // Avoid duplicates if self-transaction (unlikely but possible)
            if (d.data().fromName === "Amelia") return;
            const t = d.data();
            history.push({
                type: 'IN',
                timestamp: t.timestamp?.toDate(),
                dateStr: t.timestamp?.toDate().toLocaleString(),
                from: t.fromName,
                to: t.toName,
                msg: t.message,
                amount: t.amount || 0
            });
        });

        history.sort((a, b) => b.timestamp - a.timestamp);

        console.log(`\nTransaction History (${history.length} items):`);
        let calculatedGiven = 0;
        let goalContributions = 0;

        console.log(`\nTransaction History (${history.length} items):`);
        history.forEach(t => {
            const arrow = t.type === 'IN' ? '⬅️  IN ' : '➡️  OUT';
            let walletImpact = "   ";
            if (t.type === 'IN') {
                walletImpact = "+ " + t.amount;
            }
            if (t.type === 'OUT') {
                if (t.to === "The Shop") {
                    walletImpact = "- " + t.amount; // Purchase
                } else if (t.to.includes("Goal") || t.msg.includes("Contributed")) {
                    walletImpact = "- " + t.amount; // Goal Contribution
                    calculatedGiven += t.amount;
                    goalContributions += t.amount;
                    t.isGoal = true;
                } else {
                    walletImpact = "(0)"; // Gift (free)
                    // Regular gifts count towards lifetime_given
                    calculatedGiven += t.amount;
                }
            }

            // Only log last 20 or if it's a goal transaction
            if (history.indexOf(t) < 20 || t.isGoal) {
                console.log(`${t.dateStr} | ${arrow} | ${walletImpact.padStart(3)} | To: ${(t.to || "Unknown").padEnd(15)} | ${t.msg} ${t.isGoal ? '(GOAL)' : ''}`);
            }
        });

        console.log("\n--- Audit Results ---");
        console.log(`Measured Goal Contributions: ${goalContributions}`);
        console.log(`Calculated Lifetime Given (Gifts + Goal): ${calculatedGiven}`);

        if (publicSnap.exists()) {
            console.log(`Actual Lifetime Given (In DB):        ${publicSnap.data().lifetime_given}`);
        }

    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

checkAmeliaDetailed();
