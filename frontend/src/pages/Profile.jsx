import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { api } from "@/lib/api";
import { Crown, Trophy, BarChart3, Calendar } from "lucide-react";

export default function Profile() {
  const [data, setData] = useState(null);
  useEffect(() => { (async () => {
    const r = await api.get("/profile/me");
    setData(r.data);
  })(); }, []);

  if (!data) return (
    <div className="min-h-screen"><NavBar /><div className="max-w-5xl mx-auto px-6 py-16"><div className="glass p-10 text-center text-white/60">Yüklənir...</div></div></div>
  );

  const { user, stats, matches } = data;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="glass-strong p-6 sm:p-8 fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {user.picture ? <img src={user.picture} alt="" className="h-20 w-20 rounded-full border border-white/10" /> : <div className="h-20 w-20 rounded-full bg-indigo-500/30" />}
            <div>
              <div className="font-display font-black text-3xl sm:text-4xl tracking-tighter">{user.name}</div>
              <div className="text-white/50 text-sm">{user.email}</div>
              {user.is_admin && <div className="inline-flex items-center gap-1 mt-2 chip"><Crown className="h-3 w-3" /> Admin</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <StatCard icon={Trophy} label="Ümumi xal" value={stats.total_points} color="text-amber-300" testid="stat-total-points" />
            <StatCard icon={BarChart3} label="Oyun sayı" value={stats.games_played} color="text-sky-300" testid="stat-games-played" />
            <StatCard icon={Crown} label="Qələbələr" value={stats.games_won} color="text-emerald-300" testid="stat-games-won" />
            <StatCard icon={Calendar} label="Qələbə %" value={`${stats.win_rate}%`} color="text-violet-300" testid="stat-win-rate" />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-display font-bold text-2xl tracking-tight mb-3">Oyun tarixçəsi</h2>
          <div className="space-y-2" data-testid="match-history">
            {matches.length === 0 && <div className="glass p-8 text-center text-white/40 text-sm">Hələ oyun oynamamışsan.</div>}
            {matches.map((m) => {
              const ranked = [...m.scores].sort((a, b) => a.rank - b.rank);
              const me = m.scores.find((s) => s.user_id === user.user_id);
              const won = ranked[0]?.user_id === user.user_id;
              return (
                <div key={m.id} className="glass p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${won ? "bg-amber-300/20 text-amber-300 border border-amber-300/40" : "bg-white/5 border border-white/10 text-white/60"}`}>
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{won ? "Qələbə" : `Yer #${me?.rank || "?"}`}</div>
                      <div className="text-xs text-white/50">{new Date(m.ended_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-custom text-lg font-bold">{me?.score ?? 0}</div>
                    <div className="text-xs text-white/50">{m.rounds} raund · {m.timer_seconds}s</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4" data-testid={testid}>
      <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.8} />
      <div className={`font-mono-custom font-bold text-2xl tabular-nums mt-2 ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-white/50">{label}</div>
    </div>
  );
}
