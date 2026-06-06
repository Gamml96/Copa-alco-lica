import { useState } from "react";
import { loginWithGoogle, loginAnonymously } from "../firebase";
import { Beer, Trophy, Flame, Play, ExternalLink, HelpCircle, UserCheck } from "lucide-react";
import { motion } from "motion/react";

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [isAnonDisabledError, setIsAnonDisabledError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setIsAnonDisabledError(false);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(
        "Erro de autenticação com o Google. Isso geralmente ocorre porque o navegador bloqueou o pop-up ou cookies de terceiros dentro deste Iframe. Clique no botão vermelho abaixo para abrir o app em tela cheia na nova aba!"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setIsAnonDisabledError(false);
    setError(null);
    try {
      await loginAnonymously();
    } catch (err: any) {
      console.error(err);
      const errStr = String(err);
      if (err?.code === "auth/admin-restricted-operation" || errStr.includes("admin-restricted-operation") || errStr.includes("auth/admin-restricted-operation")) {
        setIsAnonDisabledError(true);
        setError(
          "O Login Anônimo (Convidado) precisa ser ativado no painel do Firebase pelo administrador/proprietário do projeto para poder funcionar. Siga o passo a passo de 10 segundos abaixo:"
        );
      } else {
        setError("Erro ao entrar como convidado. Verifique sua conexão de rede ou permissões.");
      }
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative"
        id="auth-card"
      >
        {/* Taverna Emblem */}
        <div className="mx-auto w-20 h-20 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-6 relative">
          <Beer className="w-10 h-10 text-amber-400 animate-pulse" />
          <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full text-[10px] font-bold">
            18+
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-sans">
          Chute &amp; Gole 🍻
        </h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          O aplicativo do churrasco e futebol! Aposte em palpites de lances em tempo real e pague em doses de bebida se errar. Sem dinheiro, apenas zoeira!
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center">
            <Trophy className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Apostas</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center">
            <Beer className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Doses</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center">
            <Flame className="w-5 h-5 text-rose-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Tempo Real</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl text-left leading-relaxed space-y-3" id="auth-error">
            <div className="flex gap-2 items-start">
              <HelpCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{error}</div>
            </div>
            
            {isAnonDisabledError ? (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] space-y-2 mt-2">
                <p className="font-semibold text-emerald-400">Como Ativar no Firebase Console (Passo Único):</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-450">
                  <li>Clique no botão <span className="text-white font-medium">Ir para Firebase Console</span> abaixo.</li>
                  <li>Na seção "Provedores de login", clique em <span className="text-white font-medium">Adicionar novo provedor</span> e selecione <span className="text-white font-medium">Anônimo (Anonymous)</span>.</li>
                  <li>Ative a chave seletora, clique em <span className="text-white font-medium">Salvar</span> e pronto!</li>
                </ol>
                <a
                  href="https://console.firebase.google.com/project/ai-studio-applet-webapp-c2b85/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold py-2 px-3 rounded-lg text-xs mt-3 transition active:scale-98"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ir para Firebase Console 🛠️</span>
                </a>
              </div>
            ) : (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition active:scale-98"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir App em Nova Aba</span>
              </a>
            )}
          </div>
        )}

        <div className="space-y-3">
          {/* Main Google Login button */}
          <button
            onClick={handleLogin}
            disabled={loading || guestLoading}
            id="google-login-btn"
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 transition text-slate-950 font-bold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-amber-500/10 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Entrar com o Google</span>
              </>
            )}
          </button>

          {/* Fallback anonymous guest login option */}
          <button
            onClick={handleGuestLogin}
            disabled={loading || guestLoading}
            id="guest-login-btn"
            className="w-full flex items-center justify-center gap-2.5 bg-slate-950 hover:bg-slate-950/80 active:scale-98 transition text-slate-300 border border-slate-800 font-bold py-3.5 px-6 rounded-2xl hover:text-white disabled:opacity-50"
          >
            {guestLoading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Entrar como Convidado (Sem Login)</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic Tips section */}
        <div className="mt-6 pt-5 border-t border-slate-850/80 text-left">
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            💡 <strong className="text-emerald-400">Dica da Rodada:</strong> Se você estiver rodando o app dentro do visualizador do AI Studio, o seu navegador pode bloquear pop-ups. Caso o botão do Google dê erro, use o botão <span className="font-semibold text-slate-200">Convidado</span> para entrar na hora!
          </p>
        </div>

        <p className="text-[9px] text-slate-500 mt-5 leading-relaxed">
          Ao entrar, declare ser maior de 18 anos e estar de acordo com o consumo responsável de bebidas alcoólicas. Divirta-se moderadamente.
        </p>
      </motion.div>
    </div>
  );
}
