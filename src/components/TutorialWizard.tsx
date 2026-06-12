import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Beer, 
  Trophy, 
  Users, 
  HelpCircle, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Lock, 
  Clock, 
  Sparkles, 
  Play, 
  MessageSquare,
  Sparkle
} from "lucide-react";

interface TutorialWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TutorialWizard({ isOpen, onClose }: TutorialWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: "Boas-vindas ao Bar! ⚽🍻",
      tagline: "O App que transforma o futebol ao vivo em rodada de gargalhadas e doses!",
      description: "Chute & Gole é um jogo de resenha em tempo real para assistir partidas de futebol com os amigos. Aqui, cada lance vira um palpite e quem errar, vira o copo!",
      color: "from-amber-500/20 to-orange-500/10",
      accent: "text-amber-400",
      icon: <Beer className="w-16 h-16 text-amber-405 animate-bounce text-amber-400" />,
      visual: (
        <div className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col items-center">
          <div className="flex gap-4 items-center justify-center">
            <div className="text-center p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="block text-xl">⚽</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mt-1">Chute Real</span>
            </div>
            <span className="text-xl font-black text-amber-500">+</span>
            <div className="text-center p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="block text-xl">🍻</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mt-1">Gole com Amigos</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-450 text-slate-400 mt-4 text-center font-mono">
            "Sem complicação: assista ao jogo, palpite e beba!"
          </span>
        </div>
      )
    },
    {
      title: "Crie ou Entre em um Boteco 🎪",
      tagline: "Sua mesa virtual exclusiva para a resenha",
      description: "Um 'Boteco' é a sua sala privada de palpites. Você pode criar um novo boteco ou entrar em um já criado pelos amigos utilizando o código da sala (ex: FLA-4982). É tudo sincronizado na hora!",
      color: "from-emerald-500/20 to-teal-500/10",
      accent: "text-emerald-400",
      icon: <Users className="w-14 h-14 text-emerald-400" />,
      visual: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center bg-slate-950 p-2.5 px-3.5 rounded-xl border border-slate-850">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-widest">Boteco Ativo</span>
              <span className="text-xs font-bold text-white">Mesa do Brasileirão 🏆</span>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-1 rounded font-black border border-emerald-500/20">
              MAS-8512
            </span>
          </div>
          <p className="text-[10px] text-slate-500 text-center italic">
            Compartilhe o código e todos se conectam na mesma rodada de copos!
          </p>
        </div>
      )
    },
    {
      title: "Lance Palpites de Lances 🎯",
      tagline: "Qualquer pessoa na mesa pode propor desafios!",
      description: "A resenha não tem dono fixo! Viu que vai acontecer um lance interessante? Clique em 'Novo Palpite', defina um título (Ex: 'Neymar bate a falta na trave?'), as alternativas de voto e o valor do contrato em doses!",
      color: "from-blue-500/20 to-indigo-500/10",
      accent: "text-blue-400",
      icon: <Sparkles className="w-14 h-14 text-blue-400" />,
      visual: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-left">
          <div className="bg-slate-950 p-3 rounded-xl border border-blue-500/20">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded uppercase font-mono">
                🥃 Vale 2 Doses
              </span>
              <span className="text-[10px] text-blue-400 font-bold font-mono">Aberto</span>
            </div>
            <h5 className="text-xs font-bold text-white">Próximo escanteio será do Flamengo?</h5>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-slate-900 p-2 rounded-lg text-[10px] border border-slate-800 text-slate-300 text-center font-bold">
                Sim 👍
              </div>
              <div className="bg-slate-900 p-2 rounded-lg text-[10px] border border-slate-800 text-slate-300 text-center font-bold">
                Não 👎
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Trancamento Rápido 🔒",
      tagline: "A chave para evitar trapaças e palpites atrasados!",
      description: "Futebol na TV tem delay (atraso)! Se o escanteio for cobrado de repente, o criador do palpite (ou o administrador do boteco) pode clicar em 'Trancar Apostas 🔒' para congelar a votação instantaneamente, impedindo palpites espertinhos!",
      color: "from-rose-500/20 to-red-500/10",
      accent: "text-rose-400",
      icon: <Lock className="w-14 h-14 text-rose-455 text-rose-400 animate-pulse" />,
      visual: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-black px-4 py-2 rounded-xl">
            <Lock className="w-4 h-4 text-rose-400" />
            <span>PALPITES BLOQUEADOS!</span>
          </div>
          <p className="text-[10px] text-slate-500 text-center max-w-xs leading-normal">
            Ninguém mais vota! O criador agora avalia o lance na TV e anuncia quem ganhou/perdeu para aplicar as doses.
          </p>
        </div>
      )
    },
    {
      title: "Vire a Dose e Limpe sua Conta 🥃",
      tagline: "Quem erra de verdade, bebe com integridade!",
      description: "O palpite encerrou e você perdeu? Sua conta de 'Doses a Virar' subirá na mesma hora. Beba o seu copo físico e clique no grande botão 'Bebi uma Dose! 🍻' para purgar seus débitos. Beba água e jogue com juízo!",
      color: "from-violet-500/20 to-fuchsia-500/10",
      accent: "text-violet-400",
      icon: <Check className="w-14 h-14 text-violet-400" />,
      visual: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <span className="block text-2xl font-black text-rose-500">2</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Doses Devendo 🔥</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center">
              <span className="block text-2xl font-black text-slate-400">4</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Já Bebidas 🍺</span>
            </div>
          </div>
          <button className="bg-amber-500 text-slate-950 text-[10px] font-black px-4 py-2 rounded-xl flex items-center gap-1">
            <Beer className="w-3.5 h-3.5 fill-slate-950" />
            <span>Bebi uma Dose! 🍻</span>
          </button>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative"
        >
          {/* Radial amber backdrop glow */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-br ${steps[currentStep].color} blur-3xl opacity-60 -z-10 transition-all duration-500`} />

          {/* Close Header Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition cursor-pointer z-20"
            title="Fechar guia"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Wizard Content */}
          <div className="p-6 md:p-8 flex flex-col items-center text-center space-y-6">
            
            {/* Step Counter Tag */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-full border border-slate-800/80">
              <span className="text-[10px] tracking-wider uppercase font-black text-amber-500">
                Tutorial do Boteco 💡
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-75 * bg-slate-700" />
              <span className="text-[10px] font-bold text-slate-400">
                Passo {currentStep + 1} de {steps.length}
              </span>
            </div>

            {/* Main Visual & Icon */}
            <div className="flex flex-col items-center justify-center h-20">
              {steps[currentStep].icon}
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {steps[currentStep].title}
              </h3>
              <p className={`text-xs ${steps[currentStep].accent} font-extrabold tracking-wide`}>
                {steps[currentStep].tagline}
              </p>
            </div>

            {/* Visual Interactive Sandbox */}
            <div className="w-full max-w-sm">
              {steps[currentStep].visual}
            </div>

            {/* Description Paragraph */}
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {steps[currentStep].description}
            </p>

            {/* Step Dot Indicators */}
            <div className="flex items-center gap-1.5 justify-center py-2">
              {steps.map((_, idx) => (
                <div
                  key={`dot_${idx}`}
                  className={`h-1.5 rounded-full transition-all duration-350 ${
                    idx === currentStep ? "w-6 bg-amber-400" : "w-1.5 bg-slate-800"
                  }`}
                />
              ))}
            </div>

            {/* Controls Bar */}
            <div className="w-full pt-4 border-t border-slate-800/60 flex items-center justify-between gap-4">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl border border-slate-800 font-sans transition ${
                  currentStep === 0
                    ? "opacity-30 cursor-not-allowed text-slate-600"
                    : "bg-slate-950 hover:bg-slate-850 text-slate-300 cursor-pointer"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs font-black py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 transition duration-200 cursor-pointer shadow-lg active:scale-97"
              >
                <span>{currentStep === steps.length - 1 ? "Pronto! Bora pro Bar 🚀" : "Avançar"}</span>
                {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-950 font-black" />}
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
