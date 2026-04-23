import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../components/GlassCard";
import { api } from "../lib/api";
import { colors } from "../lib/theme";

const TABS = [
  { key: "daily", label: "Günlük" },
  { key: "weekly", label: "Həftəlik" },
  { key: "all", label: "Bütün zaman" },
];

export default function LeaderboardScreen() {
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

  const rankIcon = (i) => {
    if (i === 0) return <Ionicons name="trophy" size={18} color={colors.amber} />;
    if (i === 1) return <Ionicons name="medal" size={18} color="#cbd5e1" />;
    if (i === 2) return <Ionicons name="ribbon" size={18} color="#fb923c" />;
    return <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Courier" }}>{i + 1}</Text>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="trophy" size={26} color={colors.amber} />
          <Text style={styles.h1}>Lider Cədvəli</Text>
        </View>
        <Text style={styles.sub}>Azərbaycanın ən kəskin zehnləri.</Text>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]} testID={`tab-${t.key}`}>
              <Text style={[styles.tabTxt, tab === t.key && { color: colors.indigo }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <GlassCard>
          <View style={styles.headRow}>
            <Text style={[styles.headCell, { flex: 0.6 }]}>#</Text>
            <Text style={[styles.headCell, { flex: 3 }]}>Oyunçu</Text>
            <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>Oyun</Text>
            <Text style={[styles.headCell, { flex: 1.2, textAlign: "right" }]}>Xal</Text>
          </View>
          {loading && <Text style={{ color: "rgba(255,255,255,0.5)", padding: 20, textAlign: "center" }}>Yüklənir...</Text>}
          {!loading && entries.length === 0 && (
            <Text style={{ color: "rgba(255,255,255,0.4)", padding: 24, textAlign: "center", fontSize: 12 }}>
              Hələlik nəticə yoxdur. İlk yerə sən keç!
            </Text>
          )}
          {entries.map((e, idx) => (
            <View key={e.user_id} style={[styles.row, idx === 0 && { backgroundColor: "rgba(251,191,36,0.08)" }]}>
              <View style={{ flex: 0.6, alignItems: "flex-start" }}>{rankIcon(idx)}</View>
              <View style={{ flex: 3, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.avatar}><Text style={{ color: "#fff", fontSize: 12 }}>{(e.name || "?")[0]}</Text></View>
                <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "600" }}>{e.name || "Naməlum"}</Text>
              </View>
              <Text style={{ flex: 1, textAlign: "right", color: "rgba(255,255,255,0.6)", fontFamily: "Courier" }}>{e.games}</Text>
              <Text style={{ flex: 1.2, textAlign: "right", color: "#fff", fontFamily: "Courier", fontSize: 16, fontWeight: "800" }}>{e.points}</Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.7 },
  sub: { color: "rgba(255,255,255,0.6)", marginTop: -6 },
  tabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 999, padding: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  tabTxt: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 13 },
  headRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", marginBottom: 6 },
  headCell: { color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  avatar: { width: 26, height: 26, borderRadius: 999, backgroundColor: "rgba(129,140,248,0.3)", alignItems: "center", justifyContent: "center" },
});
