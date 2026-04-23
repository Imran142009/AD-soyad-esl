import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import { colors, radius, CATEGORY_LABELS, CATEGORIES } from "../lib/theme";
import { api, loadToken, wsUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function GameRoomScreen({ route, navigation }) {
  const { code } = route.params;
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [answers, setAnswers] = useState({});
  const [votingItems, setVotingItems] = useState([]);
  const [votes, setVotes] = useState({});
  const [roundResults, setRoundResults] = useState(null);
  const [finalScores, setFinalScores] = useState(null);
  const [now, setNow] = useState(Date.now());
  const wsRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let reconnect;
    (async () => {
      const token = await loadToken();
      const connect = () => {
        const ws = new WebSocket(wsUrl(`/ws/${code}`, token));
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) reconnect = setTimeout(connect, 1500);
        };
        ws.onerror = () => {};
        ws.onmessage = (ev) => {
          try { handle(JSON.parse(ev.data)); } catch (_e) {}
        };
      };
      connect();
    })();
    return () => { stopped = true; clearTimeout(reconnect); try { wsRef.current?.close(); } catch (_e) {} };
  }, [code]);

  const handle = (msg) => {
    switch (msg.type) {
      case "state":
        setRoom(msg.room);
        if (msg.room?.last_round_results) setRoundResults(msg.room.last_round_results);
        if (msg.room?.final_scores) setFinalScores(msg.room.final_scores);
        if (msg.room?.state === "playing") {
          setRoundResults(null); setFinalScores(null); setAnswers({}); setVotingItems([]); setVotes({});
        }
        break;
      case "voting_phase":
        setVotingItems(msg.items || []);
        setVotes({});
        break;
      case "vote_update": {
        const k = `${msg.target_user_id}:${msg.category}`;
        setVotes((prev) => ({ ...prev, [k]: { approvals: msg.approvals, rejections: msg.rejections, myVote: msg.voter_id === user?.user_id ? msg.approve : prev[k]?.myVote } }));
        break;
      }
      case "round_results":
        setRoundResults(msg.results);
        break;
      case "game_end":
        setFinalScores(msg.final_scores);
        break;
      case "player_progress":
        setRoom((r) => r ? { ...r, players: r.players.map((p) => p.user_id === msg.user_id ? { ...p, submitted: msg.submitted } : p) } : r);
        break;
      case "error":
        if (msg.error === "room_not_found") { Alert.alert("Otaq tapılmadı"); setTimeout(() => navigation.goBack(), 300); }
        break;
      default: break;
    }
  };

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 300); return () => clearInterval(iv); }, []);

  const send = (obj) => { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  const isHost = room && user && room.host_id === user.user_id;
  const myPlayer = room?.players?.find((p) => p.user_id === user?.user_id);
  const timeLeft = useMemo(() => {
    if (!room?.round_deadline || room.state !== "playing") return null;
    const ms = new Date(room.round_deadline).getTime() - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [room, now]);

  if (!room) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 30, alignItems: "center" }}>
          <GlassCard><Text style={{ color: "#fff" }}>Otağa qoşuluruq...</Text></GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
          {/* Top Bar */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={styles.codePill}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 2 }}>OTAQ</Text>
              <Text style={styles.codeText}>{code}</Text>
              <Ionicons name="people" size={14} color={colors.indigo} />
              <Text style={{ color: "#fff", fontFamily: "Courier" }}>{room.players.length}</Text>
            </View>
            <View style={[styles.liveDot, { backgroundColor: connected ? colors.emerald : colors.amber }]} />
          </View>

          {room.state === "lobby" && (
            <LobbyView room={room} isHost={isHost} onStart={() => send({ type: "start_round" })} onSettings={(patch) => send({ type: "settings", ...patch })} />
          )}

          {room.state === "playing" && (
            <PlayingView room={room} timeLeft={timeLeft} answers={answers} setAnswers={setAnswers} onSubmit={(c, w) => send({ type: "submit_word", category: c, word: w })} onStop={() => send({ type: "stop" })} myPlayer={myPlayer} />
          )}

          {room.state === "voting" && (
            <VotingView room={room} items={votingItems} votes={votes} userId={user.user_id} isHost={isHost} onVote={(t, c, a) => send({ type: "vote", target_user_id: t, category: c, approve: a })} onFinalize={() => send({ type: "finalize_round" })} />
          )}

          {room.state === "results" && roundResults && (
            <ResultsView room={room} results={roundResults} isHost={isHost} onNext={() => send({ type: "next_round" })} onEnd={() => send({ type: "end_game" })} />
          )}

          {room.state === "ended" && finalScores && (
            <FinalView finalScores={finalScores} onBack={() => navigation.goBack()} />
          )}

          <PlayerList room={room} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LobbyView({ room, isHost, onStart, onSettings }) {
  return (
    <>
      <GlassCard strong>
        <Text style={styles.label}>Lobbi</Text>
        <Text style={styles.h2}>Oyunçuları gözləyirik</Text>
        <Text style={styles.muted}>Timer: <Text style={styles.mono}>{room.timer_seconds}s</Text> · Raund: <Text style={styles.mono}>{room.total_rounds}</Text> · {room.categories.length} kateqoriya</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {room.categories.map((c) => (<View key={c} style={styles.chip}><Text style={styles.chipTxt}>{CATEGORY_LABELS[c]}</Text></View>))}
        </View>
        {isHost && (
          <View style={{ marginTop: 16 }}>
            <Button title="Raundu başlat" leftIcon={<Ionicons name="play" size={16} color="#fff" />} onPress={onStart} testID="start-round-btn" />
          </View>
        )}
      </GlassCard>
      {isHost && <HostSettings room={room} onApply={onSettings} />}
    </>
  );
}

function HostSettings({ room, onApply }) {
  const [timer, setTimer] = useState(room.timer_seconds);
  const [rounds, setRounds] = useState(room.total_rounds);
  const [cats, setCats] = useState(room.categories);
  const toggleCat = (k) => { if (cats.includes(k)) { if (cats.length > 1) setCats(cats.filter((c) => c !== k)); } else setCats([...cats, k]); };
  return (
    <GlassCard>
      <Text style={styles.label}>Parametrlər</Text>
      <Text style={styles.sectionSub}>Timer</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {[30, 60, 90].map((t) => (
          <Pressable key={t} onPress={() => setTimer(t)} style={[styles.pill, timer === t && styles.pillActive]}>
            <Text style={[styles.pillTxt, timer === t && { color: "#fff" }]}>{t}s</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionSub}>Raund</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {[1, 3, 5, 7].map((r) => (
          <Pressable key={r} onPress={() => setRounds(r)} style={[styles.pill, rounds === r && styles.pillActive]}>
            <Text style={[styles.pillTxt, rounds === r && { color: "#fff" }]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionSub}>Kateqoriyalar</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.key} onPress={() => toggleCat(c.key)} style={[styles.pill, cats.includes(c.key) && styles.pillActive]}>
            <Text style={[styles.pillTxt, cats.includes(c.key) && { color: "#fff" }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 12 }}>
        <Button variant="glass" title="Tətbiq et" onPress={() => onApply({ timer_seconds: timer, total_rounds: rounds, categories: cats })} />
      </View>
    </GlassCard>
  );
}

function PlayingView({ room, timeLeft, answers, setAnswers, onSubmit, onStop, myPlayer }) {
  const critical = timeLeft !== null && timeLeft <= 10;
  const submittedCats = new Set(myPlayer?.submitted || []);
  return (
    <>
      <GlassCard strong>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.label}>Hərf</Text>
            <Text style={styles.letter}>{room.current_letter}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.label}>Qalan vaxt</Text>
            <View style={[styles.timerBox, critical && { backgroundColor: "rgba(248,113,113,0.15)", borderColor: colors.red }]}>
              <Text style={[styles.timerText, critical && { color: colors.red }]}>
                {String(Math.floor((timeLeft ?? 0) / 60)).padStart(2, "0")}:{String((timeLeft ?? 0) % 60).padStart(2, "0")}
              </Text>
            </View>
            <Text style={styles.muted}>Raund {room.current_round}/{room.total_rounds}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={{ gap: 8 }}>
        {room.categories.map((cat) => {
          const submitted = submittedCats.has(cat);
          return (
            <GlassCard key={cat}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 70 }}>
                  <Text style={styles.label}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Courier" }}>{room.current_letter}...</Text>
                </View>
                <TextInput
                  value={answers[cat] ?? ""}
                  onChangeText={(t) => setAnswers((a) => ({ ...a, [cat]: t }))}
                  onBlur={() => { if ((answers[cat] || "").trim()) onSubmit(cat, answers[cat]); }}
                  onSubmitEditing={() => onSubmit(cat, answers[cat] || "")}
                  placeholder={`${room.current_letter} ilə başla...`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.wordInput}
                  testID={`input-${cat}`}
                />
                {submitted && <Ionicons name="checkmark-circle" size={22} color={colors.emerald} />}
              </View>
            </GlassCard>
          );
        })}
      </View>

      <Button title="STOP!" variant="danger" onPress={onStop} leftIcon={<Ionicons name="stop-circle" size={18} color="#fff" />} testID="stop-btn" />
    </>
  );
}

function VotingView({ room, items, votes, userId, isHost, onVote, onFinalize }) {
  const grouped = useMemo(() => {
    const g = {};
    for (const it of items) { if (!it.word) continue; (g[it.category] = g[it.category] || []).push(it); }
    return g;
  }, [items]);
  return (
    <>
      <GlassCard strong>
        <Text style={styles.label}>Səsvermə</Text>
        <Text style={styles.h2}>Cavabları təsdiqlə</Text>
        <Text style={styles.muted}>Hərf: <Text style={styles.mono}>{room.current_letter}</Text></Text>
        {isHost && (
          <View style={{ marginTop: 10 }}>
            <Button title="Nəticələri hesabla" onPress={onFinalize} leftIcon={<Ionicons name="calculator" size={16} color="#fff" />} testID="finalize-btn" />
          </View>
        )}
      </GlassCard>
      {Object.entries(grouped).map(([cat, list]) => (
        <GlassCard key={cat}>
          <Text style={styles.label}>{CATEGORY_LABELS[cat]}</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {list.map((it) => {
              const k = `${it.target_user_id}:${it.category}`;
              const v = votes[k] || {};
              const isMe = it.target_user_id === userId;
              return (
                <View key={k} style={styles.voteRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{it.target_name}</Text>
                    <Text style={{ color: "#fff", fontWeight: "600" }}>{it.word}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.emerald, fontFamily: "Courier", fontSize: 12 }}>{v.approvals || 0}</Text>
                    <Pressable
                      disabled={isMe}
                      onPress={() => onVote(it.target_user_id, it.category, true)}
                      style={[styles.voteBtn, v.myVote === true && styles.voteBtnOk, isMe && { opacity: 0.3 }]}
                    >
                      <Ionicons name="checkmark" size={16} color={v.myVote === true ? colors.emerald : "rgba(255,255,255,0.6)"} />
                    </Pressable>
                    <Pressable
                      disabled={isMe}
                      onPress={() => onVote(it.target_user_id, it.category, false)}
                      style={[styles.voteBtn, v.myVote === false && styles.voteBtnNo, isMe && { opacity: 0.3 }]}
                    >
                      <Ionicons name="close" size={16} color={v.myVote === false ? colors.red : "rgba(255,255,255,0.6)"} />
                    </Pressable>
                    <Text style={{ color: colors.red, fontFamily: "Courier", fontSize: 12 }}>{v.rejections || 0}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>
      ))}
    </>
  );
}

function ResultsView({ room, results, isHost, onNext, onEnd }) {
  const isFinal = room.current_round >= room.total_rounds;
  const ranked = Object.entries(results.totals || {}).sort((a, b) => b[1] - a[1]);
  const byUser = {};
  for (const b of results.breakdown || []) { (byUser[b.user_id] = byUser[b.user_id] || []).push(b); }
  const nameOf = (uid) => room.players.find((p) => p.user_id === uid)?.name || "?";
  return (
    <>
      <GlassCard strong>
        <Text style={styles.label}>Raund {results.round} nəticələri</Text>
        <Text style={styles.h2}>Hərf: <Text style={{ color: colors.indigo }}>{results.letter}</Text></Text>
        {isHost && (
          <View style={{ marginTop: 12 }}>
            {isFinal ? (
              <Button title="Oyunu bitir" onPress={onEnd} leftIcon={<Ionicons name="trophy" size={16} color="#fff" />} testID="end-game-btn" />
            ) : (
              <Button title="Növbəti raund" onPress={onNext} leftIcon={<Ionicons name="chevron-forward" size={16} color="#fff" />} testID="next-round-btn" />
            )}
          </View>
        )}
      </GlassCard>
      {ranked.map(([uid, total], idx) => (
        <GlassCard key={uid}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={[styles.rank, idx === 0 && { backgroundColor: "rgba(251,191,36,0.2)", borderColor: colors.amber }]}>
                <Text style={[{ color: "#fff", fontFamily: "Courier", fontWeight: "700" }, idx === 0 && { color: colors.amber }]}>{idx + 1}</Text>
              </View>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{nameOf(uid)}</Text>
            </View>
            <Text style={{ color: "#fff", fontFamily: "Courier", fontWeight: "800", fontSize: 18 }}>
              {total} <Text style={{ color: colors.emerald, fontSize: 11 }}>+{results.delta[uid] || 0}</Text>
            </Text>
          </View>
          <View style={{ marginTop: 8, gap: 4 }}>
            {(byUser[uid] || []).map((b, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, width: 52 }}>{CATEGORY_LABELS[b.category]}</Text>
                  <Text numberOfLines={1} style={{ color: b.valid ? "#fff" : "rgba(255,255,255,0.3)", textDecorationLine: b.valid ? "none" : "line-through" }}>{b.word || "—"}</Text>
                </View>
                <Text style={{ color: b.points === 10 ? colors.emerald : b.points === 5 ? colors.sky : "rgba(255,255,255,0.3)", fontFamily: "Courier", fontSize: 11 }}>+{b.points}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ))}
    </>
  );
}

function FinalView({ finalScores, onBack }) {
  return (
    <GlassCard strong>
      <View style={{ alignItems: "center" }}>
        <Ionicons name="trophy" size={40} color={colors.amber} />
        <Text style={styles.label}>Oyun bitdi</Text>
        <Text style={styles.h2}>Yekun nəticə</Text>
      </View>
      <View style={{ gap: 8, marginTop: 14 }}>
        {finalScores.map((s, idx) => (
          <View key={s.user_id} style={[styles.finalRow, idx === 0 && { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)" }]}>
            <Text style={{ color: "#fff", fontWeight: "700", fontFamily: "Courier", width: 24 }}>{idx + 1}</Text>
            <Text style={{ flex: 1, color: "#fff", fontWeight: "600" }}>{s.name}</Text>
            {idx === 0 && <Ionicons name="ribbon" size={16} color={colors.amber} />}
            <Text style={{ color: "#fff", fontFamily: "Courier", fontSize: 18, fontWeight: "800" }}>{s.score}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16 }}>
        <Button title="Lobbiyə qayıt" onPress={onBack} testID="back-lobby-btn" />
      </View>
    </GlassCard>
  );
}

function PlayerList({ room }) {
  return (
    <GlassCard>
      <Text style={styles.label}>Oyunçular ({room.players.length})</Text>
      <View style={{ gap: 6, marginTop: 8 }}>
        {room.players.map((p) => (
          <View key={p.user_id} style={styles.playerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.avatarFallback}><Text style={{ color: "#fff" }}>{p.name[0]}</Text></View>
              <Text style={{ color: "#fff", fontWeight: "600" }}>{p.name}</Text>
              {p.is_host && <Ionicons name="ribbon" size={12} color={colors.amber} />}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {room.state === "playing" && p.submitted && (
                <Text style={{ color: colors.emerald, fontSize: 11, fontFamily: "Courier" }}>{p.submitted.length}/{room.categories.length}</Text>
              )}
              <Text style={{ color: "#fff", fontFamily: "Courier", fontWeight: "800" }}>{p.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  backBtn: { padding: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  codePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  codeText: { color: "#fff", fontFamily: "Courier", letterSpacing: 2, fontWeight: "700", fontSize: 15 },
  liveDot: { width: 10, height: 10, borderRadius: 999 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 },
  h2: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.6, marginTop: 4 },
  muted: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
  mono: { fontFamily: "Courier", color: colors.indigo, fontWeight: "700" },
  chip: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipTxt: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  sectionSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  pillActive: { backgroundColor: "rgba(129,140,248,0.2)", borderColor: colors.indigo },
  pillTxt: { color: "rgba(255,255,255,0.7)", fontFamily: "Courier", fontSize: 12 },
  letter: { fontSize: 70, color: "#fff", fontWeight: "900", letterSpacing: -3, lineHeight: 72 },
  timerBox: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginVertical: 4,
  },
  timerText: { fontFamily: "Courier", fontSize: 34, color: "#fff", fontWeight: "700" },
  wordInput: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  voteBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  voteBtnOk: { backgroundColor: "rgba(52,211,153,0.15)", borderColor: colors.emerald },
  voteBtnNo: { backgroundColor: "rgba(248,113,113,0.15)", borderColor: colors.red },
  rank: { width: 30, height: 30, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  playerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatarFallback: { width: 26, height: 26, borderRadius: 999, backgroundColor: "rgba(129,140,248,0.3)", alignItems: "center", justifyContent: "center" },
});
