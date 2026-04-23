import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crown, Medal, Award, Trophy } from "lucide-react";

const TABS = [
  { key: "daily", label: "Günlük" },
  { key: "weekly", label: "Həftəlik" },
  { key: "all", label: "Bütün zaman" },
];

export default function Leaderboard() {
  const [tab, setTab] = useState("all");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/leaderboard?period=${tab}`);
        setEntries(data.entries || []);
      } finally { setLoading(false); }
    })();
  }, [tab]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="fade-up">
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-amber-300" strokeWidth={1.5} />
            <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter">Lider Cədvəli</h1>
          </div>
          <div className="text-white/60 mt-1">Azərbaycanın ən kəskin zehninləri burada.</div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="bg-black/40 border border-white/10 rounded-full p-1" data-testid="leaderboard-tabs">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-indigo-300 px-5"
                data-testid={`tab-${t.key}`}
              >{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-6">
              <div className="glass overflow-hidden">
                <div className="grid grid-cols-12 px-5 py-3 text-xs uppercase tracking-widest text-white/40 border-b border-white/5">
                  <div className="col-span-1">#</div>
                  <div className="col-span-6">Oyunçu</div>
                  <div className="col-span-2 text-right">Oyun</div>
                  <div className="col-span-3 text-right">Xal</div>
                </div>
                {loading && <div className="p-8 text-center text-white/50">Yüklənir...</div>}
                {!loading && entries.length === 0 && (
                  <div className="p-10 text-center text-white/40 text-sm">Hələlik nəticə yoxdur. İlk yerə sən keç!</div>
                )}
                {entries.map((e, idx) => (
                  <div
                    key={e.user_id}
                    className={`grid grid-cols-12 px-5 py-4 items-center border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/5 ${
                      idx === 0 ? "bg-amber-300/10" : idx === 1 ? "bg-slate-300/5" : idx === 2 ? "bg-orange-300/5" : ""
                    }`}
                    data-testid={`leaderboard-row-${idx}`}
                  >
                    <div className="col-span-1 flex items-center">
                      {idx === 0 && <Crown className="h-4 w-4 text-amber-300" />}
                      {idx === 1 && <Medal className="h-4 w-4 text-slate-300" />}
                      {idx === 2 && <Award className="h-4 w-4 text-orange-300" />}
                      {idx > 2 && <span className="font-mono-custom text-white/50">{idx + 1}</span>}
                    </div>
                    <div className="col-span-6 flex items-center gap-3">
                      {e.picture ? <img src={e.picture} alt="" className="h-8 w-8 rounded-full border border-white/10" /> : <div className="h-8 w-8 rounded-full bg-indigo-500/30" />}
                      <div className="font-medium">{e.name || "Naməlum"}</div>
                    </div>
                    <div className="col-span-2 text-right text-white/60 font-mono-custom text-sm">{e.games}</div>
                    <div className="col-span-3 text-right font-mono-custom font-bold tabular-nums text-lg">{e.points}</div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
