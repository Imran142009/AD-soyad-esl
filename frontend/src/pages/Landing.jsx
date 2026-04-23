import { useAuth } from "@/context/AuthContext";
import { Sparkles, ArrowRight, Users, Timer, Trophy, Crown } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/lobby", { replace: true });
  }, [user, navigate]);

  const handleSignIn = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const categories = ["Ad", "Soyad", "Şəhər", "Ölkə", "Bitki", "Heyvan", "Əşya"];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <img
        src="https://static.prod-images.emergentagent.com/jobs/6fcc6400-d2ef-4e71-85ab-912d845dbb57/images/83d93760408621f09aa778a330ea65d446cc5cf31981b1f04dce6e016603f885.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 w-full h-full object-cover opacity-40 mix-blend-screen pointer-events-none"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0B0E14]/40 via-[#0B0E14]/70 to-[#0B0E14]" />

      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_0_20px_rgba(129,140,248,0.5)]">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={1.8} />
          </div>
          <div className="font-display font-black text-xl tracking-tighter">Ad·Soyad·Şəhər</div>
        </div>
        <button onClick={handleSignIn} className="btn-glass" data-testid="header-signin-btn">
          Daxil ol
        </button>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-12 sm:pt-20 pb-16">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 fade-up">
            <div className="chip mb-5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Canlı multiplayer · Azərbaycan klassiki
            </div>
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter leading-[0.95] neon-text">
              Hərf çıxdı.<br />
              <span className="text-indigo-300">Ad, Soyad,</span>
              <br />
              Şəhər... <span className="text-white/50">başla!</span>
            </h1>
            <p className="mt-6 text-white/70 text-base sm:text-lg max-w-xl">
              Dostlarınla real-vaxt yarışlara qoşul. Hər raundda bir hərf, yeddi kateqoriya, saniyələrlə qərar ver.
              Unikal cavab = <span className="font-mono-custom text-emerald-300">+10</span>, ortaq cavab =
              <span className="font-mono-custom text-sky-300"> +5</span>.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={handleSignIn} className="btn-primary text-base" data-testid="cta-signin-btn">
                Google ilə başla <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#how" className="btn-glass">Necə oynanır?</a>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              <Stat icon={Users} label="Otaq" value="Private/Public" />
              <Stat icon={Timer} label="Timer" value="30·60·90s" />
              <Stat icon={Trophy} label="Lider" value="Daily·Weekly" />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="glass-strong p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="relative">
                <div className="text-white/60 text-sm tracking-wider uppercase">Bu raundun hərfi</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-display font-black text-[10rem] leading-none tracking-tighter text-white neon-text">
                    Ə
                  </div>
                  <div className="font-mono-custom text-5xl text-white/90 tabular-nums">00:47</div>
                </div>
                <div className="mt-6 space-y-2">
                  {["Əli", "Əliyev", "Ərdəbil", "Ərəbistan", "Ərik", "Ətçi", "Əşya"].map((w, i) => (
                    <div
                      key={w}
                      className="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/50 font-mono-custom w-14">{categories[i]}</span>
                        <span className="text-white font-medium">{w}</span>
                      </div>
                      <span className="text-xs font-mono-custom text-emerald-300">+{i % 3 === 0 ? 10 : 5}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 overflow-hidden border-y border-white/10 py-4">
          <div className="flex gap-10 marquee whitespace-nowrap font-display font-black text-2xl sm:text-3xl text-white/30 tracking-tighter">
            {Array.from({ length: 2 }).map((_, g) => (
              <div key={g} className="flex gap-10">
                {["Ad", "Soyad", "Şəhər", "Ölkə", "Bitki", "Heyvan", "Əşya", "Real-time", "Multiplayer", "Glass UI"].map((t, i) => (
                  <span key={i} className="flex items-center gap-10">
                    {t}
                    <span className="text-indigo-400/60">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div id="how" className="mt-20 grid md:grid-cols-3 gap-6">
          <HowCard step="01" title="Otaq yarat" body="Özəl və ya açıq otaq. Timer və kateqoriyaları seç." />
          <HowCard step="02" title="Hərf təyin et" body="Raundu başladınca təsadüfi hərf verilir. Dərhal yaz!" />
          <HowCard step="03" title="Səslə və qazan" body="Hər cavabı oyunçular təsdiqləsin. Unikal cavab — bonus." />
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-white/40 text-sm">
        Emergent · Real-time glass UI
      </footer>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="glass p-3">
      <Icon className="h-4 w-4 text-indigo-300" strokeWidth={1.8} />
      <div className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function HowCard({ step, title, body }) {
  return (
    <div className="glass p-6 group transition-all duration-300 hover:-translate-y-1">
      <div className="font-mono-custom text-indigo-300 text-xs tracking-widest">STEP {step}</div>
      <div className="mt-2 font-display font-black text-2xl tracking-tighter">{title}</div>
      <div className="mt-2 text-white/60 text-sm">{body}</div>
      <Crown className="mt-4 h-5 w-5 text-white/30 group-hover:text-indigo-300 transition-colors" strokeWidth={1.5} />
    </div>
  );
}
