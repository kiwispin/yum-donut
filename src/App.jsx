import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, limit, 
  onSnapshot, doc, updateDoc, setDoc, getDoc, serverTimestamp, 
  runTransaction, where 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, updateProfile, signInWithCustomToken
} from 'firebase/auth';
import { 
  Trophy, Gift, Activity, MessageSquare, 
  LogOut, UserPlus, Heart, Zap, Search, CheckCircle
} from 'lucide-react';

// --- CONFIGURATION START ---

// 1. Firebase Configuration
// IMPORTANT: When running here in the chat, we use a system config (__firebase_config).
// When you copy this to Vercel/GitHub, this variable won't exist, so it falls back to the object.
// You MUST replace the values in the object below with your real keys from Firebase Console when deploying.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyAnjuK_F8ZO3WqTfCEeXEF5J84CG8Irjq4",
  authDomain: "yum-donut-school.firebaseapp.com",
  projectId: "yum-donut-school",
  storageBucket: "yum-donut-school.firebasestorage.app",
  messagingSenderId: "910400935670",
  appId: "1:910400935670:web:8f196e7da498d67ca17ed7"
};

// 2. School Roster (Edit this list anytime!)
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
  "Isaac"
];

const DAILY_LIMIT = 5;
const EMOJI = "🍩";
// If running in chat, use dynamic app id, otherwise use the fixed string
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'yum-donut-school'; 

// --- CONFIGURATION END ---

// --- Firebase Init ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    outline: "border-2 border-slate-200 hover:border-pink-500 hover:text-pink-500 text-slate-600"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
};

// --- Main Application ---

export default function YumDonutApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('give'); // 'give', 'feed', 'leaderboard'
  
  // Data State
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [notification, setNotification] = useState(null);

  // Auth & Profile Listener
  useEffect(() => {
    // Robust Auth: Check for system token first (needed for preview), fallback to anonymous
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
             await signInWithCustomToken(auth, __initial_auth_token);
        } else {
             await signInAnonymously(auth);
        }
    }
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to my specific profile data (balance, daily limits)
        const userRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'data');
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setMyProfile(docSnap.data());
          } else {
            setMyProfile(null); // User needs to create profile
          }
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Global Listeners (Users & Feed)
  useEffect(() => {
    if (!user) return;

    // Listen to all users (for search/leaderboard)
    const usersQuery = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      // We map docs by ID which is now the NAME
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    });

    // Listen to recent transactions (Feed)
    const feedQuery = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), 
      orderBy('timestamp', 'desc'), 
      limit(20)
    );
    const unsubFeed = onSnapshot(feedQuery, (snapshot) => {
      const feedList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(feedList);
    });

    return () => { unsubUsers(); unsubFeed(); };
  }, [user]);

  // --- Actions ---

  const handleCreateProfile = async (name) => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const uid = user.uid;
      
      // 1. Check if a public profile already exists for this name (from offline gifts)
      // We are now using the NAME as the Document ID for public data to allow pre-seeding
      const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', name);
      const publicDoc = await getDoc(publicRef);
      
      let currentBalance = 0;
      let avatarColor = `hsl(${Math.random() * 360}, 70%, 50%)`;

      if (publicDoc.exists()) {
          const data = publicDoc.data();
          currentBalance = data.balance || 0;
          if (data.avatar_color) avatarColor = data.avatar_color;
      }

      const initialPrivateData = {
        name: name,
        balance: currentBalance, // Sync private balance with public
        given_today: 0,
        last_given_date: new Date().toDateString(),
        avatar_color: avatarColor
      };

      // 2. Private Profile (for limits & ownership)
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data'), initialPrivateData);
      
      // 3. Public Profile (Create or Merge)
      // We add 'claimed: true' so we know a real user owns this name now
      await setDoc(publicRef, {
        name: name,
        balance: currentBalance,
        avatar_color: avatarColor,
        claimed: true,
        uid: uid 
      }, { merge: true });

    } catch (error) {
      console.error("Error creating profile:", error);
      showNotification("Failed to create profile", "error");
    }
    setLoading(false);
  };

  const handleGiveDonut = async (recipientName, message) => {
    if (!myProfile) return;
    
    // Check Daily Limit
    const today = new Date().toDateString();
    let currentGiven = myProfile.last_given_date === today ? myProfile.given_today : 0;

    if (currentGiven >= DAILY_LIMIT) {
      showNotification(`You've used all ${DAILY_LIMIT} ${EMOJI} for today!`, "error");
      return;
    }

    try {
        // 1. Create Transaction Record
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
            fromName: myProfile.name,
            toName: recipientName,
            message: message,
            timestamp: serverTimestamp(),
            emoji: EMOJI
        });

        // 2. Update Sender (My) Private Data
        const senderRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
        await updateDoc(senderRef, {
            given_today: currentGiven + 1,
            last_given_date: today
        });

        // 3. Update Recipient Public Balance (By Name Key)
        // If the doc doesn't exist yet, we create it (Offline Gift!)
        const recipientRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', recipientName);
        const recipientDoc = await getDoc(recipientRef);
        
        if (recipientDoc.exists()) {
            await updateDoc(recipientRef, {
                balance: (recipientDoc.data().balance || 0) + 1
            });
        } else {
            // Create "Ghost" Account for user who hasn't logged in yet
            await setDoc(recipientRef, {
                name: recipientName,
                balance: 1,
                avatar_color: `hsl(${Math.random() * 360}, 60%, 80%)`, // Light pastel for ghosts
                claimed: false
            });
        }

        showNotification(`Sent a ${EMOJI} successfully!`);
        setView('feed');

    } catch (e) {
        console.error(e);
        showNotification("Failed to send donut. Try again.", "error");
    }
  };

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Render Helpers ---

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-pink-50">
      <div className="animate-spin text-4xl">{EMOJI}</div>
    </div>
  );

  if (!user) return <div>Authenticating...</div>;

  if (!myProfile) {
    // Pass users so we know who is already claimed
    return <LoginScreen onCreate={handleCreateProfile} existingUsers={users} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0">
      {/* Mobile-friendly Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-pink-100 p-2 rounded-lg">
                <span className="text-xl leading-none">{EMOJI}</span>
            </div>
            <div>
                <h1 className="font-bold text-lg text-slate-900 leading-tight">YumDonut</h1>
                <p className="text-xs text-slate-500">School Recognition</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="hidden md:block text-right">
                <p className="text-sm font-semibold">{myProfile.name}</p>
                <p className="text-xs text-slate-500">
                    {DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)} left to give
                </p>
             </div>
             <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner"
                style={{ backgroundColor: myProfile.avatar_color }}
             >
                {myProfile.name.charAt(0).toUpperCase()}
             </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Notification Toast */}
        {notification && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-50 animate-bounce ${
                notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
                {notification.msg}
            </div>
        )}

        {/* Stats Cards (Desktop Only) */}
        <div className="hidden md:grid grid-cols-3 gap-4 mb-8">
            <Card className="flex flex-col items-center justify-center py-6 border-pink-100 bg-pink-50">
                <span className="text-3xl mb-1">{EMOJI}</span>
                <span className="text-sm text-pink-600 font-semibold uppercase tracking-wide">To Give Today</span>
                <span className="text-4xl font-black text-pink-500 mt-2">
                    {DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)}
                </span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-6">
                <span className="text-3xl mb-1">🎁</span>
                <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Received</span>
                <span className="text-4xl font-black text-slate-700 mt-2">{myProfile.balance}</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-6">
                <span className="text-3xl mb-1">👑</span>
                <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Rank</span>
                <span className="text-4xl font-black text-slate-700 mt-2">
                    #{users.sort((a,b) => b.balance - a.balance).findIndex(u => u.name === myProfile.name) + 1}
                </span>
            </Card>
        </div>

        {/* Views */}
        {view === 'give' && (
            <GiveView 
                // We pass the full roster to GiveView now, ensuring everyone is visible
                roster={SCHOOL_ROSTER}
                // We pass the existing users so we can show avatars if they exist
                existingUsers={users}
                currentUserName={myProfile.name}
                onGive={handleGiveDonut} 
                remaining={DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)}
            />
        )}
        
        {view === 'feed' && (
            <FeedView transactions={transactions} />
        )}
        
        {view === 'leaderboard' && (
            <LeaderboardView users={users} roster={SCHOOL_ROSTER} />
        )}

      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavBtn icon={Gift} label="Give" active={view === 'give'} onClick={() => setView('give')} />
        <NavBtn icon={Activity} label="Feed" active={view === 'feed'} onClick={() => setView('feed')} />
        <NavBtn icon={Trophy} label="Leaders" active={view === 'leaderboard'} onClick={() => setView('leaderboard')} />
      </div>
    </div>
  );
}

// --- Sub-Components ---

function LoginScreen({ onCreate, existingUsers }) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState(null);

  // Filter roster: Must match search AND not be already CLAIMED
  // We check 'claimed' property. If a ghost account exists (balance > 0) but not claimed, it should still appear here!
  const availableNames = SCHOOL_ROSTER.filter(name => {
    const userDoc = existingUsers.find(u => u.name === name);
    const isClaimed = userDoc && userDoc.claimed; // Only hide if actually claimed by a real user
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    return !isClaimed && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border-t-8 border-pink-500">
        <div className="text-6xl mb-4">{EMOJI}</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Welcome to YumDonut</h1>
        <p className="text-slate-500 mb-6">Find your name to get started.</p>
        
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
                <div className="text-center text-slate-400 py-4 text-sm">
                   {search ? "No names found." : "All names taken!"}
                </div>
             ) : (
                availableNames.map(name => {
                    // Check if there are pending donuts for this user
                    const ghostUser = existingUsers.find(u => u.name === name);
                    const pendingDonuts = ghostUser ? ghostUser.balance : 0;

                    return (
                        <button
                            key={name}
                            onClick={() => setSelectedName(name)}
                            className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-all flex justify-between items-center ${
                                selectedName === name 
                                ? 'bg-pink-500 text-white shadow-md' 
                                : 'hover:bg-white hover:shadow-sm text-slate-600'
                            }`}
                        >
                            <span>{name}</span>
                            <div className="flex items-center gap-2">
                                {pendingDonuts > 0 && (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                        {pendingDonuts} {EMOJI} waiting
                                    </span>
                                )}
                                {selectedName === name && <CheckCircle size={16} />}
                            </div>
                        </button>
                    );
                })
             )}
          </div>

          <Button 
            variant="primary" 
            className="w-full py-3 text-lg" 
            onClick={() => onCreate(selectedName)}
            disabled={!selectedName}
          >
            I am {selectedName || "..."}
          </Button>
          
          <p className="text-xs text-center text-slate-400 mt-4">
             Note: Once you claim a name, it disappears from this list.
          </p>
        </div>
      </div>
    </div>
  );
}

function GiveView({ roster, existingUsers, currentUserName, onGive, remaining }) {
    const [selectedUser, setSelectedUser] = useState("");
    const [message, setMessage] = useState("");
    const [filter, setFilter] = useState("");

    // Show EVERYONE from the roster (except self)
    const filteredRoster = roster
        .filter(name => name !== currentUserName)
        .filter(name => name.toLowerCase().includes(filter.toLowerCase()));

    const handleSubmit = () => {
        if (!selectedUser || !message) return;
        onGive(selectedUser, message);
        setMessage("");
        setSelectedUser("");
        setFilter("");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Mobile Stat Card */}
            <div className="md:hidden bg-pink-500 text-white p-6 rounded-2xl shadow-lg shadow-pink-200 flex justify-between items-center">
                <div>
                    <h2 className="font-bold text-lg opacity-90">Daily Balance</h2>
                    <p className="text-xs opacity-75">Use them or lose them!</p>
                </div>
                <div className="text-4xl font-black">{remaining}</div>
            </div>

            <Card className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Heart className="text-pink-500" size={24} />
                    <h2 className="text-xl font-bold text-slate-800">Who deserves a donut?</h2>
                </div>

                {remaining === 0 ? (
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
                                        className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                        placeholder="Search name..."
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                    />
                                    <UserPlus className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                    
                                    {filter && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-xl rounded-xl border border-slate-100 max-h-60 overflow-y-auto z-10 divide-y divide-slate-50">
                                            {filteredRoster.map(name => {
                                                const userData = existingUsers.find(u => u.name === name);
                                                const bgColor = userData?.avatar_color || "#cbd5e1"; // default gray
                                                
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
                                <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-xl">
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
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                                rows={3}
                                placeholder="Thanks for helping me with the math homework!"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        <Button 
                            onClick={handleSubmit} 
                            disabled={!selectedUser || !message}
                            className="w-full py-3 text-lg"
                        >
                            Give {EMOJI}
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
}

function FeedView({ transactions }) {
    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-slate-800 px-1">Recent Activity</h2>
            {transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <p className="text-4xl mb-2">🦗</p>
                    <p>No donuts given yet. Be the first!</p>
                </div>
            ) : (
                transactions.map(tx => (
                    <Card key={tx.id} className="flex gap-4">
                        <div className="flex-shrink-0 mt-1 bg-pink-100 text-pink-500 p-2 rounded-full h-10 w-10 flex items-center justify-center text-lg shadow-sm">
                            {tx.emoji || EMOJI}
                        </div>
                        <div className="flex-grow">
                            <div className="flex flex-wrap items-baseline gap-x-1 mb-1">
                                <span className="font-bold text-slate-900">{tx.fromName}</span>
                                <span className="text-slate-500 text-sm">gave a donut to</span>
                                <span className="font-bold text-slate-900">{tx.toName}</span>
                            </div>
                            <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                                "{tx.message}"
                            </p>
                            <p className="text-xs text-slate-400 mt-2 text-right">
                                {tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleString() : 'Just now'}
                            </p>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}

function LeaderboardView({ users, roster }) {
    // Combine Roster with Users to show people with 0 points
    const combinedList = roster.map(name => {
        const userData = users.find(u => u.name === name);
        return {
            name: name,
            balance: userData ? userData.balance : 0,
            avatar_color: userData ? userData.avatar_color : '#cbd5e1'
        };
    }).sort((a, b) => b.balance - a.balance);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-xl font-bold text-slate-800">Leaderboard</h2>
                <span className="text-xs font-medium bg-pink-100 text-pink-600 px-2 py-1 rounded-full">All Time</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {combinedList.map((u, index) => (
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
                            <p className="font-bold text-slate-800 truncate">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.balance} donuts received</p>
                        </div>
                        <div className="text-right pl-2">
                             <div className="inline-flex items-center bg-pink-50 text-pink-600 px-3 py-1 rounded-full font-bold text-sm">
                                {u.balance} {EMOJI}
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const NavBtn = ({ icon: Icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 w-16 transition-colors ${active ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'}`}
    >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{label}</span>
    </button>
);