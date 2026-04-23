import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { colors, radius } from "../lib/theme";

export default function Button({ title, onPress, variant = "primary", loading, disabled, leftIcon, style, testID }) {
  const variants = {
    primary: { bg: colors.indigoDeep, text: "#fff", border: "transparent" },
    glass: { bg: "rgba(255,255,255,0.10)", text: "#fff", border: "rgba(255,255,255,0.18)" },
    danger: { bg: "#EF4444", text: "#fff", border: "transparent" },
    ghost: { bg: "transparent", text: colors.white, border: "rgba(255,255,255,0.18)" },
  }[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: variants.bg, borderColor: variants.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "primary" && styles.primaryShadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variants.text} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {leftIcon}
          <Text style={[styles.txt, { color: variants.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  txt: { fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  primaryShadow: {
    shadowColor: "#6366F1",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
