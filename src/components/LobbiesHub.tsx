import { useState, useEffect, FormEvent } from "react";
import { collection, doc, setDoc, getDocs, query, orderBy, limit, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Room, UserProfile, Player } from "../types";
import { Beer, Plus, LogIn, Users, PlusCircle, Search, Trophy, Trash2 } from "lucide-react";
import { motion } from "motion/react";

interface LobbiesHubProps {
  user: UserProfile;
  onJoinRoom: (roomId: string) => void;
}

export default function LobbiesHub({ user, onJoinRoom }: LobbiesHubProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load active rooms for global feed
  const fetchRooms = async () => {
    try {
      const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      const roomsList: Room[] = [];
      querySnapshot.forEach((docSnap) => {
        roomsList.push(docSnap.data() as Room);
      });
      setRooms(roomsList);
    } catch (err) {
      console.error("Erro ao buscar salas:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const codeSuffix = Math.floor(1000 + Math.random() * 9000);
      const uniqueCode = `${roomName.slice(0, 3).toUpperCase()}-${codeSuffix}`;
      const roomId = `room_${Date.now()}`;

      const newRoom: Room = {
        id: roomId,
        name: roomName.trim(),
        creatorId: user.uid,
        creatorName: user.displayName,
        code: uniqueCode,
        currentMatch: "Partida Inicial • Placar Zerado ⚽",
        createdAt: new Date().toISOString(),
      };

      // Create room document
      try {
        await setDoc(doc(db, "rooms", roomId), newRoom);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId} (Create Room Doc)`);
      }

      // Register creator as first player
      const initialPlayer: Player = {
        userId: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favoriteTeam: user.favoriteTeam,
        dosesOwed: 0,
        dosesDrunk: 0,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, "rooms", roomId, "players", user.uid), initialPlayer);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/players/${user.uid} (Create Player Doc)`);
      }

      // Welcome system message
      const welcomeMsg = {
        id: `msg_welcome_${Date.now()}`,
        roomId: roomId,
        userId: "system",
        userName: "Taverneiro",
        userPhoto: "",
        text: `🍻 O boteco "${roomName.trim()}" está aberto! Palpites liberados. Que comecem os lances e fiquem de olho nas doses deveras salgadas! 🍺⚽`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, "rooms", roomId, "messages", welcomeMsg.id), welcomeMsg);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/messages/${welcomeMsg.id} (Create Welcome Message)`);
      }

      onJoinRoom(roomId);
    } catch (err: any) {
      setError("Erro ao criar o boteco. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const parsedCode = inviteCode.trim().toUpperCase();
      let foundRoom: Room | null = null;

      // Find room with this code
      const qSnapshot = await getDocs(collection(db, "rooms"));
      qSnapshot.forEach((docSnap) => {
        const d = docSnap.data() as Room;
        if (d.code === parsedCode) {
          foundRoom = d;
        }
      });

      if (!foundRoom) {
        setError("Boteco não localizado! Verifique o código enviado pelos amigos.");
        setLoading(false);
        return;
      }

      const roomId = (foundRoom as Room).id;

      // Register current user as player in that room
      const playerRecord: Player = {
        userId: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favoriteTeam: user.favoriteTeam,
        dosesOwed: 0,
        dosesDrunk: 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "players", user.uid), playerRecord);

      // System message notifying joining
      const joinMsg = {
        id: `msg_join_${Date.now()}`,
        roomId: roomId,
        userId: "system",
        userName: "Taverneiro",
        userPhoto: "",
        text: `⚽ ${user.displayName} (Torcedor do ${user.favoriteTeam}) acabou de se sentar na mesa! Preparem os copos! 🍻`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", joinMsg.id), joinMsg);

      onJoinRoom(roomId);
    } catch (err: any) {
      setError("Não conseguimos entrar no boteco. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDirect = async (room: Room) => {
    setLoading(true);
    try {
      // Register player in that room
      const playerRecord: Player = {
        userId: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favoriteTeam: user.favoriteTeam,
        dosesOwed: 0,
        dosesDrunk: 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", room.id, "players", user.uid), playerRecord);
      onJoinRoom(room.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "rooms", roomId));
      setConfirmDeleteRoomId(null);
      await fetchRooms(); // Refresh list
    } catch (err: any) {
      console.error("Erro ao excluir boteco:", err);
      setError("Não conseguimos excluir o boteco. Erro de permissão.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllRooms = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const querySnapshot = await getDocs(collection(db, "rooms"));
      let deleteCount = 0;

      for (const roomDoc of querySnapshot.docs) {
        const roomId = roomDoc.id;

        // 1. Delete players
        try {
          const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
          for (const pDoc of playersSnap.docs) {
            await deleteDoc(doc(db, "rooms", roomId, "players", pDoc.id));
          }
        } catch (e) {
          console.error("Erro ao limpar jogadores do boteco", roomId, e);
        }

        // 2. Delete messages
        try {
          const messagesSnap = await getDocs(collection(db, "rooms", roomId, "messages"));
          for (const mDoc of messagesSnap.docs) {
            await deleteDoc(doc(db, "rooms", roomId, "messages", mDoc.id));
          }
        } catch (e) {
          console.error("Erro ao limpar mensagens do boteco", roomId, e);
        }

        // 3. Delete bets
        try {
          const betsSnap = await getDocs(collection(db, "rooms", roomId, "bets"));
          for (const bDoc of betsSnap.docs) {
            await deleteDoc(doc(db, "rooms", roomId, "bets", bDoc.id));
          }
        } catch (e) {
          console.error("Erro ao limpar palpites do boteco", roomId, e);
        }

        // 4. Delete the room itself
        await deleteDoc(doc(db, "rooms", roomId));
        deleteCount++;
      }

      setConfirmDeleteAll(false);
      await fetchRooms(); // Refresh lists
      setSuccessMessage(`Rodada resetada com sucesso! ${deleteCount} boteco(s) excluído(s) da base.`);
    } catch (err: any) {
      console.error("Erro ao resetar os quadros:", err);
      setError("Erro ao resetar os botecos. Certifique-se de estar conectado à internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 border border-emerald-500/20 rounded-3xl p-6 md:p-8 shadow-xl mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
            <Beer className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">Chute &amp; Gole ⚽🍻</h1>
            <p className="text-emerald-400 text-sm mt-1">
              Bem-vindo à mesa, <span className="font-bold text-amber-400">{user.displayName}</span> do {user.favoriteTeam}
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center bg-slate-950/40 px-4 py-2.5 rounded-2xl border border-emerald-500/10">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-xs text-slate-300 font-medium">Beba com responsabilidade</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl flex justify-between items-center animate-fade-in">
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="text-xs text-slate-400 hover:text-white ml-2 font-bold focus:outline-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Create and Join Lobbies */}
        <div className="space-y-6 lg:col-span-1">
          {/* Create Room Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md" id="create-room-box">
            <div className="flex items-center gap-3 mb-4">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Criar Nova Roda</h2>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-2">
                  Nome do Boteco / Churrasco
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Ex: Resenha da Champions 🏆"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition"
                  maxLength={30}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-5 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir Boteco</span>
              </button>
            </form>
          </div>

          {/* Join Room Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md" id="join-room-box">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-white">Entrar por Código</h2>
            </div>
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-2">
                  Código do Convite
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Ex: FAM-1234"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm uppercase outline-none font-mono tracking-widest transition"
                  maxLength={15}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-5 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
              >
                <LogIn className="w-4 h-4" />
                <span>Puxar Cadeira (Entrar)</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Active lobbies board list */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md min-h-[400px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Quadro de Botecos Ativos</h2>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {/* Reset button with double-confirmation */}
                {confirmDeleteAll ? (
                  <div className="flex items-center gap-1.5 bg-rose-500/10 p-1 px-2.5 rounded-xl border border-rose-500/25">
                    <span className="text-[10px] text-rose-450 font-black uppercase tracking-wider">Limpar tudo?</span>
                    <button
                      onClick={handleDeleteAllRooms}
                      disabled={loading}
                      className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      {loading ? "Excluindo..." : "Sim, Deletar!"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteAll(false)}
                      disabled={loading}
                      className="text-[10px] bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmDeleteAll(true);
                      setSuccessMessage(null);
                      setError(null);
                    }}
                    className="text-[10px] bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 font-bold py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    title="Excluir todos os botecos da base de dados"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Resetar Todos os Botecos</span>
                  </button>
                )}
                
                <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full animate-pulse shrink-0">
                  Ao Vivo 🟢
                </span>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Beer className="w-8 h-8 text-slate-700" />
                </div>
                <h3 className="text-slate-300 font-bold mb-1">Nenhum boteco público</h3>
                <p className="text-slate-500 text-xs max-w-sm">
                  Seja o primeiro a inaugurar a rodada! Crie um boteco à esquerda e mande o código para a rapaziada do grupo!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ scale: 1.01 }}
                    className="bg-slate-950 border border-slate-800/80 hover:border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between transition group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-extrabold text-white text-base group-hover:text-emerald-400 transition truncate">
                          {room.name}
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-amber-400 border border-slate-800 font-mono py-1 px-2.5 rounded-lg font-bold">
                          {room.code}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mb-3 truncate font-mono">
                        🏟️ {room.currentMatch}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={`Criado por: ${room.creatorName}`}>
                          Por: {room.creatorId === user.uid ? "Você 👑" : room.creatorName}
                        </span>

                        {room.creatorId === user.uid ? (
                          confirmDeleteRoomId === room.id ? (
                            <div className="flex items-center gap-1.5 shrink-0 bg-rose-500/10 p-1 px-2 rounded-xl border border-rose-500/20">
                              <span className="text-[10px] text-rose-400 font-bold">Excluir?</span>
                              <button
                                onClick={() => handleDeleteRoom(room.id)}
                                className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-2 py-0.5 rounded transition cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDeleteRoomId(null)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-2 py-0.5 rounded transition cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 items-center shrink-0">
                              <button
                                onClick={() => setConfirmDeleteRoomId(room.id)}
                                className="text-[10px] bg-rose-950/60 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 hover:border-transparent font-bold py-1.5 px-2.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                                title="Cancelar e excluir esse boteco"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Cancelar Boteco</span>
                              </button>
                              <button
                                onClick={() => handleJoinDirect(room)}
                                className="text-xs bg-emerald-950 hover:bg-emerald-450 hover:text-slate-950 text-emerald-450 font-bold py-1.5 px-3 rounded-lg transition cursor-pointer"
                              >
                                Entrar →
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => handleJoinDirect(room)}
                            className="text-xs bg-emerald-950 hover:bg-emerald-450 hover:text-slate-950 text-emerald-450 font-bold py-1.5 px-3 rounded-lg transition cursor-pointer"
                          >
                            Entrar Rápido →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
