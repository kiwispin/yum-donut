
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

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

// Set to true to actually sync wallets, false for dry run (audit only)
const SYNC_MODE = process.argv.includes('--sync');

async function syncWallets() {
    console.log("===========================================");
    console.log(` WALLET SYNC AUDIT ${SYNC_MODE ? '(SYNC MODE)' : '(DRY RUN)'}`);
    console.log("===========================================\n");

    if (!SYNC_MODE) {
        console.log("ℹ️  Running in DRY RUN mode. Add --sync flag to actually sync wallets.\n");
    }

    try {
        // 1. Get all users from public data
        const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
        const usersSnap = await getDocs(usersRef);

        const discrepancies = [];
        let totalUsers = 0;
        let claimedUsers = 0;
        let matchedUsers = 0;

        console.log("Checking all users...\n");

        for (const userDoc of usersSnap.docs) {
            const publicData = userDoc.data();
            const name = publicData.name || userDoc.id;
            const publicBalance = publicData.balance || 0;
            const uid = publicData.uid;
            const claimed = publicData.claimed;

            totalUsers++;

            if (!uid || !claimed) {
                // User hasn't claimed their account, skip
                continue;
            }

            claimedUsers++;

            // Get private profile
            const privateRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data');
            const privateSnap = await getDoc(privateRef);

            if (!privateSnap.exists()) {
                console.log(`⚠️  ${name}: Private profile missing!`);
                discrepancies.push({
                    name,
                    uid,
                    publicBalance,
                    privateBalance: null,
                    issue: 'MISSING_PRIVATE'
                });
                continue;
            }

            const privateData = privateSnap.data();
            const privateBalance = privateData.balance || 0;

            if (publicBalance !== privateBalance) {
                const diff = publicBalance - privateBalance;
                console.log(`❌ ${name}: PUBLIC=${publicBalance}, PRIVATE=${privateBalance} (diff: ${diff > 0 ? '+' : ''}${diff})`);
                discrepancies.push({
                    name,
                    uid,
                    publicBalance,
                    privateBalance,
                    diff,
                    issue: 'MISMATCH'
                });

                // Sync if in sync mode
                if (SYNC_MODE) {
                    try {
                        await updateDoc(privateRef, { balance: publicBalance });
                        console.log(`   ✅ SYNCED: Private balance updated to ${publicBalance}`);
                    } catch (e) {
                        console.log(`   ❌ SYNC FAILED: ${e.message}`);
                    }
                }
            } else {
                matchedUsers++;
            }
        }

        // Summary
        console.log("\n===========================================");
        console.log("                  SUMMARY");
        console.log("===========================================");
        console.log(`Total Users:      ${totalUsers}`);
        console.log(`Claimed Users:    ${claimedUsers}`);
        console.log(`Matched:          ${matchedUsers} ✅`);
        console.log(`Discrepancies:    ${discrepancies.length} ${discrepancies.length > 0 ? '⚠️' : ''}`);

        if (discrepancies.length > 0) {
            console.log("\n--- Discrepancies Found ---");
            discrepancies.forEach(d => {
                if (d.issue === 'MISSING_PRIVATE') {
                    console.log(`• ${d.name}: Private profile missing (public balance: ${d.publicBalance})`);
                } else {
                    console.log(`• ${d.name}: PUBLIC=${d.publicBalance}, PRIVATE=${d.privateBalance} (diff: ${d.diff > 0 ? '+' : ''}${d.diff})`);
                }
            });

            if (!SYNC_MODE) {
                console.log("\n💡 To sync these wallets, run: node scripts/sync_wallets.js --sync");
            } else {
                console.log("\n✅ All discrepancies have been synced!");
            }
        } else {
            console.log("\n✅ All wallets are in sync!");
        }

    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

syncWallets();
