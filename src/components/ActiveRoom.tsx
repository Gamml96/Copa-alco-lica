import { useState, useEffect, useRef, FormEvent } from "react";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Room, Player, Bet, Message, UserProfile } from "../types";
import {
  Beer,
  MessageSquare,
  Send,
  Users,
  Trophy,
  Plus,
  Tv,
  CheckCircle,
  Copy,
  ChevronLeft,
  Flame,
  Check,
  Award,
  PlusCircle,
  TrendingUp,
  Clock,
  Lock,
  Unlock,
  Sparkles,
  Trash2,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const FOOTBALL_BET_TEMPLATES = [
  { label: "⚽ Próximo Gol", title: "Quem faz o próximo gol?", options: "Time da Casa, Visitante, Ninguém", value: 2, duration: 300 },
  { label: "⏱️ Gol Próximos 5 Min", title: "Vai sair gol nos próximos 5 minutos?", options: "Sim, Não", value: 1, duration: 300 },
  { label: "🚩 Escanteio", title: "O próximo escanteio será de quem?", options: "Time da Casa, Visitante, Nenhum", value: 1, duration: 125 },
  { label: "📺 Chamada do VAR", title: "O juiz vai consultar o VAR neste lance?", options: "Sim (Vai ver), Não (Segue o jogo)", value: 2, duration: 180 },
  { label: "🟨 Cartão", title: "O juiz vai dar cartão amarelo/vermelho nos próximos 3 min?", options: "Sim, Não", value: 1, duration: 180 },
  { label: "🧤 Defesa de Pênalti", title: "O goleiro vai pegar essa cobrança?", options: "Sim (Pega/Trave), Não (Gol)", value: 3, duration: 60 }
];

interface ActiveRoomProps {
  roomId: string;
  user: UserProfile;
  onBack: () => void;
}

export default function ActiveRoom({ roomId, user, onBack }: ActiveRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Form states
  const [newMatchInfo, setNewMatchInfo] = useState("");
  const [editingMatch, setEditingMatch] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // Create bet form states
  const [betTitle, setBetTitle] = useState("");
  const [betOptionsString, setBetOptionsString] = useState("Sim, Não");
  const [betValue, setBetValue] = useState(1);
  const [betDuration, setBetDuration] = useState<number>(0); // Seconds: 0 = No limit, 30, 60, 120, etc.
  const [creatingBet, setCreatingBet] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live countdown timer state (ticks every second)
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRemainingCalculatedSecs = (endsAtStr?: string) => {
    if (!endsAtStr) return null;
    const endsAt = new Date(endsAtStr);
    const diff = Math.floor((endsAt.getTime() - now.getTime()) / 1000);
    return diff > 0 ? diff : 0;
  };

  // Load Room details and subcollections
  useEffect(() => {
    // 1. Room doc listener
    const unsubRoom = onSnapshot(
      doc(db, "rooms", roomId),
      (docSnap) => {
        if (docSnap.exists()) {
          setRoom(docSnap.data() as Room);
        } else {
          onBack();
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`)
    );

    // 2. Players collection listener
    const unsubPlayers = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snapshot) => {
        const list: Player[] = [];
        snapshot.forEach((pSnap) => {
          list.push(pSnap.data() as Player);
        });
        // Sort players by dosesDrunk descending, or those who owe stats
        const sorted = list.sort((a, b) => b.dosesDrunk - a.dosesDrunk || b.dosesOwed - a.dosesOwed);
        setPlayers(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/players`)
    );

    // 3. Bets subcollection listener
    const unsubBets = onSnapshot(
      query(collection(db, "rooms", roomId, "bets"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const list: Bet[] = [];
        snapshot.forEach((bSnap) => {
          list.push(bSnap.data() as Bet);
        });
        setBets(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/bets`)
    );

    // 4. Messages subcollection listener (limit to 50 for performance)
    const unsubMessages = onSnapshot(
      query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc")),
      (snapshot) => {
        const list: Message[] = [];
        snapshot.forEach((mSnap) => {
          list.push(mSnap.data() as Message);
        });
        // Limit to last 60 inside the hook
        setMessages(list.slice(-60));
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/messages`)
    );

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubBets();
      unsubMessages();
    };
  }, [roomId]);

  // Scroll to bottom of chat whenever messages list changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Copy Code to Clipboard
  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Submit Match details (Creator only)
  const handleUpdateMatchInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!room || !newMatchInfo.trim()) return;

    try {
      await updateDoc(doc(db, "rooms", roomId), {
        currentMatch: newMatchInfo.trim(),
      });
      setEditingMatch(false);
      setNewMatchInfo("");

      // Post automatic system notification
      const alertMsg: Message = {
        id: `msg_sys_${Date.now()}`,
        roomId,
        userId: "system",
        userName: "Árbitro 🚩",
        userPhoto: "",
        text: `📢 Jogo atualizado: "${newMatchInfo.trim()}"! Fiquem atentos aos palpites!`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", alertMsg.id), alertMsg);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit new bet (Creator only)
  const handleCreateBet = async (e: FormEvent) => {
    e.preventDefault();
    if (!betTitle.trim()) return;

    try {
      const optionsArray = betOptionsString
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      if (optionsArray.length < 2) {
        alert("A aposta precisa ter pelo menos 2 alternativas (Ex: Sim, Não)");
        return;
      }

      const betId = `bet_${Date.now()}`;
      const endsAt = betDuration > 0 ? new Date(Date.now() + betDuration * 1000).toISOString() : undefined;
      const newBet: Bet = {
        id: betId,
        roomId,
        title: betTitle.trim(),
        options: optionsArray,
        betValue,
        status: "open",
        votes: {},
        creatorId: user.uid,
        createdAt: new Date().toISOString(),
        endsAt,
      };

      await setDoc(doc(db, "rooms", roomId, "bets", betId), newBet);

      // System notification
      const alertMsg: Message = {
        id: `msg_sys_bet_${Date.now()}`,
        roomId,
        userId: "system",
        userName: "Palpiteiro",
        userPhoto: "",
        text: `🎯 Nova aposta aberta: "${betTitle.trim()}" valendo ${betValue} dose(s)! Façam seus palpites!${betDuration > 0 ? ` ⏱️ Tempo Limite: ${betDuration >= 60 ? `${Math.floor(betDuration / 60)} min` : `${betDuration} seg`}!` : ""}`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", alertMsg.id), alertMsg);

      setBetTitle("");
      setBetOptionsString("Sim, Não");
      setBetValue(1);
      setBetDuration(0);
      setCreatingBet(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit a vote (Any player)
  const handleVote = async (betId: string, optionIndex: number) => {
    try {
      const targetBet = bets.find((b) => b.id === betId);
      if (targetBet) {
        if (targetBet.status === "resolved") return;
        if (targetBet.endsAt) {
          const secs = getRemainingCalculatedSecs(targetBet.endsAt);
          if (secs !== null && secs <= 0) {
            alert("⚠️ Opa! O tempo desse palpite já expirou, aposta bloqueada!");
            return;
          }
        }
      }

      const betRef = doc(db, "rooms", roomId, "bets", betId);
      const voterKey = `votes.${user.uid}`;
      await updateDoc(betRef, {
        [voterKey]: optionIndex,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve a bet (Creator only)
  const handleResolveBet = async (bet: Bet, winningOptionIndex: number) => {
    try {
      const betRef = doc(db, "rooms", roomId, "bets", bet.id);

      // 1. Mark bet as resolved
      await updateDoc(betRef, {
        status: "resolved",
        winnerOption: winningOptionIndex,
      });

      // 2. Determine losers and increment their dosesOwed
      const losers: string[] = [];
      const winnerName = bet.options[winningOptionIndex];

      // Scan all votes
      for (const [voterId, boughtIndex] of Object.entries(bet.votes)) {
        if (boughtIndex !== winningOptionIndex) {
          losers.push(voterId);

          // Find player and increment dosesOwed
          const playerSnap = players.find((p) => p.userId === voterId);
          if (playerSnap) {
            const playerRef = doc(db, "rooms", roomId, "players", voterId);
            await updateDoc(playerRef, {
              dosesOwed: playerSnap.dosesOwed + bet.betValue,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Post notification of results
      let statusText = `✅ Aposta "${bet.title}" foi concluída! Vencedor: "${winnerName}".\n`;
      if (losers.length > 0) {
        const loserNames = losers
          .map((cid) => players.find((p) => p.userId === cid)?.displayName || "Alguém")
          .join(", ");
        statusText += `💀 Perdedores: ${loserNames}. Estavam contra o lance correto e acumularam +${bet.betValue} doses para pagar! 🥃`;
      } else {
        statusText += `🙌 Ninguém errou! Todo mundo sóbrio por enquanto de palpites.`;
      }

      const alertMsg: Message = {
        id: `msg_sys_res_${Date.now()}`,
        roomId,
        userId: "system",
        userName: "Prefeito do Gole",
        userPhoto: "",
        text: statusText,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", alertMsg.id), alertMsg);
    } catch (err) {
      console.error(err);
    }
  };

  // Turn Drink (Drink Owed Dose)
  const handleDrinkDose = async () => {
    const myPlayer = players.find((p) => p.userId === user.uid);
    if (!myPlayer || myPlayer.dosesOwed <= 0) return;

    try {
      const playerRef = doc(db, "rooms", roomId, "players", user.uid);
      await updateDoc(playerRef, {
        dosesOwed: Math.max(0, myPlayer.dosesOwed - 1),
        dosesDrunk: myPlayer.dosesDrunk + 1,
        updatedAt: new Date().toISOString(),
      });

      // Shout in chat
      const drinkMsg: Message = {
        id: `msg_drink_${Date.now()}`,
        roomId,
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        text: `🍺 VIRADO! Acabei de tomar 1 dose e descontei da minha conta! Saúde! Tim-tim! 🥃🥂`,
        type: "drinking",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", drinkMsg.id), drinkMsg);
    } catch (err) {
      console.error(err);
    }
  };

  // Direct send message
  const handleSendMessage = async (textToSend?: string) => {
    const msgText = textToSend || chatInput;
    if (!msgText.trim()) return;

    try {
      const msgId = `msg_${Date.now()}`;
      const newMsg: Message = {
        id: msgId,
        roomId,
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        text: msgText.trim(),
        type: "chat",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "rooms", roomId, "messages", msgId), newMsg);
      if (!textToSend) setChatInput("");
    } catch (err) {
      console.error(err);
    }
  };

  // Friendly round donation / adjustment
  const handleDirectTallyModify = async (player: Player, incrementBy: number) => {
    try {
      const playerRef = doc(db, "rooms", roomId, "players", player.userId);
      const newOwed = Math.max(0, player.dosesOwed + incrementBy);
      await updateDoc(playerRef, {
        dosesOwed: newOwed,
        updatedAt: new Date().toISOString(),
      });

      if (incrementBy > 0) {
        // Send notification
        const alertMsg: Message = {
          id: `msg_toast_${Date.now()}`,
          roomId,
          userId: "system",
          userName: "Garçom 🍻",
          userPhoto: "",
          text: `🎁 ${user.displayName} mandou +${incrementBy} dose de presente para ${player.displayName}! Vai virando!`,
          type: "drinking",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "rooms", roomId, "messages", alertMsg.id), alertMsg);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [confirmingAction, setConfirmingAction] = useState<"leave" | "delete" | null>(null);

  // Leave active room
  const handleLeaveRoom = async () => {
    try {
      // Remove registration in players list
      const playerRef = doc(db, "rooms", roomId, "players", user.uid);
      await deleteDoc(playerRef);

      // Post in chat that user left
      const leaveMsgId = `msg_leave_${Date.now()}`;
      const leaveMsg: Message = {
        id: leaveMsgId,
        roomId,
        userId: "system",
        userName: "Portão do Boteco 🚪",
        userPhoto: "",
        text: `🚪 ${user.displayName} saiu do grupo e abandonou a mesa!`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", leaveMsgId), leaveMsg);

      // Clean storage and go back
      localStorage.removeItem("chutegole_active_room_id");
      onBack();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete active room entirely
  const handleDeleteRoom = async () => {
    try {
      // Delete the room document. The snapshot listener in App.tsx or inside ActiveRoom detects this deletion and boots everyone.
      await deleteDoc(doc(db, "rooms", roomId));
      localStorage.removeItem("chutegole_active_room_id");
      onBack();
    } catch (err) {
      console.error(err);
    }
  };

  const isCreator = room?.creatorId === user.uid;
  const myPlayerInfo = players.find((p) => p.userId === user.uid);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-8 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              {room?.name}
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                Boteco Ativo
              </span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400 font-mono">Código da Mesa:</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition cursor-pointer font-bold font-mono"
              >
                <span>{room?.code}</span>
                {copiedCode ? <Check className="w-3" /> : <Copy className="w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live TV Football Status */}
        <div className="w-full md:w-auto flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2.5 text-slate-300">
            <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
              <Tv className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-left">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                LANCE REAL-TIME
              </span>
              {editingMatch ? (
                <form onSubmit={handleUpdateMatchInfo} className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newMatchInfo}
                    onChange={(e) => setNewMatchInfo(e.target.value)}
                    placeholder="Ex: Corinthians 1x0 Santos"
                    className="bg-slate-900 text-xs text-white border border-slate-800 rounded px-2 py-1 outline-none focus:border-emerald-500"
                    maxLength={50}
                  />
                  <button type="submit" className="bg-emerald-500 text-slate-950 px-2 py-1 rounded text-xs font-bold cursor-pointer">
                    Ok
                  </button>
                  <button type="button" onClick={() => setEditingMatch(false)} className="text-xs text-slate-400">
                    X
                  </button>
                </form>
              ) : (
                <p className="text-xs font-bold text-yellow-400 font-mono whitespace-nowrap overflow-ellipsis">
                  ⚽ {room?.currentMatch}
                </p>
              )}
            </div>
          </div>

          {isCreator && !editingMatch && (
            <button
              onClick={() => {
                setNewMatchInfo(room?.currentMatch || "");
                setEditingMatch(true);
              }}
              className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition"
            >
              Alterar Placar
            </button>
          )}
        </div>

        {/* Room Actions / Management */}
        <div className="w-full md:w-auto shrink-0 flex flex-col md:items-end gap-1.5 min-w-[200px]">
          {confirmingAction === null ? (
            <div className="flex gap-2 w-full md:justify-end">
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setConfirmingAction("delete")}
                  className="w-full md:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer animate-fade-in"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Grupo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingAction("leave")}
                  className="w-full md:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do Grupo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-rose-500/20 rounded-2xl p-2 px-3 w-full flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 text-center">
                {confirmingAction === "delete" ? "⚠️ Excluir permanentemente?" : "🚪 Tem certeza que deseja sair?"}
              </span>
              <div className="flex gap-1.5 justify-center">
                <button
                  type="button"
                  onClick={confirmingAction === "delete" ? handleDeleteRoom : handleLeaveRoom}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 hover:scale-103 text-white text-[10px] font-black rounded-lg transition cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN (lg:col-span-8): Betting Room Control Center */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Quick Drink action card for current logged in player */}
          <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-3xl p-5 md:p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -z-10" />
            
            <div className="text-center md:text-left">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md uppercase tracking-wider">
                Teu Copo de Cerveja / Dose
              </span>
              <div className="flex flex-col md:flex-row items-center gap-3 mt-3">
                <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center text-xl font-black text-amber-400 font-mono">
                  {myPlayerInfo?.dosesOwed || 0}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Doses a Virar ⏳</h3>
                  <p className="text-xs text-slate-400">
                    Sua conta de palpites incorretos neste boteco.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDrinkDose}
              disabled={!myPlayerInfo || myPlayerInfo.dosesOwed <= 0}
              className={`w-full md:w-auto flex items-center justify-center gap-2 font-bold py-4 px-8 rounded-2xl shadow-xl active:scale-98 transition ${
                myPlayerInfo && myPlayerInfo.dosesOwed > 0
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-amber-400"
                  : "bg-slate-950 border border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Beer className="w-5 h-5 animate-bounce" />
              <span>Bebi uma Dose! 🍻</span>
            </button>
          </div>

          {/* Active Bets Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Palpites em Aberto</h3>
              </div>
              {isCreator && !creatingBet && (
                <button
                  onClick={() => setCreatingBet(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Palpite</span>
                </button>
              )}
            </div>

            {/* Create Bet Modal Block */}
            {creatingBet && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950 border border-emerald-500/20 rounded-2xl p-5 mb-6 space-y-4 shadow-inner"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" />
                    Criar Aposta pra Galera
                  </h4>
                  <button
                    onClick={() => setCreatingBet(false)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>

                <form onSubmit={handleCreateBet} className="space-y-4">
                  {/* Modelos Rápidos */}
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      Sugestões de Palpites (Modelos Rápidos):
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {FOOTBALL_BET_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={`template_${idx}`}
                          type="button"
                          onClick={() => {
                            setBetTitle(tmpl.title);
                            setBetOptionsString(tmpl.options);
                            setBetValue(tmpl.value);
                            setBetDuration(tmpl.duration);
                          }}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition"
                        >
                          {tmpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      O que vai acontecer? (Pergunta do Palpite)
                    </label>
                    <input
                      type="text"
                      value={betTitle}
                      onChange={(e) => setBetTitle(e.target.value)}
                      placeholder="Ex: Neymar vai cobrar falta?"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                      maxLength={60}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Opções (Separadas por vírgula)
                      </label>
                      <input
                        type="text"
                        value={betOptionsString}
                        onChange={(e) => setBetOptionsString(e.target.value)}
                        placeholder="Sim, Não, Só no travessão"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-xs outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Contrato: Valor em Doses 🥃
                      </label>
                      <select
                        value={betValue}
                        onChange={(e) => setBetValue(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-xs outline-none"
                      >
                        <option value={1}>1 Dose (Manso)</option>
                        <option value={2}>2 Doses (Aquecimento)</option>
                        <option value={3}>3 Doses (Brutal! 💥)</option>
                        <option value={5}>5 Doses (Vira-Vira Supremo! 🔥)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        ⏱️ Tempo Limite para Apostar
                      </label>
                      <select
                        value={betDuration}
                        onChange={(e) => setBetDuration(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-xs outline-none"
                      >
                        <option value={0}>Sem limite</option>
                        <option value={30}>30 segundos</option>
                        <option value={60}>1 minuto</option>
                        <option value={120}>2 minutos</option>
                        <option value={180}>3 minutos</option>
                        <option value={300}>5 minutos</option>
                        <option value={600}>10 minutos</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer"
                  >
                    Divulgar Aposta do Lance!
                  </button>
                </form>
              </motion.div>
            )}

            {/* List of active/resolved bets */}
            {bets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800/50">
                <Trophy className="w-8 h-8 text-slate-700 mb-2" />
                <h4 className="font-bold text-slate-300 text-sm">Sem apostas lançadas</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  O criador da sala pode lançar palpites de lances reais para rodar a mesa!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bets.map((bet) => {
                  const hasVoted = bet.votes && bet.votes[user.uid] !== undefined;
                  const myVote = hasVoted ? bet.votes[user.uid] : null;

                  return (
                    <div
                      key={bet.id}
                      className={`border rounded-2xl p-4 md:p-5 flex flex-col justify-between transition ${
                        bet.status === "open"
                          ? "bg-slate-950 border-emerald-500/10 hover:border-emerald-500/20"
                          : "bg-slate-950/60 border-slate-800/80 grayscale opacity-85"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div>
                          <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded uppercase">
                            🔥 Vale {bet.betValue} {bet.betValue === 1 ? "Dose" : "Doses"}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1 border-b border-transparent">
                            {bet.title}
                          </h4>
                        </div>
                        {bet.status === "open" ? (
                          <div className="flex flex-col items-end gap-1">
                            {bet.endsAt ? (() => {
                              const secs = getRemainingCalculatedSecs(bet.endsAt);
                              if (secs !== null && secs <= 0) {
                                return (
                                  <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-red-400" /> Encerrado
                                  </span>
                                );
                              }
                              const m = Math.floor((secs || 0) / 60);
                              const s = (secs || 0) % 60;
                              return (
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-black flex items-center gap-1 font-mono animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-400 animate-spin" /> {m}:{s < 10 ? `0${s}` : s}
                                </span>
                              );
                            })() : (
                              <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium animate-pulse">
                                Aberto
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-medium">
                            Resolvido
                          </span>
                        )}
                      </div>

                      {/* Vote Buttons / Selection Option list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {bet.options.map((option, index) => {
                          // Quick vote analytics
                          const totalVotes = Object.keys(bet.votes || {}).length;
                          const optionVotes = Object.values(bet.votes || {}).filter(
                            (v) => v === index
                          ).length;
                          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

                          const isSelected = myVote === index;
                          const isWinner = bet.status === "resolved" && bet.winnerOption === index;

                          const secs = getRemainingCalculatedSecs(bet.endsAt);
                          const isExpired = bet.status === "open" && secs !== null && secs <= 0;
                          const isDisabled = bet.status === "resolved" || isExpired;

                          return (
                            <button
                              key={`${bet.id}_opt_${index}`}
                              disabled={isDisabled}
                              onClick={() => handleVote(bet.id, index)}
                              className={`relative overflow-hidden w-full text-left p-3 rounded-xl border text-xs font-medium transition flex items-center justify-between ${
                                isWinner
                                  ? "bg-amber-500/10 border-amber-400 text-amber-400 font-bold"
                                  : isSelected
                                  ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-bold"
                                  : isExpired
                                  ? "bg-slate-950/40 border-dashed border-slate-900 text-slate-600 cursor-not-allowed"
                                  : "bg-slate-900 border-transparent text-slate-300 hover:bg-slate-900/80 cursor-pointer"
                              }`}
                            >
                              {/* Background progress fill overlay */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-slate-800/10 -z-10 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />

                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                                {isExpired && !isSelected && (
                                  <Lock className="w-3 h-3 text-slate-600" />
                                )}
                                <span>{option}</span>
                              </div>

                              <span className="text-[10px] text-slate-500 font-mono">
                                {optionVotes} {optionVotes === 1 ? 'voto' : 'votos'} ({pct}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Resolver Area for creator */}
                      {isCreator && bet.status === "open" && (
                        <div className="mt-4 pt-3 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-medium">
                            🚩 Declare o vencedor do lance real para cobrar as bebidas:
                          </span>
                          <div className="flex gap-1.5 flex-wrap">
                            {bet.options.map((option, index) => (
                              <button
                                key={`res_${bet.id}_${index}`}
                                onClick={() => handleResolveBet(bet, index)}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] py-1 px-2.5 rounded-lg transition"
                              >
                                {option} Venceu
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leaders Board / Players List in this room */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Consumo e Rodadas das Mesas</h3>
            </div>

            <div className="space-y-3">
              {players.map((plyr, idx) => {
                const isSelf = plyr.userId === user.uid;

                return (
                  <div
                    key={plyr.userId}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                      isSelf
                        ? "bg-emerald-950/20 border-emerald-500/20 shadow"
                        : "bg-slate-950 border-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-500 w-4">
                        #{idx + 1}
                      </span>
                      <img
                        src={plyr.photoURL}
                        alt="avatar"
                        className="w-10 h-10 rounded-xl bg-slate-900"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {plyr.displayName}
                          {plyr.userId === room?.creatorId && (
                            <span className="text-[8px] bg-amber-500 text-slate-950 border border-amber-400 font-bold px-1 py-[1px] rounded uppercase scale-90">
                              Adm
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-400">{plyr.favoriteTeam}</span>
                      </div>
                    </div>

                    {/* Doses owed vs drinks drank counters */}
                    <div className="flex items-center gap-4">
                      {/* Tally parameters */}
                      <div className="text-center">
                        <span className="block text-[9px] text-slate-400 uppercase tracking-wider">
                          Deve ⏳
                        </span>
                        <span className="font-mono text-sm font-black text-rose-400">
                          {plyr.dosesOwed}
                        </span>
                      </div>

                      <div className="text-center mr-2">
                        <span className="block text-[9px] text-slate-400 uppercase tracking-wider">
                          Virou 🍻
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-400">
                          {plyr.dosesDrunk}
                        </span>
                      </div>

                      {/* Direct donation controls to zombify or play with friends */}
                      {!isSelf && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDirectTallyModify(plyr, 1)}
                            className="bg-slate-900 hover:bg-rose-950 hover:text-rose-400 text-slate-400 p-1.5 rounded-lg text-[10px] border border-slate-800/80 transition"
                            title="Dar 1 dose de presente!"
                          >
                            +1 Dose 🥃
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-4): Real-time Group Chat / Banter & Interactive cheers */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col h-[75vh] shadow-xl overflow-hidden">
          
          {/* Box Header */}
          <div className="bg-slate-950 border-b border-slate-800 p-4 shrink-0 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Churras Chat &amp; Goles 💬</h3>
              <p className="text-[10px] text-slate-500">Zoeira em tempo real dos palpites</p>
            </div>
          </div>

          {/* Interactive Fast Cheer Chips */}
          <div className="bg-slate-950/60 p-2 border-b border-slate-800/50 shrink-0 flex gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
            <button
              onClick={() => handleSendMessage("⚽ GOL DO MEU TIME!!! TODO MUNDO BEBE! 🍻🚩")}
              className="bg-emerald-950 text-emerald-400 hover:bg-emerald-400 hover:text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full transition cursor-pointer"
            >
              ⚽ GOL!
            </button>
            <button
              onClick={() => handleSendMessage("🍻 Um brinde pra esse lance horroroso do juiz! Um gole!")}
              className="bg-teal-950 text-teal-400 hover:bg-teal-400 hover:text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full transition cursor-pointer"
            >
              🍻 BRINDE
            </button>
            <button
              onClick={() => handleSendMessage("😠 JUIZ DEU CARTÃO! Secou os secadores!")}
              className="bg-rose-950 text-rose-400 hover:bg-rose-400 hover:text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full transition cursor-pointer"
            >
              🚩 CARTÃO!
            </button>
            <button
              onClick={() => handleSendMessage("😜 Chuta pro mato de bico! Quem errou esse chutaço?")}
              className="bg-amber-950 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full transition cursor-pointer"
            >
              🚀 CANELADA
            </button>
          </div>

          {/* Messages Live Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950">
            {messages.length === 0 ? (
              <div className="text-center text-slate-600 text-xs py-20">
                Lobby silencioso. Mande uma mensagem para abrir os trabalhos!
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = msg.type === "system";
                const isDrinking = msg.type === "drinking";

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="bg-slate-900 border border-slate-800/60 rounded-xl p-2.5 text-[11px] text-amber-400 leading-relaxed font-mono w-full"
                    >
                      <span className="font-extrabold block mb-0.5 text-slate-500 uppercase">
                        📢 {msg.userName}
                      </span>
                      {msg.text}
                    </div>
                  );
                }

                if (isDrinking) {
                  return (
                    <div
                      key={msg.id}
                      className="bg-emerald-950/20 border border-emerald-500/10 rounded-xl p-2.5 text-[11px] text-emerald-400 leading-relaxed w-full"
                    >
                      {msg.text}
                    </div>
                  );
                }

                const isMe = msg.userId === user.uid;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 max-w-4/5 ${
                      isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <img
                      src={msg.userPhoto}
                      alt=""
                      className="w-7 h-7 rounded-lg bg-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="block text-[9px] text-slate-500 font-bold mb-0.5">
                        {msg.userName}
                      </span>
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? "bg-emerald-500 text-slate-950 font-medium rounded-tr-none"
                            : "bg-slate-900 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Composers */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite aqui para secar os amigos..."
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
              maxLength={150}
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 p-2.5 rounded-xl transition cursor-pointer"
            >
              <Send className="w-4 h-4 fill-slate-950" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
