import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import { Globe, Lock, Users, Timer, Copy, ArrowRight, RefreshCw, Gamepad2 } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function Lobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [publicRooms, setPublicRooms] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get("/rooms/public");
      setPublicRooms(data.rooms || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchRooms();
    const iv = setInterval(fetchRooms, 5000);
    return () => clearInterval(iv);
  }, []);

  const createRoom = async (isPrivate) => {
    setCreating(true);
    try {
      const { data } = await api.post("/rooms", { is_private: isPrivate });
      navigate(`/room/${data.code}`);
    } catch (e) {
      toast.error("Otaq yaradıla bilmədi");
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast.error("6 simvollu otaq kodu daxil et");
      return;
    }
    setLoading(true);
    try {
      await api.get(`/rooms/${code}`);
      navigate(`/room/${code}`);
    } catch (e) {
      toast.error("Otaq tapılmadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <Toaster position="top-right" theme="dark" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="fade-up">
              <div className="font-display font-black text-4xl sm:text-5xl tracking-tighter">
                Salam, <span className="text-indigo-300">{user?.name?.split(" ")[0] || "oyunçu"}</span>.
              </div>
              <div className="text-white/60 mt-2">Dostlarını otağa çağır və hərfin ortaya çıxmasını gözləmə.</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="glass-strong p-6 fade-up">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-indigo-300" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl">Özəl otaq</div>
                    <div className="text-xs text-white/50">Yalnız dəvət olunanlar</div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/65">Otaq kodunu dostlarına göndər — yalnız kodu bilən daxil ola bilər.</p>
                <button
                  onClick={() => createRoom(true)}
                  disabled={creating}
                  className="btn-primary w-full mt-5 disabled:opacity-60"
                  data-testid="create-private-room-btn"
                >
                  Özəl otaq yarat <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="glass-strong p-6 fade-up">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-emerald-300" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl">Açıq otaq</div>
                    <div className="text-xs text-white/50">Hamı qoşula bilər</div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/65">Yeni rəqiblərlə tanış ol. Otaq lobi siyahısında görünəcək.</p>
                <button
                  onClick={() => createRoom(false)}
                  disabled={creating}
                  className="btn-glass w-full mt-5 disabled:opacity-60"
                  data-testid="create-public-room-btn"
                >
                  Açıq otaq yarat
                </button>
              </div>
            </div>

            <div className="glass p-6 fade-up">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-lg">Kodla qoşul</div>
                <div className="text-xs text-white/40 font-mono-custom">6 SİMVOL</div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <input
                  className="input-dark font-mono-custom tracking-widest uppercase text-center text-lg"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  data-testid="join-code-input"
                />
                <button
                  onClick={joinRoom}
                  disabled={loading || joinCode.length !== 6}
                  className="btn-primary disabled:opacity-60"
                  data-testid="join-room-btn"
                >
                  Qoşul <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="glass p-6 fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-lg">
                  <Globe className="h-5 w-5 text-indigo-300" strokeWidth={1.8} />
                  Açıq otaqlar
                </div>
                <button onClick={fetchRooms} className="btn-glass !px-3 !py-1.5 text-xs" data-testid="refresh-rooms-btn">
                  <RefreshCw className="h-3.5 w-3.5" /> Yenilə
                </button>
              </div>

              <div className="mt-4 space-y-2" data-testid="public-rooms-list">
                {publicRooms.length === 0 && (
                  <div className="text-center py-8 text-white/40 text-sm">Hələlik açıq otaq yoxdur. İlk sən yarat!</div>
                )}
                {publicRooms.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => navigate(`/room/${r.code}`)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 hover:border-indigo-400/40 transition-all px-4 py-3 text-left"
                    data-testid={`public-room-${r.code}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono-custom font-bold tracking-widest text-white">{r.code}</div>
                      <div className="chip !text-[11px]">{r.state}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/60">
                      <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.players}</div>
                      <div className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {r.timer_seconds}s</div>
                      <ArrowRight className="h-4 w-4 text-indigo-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="glass p-6 fade-up" data-testid="user-summary-card">
              <div className="flex items-center gap-3">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="h-14 w-14 rounded-full border border-white/10" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-indigo-500/30 flex items-center justify-center text-xl font-bold">{user?.name?.[0]}</div>
                )}
                <div>
                  <div className="font-display font-bold text-lg">{user?.name}</div>
                  <div className="text-xs text-white/50">{user?.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <MiniStat label="Xal" value={user?.total_points || 0} color="text-emerald-300" />
                <MiniStat label="Oyun" value={user?.games_played || 0} color="text-sky-300" />
                <MiniStat label="Qələbə" value={user?.games_won || 0} color="text-amber-300" />
              </div>
            </div>

            <div className="glass p-6 fade-up">
              <div className="flex items-center gap-2 font-display font-bold text-lg">
                <Gamepad2 className="h-5 w-5 text-violet-300" strokeWidth={1.8} />
                Oyun qaydası
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>• Raundda bir hərf verilir (məs. <span className="font-mono-custom text-indigo-300">Ə</span>).</li>
                <li>• 7 kateqoriya üçün həmin hərflə başlayan söz yaz.</li>
                <li>• STOP! basanda raund bitir.</li>
                <li>• Oyunçular hər cavabı təsdiqləyir.</li>
                <li>• Unikal cavab <span className="font-mono-custom text-emerald-300">+10</span>, ortaq <span className="font-mono-custom text-sky-300">+5</span>.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3 text-center">
      <div className={`font-mono-custom text-lg font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}
