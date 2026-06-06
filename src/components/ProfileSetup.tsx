import { useState, FormEvent } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";
import { Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface ProfileSetupProps {
  userId: string;
  defaultName: string;
  onComplete: (profile: UserProfile) => void;
}

const COMMON_TEAMS = [
  "Flamengo 🔴⚫",
  "Palmeiras 🟢⚪",
  "São Paulo 🔴⚫⚪",
  "Corinthians ⚫⚪",
  "Grêmio 🔵⚫⚪",
  "Atlético-MG 🐔",
  "Cruzeiro 🦊",
  "Vasco 💢",
  "Botafogo 🔥",
  "Fluminense 🇭🇺",
  "Santos 🐳",
  "Internacional 🔴⚪",
  "Bahia 🔵🔴⚪"
];

export default function ProfileSetup({ userId, defaultName, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState(defaultName || "");
  const [team, setTeam] = useState("");
  const [customTeam, setCustomTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Por favor, digite seu apelido de resenha!");
      return;
    }
    const finalTeam = team === "custom" ? customTeam : team;
    if (!finalTeam.trim()) {
      setError("Me diz pra qual time você torce ou se é apenas churrasqueiro!");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newUser: UserProfile = {
        uid: userId,
        displayName: name.trim(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        favoriteTeam: finalTeam.trim(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", userId), newUser);
      onComplete(newUser);
    } catch (err: any) {
      console.error("Erro completo ao salvar perfil:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erro ao salvar o perfil: ${errorMessage}. Se o erro persistir, verifique sua conexão ou recarregue a aba.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative"
        id="profile-setup-card"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-950 p-3 rounded-2xl border border-emerald-500/30">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Escalação do Elenco ⚽</h2>
            <p className="text-slate-400 text-xs">Complete seu perfil antes de entrar no estádio</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Apelido */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Seu Apelido no Boteco
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Neymar do Sofá"
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition"
              maxLength={25}
              required
            />
          </div>

          {/* Time de Futebol */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Qual é seu Time do Coração?
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
              {COMMON_TEAMS.map((teamName) => (
                <button
                  key={teamName}
                  type="button"
                  onClick={() => {
                    setTeam(teamName);
                    setError(null);
                  }}
                  className={`text-left text-xs p-2.5 rounded-lg border transition ${
                    team === teamName
                      ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-semibold"
                      : "bg-slate-900/50 border-transparent text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {teamName}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setTeam("custom");
                  setError(null);
                }}
                className={`text-left text-xs p-2.5 rounded-lg border transition ${
                  team === "custom"
                    ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-semibold"
                    : "bg-slate-900/50 border-transparent text-slate-300 hover:bg-slate-900"
                }`}
              >
                Outro ou Sem time 🍺
              </button>
            </div>

            {team === "custom" && (
              <input
                type="text"
                value={customTeam}
                onChange={(e) => setCustomTeam(e.target.value)}
                placeholder="Qual o nome do time?"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition"
                maxLength={40}
                required
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-98 text-slate-950 font-bold py-3.5 px-6 rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Salvar Perfil e Entrar</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
