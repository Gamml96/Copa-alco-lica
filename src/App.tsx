import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, logout } from "./firebase";
import { UserProfile } from "./types";
import AuthScreen from "./components/AuthScreen";
import ProfileSetup from "./components/ProfileSetup";
import LobbiesHub from "./components/LobbiesHub";
import ActiveRoom from "./components/ActiveRoom";
import { LogOut, Beer, Heart } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(true);
  
  // Persist activeRoomId in localStorage so reloading the page does not boot the user out of the active room
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(() => {
    return localStorage.getItem("chutegole_active_room_id");
  });

  const setActiveRoomId = (id: string | null) => {
    setActiveRoomIdState(id);
    if (id) {
      localStorage.setItem("chutegole_active_room_id", id);
    } else {
      localStorage.removeItem("chutegole_active_room_id");
    }
  };

  useEffect(() => {
    // Listen for authentication changes or fallback to local anonymous guest
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // If not authenticated via Firebase, auto-assign a persistent local guest UID
        let localUid = localStorage.getItem("chutegole_local_uid");
        if (!localUid) {
          localUid = "guest_" + Math.random().toString(36).substring(2, 11);
          localStorage.setItem("chutegole_local_uid", localUid);
        }
        setUser({
          uid: localUid,
          displayName: ""
        } as User);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    setCheckingProfile(true);
    // Listen to user profile updates in real-time
    const unsubscribeProfile = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setCheckingProfile(false);
      },
      (error) => {
        console.error("Erro ao escutar dados do usuário:", error);
        setProfile(null);
        setCheckingProfile(false);
      }
    );

    return () => unsubscribeProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      setActiveRoomId(null);
      localStorage.removeItem("chutegole_local_uid");
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading || (user && checkingProfile)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="relative mb-4">
          <Beer className="w-12 h-12 text-amber-400 animate-bounce" />
          <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
        </div>
        <p className="text-sm font-semibold tracking-wide font-mono animate-pulse">
          Puxando as cadeiras da mesa... 🍺☕
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Tavern Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveRoomId(null)}>
            <Beer className="w-6 h-6 text-amber-400" />
            <span className="font-extrabold tracking-tight text-white font-sans text-sm md:text-base">
              Chute &amp; Gole ⚽🍻
            </span>
          </div>

          {profile && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2.5 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-200 font-bold">{profile.displayName}</span>
                <span className="text-[10px] text-slate-400 bg-slate-900 py-0.5 px-2 rounded-md">
                  {profile.favoriteTeam}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-rose-950/20 text-rose-400 hover:bg-rose-950 text-xs font-bold py-1.5 px-3 rounded-xl border border-rose-500/10 hover:border-rose-500/25 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sair do Bar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Pages */}
      <main className="flex-1">
        {!user ? (
          <AuthScreen />
        ) : !profile ? (
          <ProfileSetup
            userId={user.uid}
            defaultName={user.displayName || ""}
            onComplete={(newProfile) => {
              setProfile(newProfile);
              setCheckingProfile(false);
            }}
          />
        ) : activeRoomId ? (
          <ActiveRoom
            roomId={activeRoomId}
            user={profile}
            onBack={() => setActiveRoomId(null)}
          />
        ) : (
          <LobbiesHub user={profile} onJoinRoom={(id) => setActiveRoomId(id)} />
        )}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950/80 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="flex items-center justify-center gap-1">
            Feito para os amantes de resenha, futebol e diversão consciente <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </p>
          <p className="font-mono text-[10px]">
            © {new Date().getFullYear()} Chute &amp; Gole • 18+ • Beba com moderação
          </p>
        </div>
      </footer>
    </div>
  );
}
