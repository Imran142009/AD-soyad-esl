import React, { useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import { colors, radius, spacing } from "../lib/theme";
import { loginWithEmergentGoogle } from "../lib/auth";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { refresh, setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithEmergentGoogle();
      if (result.ok) {
        setUser(result.user);
      } else if (result.reason !== "cancel" && result.reason !== "dismiss") {
        Alert.alert("Giriş uğursuz oldu", `Səbəb: ${result.reason}. Yenidən cəhd edin.`);
      }
    } catch (e) {
      Alert.alert("Xəta", String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={["rgba(129,140,248,0.25)", "rgba(167,139,250,0.12)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: "space-between" }}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
            <Text style={styles.logoText}>Ad·Soyad·Şəhər</Text>
          </View>

          <View style={{ marginTop: 48 }}>
            <View style={styles.chip}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: colors.emerald }} />
              <Text style={styles.chipText}>Canlı multiplayer</Text>
            </View>
            <Text style={styles.h1}>Hərf çıxdı.</Text>
            <Text style={[styles.h1, { color: colors.indigo }]}>Ad, Soyad,</Text>
            <Text style={styles.h1}>Şəhər<Text style={{ color: "rgba(255,255,255,0.5)" }}>... başla!</Text></Text>
            <Text style={styles.sub}>
              Dostlarınla real-vaxt yarışlara qoşul. Unikal cavab <Text style={styles.mono}>+10</Text>, ortaq cavab <Text style={styles.mono}>+5</Text>.
            </Text>
          </View>

          <GlassCard strong style={{ marginTop: 32, marginBottom: 24 }}>
            <Text style={[styles.cardTitle, { color: "rgba(255,255,255,0.6)" }]}>Bu raundun hərfi</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
              <Text style={styles.bigLetter}>Ə</Text>
              <Text style={styles.timer}>00:47</Text>
            </View>
            <View style={{ gap: 6, marginTop: 12 }}>
              {[
                ["Ad", "Əli", 10],
                ["Soyad", "Əliyev", 5],
                ["Şəhər", "Ərdəbil", 5],
                ["Ölkə", "Ərəbistan", 10],
              ].map(([c, w, p], i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowCat}>{c}</Text>
                  <Text style={styles.rowWord}>{w}</Text>
                  <Text style={[styles.rowPts, { color: p === 10 ? colors.emerald : colors.sky }]}>+{p}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <View style={{ gap: 12 }}>
            <Button
              title="Google ilə daxil ol"
              onPress={handleLogin}
              loading={loading}
              testID="login-google-btn"
              leftIcon={<Ionicons name="logo-google" size={18} color="#fff" />}
            />
            <Text style={styles.footer}>Emergent Google Auth ilə qorunan sessiya</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.indigoDeep,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.indigo, shadowOpacity: 0.6, shadowRadius: 12,
  },
  logoText: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: -0.6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
  },
  chipText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  h1: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1.5, lineHeight: 48, marginTop: 4 },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 14, lineHeight: 20 },
  mono: { fontFamily: "Courier", color: colors.emerald, fontWeight: "700" },
  cardTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 2 },
  bigLetter: { fontSize: 100, color: "#fff", fontWeight: "900", letterSpacing: -4, lineHeight: 100 },
  timer: { fontFamily: "Courier", fontSize: 32, color: "#fff", fontWeight: "700" },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  rowCat: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Courier", width: 56 },
  rowWord: { flex: 1, color: "#fff", fontWeight: "500" },
  rowPts: { fontFamily: "Courier", fontSize: 12, fontWeight: "700" },
  footer: { color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center", marginTop: 4 },
});
