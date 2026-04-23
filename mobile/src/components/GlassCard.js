import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "../lib/theme";

export default function GlassCard({ style, children, strong = false, intensity = 40 }) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: strong ? colors.glassStrong : colors.glass,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: strong ? colors.borderStrong : colors.border,
          },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  content: { padding: 20 },
});
