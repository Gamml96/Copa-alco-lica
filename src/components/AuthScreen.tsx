import React, { useState } from "react";
import {
  loginWithGoogle,
  loginAnonymously,
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  firebaseProjectId,
} from "../firebase";
import {
  Beer,
  Trophy,
  Flame,
  Play,
  ExternalLink,
  HelpCircle,
  UserCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Errors guides
  const [isAnonDisabledError, setIsAnonDisabledError] = useState(false);
  const [isEmailDisabledError, setIsEmailDisabledError] = useState(false);
  const [isNetworkRequestError, setIsNetworkRequestError] = useState(false);
  const [isInvalidCredentialError, setIsInvalidCredentialError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetErrors = () => {
    setError(null);
    setIsAnonDisabledError(false);
    setIsEmailDisabledError(false);
    setIsNetworkRequestError(false);
    setIsInvalidCredentialError(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (!email.trim() || !password) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await loginWithEmailAndPassword(email.trim(), password);
      } else {
        await registerWithEmailAndPassword(email.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      const errCode = err?.code || "";
      const errMessage = String(err?.message || "");

      if (errCode === "auth/operation-not-allowed" || errMessage.includes("operation-not-allowed")) {
        setIsEmailDisabledError(true);
        setError(
          "O login/registro com E-mail e Senha precisa ser ativado no Firebase Console para funcionar! Siga o passo a passo curtinho abaixo para liberar o acesso:"
        );
      } else if (errCode === "auth/network-request-failed" || errMessage.includes("network-request-failed")) {
        setIsNetworkRequestError(true);
        setError(
          "Não foi possível conectar aos servidores de autenticação do Google/Firebase por problemas na rede ou bloqueio local (como um Adblocker/bloqueador de anúncios)."
        );
      } else if (errCode === "auth/email-already-in-use") {
        setError("Este endereço de e-mail já está sendo usado por outra conta.");
      } else if (errCode === "auth/invalid-email") {
        setError("Por favor, digite um endereço de e-mail válido.");
      } else if (errCode === "auth/weak-password") {
        setError("Sua senha está muito fraca. Digite pelo menos 6 caracteres.");
      } else if (errCode === "auth/user-not-found" || errCode === "auth/wrong-password" || errCode === "auth/invalid-credential") {
        setIsInvalidCredentialError(true);
        setError("E-mail ou senha incorretos.");
      } else {
        setError(err?.message || "Ocorreu um erro ao processar sua autenticação.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    resetErrors();
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      const errCode = err?.code || "";
      const errMessage = String(err?.message || "");
      if (errCode === "auth/network-request-failed" || errMessage.includes("network-request-failed")) {
        setIsNetworkRequestError(true);
        setError(
          "Não foi possível conectar aos servidores de autenticação do Google/Firebase por problemas na rede ou bloqueio local (como um Adblocker/bloqueador de anúncios)."
        );
      } else {
        setError(
          "Erro de autenticação com o Google. Isso ocorre porque o navegador bloqueia popups de terceiros dentro do iframe do AI Studio. Clique no botão de nova aba abaixo para abrir em tela cheia!"
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    resetErrors();
    try {
      await loginAnonymously();
    } catch (err: any) {
      console.error(err);
      const errStr = String(err);
      const errCode = err?.code || "";
      const errMessage = String(err?.message || "");
      if (
        err?.code === "auth/admin-restricted-operation" ||
        errStr.includes("admin-restricted-operation") ||
        errStr.includes("auth/admin-restricted-operation")
      ) {
        setIsAnonDisabledError(true);
        setError(
          "O Login Anônimo (Convidado) está desativado no momento. Se você for o dono do projeto, ative-o em 10 segundos seguindo as instruções abaixo:"
        );
      } else if (errCode === "auth/network-request-failed" || errMessage.includes("network-request-failed")) {
        setIsNetworkRequestError(true);
        setError(
          "Não foi possível conectar aos servidores de autenticação do Google/Firebase por problemas na rede ou bloqueio local (como um Adblocker/bloqueador de anúncios)."
        );
      } else {
        setError("Erro ao entrar como convidado. Verifique sua conexão ou tente novamente.");
      }
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -z-10 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative"
        id="auth-card"
      >
        {/* Emblem */}
        <div className="mx-auto w-16 h-16 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-4 relative">
          <Beer className="w-8 h-8 text-amber-400" />
          <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 px-1 py-0.5 rounded-full text-[8px] font-black leading-none">
            18+
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1.5 text-center font-sans flex items-center justify-center gap-2">
          Chute &amp; Gole <span className="text-amber-400">⚽🍻</span>
        </h1>
        <p className="text-slate-400 text-xs text-center mb-6 leading-relaxed">
          Palpites e resenha em tempo real com a galera do futebol. Errou o palpite? Pague a rodada em doses!
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-850/85 flex flex-col items-center">
            <Trophy className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[9px] font-bold text-slate-300">Apostas</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-850/85 flex flex-col items-center">
            <Beer className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[9px] font-bold text-slate-300">Dose/Meta</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-850/85 flex flex-col items-center">
            <Flame className="w-4 h-4 text-rose-400 mb-1" />
            <span className="text-[9px] font-bold text-slate-300">Resenha</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="bg-slate-950 p-1 rounded-xl flex mb-5 border border-slate-850">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              resetErrors();
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "login"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Entrar (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              resetErrors();
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "register"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Criar Conta (Senha)
          </button>
        </div>

        {/* Dynamic Alerts/Errors */}
        {error && (
          <div
            className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl leading-relaxed space-y-3"
            id="auth-error"
          >
            <div className="flex gap-2 items-start">
              <HelpCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{error}</div>
            </div>

            {isEmailDisabledError ? (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] space-y-2 mt-2 font-sans">
                <p className="font-semibold text-emerald-400">Como Ativar no Firebase Console (E-mail/Senha):</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[10px]">
                  <li>
                    Acesse o console do Firebase clicando no botão abaixo.
                  </li>
                  <li>
                    Vá em <span className="text-white font-medium">Authentication</span> &gt;{" "}
                    <span className="text-white font-medium">Sign-in method</span>.
                  </li>
                  <li>
                    Clique em <span className="text-white font-medium">Add new provider</span> e escolha{" "}
                    <span className="text-white font-medium">Email/Password (E-mail/Senha)</span>.
                  </li>
                  <li>
                    Ative a opção <span className="text-white font-semibold">Enabled</span> e clique em{" "}
                    <span className="text-white font-semibold">Save (Salvar)</span>.
                  </li>
                </ol>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-extrabold py-2 px-3 rounded-lg text-[11px] mt-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ir para Firebase Auth Config 🛠️</span>
                </a>
              </div>
            ) : isAnonDisabledError ? (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] space-y-2 mt-2 font-sans">
                <p className="font-semibold text-emerald-400">Como Ativar no Firebase Console (Anônimo):</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[10px]">
                  <li>
                    Acesse seu Firebase Console no botão abaixo.
                  </li>
                  <li>
                    Na lista de provedores, clique em <span className="text-white font-medium">Adicionar novo provedor</span>.
                  </li>
                  <li>
                    Selecione <span className="text-white font-medium">Anônimo (Anonymous)</span>.
                  </li>
                  <li>
                    Ative e salve! Pronto!
                  </li>
                </ol>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-extrabold py-2 px-3 rounded-lg text-[11px] mt-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ir para Firebase Auth Config 🛠️</span>
                </a>
              </div>
            ) : isNetworkRequestError ? (
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 text-[11px] space-y-3 mt-2 font-sans">
                <p className="font-bold text-amber-400">🛡️ Bloqueador de Anúncios ou de Privacidade Ativo?</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Extensões como <strong className="text-white">uBlock Origin, AdBlock, Brave Shield ou Privacy Badger</strong> costumam bloquear conexões aos servidores de login do Google/Firebase dentro do iframe do AI Studio por motivos de privacidade.
                </p>
                <div className="space-y-1 text-[10px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <p className="font-bold text-emerald-400">Como resolver isto fácil:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-450 leading-relaxed">
                    <li>
                      <span className="text-white font-semibold">Pause seu Bloqueador (Adblocker)</span> temporariamente nesta página.
                    </li>
                    <li>
                      Se usa <span className="text-white font-semibold">Brave Browser</span>, desative o "Brave Shield" clicando no ícone do leão na barra de endereços.
                    </li>
                    <li>
                      Ou a solução definitiva: <span className="text-emerald-400 font-bold">Abra em Nova Aba</span> usando o botão destacado abaixo de cor contrastante para rodar o jogo livre de restrições de iframe!
                    </li>
                  </ol>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-extrabold py-2 px-4 rounded-xl text-xs transition active:scale-98 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir App em Nova Aba Pública 🚀</span>
                </a>
              </div>
            ) : isInvalidCredentialError ? (
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 text-[11px] space-y-3 mt-2 font-sans">
                <p className="font-bold text-amber-400">💡 Não consegue entrar no Bar?</p>
                <div className="space-y-2 text-[10px] text-slate-400 leading-relaxed">
                  <p>
                    <strong className="text-white">1. É o seu primeiro acesso?</strong> Antes de fazer o login ("Entrar"), você precisa criar sua credencial de acesso. Clique na aba <span className="text-emerald-400 font-bold">Criar Conta (Senha)</span> logo acima, cadastre o e-mail que deseja e uma senha de pelo menos 6 dígitos.
                  </p>
                  <p>
                    <strong className="text-white">2. Esqueceu a senha ou quer testar rápido?</strong> Clique no botão <span className="text-amber-400 font-bold">"Modo Convidado Rápido"</span> mais abaixo para entrar instantaneamente sem precisar registrar nenhum e-mail ou senha!
                  </p>
                  <p>
                    <strong className="text-white">3. Atenção à digitação:</strong> Lembre-se que as senhas diferenciam maiúsculas de minúsculas e procure não deixar espaços vazios no final do e-mail ou do campo da senha.
                  </p>
                </div>
              </div>
            ) : (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition active:scale-98"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir App em Nova Aba</span>
              </a>
            )}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              E-mail válido
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              Senha (min. 6 dígitos)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="******"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition"
                      required={mode === "register"}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || googleLoading || guestLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-98 transition text-slate-950 font-black py-3 rounded-xl shadow-lg border border-transparent text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : mode === "login" ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Bar</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Registrar e Brindar 🍻</span>
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="absolute w-full border-t border-slate-800" />
          <span className="relative bg-slate-900 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Ou continuar com
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          {/* Main Google Login button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading || guestLoading}
            id="google-login-btn"
            className="w-full flex items-center justify-center gap-2.5 bg-slate-950 text-white hover:bg-slate-900 active:scale-98 transition font-bold py-3 px-6 rounded-xl border border-slate-800 hover:border-amber-500/40 text-xs shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>Entrar com Conta Google</span>
              </>
            )}
          </button>

          {/* Fallback anonymous guest login option */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading || googleLoading || guestLoading}
            id="guest-login-btn"
            className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900/60 active:scale-98 transition text-slate-400 border border-slate-850 hover:border-slate-800 font-medium py-2.5 px-6 rounded-xl text-xs hover:text-slate-200 disabled:opacity-50 cursor-pointer"
          >
            {guestLoading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-slate-450" />
                <span>Modo Convidado Rápido (Sem e-mail)</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic Tips section */}
        <div className="mt-6 pt-4 border-t border-slate-850/80 text-left">
          <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
            💡 <strong className="text-amber-400">Dica:</strong> Criando uma conta você pode acessar suas apostas, estatísticas de doses de qualquer dispositivo e nunca perde seu histórico da rodada!
          </p>
        </div>

        <p className="text-[8px] text-slate-500 mt-4 leading-relaxed text-center">
          Ao entrar, você declara ser maior de 18 anos e concordar com o consumo consciente de álcool. Divirta-se com responsabilidade.
        </p>
      </motion.div>
    </div>
  );
}
