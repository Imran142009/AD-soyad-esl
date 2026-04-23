import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/profile/me"); setData(r.data); } catch (_e) {}
    })();
  }, []);

  if (!data) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={{ padding: 30 }}><GlassCard><Text style={{ color: "#fff" }}>Yüklənir...</Text></GlassCard></View>
    </SafeAreaView>
  );

  const { stats, matches } = data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <GlassCard strong>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={styles.avatarLg}><Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{(user?.name || "?")[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>{user?.name}</Text>
              <Text style={styles.sub}>{user?.email}</Text>
              {user?.is_admin && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start", backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Ionicons name="shield-checkmark" size={10} color={colors.amber} />
                  <Text style={{ color: colors.amber, fontSize: 10 }}>Admin</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard icon="trophy" label="Ümumi xal" value={stats.total_points} color={colors.amber} testID="stat-points" />
            <StatCard icon="stats-chart" label="Oyun" value={stats.games_played} color={colors.sky} testID="stat-games" />
            <StatCard icon="medal" label="Qələbə" value={stats.games_won} color={colors.emerald} testID="stat-wins" />
            <StatCard icon="speedometer" label="%" value={`${stats.win_rate}%`} color={colors.violet} testID="stat-rate" />
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Oyun tarixçəsi</Text>
        {matches.length === 0 && (
          <GlassCard><Text style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingVertical: 12 }}>Hələ oyun oynamamısan.</Text></GlassCard>
        )}
        {matches.map((m) => {
          const ranked = [...m.scores].sort((a, b) => a.rank - b.rank);
          const me = m.scores.find((s) => s.user_id === user.user_id);
          const won = ranked[0]?.user_id === user.user_id;
          return (
            <GlassCard key={m.id}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.trophyBox, won && { backgroundColor: "rgba(251,191,36,0.15)", borderColor: colors.amber }]}>
                    <Ionicons name="trophy" size={18} color={won ? colors.amber : "rgba(255,255,255,0.6)"} />
                  </View>
                  <View>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{won ? "Qələbə" : `Yer #${me?.rank || "?"}`}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{new Date(m.ended_at).toLocaleString()}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#fff", fontFamily: "Courier", fontSize: 18, fontWeight: "800" }}>{me?.score ?? 0}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{m.rounds} raund · {m.timer_seconds}s</Text>
                </View>
              </View>
            </GlassCard>
          );
        })}

        <Button title="Çıxış" variant="ghost" onPress={logout} leftIcon={<Ionicons name="log-out-outline" size={18} color="#fff" />} testID="logout-btn" style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color, testID }) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarLg: { width: 64, height: 64, borderRadius: 999, backgroundColor: "rgba(129,140,248,0.3)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  h1: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  statCard: { flex: 1, minWidth: "22%", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statVal: { fontFamily: "Courier", fontSize: 18, fontWeight: "800", marginTop: 6 },
  statLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  sectionTitle: { color: "#fff", fontWeight: "800", fontSize: 18, marginTop: 6 },
  trophyBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
});
