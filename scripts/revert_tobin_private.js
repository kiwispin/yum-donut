
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAnjuK_F8ZO3WqTfCEeXEF5J84CG8Irjq4",
    authDomain: "yum-donut-school.firebaseapp.com",
    projectId: "yum-donut-school",
    storageBucket: "yum-donut-school.firebasestorage.app",
    messagingSenderId: "910400935670",
    appId: "1:910400935670:web:8f196e7da498d67ca17ed7"
};

const APP_ID = 'yum-donut-school';
const TOBIN_UID = '45XvIlib7jWGyAEAaWSnU2jUy8k1';
const FRAUD_AMOUNT = 59;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function revertPrivateProfile() {
    console.log(`Reverting Private Profile for UID: ${TOBIN_UID}`);

    try {
        const privateRef = doc(db, 'artifacts', APP_ID, 'users', TOBIN_UID, 'profile', 'data');
        const snap = await getDoc(privateRef);

        if (!snap.exists()) {
            console.error("Private profile not found!");
            return;
        }

        const data = snap.data();
        console.log("Current Private Data:", data);

        const currentWallet = data.balance || 0;
        const currentBank = data.bank_balance || 0;

        let newWallet = currentWallet;
        let newBank = currentBank;
        let remainingDeduction = FRAUD_AMOUNT;

        // Deduct from Wallet first
        if (newWallet >= remainingDeduction) {
            newWallet -= remainingDeduction;
            remainingDeduction = 0;
        } else {
            remainingDeduction -= newWallet;
            newWallet = 0;

            // Deduct remainder from Bank
            if (newBank >= remainingDeduction) {
                newBank -= remainingDeduction;
                remainingDeduction = 0;
            } else {
                newBank -= remainingDeduction; // Go negative if needed
                remainingDeduction = 0;
            }
        }

        console.log(`Applying deduction of ${FRAUD_AMOUNT} donuts...`);
        console.log(`Wallet: ${currentWallet} -> ${newWallet}`);
        console.log(`Bank: ${currentBank} -> ${newBank}`);

        await updateDoc(privateRef, {
            balance: newWallet,
            bank_balance: newBank
        });

        console.log("Private Profile Updated Successfully.");

    } catch (error) {
        console.error("Error updating private profile:", error);
    }
    process.exit(0);
}

revertPrivateProfile();
