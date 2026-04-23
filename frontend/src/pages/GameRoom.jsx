import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { wsUrl, CATEGORY_KEYS, CATEGORY_LABELS, api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import { Copy, Users, Play, StopCircle, ChevronRight, Check, X, Trophy, Send, Crown, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function GameRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [answers, setAnswers] = useState({}); // category -> string
  const [votingItems, setVotingItems] = useState([]);
  const [votes, setVotes] = useState({}); // `${uid}:${cat}` -> {approvals, rejections, myVote}
  const [roundResults, setRoundResults] = useState(null);
  const [finalScores, setFinalScores] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const [scoreToasts, setScoreToasts] = useState([]); // {id, delta, uid}

  // Connect WS
  useEffect(() => {
    let reconnectTimer;
    let stopped = false;

    const connect = async () => {
      // token unnecessary if cookie works; still try to get fresh session for WS query
      const url = wsUrl(`/ws/${code}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => {};
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        handleMessage(msg);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      try { wsRef.current?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case "state":
        setRoom(msg.room);
        if (msg.room?.last_round_results) setRoundResults(msg.room.last_round_results);
        if (msg.room?.final_scores) setFinalScores(msg.room.final_scores);
        if (msg.room?.state === "playing") {
          setRoundResults(null);
          setFinalScores(null);
          setAnswers({});
          setVotingItems([]);
          setVotes({});
        }
        break;
      case "voting_phase":
        setVotingItems(msg.items || []);
        setVotes({});
        break;
      case "vote_update": {
        const k = `${msg.target_user_id}:${msg.category}`;
        setVotes((prev) => ({
          ...prev,
          [k]: {
            approvals: msg.approvals,
            rejections: msg.rejections,
            myVote: msg.voter_id === user?.user_id ? msg.approve : prev[k]?.myVote,
          },
        }));
        break;
      }
      case "round_results":
        setRoundResults(msg.results);
        // Pop scores
        const pops = Object.entries(msg.results.delta || {}).map(([uid, d], i) => ({
          id: `${Date.now()}-${i}`, uid, delta: d,
        }));
        setScoreToasts(pops);
        setTimeout(() => setScoreToasts([]), 1800);
        break;
      case "game_end":
        setFinalScores(msg.final_scores);
        break;
      case "chat":
        setChat((c) => [...c.slice(-99), msg.message]);
        break;
      case "chat_history":
        setChat(msg.messages || []);
        break;
      case "player_progress":
        setRoom((r) => {
          if (!r) return r;
          const players = r.players.map((p) =>
            p.user_id === msg.user_id ? { ...p, submitted: msg.submitted } : p
          );
          return { ...r, players };
        });
        break;
      case "error":
        if (msg.error === "room_not_found") {
          toast.error("Otaq tapılmadı");
          setTimeout(() => navigate("/lobby"), 600);
        } else if (msg.error === "unauthorized") {
          toast.error("Giriş tələb olunur");
          setTimeout(() => navigate("/"), 600);
        } else if (msg.error === "muted") {
          toast.error("Səsiniz bağlanıb");
        }
        break;
      default:
        break;
    }
  }, [navigate, user?.user_id]);

  // Timer tick
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const send = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  };

  const isHost = room && user && room.host_id === user.user_id;
  const myPlayer = room?.players?.find((p) => p.user_id === user?.user_id);

  const timeLeft = useMemo(() => {
    if (!room?.round_deadline || room.state !== "playing") return null;
    const ms = new Date(room.round_deadline).getTime() - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [room, now]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Kod kopyalandı");
  };

  const submitWord = (cat, word) => {
    send({ type: "submit_word", category: cat, word });
  };

  const callStop = () => send({ type: "stop" });
  const startRound = () => send({ type: "start_round" });
  const nextRound = () => send({ type: "next_round" });
  const finalizeRound = () => send({ type: "finalize_round" });
  const endGame = () => send({ type: "end_game" });
  const vote = (targetId, category, approve) => send({ type: "vote", target_user_id: targetId, category, approve });
  const sendChat = () => {
    if (!chatInput.trim()) return;
    send({ type: "chat", text: chatInput.trim() });
    setChatInput("");
  };

  if (!room) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="glass p-10 text-center">
            <div className="font-display text-2xl">Otağa qoşulurıq...</div>
            <div className="text-sm text-white/50 mt-2">{connected ? "Hazırlıq..." : "Bağlantı qurulur..."}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <Toaster position="top-right" theme="dark" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="glass px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-white/50 uppercase tracking-widest">Otaq</span>
              <span className="font-mono-custom font-bold tracking-widest text-lg" data-testid="room-code">{code}</span>
              <button onClick={copyCode} className="text-white/60 hover:text-white" data-testid="copy-code-btn">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="glass px-4 py-2 flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-indigo-300" />
              <span data-testid="player-count">{room.players.length}</span>
            </div>
            <div className={`glass px-4 py-2 text-xs uppercase tracking-widest ${connected ? "text-emerald-300" : "text-amber-300"}`} data-testid="ws-status">
              {connected ? "● Canlı" : "○ Yenidən bağlanır..."}
            </div>
          </div>

          {isHost && room.state === "lobby" && (
            <HostSettings room={room} send={send} />
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 space-y-6">
            {/* Lobby state */}
            {room.state === "lobby" && (
              <LobbyView room={room} isHost={isHost} onStart={startRound} />
            )}

            {/* Playing state */}
            {room.state === "playing" && (
              <PlayingView
                room={room}
                timeLeft={timeLeft}
                answers={answers}
                setAnswers={setAnswers}
                onSubmit={submitWord}
                onStop={callStop}
                myPlayer={myPlayer}
              />
            )}

            {/* Voting state */}
            {room.state === "voting" && (
              <VotingView
                room={room}
                items={votingItems}
                votes={votes}
                userId={user.user_id}
                isHost={isHost}
                onVote={vote}
                onFinalize={finalizeRound}
              />
            )}

            {/* Results state */}
            {room.state === "results" && roundResults && (
              <ResultsView
                room={room}
                results={roundResults}
                isHost={isHost}
                onNext={nextRound}
                onEnd={endGame}
              />
            )}

            {/* Ended */}
            {room.state === "ended" && finalScores && (
              <FinalScoresView finalScores={finalScores} onBack={() => navigate("/lobby")} />
            )}
          </section>

          <aside className="lg:col-span-4 space-y-4">
            <PlayerList room={room} scoreToasts={scoreToasts} />
            <ChatPanel chat={chat} chatInput={chatInput} setChatInput={setChatInput} onSend={sendChat} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function HostSettings({ room, send }) {
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState(room.timer_seconds);
  const [rounds, setRounds] = useState(room.total_rounds);
  const [cats, setCats] = useState(room.categories);

  const toggleCat = (k) => {
    if (cats.includes(k)) {
      if (cats.length > 1) setCats(cats.filter((c) => c !== k));
    } else setCats([...cats, k]);
  };

  const apply = () => {
    send({ type: "settings", timer_seconds: Number(timer), total_rounds: Number(rounds), categories: cats });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-glass" data-testid="host-settings-btn">
          <SettingsIcon className="h-4 w-4" /> Parametrlər
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#0B0E14] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-2xl tracking-tighter">Otaq parametrləri</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Timer</div>
            <div className="flex gap-2">
              {[30, 60, 90].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimer(t)}
                  className={`flex-1 rounded-xl border py-3 font-mono-custom ${
                    timer === t ? "bg-indigo-500/20 border-indigo-400 text-white" : "bg-black/30 border-white/10 text-white/70"
                  }`}
                  data-testid={`timer-${t}-btn`}
                >{t}s</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Raund sayı</div>
            <div className="flex gap-2">
              {[1, 3, 5, 7, 10].map((r) => (
                <button
                  key={r}
                  onClick={() => setRounds(r)}
                  className={`flex-1 rounded-xl border py-3 font-mono-custom ${
                    rounds === r ? "bg-indigo-500/20 border-indigo-400 text-white" : "bg-black/30 border-white/10 text-white/70"
                  }`}
                  data-testid={`rounds-${r}-btn`}
                >{r}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Kateqoriyalar</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleCat(k)}
                  className={`rounded-full px-4 py-2 text-sm border transition-all ${
                    cats.includes(k) ? "bg-indigo-500/20 border-indigo-400 text-white" : "bg-black/30 border-white/10 text-white/60"
                  }`}
                  data-testid={`cat-toggle-${k}`}
                >{CATEGORY_LABELS[k]}</button>
              ))}
            </div>
          </div>
          <button onClick={apply} className="btn-primary w-full" data-testid="apply-settings-btn">Tətbiq et</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LobbyView({ room, isHost, onStart }) {
  return (
    <div className="glass-strong p-6 sm:p-10 text-center fade-up">
      <div className="text-xs uppercase tracking-widest text-white/50">Lobbi</div>
      <div className="font-display font-black text-4xl sm:text-5xl mt-2 tracking-tighter">Oyunçuları gözləyirik</div>
      <div className="mt-4 text-white/60">Timer: <span className="font-mono-custom text-indigo-300">{room.timer_seconds}s</span> · Raund: <span className="font-mono-custom text-indigo-300">{room.total_rounds}</span> · Kateqoriya: <span className="font-mono-custom text-indigo-300">{room.categories.length}</span></div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {room.categories.map((c) => <span key={c} className="chip">{CATEGORY_LABELS[c]}</span>)}
      </div>
      {isHost ? (
        <button onClick={onStart} className="btn-primary mt-8 text-base" data-testid="start-round-btn">
          <Play className="h-4 w-4" /> Raundu başlat
        </button>
      ) : (
        <div className="mt-8 text-white/50">Host raundu başladacaq...</div>
      )}
    </div>
  );
}

function PlayingView({ room, timeLeft, answers, setAnswers, onSubmit, onStop, myPlayer }) {
  const letter = room.current_letter;
  const critical = timeLeft !== null && timeLeft <= 10;
  const submittedCats = new Set(myPlayer?.submitted || []);

  return (
    <div className="space-y-5 fade-up">
      <div className="glass-strong p-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Hərf</div>
          <div className="font-display font-black text-7xl sm:text-8xl leading-none tracking-tighter neon-text">{letter}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Qalan vaxt</div>
          <div className={`font-mono-custom text-5xl sm:text-6xl tabular-nums rounded-2xl px-6 py-3 ${critical ? "timer-critical bg-red-500/10 border border-red-400/40 text-red-300" : "bg-white/5 border border-white/10 text-white"}`} data-testid="timer-display">
            {String(Math.floor((timeLeft ?? 0) / 60)).padStart(2, "0")}:{String((timeLeft ?? 0) % 60).padStart(2, "0")}
          </div>
          <div className="text-xs text-white/50 mt-2">Raund {room.current_round}/{room.total_rounds}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {room.categories.map((cat) => {
          const submitted = submittedCats.has(cat);
          return (
            <div key={cat} className={`glass p-4 flex items-center gap-3 transition-all ${submitted ? "ring-1 ring-emerald-400/40" : ""}`}>
              <div className="w-20">
                <div className="text-xs uppercase tracking-widest text-white/50">{CATEGORY_LABELS[cat]}</div>
                <div className="text-[10px] text-white/30 font-mono-custom">{letter}...</div>
              </div>
              <input
                className="input-dark flex-1 !py-2.5"
                placeholder={`${letter} ilə başla...`}
                value={answers[cat] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                onBlur={(e) => { if (e.target.value.trim()) onSubmit(cat, e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onSubmit(cat, e.currentTarget.value); e.currentTarget.blur(); }
                }}
                data-testid={`input-${cat}`}
              />
              {submitted && <Check className="h-5 w-5 text-emerald-400" strokeWidth={2} />}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button onClick={onStop} className="btn-primary bg-red-500 hover:bg-red-400 text-white px-10 py-4 text-lg" data-testid="stop-btn">
          <StopCircle className="h-5 w-5" /> STOP!
        </button>
      </div>
    </div>
  );
}

function VotingView({ room, items, votes, userId, isHost, onVote, onFinalize }) {
  // Group by category
  const grouped = useMemo(() => {
    const g = {};
    for (const it of items) {
      if (!it.word) continue;
      g[it.category] = g[it.category] || [];
      g[it.category].push(it);
    }
    return g;
  }, [items]);

  return (
    <div className="space-y-5 fade-up">
      <div className="glass-strong p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">Səsvermə</div>
            <div className="font-display font-black text-3xl tracking-tighter">Cavabları təsdiqləyin</div>
            <div className="text-sm text-white/60 mt-1">Hərf: <span className="font-mono-custom text-indigo-300">{room.current_letter}</span></div>
          </div>
          {isHost && (
            <button onClick={onFinalize} className="btn-primary" data-testid="finalize-btn">
              Nəticələri hesabla <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="glass p-8 text-center text-white/50">Heç bir cavab göndərilməyib.</div>
        )}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="glass p-5">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-3">{CATEGORY_LABELS[cat]}</div>
            <div className="space-y-2">
              {list.map((it) => {
                const k = `${it.target_user_id}:${it.category}`;
                const v = votes[k] || {};
                const isMe = it.target_user_id === userId;
                const myVote = v.myVote;
                return (
                  <div key={k} className="flex items-center justify-between gap-3 rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-white/40 min-w-[90px] truncate">{it.target_name}</div>
                      <div className="font-medium text-white truncate">{it.word}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-300 font-mono-custom">{v.approvals || 0}</span>
                      <button
                        disabled={isMe}
                        onClick={() => onVote(it.target_user_id, it.category, true)}
                        className={`h-9 w-9 rounded-full flex items-center justify-center border transition-all ${
                          myVote === true ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "bg-white/5 border-white/10 text-white/60 hover:text-emerald-300"
                        } ${isMe ? "opacity-30 cursor-not-allowed" : ""}`}
                        data-testid={`vote-approve-${it.target_user_id}-${it.category}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        disabled={isMe}
                        onClick={() => onVote(it.target_user_id, it.category, false)}
                        className={`h-9 w-9 rounded-full flex items-center justify-center border transition-all ${
                          myVote === false ? "bg-red-500/20 border-red-400 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-red-300"
                        } ${isMe ? "opacity-30 cursor-not-allowed" : ""}`}
                        data-testid={`vote-reject-${it.target_user_id}-${it.category}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-red-300 font-mono-custom">{v.rejections || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsView({ room, results, isHost, onNext, onEnd }) {
  const isFinal = room.current_round >= room.total_rounds;
  const deltaByUser = results.delta || {};
  const ranked = Object.entries(results.totals || {}).sort((a, b) => b[1] - a[1]);

  // Build breakdown by user
  const byUser = {};
  for (const b of results.breakdown || []) {
    byUser[b.user_id] = byUser[b.user_id] || [];
    byUser[b.user_id].push(b);
  }

  const nameOf = (uid) => room.players.find((p) => p.user_id === uid)?.name || "?";

  return (
    <div className="space-y-5 fade-up">
      <div className="glass-strong p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">Raund {results.round} nəticələri</div>
            <div className="font-display font-black text-3xl tracking-tighter">Hərf: <span className="text-indigo-300">{results.letter}</span></div>
          </div>
          {isHost && (
            <div className="flex gap-2">
              {isFinal ? (
                <button onClick={onEnd} className="btn-primary" data-testid="end-game-btn">Oyunu bitir <Trophy className="h-4 w-4" /></button>
              ) : (
                <button onClick={onNext} className="btn-primary" data-testid="next-round-btn">Növbəti raund <ChevronRight className="h-4 w-4" /></button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {ranked.map(([uid, total], idx) => (
          <div key={uid} className="glass p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-mono-custom font-bold ${idx === 0 ? "bg-amber-300/20 text-amber-200 border border-amber-300/40" : "bg-white/5 text-white/70 border border-white/10"}`}>{idx + 1}</div>
                <div className="font-display font-bold">{nameOf(uid)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/50">Xal</div>
                <div className="font-mono-custom font-bold text-lg tabular-nums">{total} <span className="text-emerald-300 text-xs">+{deltaByUser[uid] || 0}</span></div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {(byUser[uid] || []).map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded-lg px-2 py-1 bg-black/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 w-14">{CATEGORY_LABELS[b.category]}</span>
                    <span className={`truncate ${b.valid ? "text-white" : "text-white/40 line-through"}`}>{b.word || "—"}</span>
                  </div>
                  <span className={`font-mono-custom text-xs ${b.points === 10 ? "text-emerald-300" : b.points === 5 ? "text-sky-300" : "text-white/30"}`}>+{b.points}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalScoresView({ finalScores, onBack }) {
  return (
    <div className="glass-strong p-8 sm:p-12 text-center fade-up">
      <Trophy className="h-12 w-12 mx-auto text-amber-300" strokeWidth={1.5} />
      <div className="mt-4 text-xs uppercase tracking-widest text-white/50">Oyun bitdi</div>
      <div className="font-display font-black text-4xl sm:text-5xl tracking-tighter mt-2">Yekun nəticə</div>
      <div className="mt-8 space-y-3 max-w-xl mx-auto">
        {finalScores.map((s, idx) => (
          <div key={s.user_id} className={`flex items-center justify-between rounded-2xl px-5 py-4 ${idx === 0 ? "bg-amber-300/10 border border-amber-300/30" : "bg-black/30 border border-white/10"}`}>
            <div className="flex items-center gap-3">
              <div className="font-mono-custom font-bold text-lg w-8">{idx + 1}</div>
              {s.picture ? <img src={s.picture} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-indigo-500/30" />}
              <div className="font-display font-bold">{s.name}</div>
              {idx === 0 && <Crown className="h-4 w-4 text-amber-300" />}
            </div>
            <div className="font-mono-custom text-2xl tabular-nums">{s.score}</div>
          </div>
        ))}
      </div>
      <button onClick={onBack} className="btn-primary mt-8" data-testid="back-to-lobby-btn">Lobbiyə qayıt</button>
    </div>
  );
}

function PlayerList({ room, scoreToasts }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <div className="font-display font-bold">Oyunçular</div>
        <div className="text-xs text-white/40 font-mono-custom">{room.players.length}</div>
      </div>
      <div className="mt-3 space-y-2" data-testid="players-list">
        {room.players.map((p) => {
          const pop = scoreToasts.find((s) => s.uid === p.user_id);
          return (
            <div key={p.user_id} className="relative flex items-center justify-between rounded-xl bg-black/20 border border-white/10 px-3 py-2">
              <div className="flex items-center gap-2">
                {p.picture ? <img src={p.picture} alt="" className="h-7 w-7 rounded-full" /> : <div className="h-7 w-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs">{p.name[0]}</div>}
                <div className="text-sm font-medium truncate max-w-[120px]">{p.name}</div>
                {p.is_host && <Crown className="h-3.5 w-3.5 text-amber-300" />}
              </div>
              <div className="flex items-center gap-2">
                {room.state === "playing" && p.submitted && (
                  <div className="text-[10px] text-emerald-300 font-mono-custom">{p.submitted.length}/{room.categories.length}</div>
                )}
                <div className="font-mono-custom font-bold tabular-nums">{p.score}</div>
              </div>
              {pop && <div className="score-pop absolute right-2 -top-2 text-emerald-300 font-mono-custom font-bold">+{pop.delta}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatPanel({ chat, chatInput, setChatInput, onSend }) {
  const scrollRef = useRef();
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [chat.length]);
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 font-display font-bold">
        <MessageCircle className="h-4 w-4 text-violet-300" /> Söhbət
      </div>
      <div ref={scrollRef} className="mt-3 h-48 overflow-y-auto space-y-2 pr-1" data-testid="chat-messages">
        {chat.length === 0 && <div className="text-center text-white/30 text-xs py-6">Hələ mesaj yoxdur</div>}
        {chat.map((m, i) => (
          <div key={i} className="text-sm">
            <span className="text-indigo-300 font-medium">{m.name}:</span> <span className="text-white/85">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="input-dark !py-2 flex-1 text-sm"
          placeholder="Mesaj yaz..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          data-testid="chat-input"
        />
        <button onClick={onSend} className="btn-glass !px-3 !py-2" data-testid="chat-send-btn"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
