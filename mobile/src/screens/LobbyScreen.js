import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import { colors, radius } from "../lib/theme";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function LobbyScreen({ navigation }) {
  const { user } = useAuth();
  const [publicRooms, setPublicRooms] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await api.get("/rooms/public");
      setPublicRooms(data.rooms || []);
    } catch (_e) {}
  }, []);

  useEffect(() => { fetchRooms(); const iv = setInterval(fetchRooms, 5000); return () => clearInterval(iv); }, [fetchRooms]);

  const onRefresh = async () => { setRefreshing(true); await fetchRooms(); setRefreshing(false); };

  const createRoom = async (isPrivate) => {
    setBusy(true);
    try {
      const { data } = await api.post("/rooms", { is_private: isPrivate });
      navigation.navigate("GameRoom", { code: data.code });
    } catch (_e) {
      Alert.alert("Xəta", "Otaq yaradıla bilmədi");
    } finally { setBusy(false); }
  };

  const doJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { Alert.alert("Xəbərdarlıq", "6 simvollu kod daxil et"); return; }
    setBusy(true);
    try {
      await api.get(`/rooms/${code}`);
      navigation.navigate("GameRoom", { code });
    } catch (_e) {
      Alert.alert("Tapılmadı", "Bu koda aid otaq yoxdur");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <View>
          <Text style={styles.greeting}>Salam, <Text style={{ color: colors.indigo }}>{user?.name?.split(" ")[0] || "oyunçu"}</Text>.</Text>
          <Text style={styles.subtitle}>Dostlarını otağa çağır və hərfin açılmasını gözləmə.</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <GlassCard strong style={{ flex: 1 }}>
            <View style={styles.iconCircleIndigo}>
              <Ionicons name="lock-closed" size={18} color={colors.indigo} />
            </View>
            <Text style={styles.cardTitle}>Özəl otaq</Text>
            <Text style={styles.cardDesc}>Yalnız kodu bilən qoşula bilər.</Text>
            <View style={{ marginTop: 12 }}>
              <Button title="Yarat" onPress={() => createRoom(true)} loading={busy} testID="create-private-btn" />
            </View>
          </GlassCard>
          <GlassCard strong style={{ flex: 1 }}>
            <View style={styles.iconCircleEmerald}>
              <Ionicons name="globe" size={18} color={colors.emerald} />
            </View>
            <Text style={styles.cardTitle}>Açıq otaq</Text>
            <Text style={styles.cardDesc}>Hamı siyahıdan qoşula bilər.</Text>
            <View style={{ marginTop: 12 }}>
              <Button variant="glass" title="Yarat" onPress={() => createRoom(false)} loading={busy} testID="create-public-btn" />
            </View>
          </GlassCard>
        </View>

        <GlassCard>
          <Text style={styles.sectionTitle}>Kodla qoşul</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 }}>
            <TextInput
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              maxLength={6}
              style={styles.input}
              testID="join-code-input"
            />
            <Button title="Qoşul" onPress={doJoin} disabled={joinCode.length !== 6} loading={busy} testID="join-btn" />
          </View>
        </GlassCard>

        <GlassCard>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Açıq otaqlar</Text>
            <Pressable onPress={fetchRooms} style={styles.smallBtn}>
              <Ionicons name="refresh" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12 }}>Yenilə</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 10, gap: 8 }}>
            {publicRooms.length === 0 && (
              <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", paddingVertical: 24 }}>
                Hələlik açıq otaq yoxdur. İlk sən yarat!
              </Text>
            )}
            {publicRooms.map((r) => (
              <Pressable
                key={r.code}
                style={styles.roomRow}
                onPress={() => navigation.navigate("GameRoom", { code: r.code })}
                testID={`public-room-${r.code}`}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={styles.roomCode}>{r.code}</Text>
                  <View style={styles.statePill}><Text style={styles.statePillTxt}>{r.state}</Text></View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Ionicons name="people" size={12} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.roomMeta}>{r.players}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Ionicons name="timer" size={12} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.roomMeta}>{r.timer_seconds}s</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.indigo} />
                </View>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  greeting: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "rgba(255,255,255,0.6)", marginTop: 4 },
  iconCircleIndigo: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(129,140,248,0.2)",
    borderWidth: 1, borderColor: "rgba(129,140,248,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  iconCircleEmerald: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(52,211,153,0.18)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 10 },
  cardDesc: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  input: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    color: "#fff", paddingVertical: 12, paddingHorizontal: 14,
    fontFamily: "Courier", letterSpacing: 4, fontSize: 16, textAlign: "center",
  },
  smallBtn: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  roomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  roomCode: { color: "#fff", fontWeight: "700", fontFamily: "Courier", letterSpacing: 3 },
  statePill: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  statePillTxt: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  roomMeta: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Courier" },
});
