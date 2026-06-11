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
  const [clockOffset, setClockOffset] = useState<number>(0);

  // Sincroniza o relógio do cliente com o servidor para corrigir qualquer diferença/drift de hora
  useEffect(() => {
    const syncClock = async () => {
      try {
        const start = Date.now();
        const resp = await fetch("/index.html", { method: "GET", cache: "no-store" });
        const dateHeader = resp.headers.get("Date");
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          const latency = (Date.now() - start) / 2;
          const adjustedServerTime = serverTime + latency;
          const offset = adjustedServerTime - Date.now();
          setClockOffset(offset);
          console.log(`[ClockSync] Relógio sincronizado com o servidor. Offset: ${offset}ms.`);
        }
      } catch (err) {
        console.warn("[ClockSync] Falha ao sincronizar relógio com servidor, usando hora local:", err);
      }
    };
    syncClock();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRemainingCalculatedSecs = (endsAtStr?: string) => {
    if (!endsAtStr) return null;
    const endsAt = new Date(endsAtStr);
    const syncedNowTime = now.getTime() + clockOffset;
    const diff = Math.floor((endsAt.getTime() - syncedNowTime) / 1000);
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
        let foundMe = false;
        snapshot.forEach((pSnap) => {
          const p = pSnap.data() as Player;
          list.push(p);
          if (p.userId === user.uid) {
            foundMe = true;
          }
        });
        // Sort players by dosesDrunk descending, or those who owe stats
        const sorted = list.sort((a, b) => b.dosesDrunk - a.dosesDrunk || b.dosesOwed - a.dosesOwed);
        setPlayers(sorted);

        // Garante que o jogador atual está cadastrado na subcoleção de jogadores (ex: após recarregar a página)
        if (!foundMe && user && user.uid) {
          const autoEnlist = async () => {
            const playerRecord: Player = {
              userId: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              favoriteTeam: user.favoriteTeam,
              dosesOwed: 0,
              dosesDrunk: 0,
              updatedAt: new Date().toISOString(),
            };
            try {
              await setDoc(doc(db, "rooms", roomId, "players", user.uid), playerRecord);
            } catch (e) {
              console.error("Auto enlist failed", e);
            }
          };
          autoEnlist();
        }
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

  // Submit new bet (Any player inside the room can create)
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
      const endsAt = betDuration > 0 ? new Date((Date.now() + clockOffset) + betDuration * 1000).toISOString() : undefined;
      const newBet: Bet = {
        id: betId,
        roomId,
        title: betTitle.trim(),
        options: optionsArray,
        betValue,
        status: "open",
        votes: {},
        creatorId: user.uid,
        creatorName: user.displayName,
        createdAt: new Date().toISOString(),
        endsAt,
      };

      await setDoc(doc(db, "rooms", roomId, "bets", betId), newBet);

      // System notification
      const alertMsg: Message = {
        id: `msg_sys_bet_${Date.now()}`,
        roomId,
        userId: "system",
        userName: "Palpiteiro 🎯",
        userPhoto: "",
        text: `🎯 Nova aposta aberta por ${user.displayName}: "${betTitle.trim()}" valendo ${betValue} dose(s)! Façam seus palpites!${betDuration > 0 ? ` ⏱️ Tempo Limite: ${betDuration >= 60 ? `${Math.floor(betDuration / 60)} min` : `${betDuration} seg`}!` : ""}`,
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

  // Lock a bet early (Lock guessing / freeze votes)
  const handleLockBet = async (betId: string) => {
    try {
      const targetBet = bets.find((b) => b.id === betId);
      if (!targetBet) return;

      const betRef = doc(db, "rooms", roomId, "bets", betId);
      // We set endsAt to the current timestamp to freeze voting immediately
      await updateDoc(betRef, {
        endsAt: new Date().toISOString(),
      });

      // System notification
      const alertMsg: Message = {
        id: `msg_sys_lock_${Date.now()}`,
        roomId,
        userId: "system",
        userName: "Prefeito do Gole 🚩",
        userPhoto: "",
        text: `🔒 Palpites bloqueados antecipadamente por ${user.displayName} para: "${targetBet.title}". Ninguém mais pode votar! Aguardando resultado do lance...`,
        type: "system",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "rooms", roomId, "messages", alertMsg.id), alertMsg);
    } catch (err) {
      console.error("Lock bet failed", err);
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
                  <span>Excluir Boteco</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingAction("leave")}
                  className="w-full md:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do Boteco</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-rose-500/20 rounded-2xl p-2 px-3 w-full flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 text-center">
                {confirmingAction === "delete" ? "⚠️ Cancelar e Excluir Boteco?" : "🚪 Tem certeza que deseja sair?"}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Palpites Ativos da Mesa</h3>
                  <p className="text-[10px] text-slate-400">Todos os amigos podem lançar e votar em tempo real!</p>
                </div>
              </div>
              {!creatingBet && (
                <button
                  onClick={() => setCreatingBet(true)}
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-black py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition duration-200 cursor-pointer shadow-md shadow-emerald-500/10 active:scale-97 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 text-slate-950 stroke-[3px]" />
                  <span>Novo Palpite</span>
                </button>
              )}
            </div>

            {/* Create Bet Modal Block - VISUALLY ENHANCED */}
            {creatingBet && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 mb-8 space-y-5 shadow-2xl relative overflow-hidden"
              >
                {/* Visual decoration overlay */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />

                <div className="flex justify-between items-center pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <PlusCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                        Lançar Desafio de Lance Real
                      </h4>
                      <p className="text-[10px] text-slate-500">Crie palpites de lances para rodar os copos</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCreatingBet(false)}
                    className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white py-1 px-2.5 rounded-lg border border-slate-800 transition cursor-pointer font-bold focus:outline-none"
                  >
                    Fechar
                  </button>
                </div>

                <form onSubmit={handleCreateBet} className="space-y-4">
                  {/* Modelos Rápidos */}
                  <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                    <span className="block text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      Sugestões Rápidas:
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
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
                          className="bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                        >
                          {tmpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pergunta do Palpite */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                      Pergunta / O que vai acontecer?
                    </label>
                    <input
                      type="text"
                      value={betTitle}
                      onChange={(e) => setBetTitle(e.target.value)}
                      placeholder="Ex: Neymar vai chutar na trave nesse lance?"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/65 rounded-xl px-4 py-3 text-white text-xs outline-none transition"
                      maxLength={60}
                      required
                    />
                  </div>

                  {/* Alternativas de voto */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                      Opções de Resposta (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={betOptionsString}
                      onChange={(e) => setBetOptionsString(e.target.value)}
                      placeholder="Sim, Não, Só na trave"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/65 rounded-xl px-4 py-3 text-white text-xs outline-none transition"
                      required
                    />
                    <span className="text-[9px] text-slate-500 block mt-1">
                      Mínimo de 2 opções. Separe usando vírgulas (ex: "Casa, Visitante, Empate").
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contrato: Valor em Doses */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                        Contrato: Quantas Doses Vale? 🥃
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 5].map((val) => {
                          const labels: Record<number, string> = {
                            1: "Manso",
                            2: "Aquecer",
                            3: "Brutal 💥",
                            5: "Supremo 🔥",
                          };
                          const isSelected = betValue === val;
                          return (
                            <button
                              key={`stake_${val}`}
                              type="button"
                              onClick={() => setBetValue(val)}
                              className={`p-2 rounded-xl text-center border transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                isSelected
                                  ? "bg-amber-500/10 border-amber-500 text-amber-400 font-black shadow-lg"
                                  : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                              }`}
                            >
                              <span className="text-xs font-black">{val} {val === 1 ? "Dose" : "Doses"}</span>
                              <span className="text-[8px] text-slate-500 font-medium block">{labels[val]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tempo Limite */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                        ⏱️ Tempo Limite para Votar
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 30, 60, 120, 180, 300, 600].map((dur) => {
                          const labels: Record<number, string> = {
                            0: "Sem limite",
                            30: "30s",
                            60: "1m",
                            120: "2m",
                            180: "3m",
                            300: "5m",
                            650: "10m",
                          };
                          const isSelected = betDuration === dur;
                          return (
                            <button
                              key={`dur_${dur}`}
                              type="button"
                              onClick={() => setBetDuration(dur)}
                              className={`px-2.5 py-2 rounded-lg text-center text-[10px] border transition cursor-pointer font-bold ${
                                isSelected
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-300"
                              }`}
                            >
                              {labels[dur]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg active:scale-[0.99] transition"
                  >
                    Divulgar Desafio na Mesa! 🚀
                  </button>
                </form>
              </motion.div>
            )}

            {/* List of active/resolved bets */}
            {bets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800/50">
                <Trophy className="w-10 h-10 text-slate-700 mb-2.5 animate-bounce" />
                <h4 className="font-extrabold text-slate-300 text-sm">Sem palpites ativos de momento</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1 mx-auto px-4">
                  Qualquer pessoa na mesa pode lançar um novo palpite para agitar os amigos e começar as rodadas de dose!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bets.map((bet) => {
                  const hasVoted = bet.votes && bet.votes[user.uid] !== undefined;
                  const myVote = hasVoted ? bet.votes[user.uid] : null;

                  const secs = getRemainingCalculatedSecs(bet.endsAt);
                  const isExpired = bet.status === "open" && secs !== null && secs <= 0;
                  const isLocked = isExpired;
                  const isClosed = bet.status === "resolved";

                  const isMyOwnBet = bet.creatorId === user.uid;
                  const hasRights = isCreator || isMyOwnBet;

                  return (
                    <div
                      key={bet.id}
                      className={`border rounded-2xl p-4 md:p-5 flex flex-col justify-between transition-all duration-300 ${
                        isClosed
                          ? "bg-slate-950/40 border-slate-900/60 opacity-60 grayscale"
                          : isLocked
                          ? "bg-slate-950 border-amber-500/10 shadow-md"
                          : "bg-slate-950 border-slate-800/80 hover:border-slate-800 hover:shadow-lg shadow-lg"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div>
                          {/* Top Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-400 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                              🥃 Vale {bet.betValue} {bet.betValue === 1 ? "Dose" : "Doses"}
                            </span>
                            <span className="text-[9px] bg-slate-900/80 border border-slate-800/50 text-slate-400 px-2.5 py-0.5 rounded-md font-mono shrink-0">
                              Lançado por: <strong className="text-emerald-400">{isMyOwnBet ? "Você" : (bet.creatorName || "Brother")}</strong>
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-extrabold text-white mt-1.5 leading-snug">
                            {bet.title}
                          </h4>
                        </div>

                        {/* Status / Live Timer Indicator */}
                        <div className="shrink-0">
                          {isClosed ? (
                            <span className="text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800/50 font-bold block text-center">
                              Finalizado ✅
                            </span>
                          ) : isLocked ? (
                            <span className="text-[10px] text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/10 font-black flex items-center justify-center gap-1">
                              <Lock className="w-3 h-3 text-red-400" /> Palpites Trancados 🔒
                            </span>
                          ) : (
                            <div>
                              {bet.endsAt ? (() => {
                                if (secs !== null && secs <= 0) {
                                  return (
                                    <span className="text-[10px] text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/10 font-bold flex items-center justify-center gap-1">
                                      <Lock className="w-3 h-3 text-red-500" /> Palpites Trancados 🔒
                                    </span>
                                  );
                                }
                                const m = Math.floor((secs || 0) / 60);
                                const s = (secs || 0) % 65;
                                return (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 font-black flex items-center justify-center gap-1 font-mono animate-pulse font-bold">
                                    <Clock className="w-3 h-3 text-amber-400 animate-spin" /> {m}:{s < 10 ? `0${s}` : s}
                                  </span>
                                );
                              })() : (
                                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-500/25 font-extrabold animate-pulse block text-center">
                                  Aberto para Votos 🟢
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vote Buttons / Selection Option list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {bet.options.map((option, index) => {
                          const totalVotes = Object.keys(bet.votes || {}).length;
                          const optionVotes = Object.values(bet.votes || {}).filter(
                            (v) => v === index
                          ).length;
                          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

                          const isSelected = myVote === index;
                          const isWinner = isClosed && bet.winnerOption === index;
                          const isDisabled = isClosed || isLocked;

                          return (
                            <button
                              key={`${bet.id}_opt_${index}`}
                              disabled={isDisabled}
                              onClick={() => handleVote(bet.id, index)}
                              className={`relative overflow-hidden w-full text-left p-3.5 rounded-xl border text-xs font-semibold transition duration-205 flex items-center justify-between group ${
                                isWinner
                                  ? "bg-amber-500/10 border-amber-400 text-amber-400 font-black scale-[1.01]"
                                  : isSelected
                                  ? "bg-emerald-950/60 border-emerald-500 text-emerald-400 font-black"
                                  : isDisabled
                                  ? "bg-slate-950/20 border-slate-900 text-slate-500 cursor-not-allowed"
                                  : "bg-slate-900 border-slate-800/40 text-slate-300 hover:bg-slate-850 hover:text-white cursor-pointer"
                              }`}
                            >
                              {/* Background progress fill overlay */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 -z-10 transition-all duration-700 ease-out ${
                                  isWinner
                                    ? "bg-amber-400/10"
                                    : isSelected
                                    ? "bg-emerald-500/10"
                                    : "bg-slate-800/15"
                                }`}
                                style={{ width: `${pct}%` }}
                              />

                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                )}
                                {isClosed && !isWinner && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                )}
                                <span>{option}</span>
                              </div>

                              <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-200 transition">
                                {optionVotes} {optionVotes === 1 ? 'voto' : 'votos'} ({pct}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Resolver & Lock Area for the bet creator / room administrator */}
                      {hasRights && !isClosed && (
                        <div className="mt-4 pt-3.5 border-t border-slate-900 flex flex-col lg:flex-row justify-between items-center gap-3 bg-slate-900/20 p-3 rounded-xl border border-slate-800/40">
                          <div className="flex flex-col text-left self-start lg:self-auto">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                              Gerenciador do Seu Palpite 🛠️
                            </span>
                            <span className="text-[9px] text-slate-400">
                              Tranque palpites antes do lance ou selecione o ganhador da rodada:
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
                            {/* Early Lock button */}
                            {!isLocked && (
                              <button
                                onClick={() => handleLockBet(bet.id)}
                                className="bg-slate-950 hover:bg-rose-950/80 hover:text-rose-400 text-slate-300 border border-slate-850 hover:border-rose-500/20 font-black text-[10px] py-1.5 px-3 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1"
                                title="Fechar votação agora mesmo! Útil se a jogada começou antes do cronômetro expirar."
                              >
                                <Lock className="w-3 h-3" />
                                <span>Trancar Apostas 🔒</span>
                              </button>
                            )}

                            {/* Options to settle/declare winner */}
                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850/80">
                              <span className="text-[8px] text-slate-500 font-black uppercase px-2 font-mono">Venceu:</span>
                              {bet.options.map((option, index) => (
                                <button
                                  key={`res_${bet.id}_${index}`}
                                  onClick={() => handleResolveBet(bet, index)}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] py-1 px-2.5 rounded-md transition cursor-pointer"
                                  title={`Declarar "${option}" como a resposta correta e cobrar os errados!`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
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
