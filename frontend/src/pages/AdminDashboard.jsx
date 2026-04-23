import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { api, CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/api";
import { Users as UsersIcon, BookOpen, Ban, VolumeX, Volume2, Shield, Plus, Trash2, CheckCircle, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <Toaster position="top-right" theme="dark" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="fade-up">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-300" strokeWidth={1.5} />
            <h1 className="font-display font-black text-4xl tracking-tighter">Admin Panel</h1>
          </div>
          <div className="text-white/60 mt-1">İstifadəçiləri və lüğəti idarə et.</div>
        </div>

        <Tabs defaultValue="users" className="mt-6">
          <TabsList className="bg-black/40 border border-white/10 rounded-full p-1">
            <TabsTrigger value="users" className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-indigo-300 px-5" data-testid="admin-tab-users">İstifadəçilər</TabsTrigger>
            <TabsTrigger value="words" className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-indigo-300 px-5" data-testid="admin-tab-words">Lüğət</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
          <TabsContent value="words" className="mt-6"><WordsPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/users");
    setUsers(data.users || []);
  };
  useEffect(() => { load(); }, []);

  const ban = async (uid, val) => {
    await api.post(`/admin/users/${uid}/ban`, { banned: val });
    toast.success(val ? "İstifadəçi bloklandı" : "Blok götürüldü");
    load();
  };
  const mute = async (uid, val) => {
    await api.post(`/admin/users/${uid}/mute`, { muted: val });
    toast.success(val ? "Səsi bağlandı" : "Səs açıldı");
    load();
  };

  const filtered = users.filter((u) => !q || u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 input-dark !py-2">
          <Search className="h-4 w-4 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad və ya email ilə axtar..." className="bg-transparent outline-none flex-1" data-testid="admin-users-search" />
        </div>
        <div className="chip"><UsersIcon className="h-3.5 w-3.5" /> {filtered.length}</div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase tracking-widest">
              <th className="py-3 px-2">Ad</th>
              <th className="py-3 px-2">Email</th>
              <th className="py-3 px-2 text-right">Xal</th>
              <th className="py-3 px-2 text-right">Oyun</th>
              <th className="py-3 px-2 text-center">Status</th>
              <th className="py-3 px-2 text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-white/5 hover:bg-white/5" data-testid={`admin-user-${u.user_id}`}>
                <td className="py-3 px-2 flex items-center gap-2">
                  {u.picture ? <img src={u.picture} alt="" className="h-7 w-7 rounded-full" /> : <div className="h-7 w-7 rounded-full bg-indigo-500/30" />}
                  <span className="font-medium">{u.name}</span>
                  {u.is_admin && <span className="chip !text-[10px]">admin</span>}
                </td>
                <td className="py-3 px-2 text-white/60">{u.email}</td>
                <td className="py-3 px-2 text-right font-mono-custom">{u.total_points || 0}</td>
                <td className="py-3 px-2 text-right font-mono-custom">{u.games_played || 0}</td>
                <td className="py-3 px-2 text-center">
                  {u.is_banned && <span className="chip text-red-300 border-red-400/40">Blok</span>}
                  {u.is_muted && <span className="chip text-amber-300 border-amber-400/40 ml-1">Səsiz</span>}
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => mute(u.user_id, !u.is_muted)} className="btn-glass !px-2 !py-1 text-xs" data-testid={`mute-btn-${u.user_id}`}>
                      {u.is_muted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => ban(u.user_id, !u.is_banned)} className="btn-glass !px-2 !py-1 text-xs text-red-300" data-testid={`ban-btn-${u.user_id}`}>
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-white/40 py-10">İstifadəçi tapılmadı.</div>}
      </div>
    </div>
  );
}

function WordsPanel() {
  const [words, setWords] = useState([]);
  const [cat, setCat] = useState("");
  const [newWord, setNewWord] = useState("");
  const [newCat, setNewCat] = useState("ad");
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await api.get(`/admin/words${cat ? `?category=${cat}` : ""}`);
    setWords(data.words || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat]);

  const add = async () => {
    const w = newWord.trim();
    if (!w) return;
    await api.post("/admin/words", { category: newCat, word: w });
    setNewWord("");
    toast.success("Söz əlavə edildi");
    load();
  };
  const del = async (id) => {
    await api.delete(`/admin/words/${id}`);
    toast.success("Söz silindi");
    load();
  };

  const filtered = words.filter((w) => !q || w.word.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="glass p-5">
        <div className="flex items-center gap-2 font-display font-bold">
          <BookOpen className="h-4 w-4 text-indigo-300" /> Yeni söz
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="input-dark sm:w-48" data-testid="word-category-select">
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
          </select>
          <input className="input-dark flex-1" placeholder="Söz..." value={newWord} onChange={(e) => setNewWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} data-testid="new-word-input" />
          <button className="btn-primary" onClick={add} data-testid="add-word-btn"><Plus className="h-4 w-4" /> Əlavə et</button>
        </div>
      </div>

      <div className="glass p-5">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold"><BookOpen className="h-4 w-4 text-indigo-300" /> Lüğət ({filtered.length})</div>
          <div className="flex gap-2">
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="input-dark !py-2" data-testid="word-filter-category">
              <option value="">Bütün kateqoriyalar</option>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
            </select>
            <input className="input-dark !py-2 sm:w-56" placeholder="Axtar..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" data-testid="words-list">
          {filtered.map((w) => (
            <div key={w.id} className="chip !py-1.5">
              <span className="text-white/50 text-[10px] uppercase">{CATEGORY_LABELS[w.category]}</span>
              <span className="font-medium text-white">{w.word}</span>
              <button onClick={() => del(w.id)} className="text-red-300/80 hover:text-red-300" data-testid={`delete-word-${w.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-white/40 text-sm">Söz yoxdur.</div>}
        </div>
      </div>
    </div>
  );
}
