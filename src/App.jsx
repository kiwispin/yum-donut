import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, limit, 
  onSnapshot, doc, updateDoc, setDoc, getDoc, serverTimestamp, 
  runTransaction, arrayUnion, arrayRemove, deleteDoc, Timestamp 
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, signInWithCustomToken,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously, updateProfile
} from 'firebase/auth';
import { 
  Trophy, Gift, Activity, MessageSquare, 
  LogOut, UserPlus, Heart, Zap, Search, CheckCircle, Target, Sparkles,
  Briefcase, Flame, CheckSquare, XCircle, ShoppingBag, Crown, Camera, Lock, Users, Skull, Trash2, Clock, Calendar, Edit2, RotateCcw
} from 'lucide-react';

// --- CONFIGURATION START ---

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnjuK_F8ZO3WqTfCEeXEF5J84CG8Irjq4",
  authDomain: "yum-donut-school.firebaseapp.com",
  projectId: "yum-donut-school",
  storageBucket: "yum-donut-school.firebasestorage.app",
  messagingSenderId: "910400935670",
  appId: "1:910400935670:web:8f196e7da498d67ca17ed7"
};

// 2. School Roster
const SCHOOL_ROSTER = [
  "Mr Rayner",
  "Jacey",
  "Marina",
  "Amaia",
  "Charlotte",
  "Dewindi",
  "Alison",
  "Hunter",
  "Katie",
  "Isla",
  "Chenuthi",
  "Lily",
  "Alice",
  "Amelia",
  "Mackenzie",
  "Kanin",
  "Faith",
  "Olivia",
  "Seoyeon",
  "Lara",
  "Armani",
  "Ashley",
  "Tobin",
  "Isaac",
  "Lia"
];

const DAILY_LIMIT = 5;
const GOAL_TARGET = 50; 
const EMOJI = "🍩";
const APP_ID = 'yum-donut-school'; 

// 3. Shop Inventory
const SHOP_ITEMS = [
    { id: 'snack_box', name: 'Snack Box Treat', cost: 5, icon: '🍪', desc: 'One treat from the box.', type: 'physical' },
    { id: 'snack_2', name: 'Double Snack Attack', cost: 8, icon: '🍫', desc: 'Permission to take a SECOND treat.', type: 'physical' },
    { id: 'vip_schedule', name: 'VIP Schedule Bump', cost: 25, icon: '📅', desc: "Bump your show to the top of the 'let's work on it' list.", type: 'physical' },
    { id: 'comfy_chair', name: 'Comfy Chair Rental', cost: 30, icon: '🪑', desc: 'Rent the good chair for a day.', type: 'physical' },
    { id: 'rainbow_name', name: 'Rainbow Name', cost: 60, icon: '🌈', desc: 'Your name glows on the leaderboard!', type: 'digital' },
    { id: 'gold_pass', name: 'The GOLD Pass', cost: 100, icon: '🎫', desc: 'A physical, laminated Gold VIP Lanyard.', type: 'physical' },
    { id: 'name_camera', name: 'Name a Camera', cost: 500, icon: '🎥', desc: 'Permanently name a DJI or Sony camera!', type: 'physical' },
];

// 4. Career Ranks (Based on GIVING)
const CAREER_RANKS = [
    { min: 0, title: "Intern", icon: "☕" },
    { min: 25, title: "Runner", icon: "🏃" }, 
    { min: 50, title: "Camera Op", icon: "🎥" },
    { min: 100, title: "Editor", icon: "🎞️" },
    { min: 200, title: "Producer", icon: "🎬" },
    { min: 400, title: "Studio Head", icon: "👑" }
];

// --- CONFIGURATION END ---

// --- Firebase Init ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helpers ---

const triggerConfetti = () => {
  const count = 40;
  for(let i=0; i<count; i++) {
    const el = document.createElement('div');
    el.innerText = EMOJI;
    el.style.position = 'fixed';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = Math.random() * 100 + 'vh';
    el.style.fontSize = (Math.random() * 20 + 10) + 'px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.transition = 'transform 1s ease-out, opacity 1s ease-out';
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 200 + 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    requestAnimationFrame(() => {
      el.style.transform = `translate(${tx}px, ${ty}px) rotate(${Math.random()*360}deg)`;
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 1000);
  }
};

const getRank = (lifetimeGiven) => {
    const val = lifetimeGiven || 0;
    return [...CAREER_RANKS].reverse().find(r => val >= r.min) || CAREER_RANKS[0];
};

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-4 ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, disabled, children, variant = "primary", className = "" }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95";
  const styles = {
    primary: "bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-200 disabled:bg-pink-300 disabled:shadow-none",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:bg-slate-50",
    outline: "border-2 border-slate-200 hover:border-pink-500 hover:text-pink-500 text-slate-600",
    success: "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200 disabled:bg-green-300",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 disabled:bg-red-300"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
};

const NavBtn = ({ icon: Icon, label, active, onClick, badge }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 w-16 transition-colors relative ${active ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'}`}
    >
        <div className="relative">
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
            {badge > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-sm">
                    {badge}
                </span>
            )}
        </div>
        <span className="text-[10px] font-medium">{label}</span>
    </button>
);

// --- Main Application ---

export default function YumDonutApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('give'); 
  
  // Data State
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bounties, setBounties] = useState([]); 
  const [goalData, setGoalData] = useState({ current: 0, target: 50, title: "Frosted Friday Goal", contributors: {} });
  const [myProfile, setMyProfile] = useState(null);
  const [notification, setNotification] = useState(null);

  // Auth & Profile Listener
  useEffect(() => {
    const initAuth = async () => {
        await auth.authStateReady();
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
            } catch (e) {
                console.warn("Guest login skipped:", e.code);
            }
        }
    }
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'data');
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setMyProfile(docSnap.data());
          } else {
            // Profile is missing (could be deleted or new user)
            setMyProfile(null); 
          }
          setLoading(false);
        }, (error) => {
            console.error("Profile snapshot error", error);
            setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Global Listeners
  useEffect(() => {
    if (!user) {
        setUsers([]);
        setTransactions([]);
        setBounties([]);
        return;
    }

    const usersQuery = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    }, (e) => console.error("Users error", e));

    const feedQuery = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), 
      orderBy('timestamp', 'desc'), 
      limit(25)
    );
    const unsubFeed = onSnapshot(feedQuery, (snapshot) => {
      const feedList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(feedList);
    }, (e) => console.error("Feed error", e));

    const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
    const unsubGoal = onSnapshot(goalRef, (docSnap) => {
        if (docSnap.exists()) {
            setGoalData(docSnap.data());
        } else {
            // Default Init if missing
            setDoc(goalRef, { current: 0, target: 50, title: "Frosted Friday Goal", contributors: {} });
        }
    }, (e) => console.error("Goal error", e));

    const bountiesQuery = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bounties'), orderBy('createdAt', 'desc'));
    const unsubBounties = onSnapshot(bountiesQuery, (snapshot) => {
        const bList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBounties(bList);
    }, (e) => console.error("Bounties error", e));

    return () => { unsubUsers(); unsubFeed(); unsubGoal(); unsubBounties(); };
  }, [user]);

  // Auto-Sync Wallet
  useEffect(() => {
    if (!user || !myProfile || users.length === 0) return;
    const publicProfile = users.find(u => u.name === myProfile.name);
    if (publicProfile) {
        const publicBalance = publicProfile.balance || 0;
        const privateBalance = myProfile.balance || 0;
        if (publicBalance !== privateBalance) {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            updateDoc(userRef, { balance: publicBalance }).catch(console.error);
        }
    }
  }, [user, myProfile, users]);

  const openBountyCount = bounties.filter(b => {
      if (b.status !== 'open') return false;
      // Simple Numeric Check for Expiry
      if (b.expiresAt && b.expiresAt < Date.now() && user.uid !== 'admin_uid_placeholder') return false; 
      return true;
  }).length;

  // RANK LOGIC
  const currentPublicProfile = users.find(u => u.name === myProfile?.name);
  const currentRank = getRank(currentPublicProfile?.lifetime_given || 0);

  // --- Actions ---

  const createProfile = async (uid, name) => {
      const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', name);
      const publicDoc = await getDoc(publicRef);
      
      let currentBalance = 0;
      let currentGiven = 0;
      let lifetimeReceived = 0;
      let avatarColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
      let rainbowName = false;

      if (publicDoc.exists()) {
          const data = publicDoc.data();
          currentBalance = data.balance || 0;
          currentGiven = data.lifetime_given || 0;
          lifetimeReceived = data.lifetime_received || currentBalance;
          if (data.avatar_color) avatarColor = data.avatar_color;
          if (data.rainbow_name) rainbowName = data.rainbow_name;
      }

      const initialPrivateData = {
          name: name,
          balance: currentBalance, 
          given_today: 0,
          last_given_date: new Date().toDateString(),
          avatar_color: avatarColor
      };

      await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data'), initialPrivateData);
      
      await setDoc(publicRef, {
          name: name,
          balance: currentBalance,
          lifetime_given: currentGiven,
          lifetime_received: lifetimeReceived,
          avatar_color: avatarColor,
          rainbow_name: rainbowName,
          claimed: true,
          uid: uid 
      }, { merge: true });
  };

  const handleLoginOrRegister = async (name, password) => {
    if (!name || !password) return;
    setLoading(true);
    const email = `${name.replace(/\s+/g, '').toLowerCase()}@yumdonut.school`;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const userRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data');
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
             await createProfile(uid, name);
             showNotification(`Welcome back, ${name}! Profile restored.`);
        } else {
             showNotification(`Welcome back, ${name}!`);
        }
    } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await createProfile(userCredential.user.uid, name);
                showNotification(`Account created for ${name}!`);
            } catch (createError) {
                console.error(createError);
                showNotification("Could not create account.", "error");
            }
        } else {
            console.error(error);
            showNotification("Login failed. Check password.", "error");
        }
    }
    setLoading(false);
  };

  const handleLogout = () => {
      signOut(auth);
      window.location.reload();
  };

  const handleGiveDonut = async (recipientName, message, amount = 1) => {
    if (!myProfile) return;
    const today = new Date().toDateString();
    let currentGiven = myProfile.last_given_date === today ? myProfile.given_today : 0;
    const isAdmin = myProfile.name === "Mr Rayner";

    if (!isAdmin && (currentGiven + amount) > DAILY_LIMIT) {
      showNotification(`You only have ${DAILY_LIMIT - currentGiven} ${EMOJI} left!`, "error");
      return;
    }

    try {
        triggerConfetti(); 
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
            fromName: myProfile.name,
            toName: recipientName,
            message: message,
            timestamp: serverTimestamp(),
            emoji: EMOJI,
            amount: amount,
            likes: []
        });

        const senderPrivateRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
        await updateDoc(senderPrivateRef, {
            given_today: currentGiven + amount,
            last_given_date: today
        });

        const senderPublicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);
        const senderPublicDoc = await getDoc(senderPublicRef);
        if (senderPublicDoc.exists()) {
             await updateDoc(senderPublicRef, {
                lifetime_given: (senderPublicDoc.data().lifetime_given || 0) + amount
             });
        }

        const recipientRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', recipientName);
        const recipientDoc = await getDoc(recipientRef);
        if (recipientDoc.exists()) {
            const currentBal = recipientDoc.data().balance || 0;
            const currentLifetime = recipientDoc.data().lifetime_received || currentBal;
            await updateDoc(recipientRef, {
                balance: currentBal + amount,
                lifetime_received: currentLifetime + amount 
            });
        } else {
            await setDoc(recipientRef, {
                name: recipientName,
                balance: amount,
                lifetime_given: 0,
                lifetime_received: amount,
                avatar_color: `hsl(${Math.random() * 360}, 60%, 80%)`,
                claimed: false
            });
        }
        showNotification(`Sent ${amount} ${EMOJI} successfully!`);
        setView('feed');
    } catch (e) {
        console.error(e);
        showNotification("Failed to send donut.", "error");
    }
  };

  const handleMunchDonut = async (victimName, reason) => {
      if (!myProfile) return;
      try {
          const recipientRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', victimName);
          const recipientDoc = await getDoc(recipientRef);
          if (!recipientDoc.exists()) {
              showNotification("User has no wallet to munch!", "error");
              return;
          }
          const currentBal = recipientDoc.data().balance || 0;
          if (currentBal < 1) {
              showNotification("The Muncher goes hungry (0 donuts).", "error");
              return;
          }
          await updateDoc(recipientRef, { balance: currentBal - 1 });
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
            fromName: "The Donut Muncher",
            toName: "Someone", 
            message: `Nom nom! Ate a donut because: ${reason}`,
            timestamp: serverTimestamp(),
            emoji: "👾",
            amount: 1,
            likes: []
        });
        showNotification(`Munched 1 donut from ${victimName}!`);
        setView('feed');
      } catch (e) {
          console.error(e);
          showNotification("Munch failed.", "error");
      }
  };

  const handleReaction = async (txId, currentLikes) => {
      if (currentLikes && currentLikes.includes(myProfile.name)) return;
      const txRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'transactions', txId);
      await updateDoc(txRef, { likes: arrayUnion(myProfile.name) });
  };

  const handleContributeToGoal = async () => {
      if (!myProfile || myProfile.balance < 1) {
          showNotification("Not enough donuts!", "error");
          return;
      }
      try {
          const publicUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);
          const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
          await runTransaction(db, async (transaction) => {
              const userDoc = await transaction.get(publicUserRef);
              const goalDoc = await transaction.get(goalRef);
              if (!userDoc.exists()) throw "User missing";
              const newBalance = (userDoc.data().balance || 0) - 1;
              if (newBalance < 0) throw "Not enough donuts!";
              
              const goalCurrent = (goalDoc.data()?.current || 0) + 1;
              const contributors = goalDoc.data()?.contributors || {};
              const myContribution = (contributors[myProfile.name] || 0) + 1;

              transaction.update(publicUserRef, { balance: newBalance });
              transaction.update(goalRef, { 
                  current: goalCurrent,
                  [`contributors.${myProfile.name}`]: myContribution
              });
              const txRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'));
              transaction.set(txRef, { fromName: myProfile.name, toName: goalDoc.data()?.title || "Team Goal", message: "Contributed to the goal!", timestamp: serverTimestamp(), emoji: "🚀", likes: [] });
          });
          const privateUserRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
          await updateDoc(privateUserRef, { balance: myProfile.balance - 1 });
          showNotification("Contributed 1 donut!");
          triggerConfetti();
      } catch (e) {
          console.error(e);
          showNotification("Contribution failed.", "error");
      }
  };

  // RESTORED: Admin Goal Controls
  const handleResetGoal = async () => {
      try {
          const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
          await updateDoc(goalRef, { current: 0, contributors: {} });
          showNotification("Goal reset to 0!");
      } catch (e) {
          console.error(e);
          showNotification("Failed to reset.", "error");
      }
  };

  const handleUpdateGoal = async (newTitle, newTarget) => {
      try {
          const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
          await updateDoc(goalRef, { 
              title: newTitle, 
              target: parseInt(newTarget) 
          });
          showNotification("Goal updated!");
      } catch (e) {
          console.error(e);
          showNotification("Update failed.", "error");
      }
  };

  const handleActivateFrostedFriday = async () => {
      try {
          const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
          await updateDoc(goalRef, { current: 0 });
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), { fromName: "Mr Rayner", toName: "EVERYONE", message: "🚨 FROSTED FRIDAY IS ON! The goal was met! 🍩🎉", timestamp: serverTimestamp(), emoji: "🚨", likes: [] });
          showNotification("Activated! Goal reset.");
          triggerConfetti();
          setView('feed');
      } catch (e) {
          console.error(e);
          showNotification("Failed to activate.", "error");
      }
  };

  const handlePurchase = async (item) => {
      if (!myProfile || myProfile.balance < item.cost) {
          showNotification("Not enough donuts!", "error");
          return;
      }
      const currentUserPublic = users.find(u => u.name === myProfile.name);
      if (item.type === 'digital' && item.id === 'rainbow_name' && currentUserPublic?.rainbow_name) {
          showNotification("Already owned!", "error");
          return;
      }
      try {
          const publicUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);
          await runTransaction(db, async (transaction) => {
              const userDoc = await transaction.get(publicUserRef);
              if (!userDoc.exists()) throw "User missing";
              const currentBal = userDoc.data().balance || 0;
              if (currentBal < item.cost) throw "Not enough funds";
              const updates = { balance: currentBal - item.cost };
              if (item.type === 'digital' && item.id === 'rainbow_name') { updates.rainbow_name = true; }
              transaction.update(publicUserRef, updates);
              const txRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'));
              transaction.set(txRef, { fromName: myProfile.name, toName: "The Shop", message: `Purchased: ${item.name}`, timestamp: serverTimestamp(), emoji: "🛍️", likes: [] });
          });
          const privateUserRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
          await updateDoc(privateUserRef, { balance: myProfile.balance - item.cost });
          showNotification(`Bought ${item.name}!`);
          triggerConfetti();
      } catch (e) {
          console.error(e);
          showNotification("Purchase failed.", "error");
      }
  };

  // --- CREATE BOUNTY (Time Limit = Minutes from Now) ---
  const handleCreateBounty = async (title, reward, quantity, durationMins) => {
      const qty = parseInt(quantity) || 1;
      const duration = parseInt(durationMins) || 0;
      
      // If duration is set, calculate absolute expiry time (number)
      const expiresAt = duration > 0 ? Date.now() + (duration * 60000) : null;

      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bounties'), {
          title,
          reward: parseInt(reward),
          status: 'open',
          remaining: qty, 
          expiresAt: expiresAt, // Store as number (milliseconds)
          createdBy: myProfile.name,
          createdAt: serverTimestamp()
      });
      
      const timeMsg = duration > 0 ? ` (Expires in ${duration} mins)` : "";
      
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
          fromName: "Job Board",
          toName: "EVERYONE",
          message: `📢 New Job Posted: ${title} (${reward} ${EMOJI}) - ${qty} spots!${timeMsg}`,
          timestamp: serverTimestamp(),
          emoji: "📢",
          likes: []
      });
      showNotification("Job Posted & Announced!");
  };

  const handleDeleteBounty = async (bountyId) => {
    try {
        const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
        await deleteDoc(bountyRef);
        showNotification("Job Deleted!");
    } catch (e) {
        console.error(e);
        showNotification("Failed to delete job.", "error");
    }
  };

  const handleClaimBounty = async (bountyId, currentRemaining) => {
      const hasActive = bounties.some(b => b.status === 'claimed' && b.claimantId === user.uid);
      if (hasActive) {
           showNotification("Finish your current job first!", "error");
           return;
      }
      const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
      if (currentRemaining > 1) {
          const bountyDoc = bounties.find(b => b.id === bountyId);
          await runTransaction(db, async (transaction) => {
               transaction.update(bountyRef, { remaining: currentRemaining - 1 });
               const childRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bounties'));
               transaction.set(childRef, {
                   title: bountyDoc.title,
                   reward: bountyDoc.reward,
                   status: 'claimed',
                   claimantName: myProfile.name,
                   claimantId: user.uid,
                   createdAt: serverTimestamp(),
                   parentId: bountyId 
               });
          });
      } else {
          await updateDoc(bountyRef, { status: 'claimed', remaining: 0, claimantName: myProfile.name, claimantId: user.uid });
      }
      showNotification("Job Claimed! Good luck.");
  };

  const handleUnclaimBounty = async (bountyId) => {
      const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
      await updateDoc(bountyRef, { status: 'open', claimantName: null, claimantId: null });
      showNotification("Job is open again.");
  };

  const handlePayBounty = async (bountyId, claimantName, reward) => {
      try {
          const recipientRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', claimantName);
          const recipientDoc = await getDoc(recipientRef);
          if (recipientDoc.exists()) {
              const currentBal = recipientDoc.data().balance || 0;
              const currentLifetime = recipientDoc.data().lifetime_received || currentBal;
              
              await updateDoc(recipientRef, {
                  balance: currentBal + reward,
                  lifetime_received: currentLifetime + reward 
              });
          }
          const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
          await updateDoc(bountyRef, { status: 'paid' });
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
              fromName: "Mr Rayner",
              toName: claimantName,
              message: `Completed the bounty: ${reward} Donuts awarded!`,
              timestamp: serverTimestamp(),
              emoji: "💰",
              likes: []
          });
          triggerConfetti();
          showNotification("Bounty Paid!");
      } catch (e) {
          console.error(e);
          showNotification("Payment failed", "error");
      }
  };

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-pink-50">
      <div className="animate-spin text-4xl">{EMOJI}</div>
    </div>
  );

  if (!user || !myProfile) {
    return <LoginScreen onLogin={handleLoginOrRegister} existingUsers={users} />;
  }

  return (
    <div className={`min-h-screen font-sans text-slate-800 pb-20 md:pb-0 transition-colors duration-500 ${view === 'give' && notification?.type === 'munch' ? 'bg-red-50' : 'bg-slate-50'}`}>
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-pink-100 p-2 rounded-lg">
                <span className="text-xl leading-none">{EMOJI}</span>
            </div>
            <div>
                <h1 className="font-bold text-lg text-slate-900 leading-tight">YumDonut</h1>
                <div className="flex flex-col">
                    <p className="text-xs text-slate-500">Berkley TV Recognition</p>
                    <div className="flex items-center gap-1 text-[10px] bg-slate-100 px-1.5 rounded-full w-fit mt-0.5">
                        <span>{currentRank.icon}</span>
                        <span className="font-bold text-slate-700">{currentRank.title}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="hidden md:block text-right">
                <p className="text-sm font-semibold">{myProfile.name}</p>
                <p className="text-xs text-slate-500">
                    {myProfile.name === "Mr Rayner" 
                        ? <span className="text-pink-600 font-bold">∞ left (Admin)</span> 
                        : `${DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)} left to give`
                    }
                </p>
             </div>
             <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: myProfile.avatar_color }}
                title="Click to Logout"
                onClick={handleLogout}
             >
                {myProfile.name.charAt(0).toUpperCase()}
             </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        
        {notification && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-50 animate-bounce ${
                notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
                {notification.msg}
            </div>
        )}

        <div className="flex overflow-x-auto space-x-2 border-b border-slate-200 mb-4 pb-1">
             {['give', 'jobs', 'shop', 'goal', 'feed', 'leaderboard'].map(tab => (
                 <button
                    key={tab}
                    onClick={() => setView(tab)}
                    className={`px-4 py-2 font-medium text-sm capitalize border-b-2 transition-colors whitespace-nowrap relative ${
                        view === tab ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                 >
                    {tab}
                    {tab === 'jobs' && openBountyCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                            {openBountyCount}
                        </span>
                    )}
                 </button>
             ))}
        </div>

        {view === 'give' && (
            <GiveView 
                roster={SCHOOL_ROSTER}
                existingUsers={users}
                currentUserName={myProfile.name}
                onGive={handleGiveDonut} 
                onMunch={handleMunchDonut} 
                remaining={DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)}
            />
        )}

        {view === 'jobs' && (
            <BountiesView 
                bounties={bounties}
                currentUser={myProfile}
                userId={user.uid}
                onCreate={handleCreateBounty}
                onDelete={handleDeleteBounty} 
                onClaim={handleClaimBounty}
                onUnclaim={handleUnclaimBounty}
                onPay={handlePayBounty}
            />
        )}

        {view === 'shop' && (
            <ShopView 
                items={SHOP_ITEMS}
                userBalance={myProfile.balance}
                onPurchase={handlePurchase}
                currentUserPublic={users.find(u => u.name === myProfile.name)}
            />
        )}

        {view === 'goal' && (
            <GoalView 
                goalData={goalData} 
                userBalance={myProfile.balance}
                onContribute={handleContributeToGoal}
                currentUserName={myProfile.name}
                onActivate={handleActivateFrostedFriday}
                onUpdateGoal={handleUpdateGoal}
                onResetGoal={handleResetGoal}
            />
        )}
        
        {view === 'feed' && (
            <FeedView transactions={transactions} onReact={handleReaction} />
        )}
        
        {view === 'leaderboard' && (
            <LeaderboardView users={users} roster={SCHOOL_ROSTER} />
        )}

      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavBtn icon={Gift} label="Give" active={view === 'give'} onClick={() => setView('give')} />
        <NavBtn icon={Briefcase} label="Jobs" active={view === 'jobs'} onClick={() => setView('jobs')} badge={openBountyCount} />
        <NavBtn icon={ShoppingBag} label="Shop" active={view === 'shop'} onClick={() => setView('shop')} />
        <NavBtn icon={Activity} label="Feed" active={view === 'feed'} onClick={() => setView('feed')} />
      </div>
    </div>
  );
}

// --- Sub-Components (Defined BEFORE Main App to avoid ReferenceErrors) ---

function LoginScreen({ onLogin, existingUsers }) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState(null);
  const [password, setPassword] = useState("");

  const availableNames = SCHOOL_ROSTER.filter(name => {
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleLogin = () => {
      if (selectedName && password) {
          onLogin(selectedName, password);
      }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border-t-8 border-pink-500">
        <div className="text-6xl mb-4">{EMOJI}</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Welcome to YumDonut</h1>
        <p className="text-slate-500 mb-6">Select your name to get started.</p>
        
        {!selectedName ? (
            <div className="space-y-4 text-left">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input 
                    type="text" 
                    className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none transition"
                    placeholder="Search your name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="h-48 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50 p-2 space-y-1">
                    {availableNames.length === 0 ? (
                        <div className="text-center text-slate-400 py-4 text-sm">No names found.</div>
                    ) : (
                        availableNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setSelectedName(name)}
                                className="w-full text-left px-4 py-2 rounded-md text-sm font-medium hover:bg-white hover:shadow-sm text-slate-600 transition-all flex justify-between items-center"
                            >
                                <span>{name}</span>
                                {/* Removed Login/Register badges since we can't check without login */}
                            </button>
                        ))
                    )}
                </div>
            </div>
        ) : (
            <div className="space-y-4 text-left animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between bg-pink-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-pink-700">{selectedName}</span>
                    </div>
                    <button onClick={() => { setSelectedName(null); setPassword(""); }} className="text-xs text-pink-400 hover:text-pink-600">Change</button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                        Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">First time? Create a password. Returning? Login.</p>
                </div>
                <Button variant="primary" className="w-full py-3 text-lg" onClick={handleLogin} disabled={!password}>
                    Continue
                </Button>
            </div>
        )}
      </div>
    </div>
  );
}

function ShopView({ items, userBalance, onPurchase, currentUserPublic }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingBag /> The Donut Shop
                </h2>
                <p className="opacity-90">Spend your hard-earned donuts on rewards!</p>
                <div className="mt-4 text-sm font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
                    Your Balance: {userBalance} {EMOJI}
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => {
                    const canAfford = userBalance >= item.cost;
                    const isOwned = item.type === 'digital' && item.id === 'rainbow_name' && currentUserPublic?.rainbow_name;

                    return (
                        <Card key={item.id} className="flex flex-col justify-between relative overflow-hidden border-2 border-slate-100 hover:border-pink-200 transition-colors">
                            {isOwned && <div className="absolute top-2 right-2 text-green-500"><CheckCircle /></div>}
                            <div>
                                <div className="text-4xl mb-2">{item.icon}</div>
                                <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                                <p className="text-sm text-slate-500 mb-4">{item.desc}</p>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                                <span className="font-bold text-pink-600">{item.cost} {EMOJI}</span>
                                <Button 
                                    onClick={() => onPurchase(item)} 
                                    disabled={!canAfford || isOwned}
                                    className={!canAfford ? "opacity-50" : ""}
                                >
                                    {isOwned ? "Owned" : "Buy"}
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function BountiesView({ bounties, currentUser, userId, onCreate, onDelete, onClaim, onUnclaim, onPay }) {
    const [newTitle, setNewTitle] = useState("");
    const [newReward, setNewReward] = useState(5);
    const [newQty, setNewQty] = useState(1); 
    const [newDuration, setNewDuration] = useState(""); 
    const isAdmin = currentUser.name === "Mr Rayner";

    const activeBounties = bounties.filter(b => {
        if (b.status === 'paid') return false;
        
        // Check expiration (Numeric comparison)
        const now = Date.now();
        const isExpired = b.expiresAt && b.expiresAt < now;
        
        if (isAdmin) return true; 
        if (b.status === 'open' && isExpired) return false; // Hide expired jobs from students
        
        return true;
    });

    // New simple timer logic
    const getMinutesLeft = (expiresAt) => {
        if (!expiresAt) return null;
        const diff = expiresAt - Date.now();
        if (diff <= 0) return 0;
        return Math.ceil(diff / 60000);
    };

    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAdmin && (
                <Card className="bg-pink-50 border-pink-100">
                    <h3 className="font-bold text-pink-700 mb-3 flex items-center gap-2">
                        <Briefcase size={20}/> Post New Job
                    </h3>
                    
                    {/* GRID LAYOUT */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="col-span-2 md:col-span-5">
                            <label className="text-[10px] text-pink-400 font-bold uppercase">Job Description</label>
                            <input 
                                className="w-full p-2 rounded-lg border border-pink-200"
                                placeholder="e.g. Film Assembly"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="text-[10px] text-pink-400 font-bold uppercase">Reward</label>
                            <input 
                                type="number"
                                className="w-full p-2 rounded-lg border border-pink-200"
                                value={newReward}
                                onChange={e => setNewReward(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-pink-400 font-bold uppercase">Spots</label>
                            <input 
                                type="number"
                                min="1"
                                className="w-full p-2 rounded-lg border border-pink-200"
                                value={newQty}
                                onChange={e => setNewQty(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-pink-400 font-bold uppercase flex items-center gap-1"><Clock size={10}/> Time (m)</label>
                            <input 
                                type="number"
                                className="w-full p-2 rounded-lg border border-pink-200"
                                placeholder="∞"
                                value={newDuration}
                                onChange={e => setNewDuration(e.target.value)}
                            />
                        </div>
                        
                        <div className="col-span-2 md:col-span-2">
                            <Button className="w-full h-[42px] mt-[18px]" onClick={() => { onCreate(newTitle, newReward, newQty, newDuration); setNewTitle(""); setNewQty(1); setNewDuration(""); }}>
                                Post Job
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                <h3 className="font-bold text-slate-700 ml-1 flex justify-between items-center">
                    <span>Active Jobs</span>
                </h3>
                {activeBounties.length === 0 && <div className="text-center text-slate-400 py-8">No active jobs right now.</div>}
                
                {activeBounties.map(b => {
                    const isMyClaim = b.claimantId === userId;
                    const hasActiveJob = bounties.some(job => job.status === 'claimed' && job.claimantId === userId);
                    const remainingSpots = b.remaining || (b.status === 'open' ? 1 : 0); 
                    
                    const minsLeft = getMinutesLeft(b.expiresAt);
                    const hasTimer = b.expiresAt > 0;
                    const isExpired = hasTimer && minsLeft <= 0;

                    // Progress Bar Calculation
                    let progressWidth = 100;
                    let progressColor = 'bg-green-500';
                    
                    if (hasTimer && !isExpired && b.createdAt) {
                        // Determine duration based on creation
                        let createdTime = b.createdAt;
                        // Handle different timestamp formats if necessary, but usually it's a Timestamp obj or millis
                        // We stored it as serverTimestamp(), which returns a Timestamp object in snapshots
                        const createdMillis = createdTime.toMillis ? createdTime.toMillis() : Date.now();
                        
                        const totalDuration = b.expiresAt - createdMillis;
                        const timeRemaining = b.expiresAt - Date.now();
                        
                        if (totalDuration > 0) {
                            progressWidth = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
                        }
                        
                        if (progressWidth < 50) progressColor = 'bg-yellow-500';
                        if (progressWidth < 20) progressColor = 'bg-orange-500';
                        if (progressWidth < 10) progressColor = 'bg-red-500 animate-pulse';
                    }

                    return (
                        <Card key={b.id} className={`flex flex-col border-l-4 ${isExpired ? 'border-l-slate-300 bg-slate-50' : 'border-l-pink-500'}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex-grow min-w-0 mr-2">
                                    <h4 className="font-bold text-slate-800 break-words flex items-center gap-2 flex-wrap">
                                        {b.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">
                                            {b.reward} {EMOJI} Reward
                                        </span>
                                        {b.status === 'open' && remainingSpots > 1 && (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1">
                                                <Users size={12}/> {remainingSpots} spots left
                                            </span>
                                        )}
                                        {/* Time Limit Badge */}
                                        {b.status === 'open' && hasTimer && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'}`}>
                                                <Clock size={12}/> {isExpired ? "Expired" : `${minsLeft}m left`}
                                            </span>
                                        )}
                                        
                                        {b.status === 'claimed' && (
                                            <span className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                <CheckSquare size={12}/> Claimed by {b.claimantName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 flex-shrink-0">
                                    {b.status === 'open' && (
                                        <>
                                            <Button 
                                                variant="outline" 
                                                onClick={() => onClaim(b.id, remainingSpots)}
                                                disabled={hasActiveJob || isExpired} 
                                                className={hasActiveJob || isExpired ? "opacity-50 cursor-not-allowed" : ""}
                                                title={isExpired ? "Job Expired" : hasActiveJob ? "Finish your current job first!" : "Claim this job"}
                                            >
                                                {isExpired ? "Expired" : "Claim"}
                                            </Button>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => onDelete(b.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={20}/>
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {b.status === 'claimed' && isAdmin && (
                                        <>
                                            <button 
                                                onClick={() => onUnclaim(b.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Revoke Claim"
                                            >
                                                <XCircle size={20} />
                                            </button>
                                            <Button variant="success" onClick={() => onPay(b.id, b.claimantName, b.reward)} className="whitespace-nowrap">
                                                Pay & Close
                                            </Button>
                                        </>
                                    )}

                                    {b.status === 'claimed' && isMyClaim && !isAdmin && (
                                        <Button variant="danger" onClick={() => onUnclaim(b.id)} className="text-xs px-2 whitespace-nowrap">
                                            Cancel Claim
                                        </Button>
                                    )}

                                    {b.status === 'claimed' && !isMyClaim && !isAdmin && (
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 self-center whitespace-nowrap">
                                            Busy
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* PROGRESS BAR */}
                            {b.status === 'open' && hasTimer && !isExpired && (
                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden relative">
                                    <div 
                                        className={`h-full transition-all duration-1000 ease-linear ${progressColor}`} 
                                        style={{ width: `${progressWidth}%` }}
                                    />
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function GoalView({ goalData, userBalance, onContribute, currentUserName, onActivate, onUpdateGoal, onResetGoal }) {
    const percent = Math.min(100, ((goalData.current || 0) / (goalData.target || GOAL_TARGET)) * 100);
    const target = goalData.target || GOAL_TARGET;
    const isMet = (goalData.current || 0) >= target;
    const isAdmin = currentUserName === "Mr Rayner";
    
    // State for Admin Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(goalData.title || "Team Goal");
    const [editTarget, setEditTarget] = useState(target);

    const contributors = goalData.contributors || {};
    // Sort contributors by amount (desc)
    const sortedContributors = Object.entries(contributors)
        .sort(([,a], [,b]) => b - a);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Card className="text-center py-8 relative overflow-hidden">
                {isMet && <div className="absolute inset-0 bg-yellow-100 opacity-20 animate-pulse"></div>}
                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center p-3 bg-pink-100 rounded-full text-pink-500 mb-4">
                        <Sparkles size={32} />
                    </div>

                    {/* ADMIN EDIT MODE */}
                    {isAdmin && isEditing ? (
                        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Edit Goal</h3>
                            <div className="flex flex-col gap-2">
                                <input 
                                    className="p-2 border rounded"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Goal Title"
                                />
                                <input 
                                    className="p-2 border rounded"
                                    type="number"
                                    value={editTarget}
                                    onChange={e => setEditTarget(e.target.value)}
                                    placeholder="Target Amount"
                                />
                                <div className="flex gap-2 mt-2">
                                    <Button onClick={() => { onUpdateGoal(editTitle, editTarget); setIsEditing(false); }} className="flex-1">Save</Button>
                                    <button onClick={() => setIsEditing(false)} className="text-slate-500 text-sm px-3">Cancel</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-center items-center gap-2 mb-2">
                                <h2 className="text-2xl font-bold text-slate-800">{goalData.title || "Team Goal"}</h2>
                                {isAdmin && (
                                    <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-pink-500">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                            <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                If we reach {target} donuts together, we unlock a reward for everyone!
                            </p>
                        </>
                    )}

                    <div className="max-w-lg mx-auto bg-slate-100 rounded-full h-8 mb-2 relative">
                        <div 
                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                            style={{ width: `${percent}%` }}
                        >
                            <span className="text-white text-xs font-bold drop-shadow-md">{Math.floor(percent)}%</span>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-8">
                        {goalData.current} / {target} {EMOJI} raised
                    </p>

                    {isMet ? (
                        <div className="space-y-4">
                            <div className="bg-green-100 text-green-700 p-4 rounded-xl font-bold text-lg animate-bounce">
                                🎉 GOAL REACHED! ({goalData.current}/{target})
                            </div>
                            {isAdmin ? (
                                <div className="flex flex-col gap-2">
                                    <Button 
                                        onClick={onActivate} 
                                        variant="success"
                                        className="w-full py-3 text-lg"
                                    >
                                        🚨 Activate Reward! 🚨
                                    </Button>
                                    <button onClick={onResetGoal} className="text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1">
                                        <RotateCcw size={12}/> Reset Goal Manually
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic">Waiting for Mr Rayner to activate the event...</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                             <Button 
                                onClick={onContribute} 
                                variant="primary"
                                className="w-full max-w-xs py-3 text-lg"
                            >
                                Contribute 1 {EMOJI}
                            </Button>
                            <p className="text-xs text-slate-400">
                                You have {userBalance} donuts available.
                            </p>
                        </div>
                    )}
                </div>
             </Card>

             {/* CONTRIBUTORS LIST */}
             {sortedContributors.length > 0 && (
                 <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                     <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                         <Trophy size={16} className="text-yellow-500"/> Top Contributors
                     </h3>
                     <div className="space-y-2">
                         {sortedContributors.map(([name, count], index) => (
                             <div key={name} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded">
                                 <div className="flex items-center gap-2">
                                     <span className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-500 text-lg' : 'text-slate-400'}`}>
                                         {index + 1}
                                     </span>
                                     <span className="font-medium text-slate-700">{name}</span>
                                 </div>
                                 <span className="font-bold text-pink-500">{count} {EMOJI}</span>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
        </div>
    );
}

// ... LoginScreen, GiveView, FeedView, LeaderboardView, NavBtn ...
function GiveView({ roster, existingUsers, currentUserName, onGive, onMunch, remaining }) {
    const [selectedUser, setSelectedUser] = useState("");
    const [message, setMessage] = useState("");
    const [filter, setFilter] = useState("");
    const [amount, setAmount] = useState(1);
    const [mode, setMode] = useState("give"); // 'give' or 'munch'
    
    const isAdmin = currentUserName === "Mr Rayner";
    const isMunch = mode === "munch";

    const filteredRoster = roster
        .filter(name => name !== currentUserName)
        .filter(name => name.toLowerCase().includes(filter.toLowerCase()));

    const handleSubmit = () => {
        if (!selectedUser || !message) return;
        
        if (isMunch) {
            onMunch(selectedUser, message);
        } else {
            onGive(selectedUser, message, amount);
        }
        
        setMessage("");
        setSelectedUser("");
        setFilter("");
        setAmount(1);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`md:hidden p-6 rounded-2xl shadow-lg shadow-pink-200 flex justify-between items-center transition-colors ${isMunch ? 'bg-red-500 text-white' : 'bg-pink-500 text-white'}`}>
                <div>
                    <h2 className="font-bold text-lg opacity-90">{isMunch ? "The Muncher" : "Daily Balance"}</h2>
                    <p className="text-xs opacity-75">{isMunch ? "Feeding Time 👾" : "Use them or lose them!"}</p>
                </div>
                <div className="text-4xl font-black">{isAdmin ? "∞" : remaining}</div>
            </div>

            <Card className={`space-y-4 transition-colors ${isMunch ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 mb-2">
                        {isMunch ? <Skull className="text-red-500" size={24} /> : <Heart className="text-pink-500" size={24} />}
                        <h2 className="text-xl font-bold text-slate-800">
                            {isMunch ? "Who lost a donut?" : "Who deserves a donut?"}
                        </h2>
                    </div>
                    
                    {/* ADMIN TOGGLE */}
                    {isAdmin && (
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button 
                                onClick={() => setMode("give")}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!isMunch ? 'bg-white text-pink-500 shadow-sm' : 'text-slate-400'}`}
                            >
                                😇 Give
                            </button>
                            <button 
                                onClick={() => setMode("munch")}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isMunch ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}
                            >
                                😈 Munch
                            </button>
                        </div>
                    )}
                </div>

                {remaining === 0 && !isAdmin ? (
                     <div className="bg-slate-100 p-6 rounded-xl text-center text-slate-500">
                        <p className="text-lg font-medium">You're all out of donuts!</p>
                        <p className="text-sm">Come back tomorrow for a fresh batch.</p>
                     </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600">Select Teammate</label>
                            {!selectedUser ? (
                                <div className="relative">
                                    <input 
                                        className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                        placeholder="Search name..."
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                    />
                                    <UserPlus className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                    
                                    {filter && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-xl rounded-xl border border-slate-100 max-h-60 overflow-y-auto z-10 divide-y divide-slate-50">
                                            {filteredRoster.map(name => {
                                                const userData = existingUsers.find(u => u.name === name);
                                                const bgColor = userData?.avatar_color || "#cbd5e1"; 
                                                
                                                return (
                                                    <button 
                                                        key={name}
                                                        onClick={() => { setSelectedUser(name); setFilter(""); }}
                                                        className="w-full text-left p-3 hover:bg-pink-50 flex items-center gap-3 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background: bgColor}}>
                                                            {name[0]}
                                                        </div>
                                                        <span>{name}</span>
                                                    </button>
                                                )
                                            })}
                                            {filteredRoster.length === 0 && <div className="p-3 text-slate-400 text-sm">No users found</div>}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 bg-white border border-pink-200 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" 
                                             style={{background: existingUsers.find(u => u.name === selectedUser)?.avatar_color || "#cbd5e1"}}>
                                            {selectedUser[0]}
                                        </div>
                                        <span className="font-medium text-slate-800">
                                            {selectedUser}
                                        </span>
                                    </div>
                                    <button onClick={() => setSelectedUser("")} className="text-slate-400 hover:text-red-500">
                                        <LogOut size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600">Reason</label>
                            <textarea 
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                                rows={3}
                                placeholder={isMunch ? "Why did the Muncher strike? (e.g. Left batteries flat)" : "Thanks for helping me with the filming!"}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        {/* Admin Bulk Controls (Only show in Give Mode) */}
                        {isAdmin && !isMunch && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <Zap size={16} className="text-yellow-500"/> Admin Multiplier
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 5, 10].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setAmount(n)}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                                                amount === n 
                                                ? "bg-yellow-400 text-yellow-900 shadow-md scale-105" 
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                        >
                                            {n}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button 
                            onClick={handleSubmit} 
                            disabled={!selectedUser || !message}
                            className="w-full py-3 text-lg"
                            variant={isMunch ? "danger" : "primary"}
                        >
                            {isMunch ? `Feed The Muncher (1 ${EMOJI})` : 
                            `Give ${amount > 1 ? `${amount} ${EMOJI}` : EMOJI}`}
                            {!isMunch && <span className="text-sm opacity-80 ml-1">
                                {isAdmin ? "(∞ left)" : `(${remaining} left)`}
                            </span>}
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
}

function FeedView({ transactions, onReact }) {
    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-slate-800 px-1">Recent Activity</h2>
            {transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <p className="text-4xl mb-2">🦗</p>
                    <p>No donuts given yet. Be the first!</p>
                </div>
            ) : (
                transactions.map(tx => {
                    const count = tx.amount || 1;
                    const isMunch = tx.fromName === "The Donut Muncher";
                    
                    return (
                    <Card key={tx.id} className={`flex gap-4 relative ${isMunch ? 'bg-red-50 border-red-100' : ''}`}>
                        <div className={`flex-shrink-0 mt-1 p-2 rounded-full h-10 w-10 flex items-center justify-center text-lg shadow-sm ${isMunch ? 'bg-red-100 text-red-500' : 'bg-pink-100 text-pink-500'}`}>
                            {tx.emoji || EMOJI}
                        </div>
                        <div className="flex-grow pb-6">
                            <div className="flex flex-wrap items-baseline gap-x-1 mb-1">
                                <span className="font-bold text-slate-900">{tx.fromName}</span>
                                {tx.toName === "Frosted Friday" || tx.toName === "EVERYONE" || tx.toName === "The Shop" || tx.fromName === "Job Board" || tx.fromName === "Goal" || tx.toName === "Team Goal" ? (
                                    <span className="text-slate-500 text-sm ml-1">
                                        {tx.message.includes("activated") ? "announced" : 
                                         tx.message.includes("Purchased") ? "went shopping" : 
                                         tx.emoji === "📢" ? "announced" : "contributed to"}
                                    </span>
                                ) : isMunch ? (
                                    <>
                                        <span className="text-red-500 text-sm mx-1 font-bold">ATE a donut from</span>
                                        <span className="font-bold text-slate-900">{tx.toName}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-slate-500 text-sm mx-1">
                                            gave {count > 1 ? <span className="font-bold text-pink-600">{count} donuts</span> : "a donut"} to
                                        </span>
                                        <span className="font-bold text-slate-900">{tx.toName}</span>
                                    </>
                                )}
                            </div>
                            <p className={`p-2 rounded-lg border italic text-sm ${isMunch ? 'text-red-700 bg-red-100 border-red-200' : 'text-slate-700 bg-slate-50 border-slate-100'}`}>
                                "{tx.message}"
                            </p>
                            <p className="text-xs text-slate-400 mt-2 text-right">
                                {tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleString() : 'Just now'}
                            </p>
                            
                            <button 
                                onClick={() => onReact(tx.id, tx.likes)}
                                className="absolute bottom-3 left-16 text-xs bg-white hover:bg-orange-50 border border-slate-200 px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
                            >
                                <Flame size={12} className={tx.likes?.length ? "text-orange-500 fill-orange-500" : "text-slate-400"} />
                                <span className={tx.likes?.length ? "text-orange-600 font-bold" : "text-slate-500"}>
                                    {tx.likes?.length || 0}
                                </span>
                            </button>
                        </div>
                    </Card>
                )
                })
            )}
        </div>
    );
}

function LeaderboardView({ users, roster }) {
    const combinedList = roster.map(name => {
        const userData = users.find(u => u.name === name);
        return {
            name: name,
            balance: userData ? userData.balance : 0,
            avatar_color: userData ? userData.avatar_color : '#cbd5e1',
            rainbow_name: userData ? userData.rainbow_name : false,
            lifetime_received: userData ? userData.lifetime_received : 0,
            lifetime_given: userData ? userData.lifetime_given : 0
        };
    }).sort((a, b) => b.balance - a.balance);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-xl font-bold text-slate-800">Leaderboard</h2>
                <span className="text-xs font-medium bg-pink-100 text-pink-600 px-2 py-1 rounded-full">All Time</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {combinedList.map((u, index) => {
                    // Ranks based on GIVEN
                    const rank = getRank(u.lifetime_given || 0); 
                    return (
                    <div key={u.name} className="flex items-center p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-none">
                        <div className="w-8 font-bold text-slate-400 text-center flex-shrink-0">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </div>
                        <div className="mx-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{background: u.avatar_color}}>
                                {u.name[0]}
                            </div>
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2">
                                <p className={`font-bold truncate ${u.rainbow_name ? 'animate-text-rainbow bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500' : 'text-slate-800'}`}>
                                    {u.name}
                                </p>
                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500" title={`Given: ${u.lifetime_given || 0}`}>
                                    {rank.icon} {rank.title}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">{u.balance} donuts available</p>
                        </div>
                        <div className="text-right pl-2">
                             <div className="inline-flex items-center bg-pink-50 text-pink-600 px-3 py-1 rounded-full font-bold text-sm">
                                {u.balance} {EMOJI}
                             </div>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
}