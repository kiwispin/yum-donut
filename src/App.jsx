import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, addDoc, query, orderBy, limit, getDocs,
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
    Briefcase, Flame, CheckSquare, XCircle, ShoppingBag, Crown, Camera, Lock, Users, Skull, Trash2, Clock, Calendar, Edit2, RotateCcw, Landmark, PiggyBank, ArrowRight, ArrowLeft, UserCheck, Keyboard, Shield, Settings, Gamepad2
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. School Roster
const INITIAL_ROSTER = [
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
    "Kiara",
    "Seoyeon",
    "Lara",
    "Armani",
    "Tobin",
    "Isaac",
    "Lia"
];

const DAILY_LIMIT = 5;
const GOAL_TARGET = 50;
const EMOJI = "🍩";
const APP_ID = 'yum-donut-school';

// 3. Live Studio Configuration
const ENABLE_LIVE_STUDIO = true;

const AVATAR_COLORS = [
    '#F472B6', // Pink
    '#A78BFA', // Purple
    '#60A5FA', // Blue
    '#34D399', // Emerald
    '#FBBF24', // Amber
    '#F87171', // Red
    '#9CA3AF', // Gray
    '#14B8A6', // Teal
];

const MEDIA_EMOJIS = [
    '🎥', '🎬', '🎧', '🎤', '💻', '📸', '📹', '📼', '📺', '📻',
    '💡', '🔌', '🔋', '📡', '🕹️', '👾', '🚀', '⭐', '🎵', '🎹'
];

// 5. Pixel Avatar Palette
const PIXEL_PALETTE = [
    { name: 'Black', hex: '#000000' },
    { name: 'Pink', hex: '#FF9FF3' },
    { name: 'Purple', hex: '#D6A2E8' },
    { name: 'Cyan', hex: '#48DBFB' },
    { name: 'Teal', hex: '#1DD1A1' },
    { name: 'Lime', hex: '#BADC58' },
    { name: 'Yellow', hex: '#FDCB6E' },
    { name: 'Orange', hex: '#FFA502' },
    { name: 'Red', hex: '#FF6B6B' },
    { name: 'Brown', hex: '#834C32' },
    { name: 'Grey', hex: '#576574' }
];

const SYSTEM_AVATARS = {
    "Typing Dojo": {
        pixels: [
            null, "#576574", "#576574", "#576574", "#576574", "#576574", "#576574", null,
            null, "#576574", "#1DD1A1", "#1DD1A1", "#1DD1A1", "#1DD1A1", "#576574", null,
            null, "#576574", "#1DD1A1", "#1DD1A1", "#1DD1A1", "#1DD1A1", "#576574", null,
            null, "#576574", "#576574", "#576574", "#576574", "#576574", "#576574", null,
            null, null, null, "#576574", "#576574", null, null, null,
            null, "#576574", "#576574", "#576574", "#576574", "#576574", "#576574", null,
            null, "#576574", "#000000", "#576574", "#576574", "#000000", "#576574", null,
            null, null, null, null, null, null, null, null
        ],
        gridSize: 8,
        color: "#2c3e50"
    },
    "The Donut Muncher": {
        pixels: [
            null, null, "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", null, null,
            null, "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", null,
            "#FF6B6B", "#000000", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#000000", "#FF6B6B", "#FF6B6B",
            "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B", "#FF6B6B",
            null, "#FF6B6B", "#000000", "#FF6B6B", "#000000", "#FF6B6B", null, null,
            null, null, "#FF6B6B", null, "#FF6B6B", null, null, null,
            null, "#FF6B6B", null, null, null, "#FF6B6B", null, null,
            null, null, null, null, null, null, null, null
        ],
        gridSize: 8,
        color: "#000000"
    },
    "The Arcade": {
        pixels: [
            null, null, "#2ecc71", null, null, "#2ecc71", null, null,
            null, null, null, "#2ecc71", "#2ecc71", null, null, null,
            null, null, "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", null, null,
            null, "#2ecc71", "#2ecc71", null, null, "#2ecc71", "#2ecc71", null,
            "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71",
            "#2ecc71", null, "#2ecc71", "#2ecc71", "#2ecc71", "#2ecc71", null, "#2ecc71",
            "#2ecc71", null, "#2ecc71", null, null, "#2ecc71", null, "#2ecc71",
            null, null, "#2ecc71", null, null, "#2ecc71", null, null
        ],
        gridSize: 8,
        color: "#000000"
    }
};

// 4. Shop Inventory
const SHOP_ITEMS = [
    { id: 'raffle_ticket', name: 'Weekly Raffle Ticket', cost: 2, icon: '🎟️', desc: 'Win the FRIDAY JACKPOT! (Prize: 2 items from the box).', type: 'physical' },
    { id: 'snack_box', name: 'Snack Box Treat', cost: 5, icon: '🍪', desc: 'One treat from the box.', type: 'physical' },
    { id: 'snack_2', name: 'Double Snack Attack', cost: 8, icon: '🍫', desc: 'Permission to take a SECOND treat.', type: 'physical' },
    { id: 'vip_schedule', name: 'VIP Schedule Bump', cost: 25, icon: '📅', desc: "Bump your show to the top of the 'let's work on it' list.", type: 'physical' },
    { id: 'comfy_chair', name: 'Comfy Chair Rental', cost: 30, icon: '🪑', desc: 'Rent the good chair for a day.', type: 'physical' },
    { id: 'rainbow_name', name: 'Rainbow Name', cost: 50, icon: '🌈', desc: 'Make your name shimmer on the leaderboard!', type: 'digital' },
    { id: 'gold_border', name: 'Gold Border', cost: 50, icon: '✨', desc: 'A shiny gold border for your avatar!', type: 'digital' },
    { id: 'neon_name', name: 'Neon Name', cost: 75, icon: '💡', desc: 'Make your name glow with neon light!', type: 'digital' },
    { id: 'verified_badge', name: 'Verified Badge', cost: 150, icon: '✅', desc: 'Official blue checkmark. Serious business.', type: 'digital' },
    { id: 'gold_pass', name: 'The GOLD Pass', cost: 100, icon: '🎫', desc: 'A physical, laminated Gold VIP Lanyard.', type: 'physical' },
    { id: 'name_camera', name: 'Name a Camera', cost: 500, icon: '🎥', desc: 'Permanently name a DJI or Sony camera!', type: 'physical' },
];

const MOVIE_QUOTES = [
    { text: "May the Force be with you.", source: "Star Wars (1977)", reward: 1 },
    { text: "There's no place like home.", source: "The Wizard of Oz (1939)", reward: 1 },
    { text: "I'm the king of the world!", source: "Titanic (1997)", reward: 1 },
    { text: "Carpe diem. Seize the day, boys. Make your lives extraordinary.", source: "Dead Poets Society (1989)", reward: 1 },
    { text: "Elementary, my dear Watson.", source: "The Adventures of Sherlock Holmes (1939)", reward: 1 },
    { text: "It's alive! It's alive!", source: "Frankenstein (1931)", reward: 1 },
    { text: "My mama always said life was like a box of chocolates. You never know what you're gonna get.", source: "Forrest Gump (1994)", reward: 1 },
    { text: "I'll have what she's having.", source: "When Harry Met Sally... (1989)", reward: 1 },
    { text: "You're gonna need a bigger boat.", source: "Jaws (1975)", reward: 1 },
    { text: "Here's looking at you, kid.", source: "Casablanca (1942)", reward: 1 },
    { text: "Houston, we have a problem.", source: "Apollo 13 (1995)", reward: 1 },
    { text: "You can't handle the truth!", source: "A Few Good Men (1992)", reward: 1 },
    { text: "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.", source: "Ferris Bueller's Day Off (1986)", reward: 1 },
    { text: "To infinity and beyond!", source: "Toy Story (1995)", reward: 1 },
    { text: "Honey, where is my super suit?", source: "The Incredibles (2004)", reward: 1 },
    { text: "I am your father.", source: "Star Wars: The Empire Strikes Back (1980)", reward: 1 },
    { text: "With great power comes great responsibility.", source: "Spider-Man (2002)", reward: 1 },
    { text: "It does not do to dwell on dreams and forget to live.", source: "Harry Potter and the Sorcerer's Stone (2001)", reward: 1 },
    { text: "Roads? Where we're going, we don't need roads.", source: "Back to the Future (1985)", reward: 1 },
    { text: "Hakuna Matata! It means no worries for the rest of your days.", source: "The Lion King (1994)", reward: 1 },
    { text: "E.T. phone home.", source: "E.T. the Extra-Terrestrial (1982)", reward: 1 },
    { text: "Bond. James Bond.", source: "Dr. No (1962)", reward: 1 },
    { text: "You shall not pass!", source: "The Lord of the Rings: The Fellowship of the Ring (2001)", reward: 1 },
    { text: "I see dead people.", source: "The Sixth Sense (1999)", reward: 1 },
    { text: "Hasta la vista, baby.", source: "Terminator 2: Judgment Day (1991)", reward: 1 },
    { text: "Just keep swimming.", source: "Finding Nemo (2003)", reward: 1 },
    { text: "Magic Mirror on the wall, who is the fairest one of all?", source: "Snow White and the Seven Dwarfs (1937)", reward: 1 },
    { text: "Nobody puts Baby in a corner.", source: "Dirty Dancing (1987)", reward: 1 },
    { text: "I'm walking here! I'm walking here!", source: "Midnight Cowboy (1969)", reward: 1 },
    { text: "You had me at 'hello'.", source: "Jerry Maguire (1996)", reward: 1 },
    { text: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", source: "Rocky Balboa (2006)", reward: 1 },
    { text: "We will not go quietly into the night! We will not vanish without a fight! We're going to live on!", source: "Independence Day (1996)", reward: 1 },
    { text: "All we have to decide is what to do with the time that is given us.", source: "The Lord of the Rings: The Fellowship of the Ring (2001)", reward: 1 },
];

const TRAINING_QUOTES = [
    "The best camera is the one you have with you, but a tripod never hurts.",
    "We'll fix it in post-production, said every director who regretted it later.",
    "Lighting isn't just about exposure; it's about mood, depth, and storytelling.",
    "Sound is half the picture, so never underestimate the power of a good microphone.",
    "A film is made three times: when it is written, when it is shot, and when it is edited.",
    "Continuity is key, so make sure the actor holds the cup in the same hand.",
    "Wide angle lenses exaggerate distance, while telephoto lenses compress it.",
    "The rule of thirds is a guideline, not a law, but you should learn it before you break it.",
    "Magic hour offers the most beautiful light, but it only lasts for a short time.",
    "Don't cross the 180-degree line unless you want to confuse your audience.",
    "Every cut should be motivated by the story, not just because you're bored.",
    "Show, don't tell, is the golden rule of visual storytelling.",
    "Good editing is invisible; it guides the audience without drawing attention to itself.",
];

const TECHNICAL_PARAGRAPHS = [
    "The ISO setting on a digital camera determines the image sensor's sensitivity to light. While a lower ISO value produces a cleaner image with less digital noise, increasing the ISO allows for shooting in low-light conditions without reducing shutter speed, albeit at the cost of introducing grain. Professional cinematographers often strive to shoot at the camera's native ISO to maximize dynamic range and ensure the highest possible signal-to-noise ratio for the final grade.",
    "Shutter angle is a terminology used in motion picture cameras to describe the duration of exposure. A standard 180-degree shutter angle means the shutter is open for half the duration of each frame, resulting in natural-looking motion blur that mimics the human eye. Deviating from this standard, such as using a narrow 45-degree shutter, creates a staccato, choppy effect often used in action sequences to heighten the sense of chaos and intensity.",
    "Depth of field is controlled by the aperture, focal length, and distance to the subject. A wide aperture (low f-stop) creates a shallow depth of field, isolating the subject against a soft, bokeh-filled background, which is a hallmark of the cinematic look. Conversely, a narrow aperture (high f-stop) increases the depth of field, keeping both the foreground and background in sharp focus, often used in landscape photography or deep-focus cinematography.",
    "Color grading is the post-production process of altering and enhancing the color of a motion picture, video image, or still image. Unlike color correction, which fixes exposure and white balance issues, grading is a creative choice used to establish a visual tone or mood. For example, a 'teal and orange' look is commonly used in blockbusters to create color contrast between skin tones and the environment.",
    "Video compression codecs like H.264 and ProRes determine how video data is stored and played back. Intra-frame codecs compress each frame individually, resulting in larger file sizes but requiring less processing power to edit. Inter-frame codecs, however, save space by only storing the differences between frames, which makes them efficient for delivery but more taxing on the CPU during the editing process.",
    "Three-point lighting is a standard method used in visual media. It consists of a key light, which is the primary light source illuminating the subject; a fill light, which softens the shadows created by the key light; and a backlight (or rim light), which separates the subject from the background by creating a glowing edge. Mastering this setup is fundamental to creating professional-looking interviews and narrative scenes.",
    "The sample rate in digital audio determines how many times per second the sound wave is measured. The standard for video production is 48kHz, which is sufficient to capture the full range of human hearing. Bit depth, on the other hand, determines the dynamic range of the audio. Recording at 24-bit provides a much lower noise floor than 16-bit, allowing for more flexibility in post-production when adjusting levels.",
    "Focal length affects not just magnification but also the psychological impact of a shot. A wide-angle lens exaggerates perspective, making objects appear further apart and movement seem faster, often creating a sense of unease or dynamism. A telephoto lens compresses space, making background elements appear closer to the subject, which can feel claustrophobic or intimate depending on the context."
];

const RESOLVE_SHORTCUTS = [
    { keys: ["B"], label: "Blade Mode" },
    { keys: ["A"], label: "Selection Mode" },
    { keys: ["I"], label: "Mark In" },
    { keys: ["O"], label: "Mark Out" },
    { keys: ["J"], label: "Play Reverse" },
    { keys: ["K"], label: "Pause" },
    { keys: ["L"], label: "Play Forward" },
    { keys: ["M"], label: "Add Marker" }
];
const TRAINING_QUOTES_CONTINUED = [
    "Always check your focus, because a blurry shot is usually a useless shot.",
    "Filmmaking is a collaborative art form, so treat your crew with respect.",
    "Storyboards help you visualize the film before you even pick up a camera.",
    "White balance ensures that your colors look natural in different lighting conditions.",
    "Depth of field can be used to isolate your subject and guide the viewer's eye.",
    "Foley artists create sound effects that bring the world of the film to life.",
    "The final cut is the director's vision, but the editor is the one who stitches it together."
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
// --- Firebase Init ---
// Moved to top

// --- Helpers ---

const triggerConfetti = () => {
    const count = 40;
    for (let i = 0; i < count; i++) {
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
            el.style.transform = `translate(${tx}px, ${ty}px) rotate(${Math.random() * 360}deg)`;
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
            <span className="text-[10px] font-medium">{label}</span>
        </div>
    </button>
);

// --- LIVE STUDIO COMPONENTS ---


const LiveDock = ({ users, currentUser, onEditProfile, onEditPixels }) => {
    if (!ENABLE_LIVE_STUDIO) return null;

    // Filter for ONLINE users only (active in last 5 mins)
    const onlineUsers = users.filter(u => {
        if (!u.last_seen) return false;
        return (Date.now() - u.last_seen.toMillis()) < 5 * 60 * 1000;
    });

    // Sort: Current user first (if needed for list, but we handle current user separately), then alphabetical
    // Actually, for the main list, we want to exclude current user and just show others
    const otherOnlineUsers = onlineUsers
        .filter(u => u.name !== currentUser?.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="bg-slate-800 border-b-4 border-slate-900 p-3 pb-8 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-4 min-w-max px-2">
                <div className="flex items-center gap-2 mr-4 border-r border-slate-600 pr-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Live<br />Studio
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                </div>

                {/* Current User (Always Visible for Editing) */}
                {currentUser && (
                    <div className="group relative mr-4">
                        <PixelArtAvatar
                            pixels={currentUser.avatar_pixels}
                            gridSize={currentUser.avatar_grid_size}
                            size={48}
                            fallbackInitials={currentUser.name.charAt(0).toUpperCase()}
                            fallbackColor={currentUser.avatar_color}
                        />
                        <div
                            onClick={onEditPixels}
                            className="absolute -bottom-1 -right-1 bg-white text-slate-900 rounded-full p-0.5 border border-slate-900 shadow-sm group-hover:scale-110 transition-transform cursor-pointer"
                        >
                            <Edit2 size={10} />
                        </div>
                        {/* Label for 'You' */}
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                            You
                        </div>
                    </div>
                )}

                {/* Separator if others are online */}
                {otherOnlineUsers.length > 0 && (
                    <div className="w-px h-8 bg-slate-700 mx-2"></div>
                )}

                {/* Other Online Users */}
                {otherOnlineUsers.length > 0 ? (
                    otherOnlineUsers.map(u => (
                        <div key={u.name} className="group relative animate-in fade-in slide-in-from-right-4 duration-500">
                            <PixelArtAvatar
                                pixels={u.avatar_pixels}
                                gridSize={u.avatar_grid_size}
                                size={32}
                                fallbackInitials={u.name.charAt(0).toUpperCase()}
                                fallbackColor={u.avatar_color}
                            />
                            {/* Tooltip */}
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                {u.name}
                            </div>
                        </div>
                    ))
                ) : (
                    /* Empty State */
                    <div className="flex items-center gap-2 text-slate-500 animate-in fade-in duration-700">
                        <span className="text-2xl grayscale opacity-50">🐈</span>
                        <span className="text-xs font-medium italic">The studio is quiet...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const DressingRoomModal = ({ isOpen, onClose, currentData, onSave }) => {
    const [selectedColor, setSelectedColor] = useState(currentData?.color || AVATAR_COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState(currentData?.icon || MEDIA_EMOJIS[0]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border-4 border-slate-900 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-100 p-4 border-b-2 border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Sparkles className="text-purple-500" /> Dressing Room
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Preview */}
                    <div className="flex justify-center">
                        <div className="text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Preview</p>
                            <PixelAvatar
                                icon={selectedIcon}
                                color={selectedColor}
                                isOnline={true}
                                size="lg"
                            />
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Choose Background</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {AVATAR_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${selectedColor === color ? 'border-slate-900 scale-110 ring-2 ring-offset-2 ring-slate-200' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Icon Picker */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Choose Icon</p>
                        <div className="grid grid-cols-5 gap-2">
                            {MEDIA_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setSelectedIcon(emoji)}
                                    className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-all hover:bg-slate-50 ${selectedIcon === emoji ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-100'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => onSave(selectedColor, selectedIcon)}
                        className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
                    >
                        Save & Update
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Application ---

function BankView({ user, onDeposit, onWithdraw, onPayInterest, isAdmin, allUsers }) {
    const [amount, setAmount] = useState("");
    const walletBalance = user.balance || 0;
    const bankBalance = user.bank_balance || 0;
    const interestRate = 0.10;
    const projectedInterest = Math.floor(bankBalance * interestRate);
    const nextMilestone = Math.floor((projectedInterest + 1) / interestRate);
    const neededForNext = nextMilestone - bankBalance;

    // Admin Calc
    const totalBanked = allUsers.reduce((sum, u) => sum + (u.bank_balance || 0), 0);
    const totalInterestPayout = allUsers.reduce((sum, u) => sum + Math.floor((u.bank_balance || 0) * interestRate), 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Landmark size={120} />
                </div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
                        <Landmark className="text-yellow-400" /> The Donut Bank
                    </h2>
                    <p className="text-slate-400 text-sm mb-6">Secure your sweets. Earn interest.</p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                            <p className="text-xs text-slate-400 uppercase font-bold">Wallet</p>
                            <p className="text-2xl font-bold">{walletBalance} {EMOJI}</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-yellow-500/30">
                            <p className="text-xs text-yellow-400 uppercase font-bold">Bank Balance</p>
                            <p className="text-2xl font-bold text-yellow-400">{bankBalance} {EMOJI}</p>
                        </div>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-300">Projected Interest (10%)</span>
                            <span className="text-xl font-bold text-green-400">+{projectedInterest} {EMOJI}</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full" style={{ width: `${(bankBalance % 10) * 10}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 text-right">
                            {neededForNext > 0 ? `Deposit ${neededForNext} more to earn +1 interest!` : "Maximizing interest!"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 italic text-center">
                            "The Bank doesn't deal in crumbs. We round down."
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <ArrowRight size={16} /> Teller Window
                </h3>

                <div className="flex flex-col gap-4">
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold">{EMOJI}</span>
                        <input
                            type="number"
                            className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none font-bold text-lg"
                            placeholder="Amount"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => { onDeposit(parseInt(amount)); setAmount(""); }}
                            disabled={!amount || parseInt(amount) <= 0 || parseInt(amount) > walletBalance}
                            className="w-full py-3"
                        >
                            Deposit
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { onWithdraw(parseInt(amount)); setAmount(""); }}
                            disabled={!amount || parseInt(amount) <= 0 || parseInt(amount) > bankBalance}
                            className="w-full py-3"
                        >
                            Withdraw
                        </Button>
                    </div>

                    <div className="flex justify-center gap-4 text-xs text-slate-400">
                        <button onClick={() => setAmount(walletBalance)} className="hover:text-pink-500">Max Deposit</button>
                        <button onClick={() => setAmount(bankBalance)} className="hover:text-pink-500">Max Withdraw</button>
                    </div>
                </div>
            </Card>

            {isAdmin && (
                <div className="bg-slate-800 text-white border border-slate-700 rounded-xl shadow-sm p-4">
                    <h3 className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
                        <Crown size={16} /> Bank Manager Controls
                    </h3>
                    <div className="space-y-2 text-sm text-slate-300 mb-4">
                        <div className="flex justify-between">
                            <span>Total Deposits:</span>
                            <span className="font-bold">{totalBanked} {EMOJI}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Payout:</span>
                            <span className="font-bold text-green-400">{totalInterestPayout} {EMOJI}</span>
                        </div>
                    </div>
                    <Button
                        variant="success"
                        className="w-full"
                        onClick={() => {
                            if (confirm(`Pay out ${totalInterestPayout} donuts in interest to all users?`)) {
                                onPayInterest();
                            }
                        }}
                        disabled={totalInterestPayout === 0}
                    >
                        Pay Interest (10%)
                    </Button>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <h4 className="font-bold text-sm text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                            <PiggyBank size={14} /> Depositor Ledger
                        </h4>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {allUsers
                                .filter(u => (u.bank_balance || 0) > 0)
                                .sort((a, b) => (b.bank_balance || 0) - (a.bank_balance || 0))
                                .map((u, i) => (
                                    <div key={u.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-mono text-xs w-4">{i + 1}.</span>
                                            <span className="font-bold text-slate-200">{u.name}</span>
                                        </div>
                                        <span className="font-mono text-yellow-400 font-bold">{u.bank_balance} {EMOJI}</span>
                                    </div>
                                ))
                            }
                            {allUsers.filter(u => (u.bank_balance || 0) > 0).length === 0 && (
                                <p className="text-slate-500 text-xs italic text-center py-4">The vault is empty.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ClawMachine({ user, onWin, lastPlayed }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [clawState, setClawState] = useState('idle'); // idle, dropping, grabbing, rising
    const [prize, setPrize] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);

    // Cooldown Logic
    const COOLDOWN_HOURS = 24;
    const now = Date.now();
    const lastPlayedTime = lastPlayed ? lastPlayed.toMillis() : 0;
    const timeSinceLastPlay = now - lastPlayedTime;
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const isOnCooldown = timeSinceLastPlay < cooldownMs;
    const remainingMs = cooldownMs - timeSinceLastPlay;

    // Format remaining time
    const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    const handlePlay = () => {
        if (isPlaying || isOnCooldown) return;

        setIsPlaying(true);
        setClawState('dropping');
        setPrize(null);
        setShowConfetti(false);

        // 1. Determine Prize Immediately
        const rand = Math.random() * 100;
        let wonPrize = null;

        if (rand < 90) {
            wonPrize = { type: 'donut', amount: 1, label: "Glazed Donut", icon: "🍩" };
        } else if (rand < 99) {
            wonPrize = { type: 'donut', amount: 5, label: "Box of Donuts", icon: "🎁" };
        } else {
            wonPrize = { type: 'item', id: 'golden_ticket', label: "Golden Ticket", icon: "🎫" };
        }

        // 2. Animation Sequence
        // Drop (2.5s) -> Grab (0.5s) -> Rise (2.5s) -> Reveal

        setTimeout(() => {
            setClawState('grabbing');
        }, 2500);

        setTimeout(() => {
            setClawState('rising');
            setPrize(wonPrize); // Attach prize to claw visually
        }, 3000);

        setTimeout(() => {
            setClawState('idle');
            setIsPlaying(false);
            setShowConfetti(true);
            try {
                triggerConfetti();
            } catch (e) {
                console.error("Confetti error:", e);
            }
            // Note: We do NOT call onWin here anymore. 
            // We wait for the user to click "Awesome!" to claim the prize.
        }, 5500);
    };

    const handleClaim = () => {
        if (prize) {
            onWin(prize);
        }
        setShowConfetti(false);
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-500">
            <div className="relative w-full max-w-sm bg-slate-900 rounded-t-3xl rounded-b-xl p-2 shadow-2xl border-4 border-slate-800 ring-4 ring-pink-500/30">
                {/* Marquee Header */}
                <div className="bg-pink-500 text-white text-center py-2 rounded-t-xl font-black tracking-widest uppercase text-sm mb-2 shadow-lg border-b-4 border-pink-700 relative overflow-hidden">
                    <span className="relative z-10 drop-shadow-md">Daily Claw</span>
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>

                {/* Glass Cabinet */}
                <div className="claw-machine-glass h-64 w-full bg-slate-800 rounded-lg border-4 border-slate-700 relative">
                    {/* Background Grid */}
                    <div className="absolute inset-0 arcade-grid-bg opacity-30"></div>

                    {/* The Claw Assembly */}
                    <div className={`claw-cable z-20 ${clawState === 'dropping' ? 'h-[140px]' : clawState === 'rising' ? 'h-[20px]' : 'h-[20px]'}`}></div>
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-[2500ms] ease-in-out ${clawState === 'dropping' ? 'top-[140px]' : 'top-[20px]'}`}
                    >
                        {/* Claw Sprite */}
                        <div className={`text-4xl filter drop-shadow-lg ${clawState === 'grabbing' || clawState === 'rising' ? '' : 'animate-claw-shake'}`}>
                            {clawState === 'grabbing' || clawState === 'rising' ? '✊' : '🖐️'}
                        </div>

                        {/* Prize in Claw */}
                        {clawState === 'rising' && prize && (
                            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                                {prize.icon}
                            </div>
                        )}
                    </div>

                    {/* Pile of Donuts (Bottom) */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 flex items-end justify-center gap-1 overflow-hidden opacity-80">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="text-2xl transform translate-y-2" style={{ animationDelay: `${i * 0.1}s` }}>
                                {['🍩', '🍪', '🎁', '🎫'][i % 4]}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-slate-800 p-4 rounded-b-lg mt-2 flex flex-col items-center gap-3 border-t-2 border-slate-700">
                    {isOnCooldown ? (
                        <div className="text-center">
                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Next Play In</div>
                            <div className="bg-slate-900 text-red-500 font-mono text-xl px-4 py-2 rounded border border-slate-700 shadow-inner">
                                {hoursLeft}h {minsLeft}m
                            </div>
                        </div>
                    ) : (
                        <div className="text-green-400 text-xs font-bold uppercase animate-pulse">
                            READY TO PLAY!
                        </div>
                    )}

                    <button
                        onClick={handlePlay}
                        disabled={isPlaying || isOnCooldown}
                        className={`
                            w-full py-4 rounded-xl font-black text-lg tracking-wider uppercase transition-all transform
                            ${isPlaying || isOnCooldown
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed border-b-4 border-slate-900'
                                : 'bg-pink-500 hover:bg-pink-400 text-white shadow-lg border-b-4 border-pink-700 active:border-b-0 active:translate-y-1 pixel-btn'
                            }
                        `}
                    >
                        {isPlaying ? "Good Luck..." : "GRAB!"}
                    </button>

                    <div className="text-[10px] text-slate-500 font-mono text-center">
                        100% WIN RATE • 1 PLAY / 24H
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {showConfetti && prize && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white border-4 border-yellow-400 p-6 rounded-2xl shadow-2xl text-center transform animate-in zoom-in duration-300 pointer-events-auto max-w-xs w-full">
                        <div className="text-6xl mb-4 animate-bounce">{prize.icon}</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">YOU WON!</h3>
                        <p className="text-slate-500 font-medium mb-6">
                            You grabbed a <span className="text-pink-500 font-bold">{prize.label}</span>!
                        </p>
                        <button
                            onClick={handleClaim}
                            className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
                        >
                            Awesome!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ArcadeView({ user, onWinBonus }) {
    const [isTypingDefenceOpen, setIsTypingDefenceOpen] = useState(false);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isTypingDefenceOpen && <TypingDefenceModal onClose={() => setIsTypingDefenceOpen(false)} onReward={onWinBonus} />}
            <div className="text-center mb-6">
                <h2 className="text-3xl font-black text-slate-800 flex items-center justify-center gap-3">
                    <span className="text-4xl">🕹️</span> THE ARCADE
                </h2>
                <p className="text-slate-500 font-medium">Play daily. Win prizes.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Game Card: Claw Machine */}
                <Card className="col-span-1 border-4 border-pink-200 bg-pink-50 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                        HOT
                    </div>
                    <div className="p-4 flex flex-col items-center text-center">
                        <h3 className="text-xl font-black text-pink-600 mb-1 text-center">DONUT CLAW</h3>
                        <p className="text-xs text-pink-400 font-bold uppercase tracking-wider mb-4 text-center">Daily Bonus Game</p>

                        <ClawMachine
                            user={user}
                            lastPlayed={user?.last_daily_bonus}
                            onWin={onWinBonus}
                        />
                    </div>
                </Card>

                {/* Game Card: Typing Defence */}
                <Card className="col-span-1 border-4 border-green-500 !bg-slate-900 overflow-hidden relative group shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                    {/* Retro Grid Background */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #22c55e 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                    {/* CRT Overlay */}
                    <div className="crt-overlay absolute inset-0 pointer-events-none z-20"></div>

                    <div className="absolute top-0 right-0 bg-green-500 text-black text-xs font-bold px-2 py-1 rounded-bl-lg z-10 animate-pulse">
                        NEW
                    </div>

                    <div className="p-6 flex flex-col items-center justify-center text-center h-full relative z-10 gap-6">
                        <div>
                            <h3 className="text-2xl font-black text-green-400 mb-1 text-center font-mono tracking-tighter drop-shadow-lg">TYPING DEFENCE</h3>
                            <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Protect the Base!</p>
                        </div>

                        <div className="text-7xl animate-bounce drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]">👾</div>

                        <Button
                            onClick={() => setIsTypingDefenceOpen(true)}
                            className="w-full bg-green-600 hover:bg-green-500 text-black font-bold font-mono border-b-4 border-green-800 active:border-b-0 active:translate-y-1 text-lg py-3"
                        >
                            INSERT COIN
                        </Button>
                    </div>
                </Card>

                <Card className="col-span-1 border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-8 opacity-60 text-center">
                    <div className="text-4xl mb-4 grayscale">🎡</div>
                    <h3 className="text-lg font-bold text-slate-400">Spin The Wheel</h3>
                    <p className="text-xs text-slate-400 uppercase mt-1">Coming Soon</p>
                </Card>
            </div>
        </div>
    );
}

export default function YumDonutApp() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('give');

    // Data State
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [raffleState, setRaffleState] = useState({ tickets: [], lastWinner: null, lastWinDate: null });
    const [bounties, setBounties] = useState([]);
    const [goalData, setGoalData] = useState({ current: 0, target: 50, title: "Frosted Friday Goal", contributors: {} });
    const [myProfile, setMyProfile] = useState(null);
    const [notification, setNotification] = useState(null);
    const [isSandbox, setIsSandbox] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [featuredItemIds, setFeaturedItemIds] = useState([]);
    const [roster, setRoster] = useState(INITIAL_ROSTER);
    const [isRosterManagerOpen, setIsRosterManagerOpen] = useState(false);

    // Roster Listener & Migration
    useEffect(() => {
        const rosterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'roster');
        const unsubscribe = onSnapshot(rosterRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.names && Array.isArray(data.names)) {
                    setRoster(data.names);
                } else {
                    // Document exists but names missing/invalid
                    setDoc(rosterRef, { names: INITIAL_ROSTER }, { merge: true });
                }
            } else {
                // Migration: Create roster if missing
                setDoc(rosterRef, { names: INITIAL_ROSTER }, { merge: true });
            }
        });
        return () => unsubscribe();
    }, []);

    // Live Studio State
    const [isDressingRoomOpen, setIsDressingRoomOpen] = useState(false);

    // Pixel Avatar State
    const [isPixelStudioOpen, setIsPixelStudioOpen] = useState(false);

    const isAdmin = myProfile?.name === "Mr Rayner";

    const showNotification = (msg, type = "success") => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

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
                    showNotification("Connection issue. Please refresh.", "error");
                });
                return () => unsubProfile();
            } else {
                setLoading(false);
            }
        });

        // Safety Valve: If loading takes too long (e.g. firewall blocking Firestore), force stop.
        const safetyTimer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn("Loading timed out. Forcing UI render.");
                    showNotification("Loading timed out. Check connection.", "error");
                    return false;
                }
                return prev;
            });
        }, 10000); // 10 seconds

        return () => {
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    // --- LIVE STUDIO HEARTBEAT ---
    useEffect(() => {
        if (!ENABLE_LIVE_STUDIO || !user || !myProfile) return;

        const updateHeartbeat = async () => {
            try {
                const timestamp = serverTimestamp();
                const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
                const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

                // Update last_seen
                await updateDoc(userRef, { last_seen: timestamp });
                await updateDoc(publicRef, { last_seen: timestamp });
            } catch (e) {
                console.error("Heartbeat failed:", e);
            }
        };

        // Initial update
        updateHeartbeat();

        // Interval update (every 5 mins)
        const interval = setInterval(updateHeartbeat, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, myProfile?.name]);

    const handleSaveProfile = async (color, icon) => {
        if (!user || !myProfile) return;
        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            const updates = {
                live_avatar_color: color,
                live_avatar_icon: icon
            };

            await updateDoc(userRef, updates);
            await updateDoc(publicRef, updates);

            // Optimistic update
            setMyProfile(prev => ({ ...prev, ...updates }));
            setIsDressingRoomOpen(false);
            showNotification("Profile Updated! Looking fresh. ✨");
        } catch (e) {
            console.error("Profile update failed:", e);
            showNotification("Could not update profile.", "error");
        }
    };

    // 2. Featured Items Listener (Gold Card)
    useEffect(() => {
        try {
            const unsub = onSnapshot(doc(db, 'config', 'shop'), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setFeaturedItemIds(Array.isArray(data.featuredItemIds) ? data.featuredItemIds : []);
                }
            }, (error) => {
                console.error("Error fetching shop config:", error);
            });
            return () => unsub();
        } catch (err) {
            console.error("Error setting up shop listener:", err);
        }
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

        const raffleRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'raffle', 'state');
        const unsubRaffle = onSnapshot(raffleRef, (docSnap) => {
            if (docSnap.exists()) {
                setRaffleState(docSnap.data());
            } else {
                // Do NOT reset the state if missing. Let the first purchase create it.
                // setDoc(raffleRef, { tickets: [], lastWinner: null, lastWinDate: null });
                setRaffleState(null);
            }
        }, (e) => console.error("Raffle error", e));

        return () => { unsubUsers(); unsubFeed(); unsubGoal(); unsubBounties(); unsubRaffle(); };
    }, [user]);

    // Auto-Sync Wallet & Bank
    useEffect(() => {
        if (!user || !myProfile || users.length === 0 || isSandbox) return; // Added isSandbox check
        const publicProfile = users.find(u => u.name === myProfile.name);
        if (publicProfile) {
            const publicBalance = publicProfile.balance || 0;
            const privateBalance = myProfile.balance || 0;
            const publicBank = publicProfile.bank_balance || 0;
            const privateBank = myProfile.bank_balance || 0;

            if (publicBalance !== privateBalance || publicBank !== privateBank) {
                const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
                updateDoc(userRef, {
                    balance: publicBalance,
                    bank_balance: publicBank
                }).catch(console.error);
            }
        }
    }, [user, myProfile, users, isSandbox]); // Added isSandbox to dependencies

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

        // Live Studio Defaults
        const randomColor = AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];
        const randomEmoji = MEDIA_EMOJIS[uid.charCodeAt(uid.length - 1) % MEDIA_EMOJIS.length];

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
            bank_balance: 0,
            given_today: 0,
            last_given_date: new Date().toDateString(),
            last_training_date: null,
            last_training_date_sudden_death: null,
            last_training_date_ninja: null,
            training_earned_today: 0,
            training_last_earned_date: new Date().toDateString(),
            sudden_death_won: false,
            typing_license: false,
            avatar_color: avatarColor,
            // Pixel Avatar Fields
            avatar_pixels: [],
            avatar_grid_size: 8,
            // Live Studio Fields
            live_avatar_color: randomColor,
            live_avatar_icon: randomEmoji,
            last_seen: serverTimestamp()
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
            uid: uid,
            typing_license: false,
            // Live Studio Fields
            live_avatar_color: randomColor,
            live_avatar_icon: randomEmoji,
            last_seen: serverTimestamp()
        }, { merge: true });
    };

    // --- AUTHENTICATION ---
    const handleLoginOrRegister = async (name, password, sandboxMode = false) => {
        if (!name || !password) return;
        setLoading(true);
        try {
            if (sandboxMode) {
                setIsSandbox(true);
                // Simulate login by finding user in existing users
                const existing = users.find(u => u.name === name);
                if (existing) {
                    setUser({ uid: existing.uid || "dev-uid", name: existing.name }); // Mock user object
                    // We need to fetch profile manually since onAuthStateChanged won't trigger
                    const userRef = doc(db, 'artifacts', APP_ID, 'users', existing.uid, 'profile', 'data');
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        setMyProfile(userSnap.data());
                    } else {
                        // If profile doesn't exist for sandbox user, create a mock one
                        setMyProfile({
                            name: existing.name,
                            balance: existing.balance || 0,
                            bank_balance: existing.bank_balance || 0,
                            given_today: 0,
                            last_given_date: new Date().toDateString(),
                            last_training_date: null, // Always allow training in sandbox
                            typing_license: true, // Grant license for testing
                            avatar_color: existing.avatar_color || `hsl(${Math.random() * 360}, 70%, 50%)`
                        });
                    }
                    showNotification(`Welcome to Sandbox, ${name}!`);
                    setLoading(false);
                    return;
                } else {
                    showNotification("Sandbox user not found. Try a real user name or create one first.", "error");
                    setLoading(false);
                    return;
                }
            }

            // Real Login Logic
            setIsSandbox(false);
            const email = `${name.replace(/\s+/g, '').toLowerCase()}@yumdonut.school`;
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
                    const email = `${name.replace(/\s+/g, '').toLowerCase()}@yumdonut.school`;
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
        setIsSandbox(false); // Reset sandbox mode on logout
        window.location.reload();
    };

    const handleGiveDonut = async (recipientName, message, amount = 1) => {
        if (!myProfile) return;

        if (isSandbox) {
            showNotification(`Sandbox: Gave ${amount} donut(s) to ${recipientName} (Simulated)`, "info");
            // Optionally, you could update a local state for sandbox users to reflect the change
            // For simplicity, we'll just show a notification.
            return;
        }

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
                    claimed: false,
                    last_training_date: null, // New field for Typing Dojo
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

        if (isSandbox) {
            showNotification(`Sandbox: Munched 1 donut from ${victimName} (Simulated)`, "info");
            return;
        }

        try {
            const recipientRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', victimName);
            const recipientDoc = await getDoc(recipientRef);
            if (!recipientDoc.exists()) {
                showNotification("User has no wallet to munch!", "error");
                return;
            }

            const currentBal = recipientDoc.data().balance || 0;
            const currentBank = recipientDoc.data().bank_balance || 0;

            let updateData = {};
            let munchSource = "";

            if (currentBal >= 1) {
                updateData = { balance: currentBal - 1 };
                munchSource = "wallet";
            } else if (currentBank >= 1) {
                updateData = { bank_balance: currentBank - 1 };
                munchSource = "bank";
            } else {
                showNotification("The Muncher goes hungry (0 donuts anywhere).", "error");
                return;
            }

            await updateDoc(recipientRef, updateData);

            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
                fromName: "The Donut Muncher",
                toName: "Someone",
                message: `Nom nom! Ate a donut from ${munchSource === 'bank' ? 'the BANK' : 'wallet'} because: ${reason}`,
                timestamp: serverTimestamp(),
                emoji: "👾",
                amount: 1,
                likes: []
            });
            showNotification(`Munched 1 donut from ${victimName}'s ${munchSource}!`);
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

    const handleWinBonus = async (prize) => {
        if (!user || !myProfile) return;

        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            // 1. Update Last Played Time
            await updateDoc(userRef, { last_daily_bonus: serverTimestamp() });

            // 2. Process Reward
            if (prize.type === 'donut') {
                const amount = prize.amount;
                // Update Private
                await updateDoc(userRef, { balance: (myProfile.balance || 0) + amount });
                // Update Public
                const publicDoc = await getDoc(publicRef);
                if (publicDoc.exists()) {
                    await updateDoc(publicRef, {
                        balance: (publicDoc.data().balance || 0) + amount,
                        lifetime_received: (publicDoc.data().lifetime_received || 0) + amount
                    });
                }
                showNotification(`You won ${amount} Donut${amount > 1 ? 's' : ''}! Added to wallet.`);
            } else if (prize.type === 'item') {
                // Add item to inventory (Assuming inventory exists or just notify for now)
                // For now, we'll just give the cash equivalent or a special note
                // Actually, let's just give 10 donuts as a "Golden Ticket" equivalent for simplicity in this version
                // OR implement inventory logic if it exists. 
                // Looking at the code, there isn't a robust inventory system visible in the snippets, 
                // so let's treat Golden Ticket as a massive donut win (e.g. 10) or just a badge.
                // Let's give 10 donuts for now to be safe and valuable.
                const amount = 10;
                // Update Private
                await updateDoc(userRef, { balance: (myProfile.balance || 0) + amount });
                // Update Public
                const publicDoc = await getDoc(publicRef);
                if (publicDoc.exists()) {
                    await updateDoc(publicRef, {
                        balance: (publicDoc.data().balance || 0) + amount,
                        lifetime_received: (publicDoc.data().lifetime_received || 0) + amount
                    });
                }
                showNotification("GOLDEN TICKET! You won 10 Donuts!");
            }

            // 3. Log Transaction
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
                fromName: "The Arcade",
                toName: myProfile.name,
                message: `Won a ${prize.label} playing the Claw Machine!`,
                timestamp: serverTimestamp(),
                emoji: "🕹️",
                amount: prize.amount || 10,
                likes: []
            });

        } catch (e) {
            console.error("Bonus Error", e);
            showNotification("Error claiming prize. Contact Mr Rayner.", "error");
        }
    };

    const CORE_VALUES = {
        WHANAUNGATANGA: {
            id: "WHANAUNGATANGA",
            label: "Whanaungatanga",
            color: "bg-teal-500",
            lightColor: "bg-teal-50",
            borderColor: "border-teal-200",
            textColor: "text-teal-700",
            icon: "🤝",
            virtues: ["Connection", "Belonging", "Teamwork", "Inclusion", "Support"]
        },
        EKEA: {
            id: "EKEA",
            label: "Ekea",
            color: "bg-emerald-600",
            lightColor: "bg-emerald-50",
            borderColor: "border-emerald-200",
            textColor: "text-emerald-800",
            icon: "🌱",
            virtues: ["Empowerment", "Ownership", "Leadership", "Initiative", "Growth"]
        },
        RAAKAU: {
            id: "RAAKAU",
            label: "Raakau",
            color: "bg-green-500",
            lightColor: "bg-green-50",
            borderColor: "border-green-200",
            textColor: "text-green-700",
            icon: "🌿",
            virtues: ["Resilience", "Perseverance", "Courage", "Determination", "Strength"]
        },
        ORA: {
            id: "ORA",
            label: "Ora",
            color: "bg-lime-400",
            lightColor: "bg-lime-50",
            borderColor: "border-lime-200",
            textColor: "text-lime-800",
            icon: "☀️",
            virtues: ["Wellbeing", "Open-mindedness", "Balance", "Kindness", "Positivity"]
        }
    };

    const handleContributeToGoal = async (amount = 1) => {
        if (!myProfile || myProfile.balance < amount) {
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
                const newBalance = (userDoc.data().balance || 0) - amount;
                if (newBalance < 0) throw "Not enough donuts!";

                const goalCurrent = (goalDoc.data()?.current || 0) + amount;
                const contributors = goalDoc.data()?.contributors || {};
                const myContribution = (contributors[myProfile.name] || 0) + amount;

                transaction.update(publicUserRef, { balance: newBalance });
                transaction.update(goalRef, {
                    current: goalCurrent,
                    [`contributors.${myProfile.name}`]: myContribution
                });
                const txRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'));
                transaction.set(txRef, { fromName: myProfile.name, toName: goalDoc.data()?.title || "Team Goal", message: `Contributed ${amount} donut${amount > 1 ? 's' : ''} to the goal!`, timestamp: serverTimestamp(), emoji: "🚀", likes: [] });
            });
            const privateUserRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            await updateDoc(privateUserRef, { balance: myProfile.balance - amount });
            showNotification(`Contributed ${amount} donut${amount > 1 ? 's' : ''}!`);
            triggerConfetti();
        } catch (e) {
            console.error(e);
            showNotification("Contribution failed.", "error");
        }
    };

    // RESTORED: Admin Goal Controls
    const handleResetGoal = async () => {
        if (!isAdmin) return;
        if (!confirm("Are you sure you want to reset the goal? This will clear all contributions.")) return;

        const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
        await setDoc(goalRef, {
            current: 0,
            target: 50,
            title: "Frosted Friday Goal",
            contributors: {},
            isActive: true // Default to true on reset
        });
        showNotification("Goal has been reset!");
    };

    const handleToggleGoalActive = async (isActive) => {
        console.log("Toggling Goal Active:", isActive, "Is Admin:", isAdmin);
        if (!isAdmin) {
            console.error("Not admin, cannot toggle.");
            return;
        }
        try {
            const goalRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', 'active_goal');
            await updateDoc(goalRef, { isActive });
            console.log("Goal updated successfully to:", isActive);
            showNotification(`Goal is now ${isActive ? 'Active' : 'Inactive'}`);
        } catch (e) {
            console.error("Error toggling goal:", e);
            showNotification("Failed to toggle goal.", "error");
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

    const handleToggleFeatured = async (itemId) => {
        if (!isAdmin) return;
        const currentIds = featuredItemIds || [];
        let newIds;
        if (currentIds.includes(itemId)) {
            newIds = currentIds.filter(id => id !== itemId);
        } else {
            newIds = [...currentIds, itemId];
        }
        await setDoc(doc(db, 'config', 'shop'), { featuredItemIds: newIds }, { merge: true });
    };

    const handlePurchase = async (item) => {
        if (!myProfile || myProfile.balance < item.cost) {
            showNotification("Not enough donuts!", "error");
            return;
        }
        const currentUserPublic = users.find(u => u.name === myProfile.name);
        if (item.type === 'digital') {
            if (item.id === 'rainbow_name' && currentUserPublic?.rainbow_name) {
                showNotification("Already owned!", "error");
                return;
            }
            if (item.id === 'gold_border' && currentUserPublic?.gold_border) {
                showNotification("Already owned!", "error");
                return;
            }
            if (item.id === 'neon_name' && currentUserPublic?.neon_name) {
                showNotification("Already owned!", "error");
                return;
            }
            if (item.id === 'verified_badge' && currentUserPublic?.verified_badge) {
                showNotification("Already owned!", "error");
                return;
            }
        }
        try {
            const publicUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(publicUserRef);
                if (!userDoc.exists()) throw "User missing";

                // Read Raffle State if needed
                let raffleDoc = null;
                const raffleRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'raffle', 'state');
                if (item.id === 'raffle_ticket') {
                    raffleDoc = await transaction.get(raffleRef);
                }

                const currentBal = userDoc.data().balance || 0;
                if (currentBal < item.cost) throw "Not enough funds";

                // --- WRITES START HERE ---
                const updates = { balance: currentBal - item.cost };
                if (item.type === 'digital') {
                    if (item.id === 'rainbow_name') updates.rainbow_name = true;
                    if (item.id === 'gold_border') updates.gold_border = true;
                    if (item.id === 'neon_name') updates.neon_name = true;
                    if (item.id === 'verified_badge') updates.verified_badge = true;
                }
                transaction.update(publicUserRef, updates);

                // Handle Raffle Ticket Write
                if (item.id === 'raffle_ticket') {
                    if (raffleDoc && raffleDoc.exists()) {
                        const currentTickets = raffleDoc.data().tickets || [];
                        transaction.update(raffleRef, { tickets: [...currentTickets, myProfile.name] });
                    } else {
                        transaction.set(raffleRef, { tickets: [myProfile.name], lastWinner: null, lastWinDate: null });
                    }
                }

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

    const handleDrawRaffle = async () => {
        if (raffleState.tickets.length === 0) {
            showNotification("No tickets sold yet!", "error");
            return;
        }

        const winnerIndex = Math.floor(Math.random() * raffleState.tickets.length);
        const winnerName = raffleState.tickets[winnerIndex];

        try {
            const raffleRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'raffle', 'state');
            await updateDoc(raffleRef, {
                tickets: [],
                lastWinner: winnerName,
                lastWinDate: Date.now()
            });

            // Announce in Feed
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
                fromName: "The Raffle",
                toName: winnerName,
                message: "🎰 RAFFLE WINNER! 🎰",
                timestamp: serverTimestamp(),
                emoji: "🏆",
                likes: []
            });

            triggerConfetti();
            showNotification(`Winner: ${winnerName}!`);
        } catch (e) {
            console.error(e);
            showNotification("Draw failed.", "error");
        }
    };

    const handleRestoreRaffle = async () => {
        try {
            const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), orderBy('timestamp', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            const tickets = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.message && data.message.includes("Purchased: Weekly Raffle Ticket")) {
                    tickets.push(data.fromName);
                }
            });

            // Reverse to preserve order (oldest first) if needed, though order doesn't matter for raffle
            // But transactions are desc, so tickets are newest first.

            if (tickets.length > 0) {
                const raffleRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'raffle', 'state');
                await setDoc(raffleRef, {
                    tickets: tickets,
                    lastWinner: null,
                    lastWinDate: null
                }, { merge: true });
                showNotification(`Restored ${tickets.length} tickets!`);
                triggerConfetti();
            } else {
                showNotification("No ticket purchases found.", "info");
            }
        } catch (e) {
            console.error(e);
            showNotification("Restore failed.", "error");
        }
    };

    // --- CREATE BOUNTY (Time Limit = Minutes from Now) ---
    // --- CREATE BOUNTY (Time Limit = Date Picker) ---
    const handleCreateBounty = async (title, reward, quantity, expiresAtString, scheduledFor = null) => {
        const qty = parseInt(quantity) || 1;

        // If scheduledFor is provided, use it as the start time, otherwise use now
        const startTime = scheduledFor ? new Date(scheduledFor).getTime() : Date.now();

        // Calculate absolute expiry time (number) based on Date Picker
        let expiresAt = null;
        if (expiresAtString) {
            expiresAt = new Date(expiresAtString).getTime();
        }

        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bounties'), {
            title,
            reward: parseInt(reward),
            status: 'open',
            remaining: qty,
            expiresAt: expiresAt, // Store as number (milliseconds)
            scheduledFor: scheduledFor ? startTime : null, // Store start time if scheduled
            createdBy: myProfile.name,
            createdAt: serverTimestamp()
        });

        const timeMsg = expiresAt ? ` (Due: ${new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : "";
        const scheduleMsg = scheduledFor ? ` [Scheduled for ${new Date(scheduledFor).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}]` : "";

        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
            fromName: "Job Board",
            toName: "EVERYONE",
            message: `📢 New Job ${scheduledFor ? "Scheduled" : "Posted"}: ${title} (${reward} ${EMOJI}) - ${qty} spots!${timeMsg}${scheduleMsg}`,
            timestamp: serverTimestamp(),
            emoji: "📢",
            likes: []
        });
        showNotification(scheduledFor ? "Job Scheduled!" : "Job Posted & Announced!");
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

    const handleMarkDone = async (bountyId) => {
        const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
        await updateDoc(bountyRef, { status: 'pending_review' });
        showNotification("Marked as done! Wait for inspection.");
    };

    const handleRejectWork = async (bountyId) => {
        const bountyRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'bounties', bountyId);
        await updateDoc(bountyRef, { status: 'claimed' });
        showNotification("Work rejected. Student must redo.");
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

    // --- BANK ACTIONS ---
    const handleDeposit = async (amount) => {
        if (!myProfile || amount <= 0) return;
        if (myProfile.balance < amount) {
            showNotification("Not enough donuts in wallet!", "error");
            return;
        }
        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const publicDoc = await transaction.get(publicRef);
                if (!userDoc.exists() || !publicDoc.exists()) throw "User missing";

                const currentWallet = userDoc.data().balance || 0;
                const currentBank = userDoc.data().bank_balance || 0;

                if (currentWallet < amount) throw "Insufficient funds";

                if (isSandbox) {
                    showNotification(`Sandbox: Deposited ${amount} donuts (Simulated)`, "info");
                    return;
                }

                transaction.update(userRef, {
                    balance: currentWallet - amount,
                    bank_balance: currentBank + amount
                });
                transaction.update(publicRef, {
                    balance: currentWallet - amount,
                    bank_balance: currentBank + amount
                });
            });
            showNotification(`Deposited ${amount} donuts!`);
        } catch (e) {
            console.error(e);
            showNotification("Deposit failed.", "error");
        }
    };

    const handleWithdraw = async (amount) => {
        if (!myProfile || amount <= 0) return;
        const currentBank = myProfile.bank_balance || 0;
        if (currentBank < amount) {
            showNotification("Not enough donuts in bank!", "error");
            return;
        }
        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const publicDoc = await transaction.get(publicRef);

                const currentWallet = userDoc.data().balance || 0;
                const currentBank = userDoc.data().bank_balance || 0;

                if (currentBank < amount) throw "Insufficient bank funds";

                if (isSandbox) {
                    showNotification(`Sandbox: Withdrew ${amount} donuts (Simulated)`, "info");
                    return;
                }

                transaction.update(userRef, {
                    balance: currentWallet + amount,
                    bank_balance: currentBank - amount
                });
                transaction.update(publicRef, {
                    balance: currentWallet + amount,
                    bank_balance: currentBank - amount
                });
            });
            showNotification(`Withdrew ${amount} donuts!`);
        } catch (e) {
            console.error(e);
            showNotification("Withdrawal failed.", "error");
        }
    };

    const handlePayInterest = async () => {
        // Admin only function to pay 10% interest (rounded down)
        if (myProfile.name !== "Mr Rayner") return;

        if (isSandbox) {
            showNotification("Sandbox: Interest paid (Simulated)", "info");
            return;
        }

        try {
            let totalPaid = 0;

            for (const u of users) {
                const bBalance = u.bank_balance || 0;
                if (bBalance < 10) continue; // Minimum to earn 1 donut (10 * 0.1 = 1)

                const interest = Math.floor(bBalance * 0.10);
                if (interest > 0) {
                    const userPublicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', u.id);

                    if (u.uid) {
                        const userPrivateRef = doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'data');

                        await updateDoc(userPublicRef, {
                            bank_balance: bBalance + interest
                        });

                        await updateDoc(userPrivateRef, {
                            bank_balance: bBalance + interest
                        });

                        totalPaid += interest;
                    }
                }
            }

            if (totalPaid > 0) {
                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
                    fromName: "The Bank",
                    toName: "EVERYONE",
                    message: `PAID INTEREST! Total of ${totalPaid} Donuts distributed to savers! 🏦`,
                    timestamp: serverTimestamp(),
                    emoji: "💸",
                    likes: []
                });
                triggerConfetti();
                showNotification(`Paid ${totalPaid} donuts in interest!`);
            } else {
                showNotification("No interest to pay (nobody has enough savings).");
            }

        } catch (e) {
            console.error(e);
            showNotification("Interest payout failed.", "error");
        }
    };

    const handleDeleteTransaction = async (transactionId) => {
        if (!isAdmin) return;
        if (!confirm("Are you sure you want to delete this message? This will NOT reverse the transaction.")) return;

        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'transactions', transactionId));
            showNotification("Message deleted from feed.");
        } catch (e) {
            console.error(e);
            showNotification("Failed to delete message.", "error");
        }
    };

    // --- TYPING DOJO REWARD ---
    // --- TYPING DOJO REWARD ---
    const handleTrainingReward = async (wpm, accuracy, rewardAmount = 1, badgeToGrant = null, mode = 'scriptwriter', ninjaCombo = 0) => {
        if (!myProfile) return;

        if (isSandbox) {
            showNotification(`Sandbox: Earned ${rewardAmount} donut(s) (Simulated)`, "info");
            return;
        }

        if (!myProfile.typing_license) {
            showNotification("Practice complete! Get your license from Mr Rayner to earn donuts.", "info");
            return;
        }

        const today = new Date().toDateString();

        // Determine which date field to check/update based on mode
        let dateField = 'last_training_date'; // Default for Scriptwriter
        if (mode === 'sudden_death') dateField = 'last_training_date_sudden_death';
        if (mode === 'shortcut_ninja') dateField = 'last_training_date_ninja';

        if (myProfile[dateField] === today) {
            showNotification(`You've already trained in ${mode === 'scriptwriter' ? 'Scriptwriter' : mode === 'sudden_death' ? 'Sudden Death' : 'Ninja'} mode today!`, "error");
            return;
        }

        if (mode !== 'shortcut_ninja') {
            if (wpm < 30 || accuracy < 95) {
                showNotification("Goal not met. Keep practicing!", "error");
                return;
            }
        }

        // --- REWARD LOGIC & DAILY CAP ---
        let finalReward = 1; // Default
        let isFirstTimeSuddenDeath = false;

        if (mode === 'sudden_death') {
            if (!myProfile.sudden_death_won) {
                finalReward = 10;
                isFirstTimeSuddenDeath = true;
                badgeToGrant = 'perfectionist_badge';
            } else {
                finalReward = 2;
            }
        } else if (mode === 'shortcut_ninja') {
            if (ninjaCombo >= 20) {
                finalReward = 2;
            } else {
                finalReward = 1;
            }
        } else {
            // Scriptwriter / Standard
            finalReward = rewardAmount;
        }

        // Check Daily Cap
        // Reset daily tracker if new day
        let earnedToday = myProfile.training_earned_today || 0;
        if (myProfile.training_last_earned_date !== today) {
            earnedToday = 0;
        }

        // Cap Check (Exempt First Time Sudden Death)
        if (!isFirstTimeSuddenDeath && (earnedToday + finalReward > 3)) {
            showNotification(`Daily Training Cap Reached (3/3). Come back tomorrow!`, "error");
            return;
        }

        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const publicDoc = await transaction.get(publicRef);

                if (!userDoc.exists() || !publicDoc.exists()) throw "User missing";

                const currentBal = userDoc.data().balance || 0;
                const currentLifetime = userDoc.data().lifetime_received || currentBal;

                const updateData = {
                    balance: currentBal + finalReward,
                    lifetime_received: currentLifetime + finalReward,
                    [dateField]: today,
                    training_earned_today: earnedToday + finalReward,
                    training_last_earned_date: today
                };

                if (isFirstTimeSuddenDeath) {
                    updateData.sudden_death_won = true;
                }

                if (badgeToGrant) {
                    updateData[badgeToGrant] = true;
                }

                // WPM Tiers (The Flex)
                if (wpm >= 50) updateData.silver_border = true;
                if (wpm >= 70) updateData.gold_border = true;
                if (wpm >= 90) updateData.flame_name = true;

                transaction.update(userRef, updateData);
                transaction.update(publicRef, updateData);

                // Add to Feed
                const feedRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'));
                transaction.set(feedRef, {
                    fromName: "Typing Dojo",
                    toName: myProfile.name,
                    message: `Earned ${finalReward} donut(s) in ${mode === 'sudden_death' ? 'Sudden Death' : mode === 'shortcut_ninja' ? 'Ninja Mode' : 'Training'}! (${mode === 'shortcut_ninja' ? `Streak: ${maxNinjaCombo}` : `${wpm} WPM`})`,
                    timestamp: serverTimestamp(),
                    emoji: mode === 'sudden_death' ? "💀" : mode === 'shortcut_ninja' ? "⚡" : "🥋",
                    amount: finalReward,
                    likes: []
                });


            });

            triggerConfetti();
            showNotification(`Earned ${finalReward} donut(s)!`, "success");
            // Update local state immediately for UI responsiveness
            setUser(prev => ({ ...prev, balance: (prev.balance || 0) + finalReward }));

            let msg = `Training Complete! +${finalReward} Donut${finalReward > 1 ? 's' : ''} 🍩`;
            if (isFirstTimeSuddenDeath) msg += " & JACKPOT! 🎯";

            showNotification(msg);
        } catch (e) {
            console.error(e);
            showNotification("Reward failed.", "error");
        }
    };

    const handleUpdateLicense = async (targetUid, targetName, hasLicense) => {
        if (isSandbox) {
            showNotification(`Sandbox: ${hasLicense ? "Granted" : "Revoked"} license for ${targetName} (Simulated)`, "info");
            return;
        }
        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetName);

            await updateDoc(userRef, { typing_license: hasLicense });
            await updateDoc(publicRef, { typing_license: hasLicense });

            showNotification(`${hasLicense ? "Granted" : "Revoked"} license for ${targetName}!`);
        } catch (e) {
            console.error(e);
            showNotification("Failed to update license.", "error");
        }
    };

    const handleSavePixelAvatar = async (pixels, gridSize) => {
        if (!myProfile || !user) return;

        console.log("Saving avatar...", { pixelsLength: pixels.length, gridSize });

        try {
            const userRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
            const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', myProfile.name);

            const updateData = {
                avatar_pixels: pixels,
                avatar_grid_size: gridSize
            };

            // Use setDoc with merge for robustness
            await setDoc(userRef, updateData, { merge: true });
            await setDoc(publicRef, updateData, { merge: true });

            console.log("Avatar saved to both private and public docs.");
            showNotification("Avatar saved!");
        } catch (e) {
            console.error("Save failed:", e);
            showNotification("Failed to save avatar.", "error");
        }
    };

    const handleLogTypingAttempt = async (wpm, accuracy, mode, reward, ninjaCombo, success) => {
        if (!myProfile) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'typing_logs'), {
                userId: user.uid,
                userName: myProfile.name,
                wpm: wpm,
                accuracy: accuracy,
                mode: mode,
                reward: reward,
                ninjaCombo: ninjaCombo || 0,
                success: success,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error("Failed to log typing attempt:", e);
        }
    };


    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-pink-50">
            <div className="animate-spin text-4xl">{EMOJI}</div>
        </div>
    );

    if (!user || !myProfile) {
        return <LoginScreen onLogin={handleLoginOrRegister} existingUsers={users} roster={roster} />;
    }

    return (
        <div className={`min-h-screen font-sans text-slate-800 pb-20 md:pb-0 transition-colors duration-500 ${view === 'give' && notification?.type === 'munch' ? 'bg-red-50' : 'bg-slate-50'}`}>

            {/* LIVE DOCK */}
            <LiveDock
                users={users}
                currentUser={myProfile}
                onEditProfile={() => setIsDressingRoomOpen(true)}
                onEditPixels={() => setIsPixelStudioOpen(true)}
            />

            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
                {isSandbox && (
                    <div className="absolute top-0 left-0 w-full bg-yellow-400 text-yellow-900 text-[10px] font-bold text-center uppercase tracking-widest">
                        ⚠️ Sandbox Mode: Read Only ⚠️
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <div className="bg-pink-100 p-2 rounded-lg">
                        <span className="text-xl leading-none">{EMOJI}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-lg text-slate-900 leading-tight">YumDonut</h1>
                            <button
                                onClick={() => setShowPatchNotes(true)}
                                className="text-[10px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded-full hover:scale-105 transition-transform shadow-sm flex items-center gap-1"
                            >
                                <Sparkles size={10} /> What's New
                            </button>
                        </div>
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
                        <div className="flex items-center justify-end gap-2">
                            <p className="text-sm font-semibold">{myProfile.name}</p>
                            {myProfile.name === "Mr Rayner" && (
                                <button
                                    onClick={() => setIsRosterManagerOpen(true)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Manage Roster"
                                >
                                    <Users size={14} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsPixelStudioOpen(true)}
                                className="text-slate-400 hover:text-pink-600 transition-colors"
                                title="Edit Pixel Avatar"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => setIsDressingRoomOpen(true)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            {myProfile.name === "Mr Rayner"
                                ? <span className="text-pink-600 font-bold">∞ left (Admin)</span>
                                : `${DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)} left to give`
                            }
                        </p>
                    </div>
                    <div
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        title="Click to Logout"
                        onClick={handleLogout}
                    >
                        <PixelArtAvatar
                            pixels={myProfile.avatar_pixels}
                            gridSize={myProfile.avatar_grid_size}
                            size={40}
                            fallbackInitials={myProfile.name.charAt(0).toUpperCase()}
                            fallbackColor={myProfile.avatar_color}
                        />
                    </div>
                </div>
            </div>

            <DressingRoomModal
                isOpen={isDressingRoomOpen}
                onClose={() => setIsDressingRoomOpen(false)}
                currentData={{ color: myProfile.live_avatar_color, icon: myProfile.live_avatar_icon }}
                onSave={handleSaveProfile}
            />

            {isRosterManagerOpen && (
                <RosterManagerModal
                    onClose={() => setIsRosterManagerOpen(false)}
                    roster={roster}
                />
            )}



            {isPixelStudioOpen && (
                <PixelStudioModal
                    onClose={() => setIsPixelStudioOpen(false)}
                    currentPixels={myProfile.avatar_pixels}
                    currentGridSize={myProfile.avatar_grid_size}
                    onSave={handleSavePixelAvatar}
                />
            )}

            {/* VIEWS */}
            <div className="max-w-md md:max-w-2xl mx-auto p-4 pb-24 md:pb-4">
                {showPatchNotes && <PatchNotesModal onClose={() => setShowPatchNotes(false)} />}

                {notification && (
                    <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-50 animate-bounce ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                        }`}>
                        {notification.msg}
                    </div>
                )}

                <div className="flex overflow-x-auto justify-between border-b border-slate-200 mb-4 pb-1 no-scrollbar">
                    {['give', 'jobs', 'arcade', 'shop', 'bank', 'training', 'goal', 'feed', 'leaderboard'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setView(tab)}
                            className={`px-3 py-2 font-medium text-sm capitalize border-b-2 transition-colors whitespace-nowrap relative ${view === tab ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-700'
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
                        roster={roster}
                        existingUsers={users}
                        currentUserName={myProfile.name}
                        onGive={handleGiveDonut}
                        onMunch={handleMunchDonut}
                        remaining={DAILY_LIMIT - (myProfile.last_given_date === new Date().toDateString() ? myProfile.given_today : 0)}
                        coreValues={CORE_VALUES}
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
                        onMarkDone={handleMarkDone}
                        onReject={handleRejectWork}
                    />
                )}

                {view === 'arcade' && (
                    <ArcadeView
                        user={myProfile}
                        onWinBonus={handleWinBonus}
                    />
                )}

                {view === 'shop' && (
                    <ShopView
                        items={SHOP_ITEMS}
                        userBalance={myProfile?.balance || 0}
                        onPurchase={handlePurchase}
                        currentUserPublic={myProfile}
                        raffleState={raffleState}
                        onDrawRaffle={handleDrawRaffle}
                        onRestoreRaffle={handleRestoreRaffle}
                        featuredItemIds={featuredItemIds}
                        onToggleFeatured={handleToggleFeatured}
                    />
                )}

                {view === 'bank' && (
                    <BankView
                        user={myProfile}
                        onDeposit={handleDeposit}
                        onWithdraw={handleWithdraw}
                        onPayInterest={handlePayInterest}
                        isAdmin={myProfile.name === "Mr Rayner"}
                        allUsers={users}
                    />
                )}

                {view === 'training' && (
                    <TrainingView
                        user={myProfile}
                        onReward={handleTrainingReward}
                        allUsers={users}
                        onUpdateLicense={handleUpdateLicense}
                        onLogAttempt={handleLogTypingAttempt}
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
                        onToggleActive={handleToggleGoalActive}
                    />
                )}

                {view === 'feed' && (
                    <FeedView
                        transactions={transactions}
                        onReact={handleReaction}
                        coreValues={CORE_VALUES}
                        onDelete={handleDeleteTransaction}
                        currentUser={myProfile}
                        users={users}
                    />
                )}

                {view === 'leaderboard' && (
                    <LeaderboardView users={users} roster={roster} />
                )}

            </div>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <NavBtn icon={Gift} label="Give" active={view === 'give'} onClick={() => setView('give')} />
                <NavBtn icon={Briefcase} label="Jobs" active={view === 'bounties'} onClick={() => setView('bounties')} badge={openBountyCount} />
                <NavBtn icon={Gamepad2} label="Arcade" active={view === 'arcade'} onClick={() => setView('arcade')} />
                <NavBtn icon={ShoppingBag} label="Shop" active={view === 'shop'} onClick={() => setView('shop')} />
                <NavBtn icon={Landmark} label="Bank" active={view === 'bank'} onClick={() => setView('bank')} />
                <NavBtn icon={Keyboard} label="Train" active={view === 'training'} onClick={() => setView('training')} />
                <NavBtn icon={Activity} label="Feed" active={view === 'feed'} onClick={() => setView('feed')} />
            </div>
        </div>
    );
}

// --- Sub-Components (Defined BEFORE Main App to avoid ReferenceErrors) ---

function TrainingView({ user, onReward, allUsers, onUpdateLicense, onLogAttempt }) {
    const [gameState, setGameState] = useState('idle'); // idle, playing, finished, failed
    const [mode, setMode] = useState('scriptwriter'); // 'scriptwriter' | 'sudden_death' | 'shortcut_ninja'

    // Common State
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);

    // Typing Dojo State
    const [currentQuote, setCurrentQuote] = useState("");
    const [targetQuoteObject, setTargetQuoteObject] = useState(null);
    const [userInput, setUserInput] = useState("");
    const [wpm, setWpm] = useState(0);
    const [accuracy, setAccuracy] = useState(0);
    const inputRef = useRef(null);
    const [isStatsOpen, setIsStatsOpen] = useState(false);


    // Ninja Mode State
    const [currentShortcut, setCurrentShortcut] = useState(null);
    const [ninjaScore, setNinjaScore] = useState(0);
    const [ninjaLives, setNinjaLives] = useState(3);
    const [ninjaCombo, setNinjaCombo] = useState(0);
    const [maxNinjaCombo, setMaxNinjaCombo] = useState(0);
    const [reactionTimes, setReactionTimes] = useState([]);
    const [cardTimer, setCardTimer] = useState(3000); // Current time in ms
    const [maxCardTimer, setMaxCardTimer] = useState(3000); // Max time for current card (for progress bar)
    const [cardStartTime, setCardStartTime] = useState(0);
    const [feedbackState, setFeedbackState] = useState(null); // 'correct', 'wrong', null
    const timerRef = useRef(null);

    // --- SHORTCUT NINJA LOGIC ---
    useEffect(() => {
        if (mode === 'shortcut_ninja' && gameState === 'playing') {
            const handleKeyDown = (e) => {
                // Prevent default for game keys to avoid browser actions
                if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    // e.preventDefault(); // Optional
                }

                if (!currentShortcut) return;

                const key = e.key.toLowerCase();
                const targetKey = currentShortcut.keys[0].toLowerCase();

                if (key === targetKey) {
                    // Correct!
                    handleNinjaCorrect();
                } else {
                    // Wrong!
                    // Ignore modifier keys alone
                    if (['shift', 'control', 'alt', 'meta'].includes(key)) return;
                    handleNinjaWrong();
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [mode, gameState, currentShortcut]);

    useEffect(() => {
        if (mode === 'shortcut_ninja' && gameState === 'playing') {
            timerRef.current = setInterval(() => {
                setCardTimer(prev => {
                    if (prev <= 0) {
                        handleNinjaWrong(true); // Timeout
                        return 3000; // Reset to safe default (will be overwritten by nextShortcut)
                    }
                    return prev - 100; // 100ms tick
                });
            }, 100);
            return () => clearInterval(timerRef.current);
        }
    }, [mode, gameState]);

    const startNinjaGame = () => {
        setNinjaScore(0);
        setNinjaLives(3);
        setNinjaCombo(0);
        setMaxNinjaCombo(0);
        setReactionTimes([]);
        setCardTimer(3000);
        setMaxCardTimer(3000);
        setGameState('playing');
        nextShortcut(0);
    };

    const nextShortcut = (comboOverride = null) => {
        const effectiveCombo = comboOverride !== null ? comboOverride : ninjaCombo;
        const random = RESOLVE_SHORTCUTS[Math.floor(Math.random() * RESOLVE_SHORTCUTS.length)];

        // Dynamic Difficulty: 3000ms base, -100ms per combo, min 1000ms
        const newDuration = Math.max(1000, 3000 - (effectiveCombo * 100));

        setCurrentShortcut(random);
        setCardTimer(newDuration);
        setMaxCardTimer(newDuration);
        setCardStartTime(Date.now());
    };

    const handleNinjaCorrect = () => {
        // Visual Feedback
        setFeedbackState('correct');
        setTimeout(() => setFeedbackState(null), 200);

        // Speed Bonus (< 1s)
        const timeTaken = Date.now() - cardStartTime;
        const isPerfect = timeTaken < 1000;

        // Track Metrics
        setReactionTimes(prev => [...prev, timeTaken]);
        setNinjaCombo(prev => {
            const newCombo = prev + 1;
            setMaxNinjaCombo(currentMax => Math.max(currentMax, newCombo));
            return newCombo;
        });

        // Score Logic
        const basePoints = 10;
        const speedBonus = isPerfect ? 10 : 0;
        const comboMultiplier = ninjaCombo >= 10 ? 2 : 1;

        setNinjaScore(prev => prev + ((basePoints + speedBonus) * comboMultiplier));

        // Next Card (Pass new combo for difficulty scaling)
        nextShortcut(ninjaCombo + 1);
    };

    const handleNinjaWrong = (isTimeout = false) => {
        // Visual Feedback
        setFeedbackState('wrong');
        setTimeout(() => setFeedbackState(null), 200);

        // Penalty Logic
        setNinjaScore(prev => Math.max(0, prev - 5));
        setNinjaCombo(0); // Streak Breaker!
        setNinjaLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
                endNinjaGame();
            } else {
                nextShortcut(0); // Reset difficulty on fail
            }
            return newLives;
        });
    };

    const endNinjaGame = () => {
        clearInterval(timerRef.current);
        setGameState('finished');
        if (ninjaScore >= 1000 && user.typing_license) {
            onReward(0, 0, 1, null, mode, maxNinjaCombo); // Pass maxNinjaCombo for reward calculation
            onLogAttempt(0, 0, mode, 1, maxNinjaCombo, true);
        } else {
            onLogAttempt(0, 0, mode, 0, maxNinjaCombo, false);
        }
    };

    // --- TYPING DOJO LOGIC ---
    const startGame = () => {
        if (mode === 'shortcut_ninja') {
            startNinjaGame();
            return;
        }

        let randomQuote;
        let quoteObject = null;

        if (mode === 'sudden_death') {
            randomQuote = TECHNICAL_PARAGRAPHS[Math.floor(Math.random() * TECHNICAL_PARAGRAPHS.length)];
            quoteObject = { text: randomQuote, source: "Technical Manual", reward: 10 };
        } else if (user.typing_license) {
            // Licensed users get Movie Quotes
            quoteObject = MOVIE_QUOTES[Math.floor(Math.random() * MOVIE_QUOTES.length)];
            randomQuote = quoteObject.text;
        } else {
            // Unlicensed users get standard training quotes
            randomQuote = TRAINING_QUOTES[Math.floor(Math.random() * TRAINING_QUOTES.length)];
        }

        setTargetQuoteObject(quoteObject);
        setCurrentQuote(randomQuote);
        setUserInput("");
        setGameState('playing');
        setStartTime(Date.now());
        setEndTime(null);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleInput = (e) => {
        const value = e.target.value;

        // Sudden Death Logic: Fail immediately on mismatch
        if (mode === 'sudden_death') {
            if (!currentQuote.startsWith(value)) {
                setGameState('failed');
                // Log immediate failure
                onLogAttempt(0, 0, mode, 0, 0, false);
                return;
            }
        }

        setUserInput(value);

        if (value === currentQuote) {
            endGame(value);
        }
    };

    const endGame = (finalInput) => {
        const end = Date.now();
        setEndTime(end);
        setGameState('finished');

        const timeInMinutes = (end - startTime) / 60000;
        const words = currentQuote.split(" ").length;
        const calculatedWpm = Math.round(words / timeInMinutes);

        // Calculate accuracy using finalInput
        let correctChars = 0;
        const inputToCheck = finalInput || userInput;
        for (let i = 0; i < currentQuote.length; i++) {
            if (inputToCheck[i] === currentQuote[i]) correctChars++;
        }
        const calculatedAccuracy = Math.round((correctChars / currentQuote.length) * 100);

        setWpm(calculatedWpm);
        setAccuracy(calculatedAccuracy);

        if (user.typing_license) {
            if (mode === 'sudden_death') {
                if (calculatedAccuracy === 100 && calculatedWpm > 30) {
                    onReward(calculatedWpm, 100, 10, 'perfectionist_badge', mode);
                    onLogAttempt(calculatedWpm, 100, mode, 10, 0, true);
                } else {
                    // Sudden Death failure - no reward
                    onLogAttempt(calculatedWpm, calculatedAccuracy, mode, 0, 0, false);
                }
            } else if (calculatedWpm > 30 && calculatedAccuracy >= 95) {
                const reward = targetQuoteObject?.reward || 1;
                onReward(calculatedWpm, calculatedAccuracy, reward, null, mode);
                onLogAttempt(calculatedWpm, calculatedAccuracy, mode, reward, 0, true);
            } else {
                // Standard failure
                onLogAttempt(calculatedWpm, calculatedAccuracy, mode, 0, 0, false);
            }
        } else {
            // Unlicensed attempt
            onLogAttempt(calculatedWpm, calculatedAccuracy, mode, 0, 0, false);
        }
    };

    const today = new Date().toDateString();

    // Determine if trained based on current mode
    let hasTrainedToday = false;
    if (mode === 'scriptwriter' && user.last_training_date === today) hasTrainedToday = true;
    if (mode === 'sudden_death' && user.last_training_date_sudden_death === today) hasTrainedToday = true;
    if (mode === 'shortcut_ninja' && user.last_training_date_ninja === today) hasTrainedToday = true;
    const hasLicense = user.typing_license;
    const isAdmin = user.name === "Mr Rayner";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`rounded-xl shadow-sm p-6 text-white transition-colors duration-500 ${mode === 'sudden_death' ? 'bg-slate-900' :
                mode === 'shortcut_ninja' ? 'bg-slate-800' :
                    hasLicense ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-slate-600'
                }`}>
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2 whitespace-nowrap">
                            {mode === 'sudden_death' ? <Target className="text-red-500" /> :
                                mode === 'shortcut_ninja' ? <Zap className="text-yellow-400" /> : <Keyboard />}
                            {mode === 'sudden_death' ? "Sudden Death" :
                                mode === 'shortcut_ninja' ? "Shortcut Ninja" : "Typing Dojo"}
                        </h2>
                        {isAdmin && (
                            <button
                                onClick={() => setIsStatsOpen(true)}
                                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors mt-1"
                            >
                                <Activity size={12} /> Class Stats
                            </button>
                        )}
                        <p className="opacity-90 mt-1">
                            {mode === 'sudden_death' ? "100% Accuracy Required. One mistake = Game Over." :
                                mode === 'shortcut_ninja' ? "Hit shortcuts fast! Build your combo." :
                                    hasLicense ? "Type the movie quote. Earn donuts." : "Practice Mode. Get licensed to earn rewards."}
                        </p>
                    </div>
                    {(hasLicense || isAdmin) && (
                        <div className="flex bg-black/20 rounded-lg p-1">
                            <button
                                onClick={() => setMode('scriptwriter')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${mode === 'scriptwriter' ? 'bg-white text-blue-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
                            >
                                Scriptwriter
                            </button>
                            <button
                                onClick={() => setMode('sudden_death')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${mode === 'sudden_death' ? 'bg-red-600 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}
                            >
                                Sudden Death
                            </button>
                            <button
                                onClick={() => setMode('shortcut_ninja')}
                                className={`hidden md:block px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${mode === 'shortcut_ninja' ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'}`}
                            >
                                Ninja
                            </button>
                            <span className="md:hidden px-3 py-1 text-xs font-bold text-white/30 cursor-not-allowed whitespace-nowrap">
                                Ninja (PC)
                            </span>
                        </div>
                    )}
                </div>

                <div className={`mt-4 text-sm font-bold inline-block px-3 py-1 rounded-full ${mode === 'sudden_death' ? 'bg-red-500/20 text-red-200 border border-red-500/50' :
                    mode === 'shortcut_ninja' ? 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/50' :
                        hasLicense ? 'bg-white/20' : 'bg-yellow-400 text-slate-900'
                    }`}>
                    {mode === 'sudden_death' ? (user?.sudden_death_won ? "Reward: 2 Donuts (Daily Practice)" : "Reward: 10 Donuts + 🎯 Badge (First Time Only)") :
                        mode === 'shortcut_ninja' ? "Reward: 1 Donut (2 for 20+ Streak)" :
                            hasLicense ? "Daily Goal: >30 WPM & 95% Accuracy" : "PRACTICE MODE (0 Donuts)"}
                </div>
            </div>

            <Card className={`text-center py-8 transition-colors duration-200 ${feedbackState === 'correct' ? 'bg-green-50 border-green-200 scale-[1.02]' :
                feedbackState === 'wrong' ? 'bg-red-50 border-red-200 translate-x-1' : ''
                }`}>
                {gameState === 'failed' && mode === 'sudden_death' && (
                    <div className="space-y-4 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                            <XCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-red-600">GAME OVER</h3>
                        <p className="text-slate-600">One mistake is all it takes.</p>
                        <Button onClick={() => setGameState('idle')} variant="outline" className="mt-4">
                            Try Again
                        </Button>
                    </div>
                )}

                {gameState === 'finished' && mode === 'shortcut_ninja' && (
                    <div className="space-y-4 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-4">
                            <Zap size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">DOJO CLOSED</h3>
                        <div className="text-4xl font-black text-slate-900 my-4">{ninjaScore} PTS</div>

                        <div className="inline-block px-4 py-2 rounded-full font-bold text-white mb-4" style={{
                            backgroundColor: ninjaScore >= 1500 ? '#000' : ninjaScore >= 500 ? '#22c55e' : '#cbd5e1'
                        }}>
                            {ninjaScore >= 1500 ? "🥋 BLACK BELT" : ninjaScore >= 500 ? "🥋 GREEN BELT" : "🥋 WHITE BELT"}
                        </div>

                        <p className="text-slate-600">
                            {ninjaScore >= 1000 ? "Incredible reflexes! You earned a donut." : "Keep training to reach 1000 points!"}
                        </p>
                        <Button onClick={() => setGameState('idle')} variant="outline" className="mt-4">
                            Train Again
                        </Button>
                    </div>
                )}

                {gameState === 'idle' && (
                    <div className="space-y-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${mode === 'sudden_death' ? 'bg-red-100 text-red-600' :
                            mode === 'shortcut_ninja' ? 'bg-yellow-100 text-yellow-600' :
                                hasLicense ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {mode === 'sudden_death' ? <Target size={40} /> :
                                mode === 'shortcut_ninja' ? <Zap size={40} /> : <Keyboard size={40} />}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Ready to Train?</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            {mode === 'shortcut_ninja' ? "Press the correct keys as fast as you can. Don't break your streak!" :
                                "Type the filmmaking quote exactly as it appears. Speed and precision are key!"}
                        </p>
                        {hasTrainedToday && hasLicense ? (
                            <div className="bg-green-100 text-green-700 p-3 rounded-lg font-bold">
                                You've already earned your daily donut! Come back tomorrow.
                            </div>
                        ) : (
                            <Button onClick={startGame} className="w-full max-w-xs py-3 text-lg mx-auto">
                                {hasLicense ? "Start Challenge" : "Start Practice"}
                            </Button>
                        )}
                    </div>
                )}

                {gameState === 'playing' && mode === 'shortcut_ninja' && (
                    <div className={`max-w-md mx-auto transition-all duration-300 ${ninjaCombo >= 10 ? 'p-1 rounded-2xl bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 animate-pulse' : ''}`}>
                        <div className={`bg-white rounded-xl p-6 ${ninjaCombo >= 10 ? 'border-4 border-yellow-400' : ''}`}>
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <Heart key={i} size={24} className={i < ninjaLives ? "text-red-500 fill-red-500" : "text-slate-200"} />
                                    ))}
                                </div>
                                <div className="text-2xl font-black text-slate-900">{ninjaScore}</div>
                            </div>

                            <div className="py-8 relative">
                                {/* Timer Bar */}
                                <div className="absolute top-0 left-0 right-0 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-slate-800 transition-all duration-100 ease-linear"
                                        style={{ width: `${(cardTimer / maxCardTimer) * 100}%` }}
                                    />
                                </div>

                                <div className="mt-8 text-5xl font-black text-slate-800 mb-4">{currentShortcut?.label}</div>

                                <div
                                    className="text-2xl font-bold text-slate-400 transition-opacity duration-500"
                                    style={{ opacity: Math.max(0, 1 - (ninjaCombo / 20)) }}
                                >
                                    PRESS [ <span className="text-slate-800">{currentShortcut?.keys[0]}</span> ]
                                </div>

                                {ninjaCombo >= 5 && (
                                    <div className="mt-8 animate-bounce text-orange-500 font-black text-xl">
                                        {ninjaCombo}x COMBO! 🔥
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'playing' && mode !== 'shortcut_ninja' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-sm font-bold text-slate-500 italic">
                                {targetQuoteObject?.source}
                            </span>
                            {hasLicense && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${targetQuoteObject?.reward > 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-pink-100 text-pink-600'}`}>
                                    Reward: {targetQuoteObject?.reward} {EMOJI}
                                </span>
                            )}
                        </div>
                        <div className="bg-slate-100 p-6 rounded-xl text-xl font-serif text-slate-700 leading-relaxed select-none">
                            {currentQuote.split('').map((char, index) => {
                                let color = "text-slate-700";
                                if (index < userInput.length) {
                                    color = userInput[index] === char ? "text-green-600" : "text-red-500 bg-red-100";
                                }
                                return <span key={index} className={color}>{char}</span>;
                            })}
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full p-4 text-lg border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                            placeholder="Type here..."
                            value={userInput}
                            onChange={handleInput}
                            onPaste={(e) => e.preventDefault()} // No cheating!
                        />
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                            Timer Running...
                        </p>
                    </div>
                )}

                {gameState === 'finished' && mode === 'shortcut_ninja' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs text-slate-400 font-bold uppercase">Avg Reaction</p>
                                <p className="text-3xl font-black text-blue-500">
                                    {reactionTimes.length > 0
                                        ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length / 1000).toFixed(2)
                                        : "0.00"} <span className="text-sm text-slate-400 font-normal">s</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs text-slate-400 font-bold uppercase">Max Streak</p>
                                <p className="text-3xl font-black text-yellow-500">
                                    {maxNinjaCombo}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-3 mt-6">
                            <Button onClick={startGame} variant="outline" className="w-full max-w-xs">
                                Train Again
                            </Button>
                            <button onClick={() => setGameState('idle')} className="text-slate-400 hover:text-slate-600 text-sm">
                                Back to Menu
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'finished' && mode !== 'shortcut_ninja' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs text-slate-400 font-bold uppercase">Speed</p>
                                <p className={`text-3xl font-black ${wpm > 30 ? 'text-green-500' : 'text-orange-500'}`}>
                                    {wpm} <span className="text-sm text-slate-400 font-normal">WPM</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs text-slate-400 font-bold uppercase">Accuracy</p>
                                <p className={`text-3xl font-black ${accuracy >= 95 ? 'text-green-500' : 'text-orange-500'}`}>
                                    {accuracy}%
                                </p>
                            </div>
                        </div>

                        {wpm > 30 && accuracy >= 95 ? (
                            <div className={`p-6 rounded-xl animate-bounce ${hasLicense ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                <h3 className="text-xl font-bold mb-1">🎉 {hasLicense ? "Challenge Complete!" : "Practice Complete!"}</h3>
                                <p>{mode === 'sudden_death' ? "You earned 10 Donuts! 💀" : hasLicense ? `You earned ${targetQuoteObject?.reward || 1} Donut${(targetQuoteObject?.reward || 1) > 1 ? 's' : ''}!` : "Great job! Get licensed to earn rewards."}</p>
                            </div>
                        ) : (
                            <div className="bg-orange-50 text-orange-700 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-1">So Close!</h3>
                                <p>You need &gt;30 WPM and 95% Accuracy. Try again!</p>
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-3 mt-6">
                            <Button onClick={startGame} variant="outline" className="w-full max-w-xs">
                                Try Again
                            </Button>
                            <button onClick={() => setGameState('idle')} className="text-slate-400 hover:text-slate-600 text-sm">
                                Back to Menu
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {isAdmin && allUsers && (
                <Card className="bg-white border-2 border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Crown size={16} className="text-yellow-500" /> Instructor Controls
                    </h3>
                    <div className="space-y-2">
                        {allUsers.filter(u => u.name !== "Mr Rayner").map(u => (
                            <div key={u.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-700">{u.name}</span>
                                {u.typing_license ? (
                                    <button
                                        onClick={() => onUpdateLicense(u.uid, u.name, false)}
                                        className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-colors"
                                    >
                                        Revoke License
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onUpdateLicense(u.uid, u.name, true)}
                                        className="text-xs bg-green-100 text-green-600 px-3 py-1.5 rounded-lg font-bold hover:bg-green-200 transition-colors"
                                    >
                                        Grant License
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {/* MODALS */}
            {isStatsOpen && <TypingStatsModal onClose={() => setIsStatsOpen(false)} />}
        </div>
    );
}

// --- PIXEL AVATAR COMPONENTS ---

function PixelArtAvatar({ pixels, gridSize, size = 40, fallbackInitials, fallbackColor }) {
    // If no pixels, show initials fallback
    if (!pixels || pixels.length === 0) {
        return (
            <div
                className="rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                style={{ width: size, height: size, backgroundColor: fallbackColor || '#94a3b8', fontSize: size * 0.4 }}
            >
                {fallbackInitials}
            </div>
        );
    }

    const pixelSize = size / gridSize;

    return (
        <div
            className="shadow-sm"
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, ${pixelSize}px)`,
                width: size,
                height: size,
                borderRadius: '4px',
                overflow: 'hidden'
            }}
        >
            {pixels.map((color, index) => (
                <div
                    key={index}
                    style={{ backgroundColor: color || '#FFFFFF' }}
                />
            ))}
        </div>
    );
}

function PixelStudioModal({ onClose, currentPixels, currentGridSize, onSave }) {
    const [gridSize, setGridSize] = useState(currentGridSize || 8);
    const [pixels, setPixels] = useState([]);
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        // Initialize or resize grid
        const totalPixels = gridSize * gridSize;
        if (currentPixels && currentPixels.length === totalPixels) {
            setPixels(currentPixels);
        } else {
            // Create new grid or resize
            const newPixels = Array(totalPixels).fill('#FFFFFF');
            setPixels(newPixels);
        }
    }, [gridSize]);

    const handlePixelClick = (index) => {
        const newPixels = [...pixels];
        newPixels[index] = selectedColor;
        setPixels(newPixels);
    };

    const handleMouseDown = (index) => {
        setIsDrawing(true);
        handlePixelClick(index);
    };

    const handleMouseEnter = (index) => {
        if (isDrawing) {
            handlePixelClick(index);
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const handleClear = () => {
        setPixels(Array(gridSize * gridSize).fill('#FFFFFF'));
    };

    const handleSave = () => {
        onSave(pixels, gridSize);
        onClose();
    };

    const gridDisplaySize = gridSize === 8 ? 320 : 320; // Keep same display size
    const pixelSize = gridDisplaySize / gridSize;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">🎨 Pixel Studio</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle size={24} />
                    </button>
                </div>

                {/* Grid Size Toggle */}
                <div className="flex justify-center gap-2 mb-4">
                    <button
                        onClick={() => setGridSize(8)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${gridSize === 8 ? 'bg-pink-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        8x8 (Easy)
                    </button>
                    <button
                        onClick={() => setGridSize(16)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${gridSize === 16 ? 'bg-pink-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        16x16 (Detailed)
                    </button>
                </div>

                {/* Canvas */}
                <div className="flex justify-center mb-4">
                    <div
                        className="border-2 border-slate-300 rounded-lg overflow-hidden shadow-md"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${gridSize}, ${pixelSize}px)`,
                            width: gridDisplaySize,
                            height: gridDisplaySize,
                            userSelect: 'none'
                        }}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {pixels.map((color, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: color,
                                    cursor: 'crosshair',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}
                                onMouseDown={() => handleMouseDown(index)}
                                onMouseEnter={() => handleMouseEnter(index)}
                                onTouchStart={() => handlePixelClick(index)}
                            />
                        ))}
                    </div>
                </div>

                {/* Color Palette */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {PIXEL_PALETTE.map((color) => (
                        <button
                            key={color.hex}
                            onClick={() => setSelectedColor(color.hex)}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColor === color.hex ? 'border-slate-800 scale-110 shadow-lg' : 'border-slate-200 hover:scale-105'
                                }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                        />
                    ))}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-pink-500 text-white rounded-lg font-bold hover:bg-pink-600 transition-colors shadow-md"
                    >
                        Save Avatar
                    </button>
                </div>
            </div>
        </div>
    );
}

function LoginScreen({ onLogin, existingUsers, roster }) {
    const [search, setSearch] = useState("");
    const [selectedName, setSelectedName] = useState(null);
    const [password, setPassword] = useState("");
    const [showPatchNotes, setShowPatchNotes] = useState(false);

    const availableNames = (roster || []).filter(name => {
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const handleLogin = () => {
        if (selectedName && password) {
            onLogin(selectedName, password);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            {showPatchNotes && <PatchNotesModal onClose={() => setShowPatchNotes(false)} />}
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border-t-8 border-pink-500 relative">
                <button
                    onClick={() => setShowPatchNotes(true)}
                    className="absolute top-4 right-4 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded-full hover:scale-105 transition-transform shadow-sm flex items-center gap-1"
                >
                    <Sparkles size={10} /> What's New
                </button>
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

                {import.meta.env.DEV && (
                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={() => onLogin("Mr Rayner", "123", true)}
                            className="flex-1 py-2 text-xs text-slate-400 hover:text-slate-600 font-mono border border-dashed border-slate-300 rounded-lg"
                        >
                            [DEV] Admin
                        </button>
                        <button
                            onClick={() => onLogin("Alice", "123", true)}
                            className="flex-1 py-2 text-xs text-slate-400 hover:text-slate-600 font-mono border border-dashed border-slate-300 rounded-lg"
                        >
                            [DEV] Student
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function PatchNotesModal({ onClose }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full m-4 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="text-yellow-300" /> What's New
                        </h2>
                        <p className="opacity-90 text-sm mt-1">Live Studio & Visual Upgrades!</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-xl">🕹️</span> The Arcade is Open!
                        </h3>
                        <p className="text-slate-600 text-sm">
                            Visit the new <strong>Arcade</strong> tab to play the Daily Claw Machine. Win free donuts, boxes of donuts, or even a Golden Ticket! 🎟️
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Edit2 className="text-pink-500" size={20} /> Pixel Art Studio
                        </h3>
                        <p className="text-slate-600 text-sm">
                            Unleash your creativity! Click the <strong>Pencil Icon</strong> (next to settings) to draw your own custom 8x8 or 16x16 pixel avatar. It shows up everywhere! 🎨
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Zap className="text-yellow-500" size={20} /> Ninja Mode Tuned
                        </h3>
                        <p className="text-slate-600 text-sm">
                            Think you're fast? Ninja mode now gets <strong>faster</strong> as your combo grows. Plus, at Combo 20, the hints disappear! Good luck. 🥋
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="text-blue-500" size={20} /> Feed Upgrade
                        </h3>
                        <p className="text-slate-600 text-sm">
                            The feed now displays everyone's custom pixel avatars. See who's who at a glance! 👀
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <Button onClick={onClose} className="w-full">
                        Got it!
                    </Button>
                </div>
            </div >
        </div >
    );
}

function RosterManagerModal({ onClose, roster }) {
    const [newName, setNewName] = useState("");
    const [error, setError] = useState("");

    const handleAddUser = async () => {
        if (!newName.trim()) return;
        if (roster.includes(newName.trim())) {
            setError("User already exists!");
            return;
        }

        try {
            const rosterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'roster');
            await setDoc(rosterRef, {
                names: arrayUnion(newName.trim())
            }, { merge: true });
            setNewName("");
            setError("");
        } catch (e) {
            console.error(e);
            setError("Failed to add user.");
        }
    };

    const handleRemoveUser = async (nameToRemove) => {
        if (!confirm(`Are you sure you want to remove ${nameToRemove}?`)) return;

        try {
            const rosterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'roster');
            await setDoc(rosterRef, {
                names: arrayRemove(nameToRemove)
            }, { merge: true });
        } catch (e) {
            console.error(e);
            setError("Failed to remove user.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full m-4 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Users size={20} /> Manage Roster
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                if (confirm("Reset roster to default list? This will remove custom additions.")) {
                                    try {
                                        const rosterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'roster');
                                        await setDoc(rosterRef, { names: INITIAL_ROSTER }, { merge: true });
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                            }}
                            className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 transition-colors"
                        >
                            Reset
                        </button>
                        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                            <XCircle size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Enter new student name..."
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                        />
                        <button
                            onClick={handleAddUser}
                            disabled={!newName.trim()}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-600 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {[...roster].sort().map(name => (
                        <div key={name} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg group">
                            <span className="font-medium text-slate-700">{name}</span>
                            <button
                                onClick={() => handleRemoveUser(name)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="p-3 bg-slate-50 text-center text-xs text-slate-400 border-t border-slate-100">
                    {roster.length} students in roster
                </div>
            </div>
        </div>
    );
}

function ShopView({ items, userBalance, onPurchase, currentUserPublic, raffleState, onDrawRaffle, onRestoreRaffle, featuredItemIds, onToggleFeatured }) {
    const isAdmin = currentUserPublic?.name === "Mr Rayner";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Banner */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingBag /> The Donut Shop
                </h2>
                <p className="opacity-90">Spend your hard-earned donuts on rewards!</p>
                <div className="mt-4 text-sm font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
                    Your Balance: {userBalance} {EMOJI}
                </div>
            </div>

            {/* RAFFLE BANNER */}
            {raffleState && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300"></div>
                    <h3 className="font-bold text-yellow-800 text-lg flex items-center justify-center gap-2">
                        🎰 WEEKLY RAFFLE 🎰
                    </h3>
                    {raffleState.lastWinner ? (
                        <div className="mt-2 animate-bounce">
                            <p className="text-xs text-yellow-600 uppercase font-bold">Last Winner</p>
                            <p className="text-xl font-black text-purple-600">{raffleState.lastWinner}</p>
                            <p className="text-[10px] text-slate-400">{new Date(raffleState.lastWinDate).toLocaleDateString()}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-yellow-700 mt-1">Buy a ticket to win the jackpot!</p>
                    )}
                    <div className="mt-3 text-xs font-bold text-slate-500 bg-white/50 inline-block px-3 py-1 rounded-full">
                        {raffleState.tickets?.length || 0} Tickets in the Hat
                    </div>

                    {isAdmin && (
                        <div className="mt-4 border-t border-yellow-200 pt-3">
                            <button
                                onClick={onDrawRaffle}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded transition-colors"
                            >
                                🎲 Draw Winner
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => {
                    const canAfford = userBalance >= (item.cost || 0);

                    // Safe check for ownership
                    let isOwned = false;
                    try {
                        isOwned = !!(item.type === 'digital' && currentUserPublic && (
                            (item.id === 'rainbow_name' && currentUserPublic.rainbow_name) ||
                            (item.id === 'gold_border' && currentUserPublic.gold_border) ||
                            (item.id === 'neon_name' && currentUserPublic.neon_name) ||
                            (item.id === 'verified_badge' && currentUserPublic.verified_badge)
                        ));
                    } catch (e) {
                        console.error("Error checking ownership:", e);
                    }

                    // Gold Card Logic
                    const safeFeaturedIds = Array.isArray(featuredItemIds) ? featuredItemIds : [];
                    const isFeatured = safeFeaturedIds.includes(item.id);

                    return (
                        <div key={item.id} className={`flex flex-col justify-between relative overflow-hidden border-2 transition-all duration-300 rounded-xl p-6 ${isFeatured ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-400 shadow-lg scale-[1.02]' : 'bg-white border-slate-100 hover:border-pink-200'}`}>
                            {isOwned && <div className="absolute top-2 right-2 text-green-500"><CheckCircle /></div>}

                            {/* Featured Badge */}
                            {isFeatured && (
                                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm z-10">
                                    FEATURED
                                </div>
                            )}

                            {/* Admin Star Toggle */}
                            {isAdmin && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleFeatured && onToggleFeatured(item.id); }}
                                    className="absolute top-2 left-2 z-20 hover:scale-110 transition-transform"
                                >
                                    {isFeatured ? (
                                        <div className="text-yellow-500 drop-shadow-sm">⭐</div>
                                    ) : (
                                        <div className="text-slate-300 hover:text-yellow-400">☆</div>
                                    )}
                                </button>
                            )}

                            <div>
                                <div className="text-4xl mb-2 flex items-center gap-2">
                                    {item.icon}
                                    {isFeatured && <span className="text-lg animate-pulse">🔥</span>}
                                </div>
                                <h3 className={`font-bold text-lg ${isFeatured ? 'text-yellow-900' : 'text-slate-800'}`}>{item.name}</h3>
                                <p className={`text-sm mb-4 ${isFeatured ? 'text-yellow-800/80' : 'text-slate-500'}`}>{item.desc}</p>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <span className={`font-bold ${isFeatured ? 'text-yellow-700' : 'text-pink-600'}`}>{item.cost} {EMOJI}</span>
                                <button
                                    onClick={() => onPurchase(item)}
                                    disabled={!canAfford || isOwned}
                                    className={`px-4 py-2 rounded transition-colors text-white ${!canAfford ? "opacity-50 cursor-not-allowed" : "hover:bg-opacity-90"} ${isFeatured ? "bg-yellow-600" : "bg-pink-600"}`}
                                >
                                    {isOwned ? "Owned" : "Buy"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BountiesView({ bounties, currentUser, userId, onCreate, onDelete, onClaim, onUnclaim, onPay, onMarkDone, onReject }) {
    const [newTitle, setNewTitle] = useState("");
    const [newReward, setNewReward] = useState(5);
    const [newQty, setNewQty] = useState(1);
    const [newExpiresAt, setNewExpiresAt] = useState("");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleTime, setScheduleTime] = useState("");
    const isAdmin = currentUser.name === "Mr Rayner";

    const activeBounties = bounties.filter(b => {
        if (b.status === 'paid') return false;

        // Check expiration (Numeric comparison)
        const now = Date.now();
        const isExpired = b.expiresAt && b.expiresAt < now;

        // Check scheduling
        if (b.scheduledFor && b.scheduledFor > now) {
            if (!isAdmin) return false; // Hide from students
        }

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

    const formatTime = (timestamp) => {
        if (!timestamp) return "";
        return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    // Calculate preview time for new job
    const previewTime = newExpiresAt ? formatTime(new Date(newExpiresAt).getTime()) : "";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAdmin && (
                <Card className="bg-pink-50 border-pink-100">
                    <h3 className="font-bold text-pink-700 mb-3 flex items-center gap-2">
                        <Briefcase size={20} /> Post New Job
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
                            <label className="text-[10px] text-pink-400 font-bold uppercase">Due Date</label>
                            <div className="relative">
                                <input
                                    type="datetime-local"
                                    className="w-full p-2 rounded-lg border border-pink-200"
                                    value={newExpiresAt}
                                    onChange={e => setNewExpiresAt(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="col-span-2 md:col-span-5 flex flex-wrap items-center gap-3 mt-2 mb-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="schedule"
                                    checked={isScheduled}
                                    onChange={e => setIsScheduled(e.target.checked)}
                                    className="rounded text-pink-500 focus:ring-pink-500"
                                />
                                <label htmlFor="schedule" className="text-xs font-bold text-slate-500 cursor-pointer select-none uppercase">Schedule for later?</label>
                            </div>

                            {isScheduled && (
                                <input
                                    type="datetime-local"
                                    className="p-2 rounded-lg border border-pink-200 text-xs"
                                    value={scheduleTime}
                                    onChange={e => setScheduleTime(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="col-span-2 md:col-span-5">
                            <Button className="w-full h-[42px]" onClick={() => {
                                onCreate(newTitle, newReward, newQty, newExpiresAt, isScheduled ? scheduleTime : null);
                                setNewTitle(""); setNewQty(1); setNewExpiresAt(""); setIsScheduled(false); setScheduleTime("");
                            }}>
                                {isScheduled ? "Schedule Job" : "Post Job"}
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
                    const dueTime = hasTimer ? formatTime(b.expiresAt) : "";

                    // Progress Bar Calculation
                    let progressWidth = 100;
                    let progressColor = 'bg-green-500';

                    if (hasTimer && !isExpired && b.createdAt) {
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
                        <Card key={b.id} className={`flex flex-col border-l-4 ${isExpired ? 'border-l-slate-300 bg-slate-50' : b.status === 'pending_review' ? 'border-l-green-500 bg-green-50' : 'border-l-pink-500'}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex-grow min-w-0 mr-2">
                                    <h4 className="font-bold text-slate-800 break-words flex items-center gap-2 flex-wrap">
                                        {b.title}
                                        {b.status === 'pending_review' && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 animate-pulse">
                                                <CheckCircle size={12} /> Ready for Inspection
                                            </span>
                                        )}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">
                                            {b.reward} {EMOJI} Reward
                                        </span>
                                        {b.status === 'open' && remainingSpots > 1 && (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1">
                                                <Users size={12} /> {remainingSpots} spots left
                                            </span>
                                        )}
                                        {/* Scheduled Badge */}
                                        {b.scheduledFor && b.scheduledFor > Date.now() && (
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1">
                                                <Calendar size={12} /> Scheduled {formatTime(b.scheduledFor)}
                                            </span>
                                        )}

                                        {/* Time Limit Badge */}
                                        {b.status === 'open' && hasTimer && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'}`}>
                                                <Clock size={12} /> {isExpired ? "Expired" : `Due ${dueTime}`}
                                            </span>
                                        )}

                                        {b.status === 'claimed' && (
                                            <span className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                <CheckSquare size={12} /> Claimed by {b.claimantName}
                                            </span>
                                        )}
                                        {b.status === 'pending_review' && (
                                            <span className="text-xs text-green-600 flex items-center gap-1 whitespace-nowrap font-bold">
                                                <UserCheck size={12} /> Done by {b.claimantName}
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
                                                    <Trash2 size={20} />
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
                                            <Button variant="outline" onClick={() => onPay(b.id, b.claimantName, b.reward)} className="whitespace-nowrap opacity-50 hover:opacity-100">
                                                Pay Now
                                            </Button>
                                        </>
                                    )}

                                    {b.status === 'pending_review' && isAdmin && (
                                        <>
                                            <button
                                                onClick={() => onReject(b.id)}
                                                className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                title="Reject Work (Redo)"
                                            >
                                                <RotateCcw size={20} />
                                            </button>
                                            <Button variant="success" onClick={() => onPay(b.id, b.claimantName, b.reward)} className="whitespace-nowrap animate-bounce">
                                                Pay & Close
                                            </Button>
                                        </>
                                    )}

                                    {b.status === 'claimed' && isMyClaim && !isAdmin && (
                                        <div className="flex gap-2">
                                            <Button variant="danger" onClick={() => onUnclaim(b.id)} className="text-xs px-2 whitespace-nowrap">
                                                Cancel
                                            </Button>
                                            <Button variant="success" onClick={() => onMarkDone(b.id)} className="text-xs px-2 whitespace-nowrap">
                                                Mark Done
                                            </Button>
                                        </div>
                                    )}

                                    {b.status === 'pending_review' && isMyClaim && !isAdmin && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold whitespace-nowrap">
                                            Waiting for Review...
                                        </span>
                                    )}

                                    {(b.status === 'claimed' || b.status === 'pending_review') && !isMyClaim && !isAdmin && (
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 self-center whitespace-nowrap">
                                            Busy
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* PROGRESS BAR */}
                            {(b.status === 'open' || b.status === 'claimed' || b.status === 'pending_review') && hasTimer && !isExpired && (
                                <div className="w-full h-2 bg-slate-100 rounded-full mt-3 relative">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-linear ${progressColor} relative`}
                                        style={{ width: `${progressWidth}%` }}
                                    >
                                        <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-sm leading-none filter drop-shadow-sm transform hover:scale-125 transition-transform cursor-default" title="Time is ticking!">
                                            🍩
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function GoalView({ goalData, userBalance, onContribute, currentUserName, onActivate, onUpdateGoal, onResetGoal, onToggleActive }) {
    const target = goalData.target !== undefined ? goalData.target : GOAL_TARGET;
    const isActive = goalData.isActive !== false; // Default to true if undefined
    const isAdmin = currentUserName === "Mr Rayner";

    // "Inactive" implies "Achieved" for the visual state (as requested)
    const isMet = (goalData.current || 0) >= target || !isActive;
    const percent = !isActive ? 100 : (target === 0 ? 100 : Math.min(100, ((goalData.current || 0) / target) * 100));

    // State for Admin Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(goalData.title || "Team Goal");
    const [editTarget, setEditTarget] = useState(target);

    const contributors = goalData.contributors || {};
    // Sort contributors by amount (desc)
    const sortedContributors = Object.entries(contributors)
        .sort(([, a], [, b]) => b - a);

    if (!isActive && !isAdmin) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200">
                    <div className="inline-flex items-center justify-center p-4 bg-slate-100 rounded-full text-slate-400 mb-4">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-400 mb-2">Coming Soon</h2>
                    <p className="text-slate-400">The next goal hasn't started yet. Stay tuned!</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className={`text-center py-8 relative overflow-hidden ${!isActive && !isMet ? 'opacity-75 grayscale' : ''} ${isMet ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-yellow-400 shadow-xl shadow-yellow-200' : ''}`}>
                {isMet && <div className="absolute inset-0 bg-yellow-400 opacity-10 animate-pulse"></div>}
                <div className="relative z-10">
                    <div className={`inline-flex items-center justify-center p-3 rounded-full mb-4 ${isMet ? 'bg-yellow-400 text-white shadow-lg scale-110' : 'bg-pink-100 text-pink-500'}`}>
                        {isMet ? <Trophy size={32} /> : <Sparkles size={32} />}
                    </div>

                    {/* ADMIN CONTROLS */}
                    {isAdmin && (
                        <div className="mb-4 flex justify-end">
                            <button
                                onClick={() => onToggleActive(!isActive)}
                                className={`text-xs font-bold px-3 py-1 rounded-full border ${isActive ? 'bg-green-100 text-green-600 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}
                            >
                                {isActive ? "🟢 Goal Active" : "🔴 Goal Inactive"}
                            </button>
                        </div>
                    )}

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
                                    onChange={e => setEditTarget(parseInt(e.target.value) || 0)}
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
                                <h2 className={`text-2xl font-bold ${isMet ? 'text-yellow-700' : 'text-slate-800'}`}>
                                    {isMet ? `GOAL ACHIEVED: ${goalData.title || "Team Goal"}` : (goalData.title || "Team Goal")}
                                </h2>
                                {isAdmin && (
                                    <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-pink-500">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                            <p className={`${isMet ? 'text-yellow-800 font-medium' : 'text-slate-500'} mb-6 max-w-md mx-auto`}>
                                {isMet ? "We did it! Enjoy the victory!" : `If we reach ${target} donuts together, we unlock a reward for everyone!`}
                            </p>
                        </>
                    )}

                    <div className="max-w-lg mx-auto bg-slate-100 rounded-full h-8 mb-2 relative overflow-hidden border border-slate-200">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 ${isMet ? 'bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 animate-shimmer bg-[length:200%_100%]' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            style={{ width: `${percent}%` }}
                        >
                            <span className="text-white text-xs font-bold drop-shadow-md">{Math.floor(percent)}%</span>
                        </div>
                    </div>
                    <p className={`text-sm font-bold ${isMet ? 'text-yellow-700' : 'text-slate-700'} mb-8`}>
                        {goalData.current} / {target} {EMOJI} raised
                    </p>

                    {isMet ? (
                        <div className="space-y-4">
                            <div className="bg-yellow-400 text-white p-4 rounded-xl font-black text-xl animate-bounce shadow-lg border-b-4 border-yellow-600 transform hover:scale-105 transition-transform cursor-default">
                                🏆 GOAL ACHIEVED!
                            </div>
                            {isAdmin ? (
                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={onActivate}
                                        variant="success"
                                        className="w-full py-3 text-lg shadow-lg shadow-green-200"
                                    >
                                        🚨 Activate Reward! 🚨
                                    </Button>
                                    <button onClick={onResetGoal} className="text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1">
                                        <RotateCcw size={12} /> Reset Goal Manually
                                    </button>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 italic">
                                    Wait for Mr Rayner to activate the reward!
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-2 justify-center max-w-sm mx-auto">
                            <Button
                                onClick={() => onContribute(1)}
                                disabled={userBalance < 1}
                                className="flex-1"
                            >
                                Give 1 {EMOJI}
                            </Button>
                            <Button
                                onClick={() => onContribute(5)}
                                disabled={userBalance < 5}
                                className="flex-1"
                            >
                                Give 5 {EMOJI}
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* CONTRIBUTORS LIST */}
            <div className="space-y-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Users size={16} /> Top Contributors
                </h3>
                {sortedContributors.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No contributions yet. Be the hero!
                    </div>
                ) : (
                    sortedContributors.map(([name, amount], index) => (
                        <div key={name} className={`flex justify-between items-center p-3 rounded-lg border ${index < 3 && isMet ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                {isMet && index < 3 && (
                                    <span className="text-xl">
                                        {index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}
                                    </span>
                                )}
                                <span className={`font-bold ${index === 0 && isMet ? 'text-yellow-700' : 'text-slate-700'}`}>{name}</span>
                            </div>
                            <span className="font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded-md text-xs">
                                +{amount} {EMOJI}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function GiveView({ roster, existingUsers, currentUserName, onGive, onMunch, remaining, coreValues }) {
    const [selectedUser, setSelectedUser] = useState("");
    const [message, setMessage] = useState("");
    const [filter, setFilter] = useState("");
    const [amount, setAmount] = useState(1);
    const [mode, setMode] = useState("give"); // 'give' or 'munch'
    const [step, setStep] = useState(1); // 1: User, 2: Value, 3: Virtue/Message
    const [selectedValue, setSelectedValue] = useState(null);
    const [selectedVirtue, setSelectedVirtue] = useState("");

    const isAdmin = currentUserName === "Mr Rayner";
    const isMunch = mode === "munch";

    const filteredRoster = roster
        .filter(name => name !== currentUserName)
        .filter(name => name.toLowerCase().includes(filter.toLowerCase()));

    const handleSubmit = () => {
        if (!selectedUser || !message) return;
        if (!isMunch && !selectedValue) return; // Value required for giving

        if (isMunch) {
            onMunch(selectedUser, message);
        } else {
            onGive(selectedUser, message, amount, selectedValue, selectedVirtue);
        }

        // Reset
        setMessage("");
        setSelectedUser("");
        setFilter("");
        setAmount(1);
        setStep(1);
        setSelectedValue(null);
        setSelectedVirtue("");
    };

    const handleUserSelect = (name) => {
        setSelectedUser(name);
        setFilter("");
        if (isMunch) {
            // Munch doesn't need values
            setStep(3);
        } else {
            setStep(2);
        }
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
                                onClick={() => { setMode("give"); setStep(1); }}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!isMunch ? 'bg-white text-pink-500 shadow-sm' : 'text-slate-400'}`}
                            >
                                😇 Give
                            </button>
                            <button
                                onClick={() => { setMode("munch"); setStep(1); }}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isMunch ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}
                            >
                                😈 Munch
                            </button>
                        </div>
                    )}
                </div>

                {remaining === 0 && !isAdmin && !isMunch ? (
                    <div className="bg-slate-100 p-6 rounded-xl text-center text-slate-500">
                        <p className="text-lg font-medium">You're all out of donuts!</p>
                        <p className="text-sm">Come back tomorrow for a fresh batch.</p>
                    </div>
                ) : (
                    <>
                        {/* STEP 1: SELECT USER */}
                        <div className={`space-y-2 ${step !== 1 && 'opacity-50 pointer-events-none'}`}>
                            <label className="text-sm font-semibold text-slate-600 flex justify-between">
                                <span>Step 1: Select Teammate</span>
                                {step > 1 && <button onClick={() => setStep(1)} className="text-pink-500 text-xs underline pointer-events-auto">Change</button>}
                            </label>
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
                                                const hasGoldBorder = userData?.gold_border;
                                                const hasNeonName = userData?.neon_name;
                                                const hasVerified = userData?.verified_badge;

                                                return (
                                                    <button
                                                        key={name}
                                                        onClick={() => handleUserSelect(name)}
                                                        className="w-full text-left p-3 hover:bg-pink-50 flex items-center gap-3 transition-colors"
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${hasGoldBorder ? 'gold-border' : ''}`} style={{ background: bgColor }}>
                                                            {name[0]}
                                                        </div>
                                                        <span className={`flex items-center gap-1 ${hasNeonName ? 'neon-text font-bold' : ''}`}>
                                                            {name}
                                                            {hasVerified && <span className="text-blue-500 text-[10px]">✅</span>}
                                                        </span>
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
                                            style={{ background: existingUsers.find(u => u.name === selectedUser)?.avatar_color || "#cbd5e1" }}>
                                            {selectedUser[0]}
                                        </div>
                                        <span className="font-medium text-slate-800">
                                            {selectedUser}
                                        </span>
                                    </div>
                                    {step === 1 && (
                                        <button onClick={() => setSelectedUser("")} className="text-slate-400 hover:text-red-500">
                                            <LogOut size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* STEP 2: SELECT VALUE (Give Mode Only) */}
                        {!isMunch && step >= 2 && (
                            <div className={`space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 ${step !== 2 && 'opacity-50 pointer-events-none'}`}>
                                <label className="text-sm font-semibold text-slate-600 flex justify-between">
                                    <span>Step 2: Select Value</span>
                                    {step > 2 && <button onClick={() => setStep(2)} className="text-pink-500 text-xs underline pointer-events-auto">Change</button>}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.values(coreValues).map(val => (
                                        <button
                                            key={val.id}
                                            onClick={() => { setSelectedValue(val.id); setSelectedVirtue(""); setStep(3); }}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${selectedValue === val.id
                                                ? `${val.color} text-white border-transparent shadow-md scale-[1.02]`
                                                : `bg-white ${val.borderColor} ${val.textColor} hover:bg-slate-50`
                                                }`}
                                        >
                                            <div className="text-xl mb-1">{val.icon}</div>
                                            <div className="font-bold text-sm">{val.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: VIRTUE & MESSAGE */}
                        {step >= 3 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Virtue Selection (Optional) */}
                                {!isMunch && selectedValue && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-600">Step 3: Specific Virtue (Optional)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {coreValues[selectedValue].virtues.map(virtue => (
                                                <button
                                                    key={virtue}
                                                    onClick={() => setSelectedVirtue(virtue === selectedVirtue ? "" : virtue)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${selectedVirtue === virtue
                                                        ? `${coreValues[selectedValue].color} text-white border-transparent`
                                                        : `bg-white text-slate-600 border-slate-200 hover:border-slate-300`
                                                        }`}
                                                >
                                                    {virtue}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-600">Message</label>
                                    <textarea
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                                        rows={3}
                                        placeholder={isMunch ? "Why did the Muncher strike?" : `Thanks for showing ${selectedVirtue || coreValues[selectedValue]?.label || "Values"} by...`}
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                    />
                                </div>

                                {/* Admin Bulk Controls (Only show in Give Mode) */}
                                {isAdmin && !isMunch && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Zap size={16} className="text-yellow-500" /> Admin Multiplier
                                        </label>
                                        <div className="flex gap-2">
                                            {[1, 2, 5, 10].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setAmount(n)}
                                                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${amount === n
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
                                    disabled={!selectedUser || !message || (!isMunch && !selectedValue)}
                                    className="w-full py-3 text-lg"
                                    variant={isMunch ? "danger" : "primary"}
                                >
                                    {isMunch ? `Feed The Muncher (1 ${EMOJI})` :
                                        `Give ${amount > 1 ? `${amount} ${EMOJI}` : EMOJI}`}
                                    {!isMunch && <span className="text-sm opacity-80 ml-1">
                                        {isAdmin ? "(∞ left)" : `(${remaining} left)`}
                                    </span>}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}

function FeedView({ transactions, onReact, coreValues, onDelete, currentUser, users }) {
    const isAdmin = currentUser?.name === "Mr Rayner";

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
                    const valueData = tx.value && coreValues ? coreValues[tx.value] : null;

                    // Find sender user data for avatar
                    const senderUser = users?.find(u => u.name === tx.fromName);
                    const systemAvatar = SYSTEM_AVATARS[tx.fromName];

                    return (
                        <Card key={tx.id} className={`relative overflow-hidden group ${isMunch ? 'bg-red-50 border-red-100' : ''}`}>
                            {isAdmin && (
                                <button
                                    onClick={() => onDelete(tx.id)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10 p-1"
                                    title="Delete Message"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            {/* VALUE BADGE HEADER */}
                            {valueData && (
                                <div className={`${valueData.lightColor} border-b ${valueData.borderColor} p-2 px-4 flex items-center gap-2 -mx-6 -mt-6 mb-4`}>
                                    <span className="text-lg">{valueData.icon}</span>
                                    <span className={`text-xs font-black uppercase tracking-wider ${valueData.textColor}`}>
                                        {valueData.label}
                                    </span>
                                    {tx.virtue && (
                                        <>
                                            <span className={`${valueData.textColor} opacity-40`}>•</span>
                                            <span className={`text-xs font-bold ${valueData.textColor}`}>
                                                {tx.virtue}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 mt-1">
                                    <PixelArtAvatar
                                        pixels={systemAvatar ? systemAvatar.pixels : senderUser?.avatar_pixels}
                                        gridSize={systemAvatar ? systemAvatar.gridSize : senderUser?.avatar_grid_size}
                                        size={40}
                                        fallbackInitials={tx.fromName?.charAt(0).toUpperCase()}
                                        fallbackColor={systemAvatar ? systemAvatar.color : senderUser?.avatar_color}
                                    />
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
                                                <span className="text-slate-400 text-sm mx-1">recognized</span>
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
                            </div>
                        </Card>
                    )
                })
            )}
        </div >
    );
}

function LeaderboardView({ users, roster }) {
    const combinedList = roster.map(name => {
        const userData = users.find(u => u.name === name);
        return {
            name: name,
            balance: userData ? userData.balance : 0,
            avatar_color: userData ? userData.avatar_color : '#cbd5e1',
            avatar_pixels: userData ? userData.avatar_pixels : [],
            avatar_grid_size: userData ? userData.avatar_grid_size : 8,
            rainbow_name: userData ? userData.rainbow_name : false,
            gold_border: userData ? userData.gold_border : false,
            silver_border: userData ? userData.silver_border : false,
            neon_name: userData ? userData.neon_name : false,
            flame_name: userData ? userData.flame_name : false,
            verified_badge: userData ? userData.verified_badge : false,
            perfectionist_badge: userData ? userData.perfectionist_badge : false,
            typing_license: userData ? userData.typing_license : false,
            lifetime_received: userData ? userData.lifetime_received : 0,
            lifetime_given: userData ? userData.lifetime_given : 0
        };
    }).filter(u => u.name !== "Mr Rayner").sort((a, b) => b.lifetime_given - a.lifetime_given);

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
                                <div className={`${u.gold_border ? 'gold-border' : u.silver_border ? 'silver-border' : ''}`}>
                                    <PixelArtAvatar
                                        pixels={u.avatar_pixels}
                                        gridSize={u.avatar_grid_size}
                                        size={40}
                                        fallbackInitials={u.name[0]}
                                        fallbackColor={u.avatar_color}
                                    />
                                </div>
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={`font-bold truncate ${u.flame_name ? 'flame-text' :
                                        u.rainbow_name ? 'animate-text-rainbow bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500' :
                                            u.neon_name ? 'neon-text' : 'text-slate-800'
                                        }`}>
                                        {u.name}
                                    </p>
                                    {u.verified_badge && <span className="text-blue-500 text-xs" title="Verified">✅</span>}
                                    {u.perfectionist_badge && <span className="text-red-500 text-xs" title="Perfectionist">🎯</span>}
                                    {u.typing_license && <span className="text-slate-500 text-[10px] flex items-center" title="Typing License">⌨️</span>}
                                    <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500" title={`Given: ${u.lifetime_given || 0}`}>
                                        {rank.icon} {rank.title}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">{u.balance} donuts available</p>
                            </div>
                            <div className="text-right pl-2 flex flex-col items-center">
                                <div className="inline-flex items-center bg-pink-50 text-pink-600 px-3 py-1 rounded-full font-bold">
                                    {u.lifetime_given || 0} {EMOJI}
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">Given</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}

function TypingStatsModal({ onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const q = query(
                    collection(db, 'artifacts', APP_ID, 'typing_logs'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLogs(data);
            } catch (e) {
                console.error("Error fetching logs:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 animate-in zoom-in duration-200 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-500" /> Class Typing Stats
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin text-2xl">🍩</div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-slate-500 p-8">No practice attempts recorded yet.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 text-sm">
                                    <th className="p-3 font-semibold">Time</th>
                                    <th className="p-3 font-semibold">Student</th>
                                    <th className="p-3 font-semibold">Mode</th>
                                    <th className="p-3 font-semibold">WPM</th>
                                    <th className="p-3 font-semibold">Accuracy</th>
                                    <th className="p-3 font-semibold">Reward</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                                        <td className="p-3 text-slate-400">
                                            {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-3 font-medium text-slate-800">{log.userName}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.mode === 'sudden_death' ? 'bg-red-100 text-red-600' :
                                                log.mode === 'shortcut_ninja' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {log.mode === 'sudden_death' ? 'Sudden Death' :
                                                    log.mode === 'shortcut_ninja' ? 'Ninja' : 'Standard'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono font-bold">{log.wpm}</td>
                                        <td className={`p-3 font-mono font-bold ${log.accuracy === 100 ? 'text-green-600' : ''}`}>
                                            {log.accuracy}%
                                        </td>
                                        <td className="p-3">
                                            {log.reward > 0 ? (
                                                <span className="flex items-center gap-1 text-green-600 font-bold">
                                                    +{log.reward} 🍩
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function TypingDefenceModal({ onClose, onReward }) {
    const [gameState, setGameState] = useState('start'); // start, playing, gameover
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [enemies, setEnemies] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [level, setLevel] = useState(1);
    const [earnedReward, setEarnedReward] = useState(0);

    // Refs for Game Loop (to avoid stale closures)
    const gameStateRef = useRef('start');
    const livesRef = useRef(3);
    const scoreRef = useRef(0);

    const inputRef = useRef(null);
    const requestRef = useRef();
    const lastSpawnTime = useRef(0);

    // Game Constants
    const SPAWN_RATE = Math.max(1000, 3000 - (level * 200)); // Spawns faster as level increases
    const FALL_SPEED = 0.5 + (level * 0.1);

    // Word List (Media & Virtues)
    const WORDS = [
        "CAMERA", "ACTION", "FOCUS", "SCENE", "EDIT", "AUDIO", "LIGHT", "FRAME", "ZOOM", "LENS",
        "SCRIPT", "DIRECT", "PRODUCE", "CAST", "CREW", "SOUND", "ROLL", "CUT", "FADE", "WIPE",
        "RESPECT", "TRUTH", "HONOR", "LOVE", "UNITY", "TRUST", "GRACE", "PEACE", "MERCY", "FAITH",
        "KINDNESS", "JOY", "HOPE", "PATIENCE", "COURAGE", "LOYALTY", "WISDOM", "JUSTICE", "SERVICE"
    ];

    useEffect(() => {
        if (gameState === 'playing') {
            gameStateRef.current = 'playing';
            livesRef.current = 3;
            scoreRef.current = 0;
            inputRef.current?.focus();
            requestRef.current = requestAnimationFrame(gameLoop);
        } else {
            gameStateRef.current = gameState;
            cancelAnimationFrame(requestRef.current);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    const spawnEnemy = () => {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const id = Date.now() + Math.random();
        const x = 10 + Math.random() * 80;
        setEnemies(prev => [...prev, { id, word, x, y: -10 }]);
    };

    const gameLoop = (time) => {
        if (gameStateRef.current !== 'playing') return;

        // Spawn Logic
        if (time - lastSpawnTime.current > SPAWN_RATE) {
            spawnEnemy();
            lastSpawnTime.current = time;
        }

        // Move Enemies & Check Collisions
        setEnemies(prev => {
            const nextEnemies = [];
            let lifeLost = false;

            prev.forEach(enemy => {
                const newY = enemy.y + FALL_SPEED;
                if (newY > 90) { // Hit bottom (base)
                    lifeLost = true;
                } else {
                    nextEnemies.push({ ...enemy, y: newY });
                }
            });

            if (lifeLost) {
                livesRef.current -= 1;
                setLives(livesRef.current); // Sync state

                if (livesRef.current <= 0) {
                    gameStateRef.current = 'gameover';
                    setGameState('gameover'); // Sync state

                    // Calculate Reward
                    const rewardAmount = Math.floor(scoreRef.current / 1000);
                    setEarnedReward(rewardAmount);

                    if (rewardAmount > 0) {
                        onReward({
                            type: 'donut',
                            amount: rewardAmount,
                            label: 'Typing Defence Reward',
                            icon: '👾'
                        });
                    }
                }
            }

            return nextEnemies;
        });

        if (gameStateRef.current === 'playing') {
            requestRef.current = requestAnimationFrame(gameLoop);
        }
    };

    const handleInput = (e) => {
        const val = e.target.value.toUpperCase();
        setInputValue(val);

        const matchIndex = enemies.findIndex(enemy => enemy.word === val);
        if (matchIndex !== -1) {
            const enemy = enemies[matchIndex];
            setEnemies(prev => prev.filter(e => e.id !== enemy.id));

            scoreRef.current += (enemy.word.length * 10);
            setScore(scoreRef.current); // Sync state
            setInputValue("");

            if (scoreRef.current % 500 === 0) {
                setLevel(l => l + 1);
            }
        }
    };

    const startGame = () => {
        scoreRef.current = 0;
        setScore(0);
        livesRef.current = 3;
        setLives(3);
        setEnemies([]);
        setInputValue("");
        setLevel(1);
        gameStateRef.current = 'playing';
        setGameState('playing');
        lastSpawnTime.current = performance.now();
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono" onClick={onClose}>
            <div className="relative w-full max-w-2xl h-[600px] bg-slate-900 border-4 border-green-500 rounded-lg shadow-[0_0_50px_rgba(34,197,94,0.2)] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header UI */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between text-green-400 z-10 pointer-events-none bg-gradient-to-b from-black/80 to-transparent">
                    <div className="text-xl font-bold">SCORE: {score}</div>
                    <div className="text-xl font-bold">LIVES: {"❤️".repeat(Math.max(0, lives))}</div>
                </div>

                {/* Game Area */}
                <div className="relative flex-1 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                    {/* Grid Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                    {/* Enemies */}
                    {enemies.map(enemy => (
                        <div
                            key={enemy.id}
                            className="absolute transform -translate-x-1/2 text-center transition-transform"
                            style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }}
                        >
                            <div className="text-4xl animate-pulse">👾</div>
                            <div className="text-green-400 font-bold text-sm bg-black/50 px-1 rounded border border-green-500/30">
                                {enemy.word}
                            </div>
                        </div>
                    ))}

                    {/* Base */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-800 border-t-4 border-green-600 flex items-center justify-center">
                        <div className="w-16 h-16 bg-green-600 rounded-t-full -mt-8 flex items-center justify-center relative shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                            <div className="w-2 h-20 bg-green-400/20 absolute bottom-full"></div>

                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-800 border-t-2 border-slate-700 flex justify-center relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInput}
                        className="w-full max-w-md bg-black border-2 border-green-500 text-green-400 font-bold text-center text-xl py-2 rounded focus:outline-none focus:shadow-[0_0_15px_rgba(34,197,94,0.5)] uppercase placeholder-green-900"
                        placeholder={gameState === 'playing' ? "TYPE TO SHOOT" : ""}
                        autoFocus
                        onBlur={() => inputRef.current?.focus()} // Keep focus
                    />
                </div>

                {/* Overlays */}
                {gameState === 'start' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-8 z-20">
                        <h1 className="text-6xl font-black text-green-500 mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">TYPING DEFENCE</h1>
                        <p className="text-green-300 mb-4 text-xl">DEFEND THE BASE FROM ALIEN WORDS</p>
                        <p className="text-yellow-400 font-bold mb-8 text-lg animate-pulse">EARN 1 🍩 PER 1000 POINTS</p>
                        <Button onClick={startGame} className="text-2xl px-8 py-4 bg-green-600 hover:bg-green-500 text-black font-bold border-b-8 border-green-800 active:border-b-0 active:translate-y-2 transition-all">
                            START MISSION
                        </Button>
                    </div>
                )}

                {gameState === 'gameover' && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-8 z-20">
                        <h1 className="text-6xl font-black text-red-500 mb-4 tracking-tighter">GAME OVER</h1>
                        <div className="text-4xl text-white mb-4">FINAL SCORE: {score}</div>
                        {earnedReward > 0 && (
                            <div className="text-2xl text-green-400 font-bold mb-8 animate-bounce">
                                YOU WON {earnedReward} DONUT{earnedReward > 1 ? 'S' : ''}! 🍩
                            </div>
                        )}
                        <div className="flex gap-4">
                            <Button onClick={startGame} className="text-xl px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold">
                                RETRY
                            </Button>
                            <Button onClick={onClose} variant="outline" className="text-xl px-6 py-3 border-2 border-slate-500 text-slate-400 hover:bg-slate-800">
                                BACK TO ARCADE
                            </Button>
                        </div>
                    </div>
                )}

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-30">
                    <XCircle size={32} />
                </button>
            </div>
        </div>
    );
}
