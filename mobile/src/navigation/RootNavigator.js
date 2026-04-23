import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import LobbyScreen from "../screens/LobbyScreen";
import GameRoomScreen from "../screens/GameRoomScreen";
import LeaderboardScreen from "../screens/LeaderboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { colors } from "../lib/theme";
import { View, ActivityIndicator } from "react-native";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0B0E14",
          borderTopColor: "rgba(255,255,255,0.06)",
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.indigo,
        tabBarInactiveTintColor: "rgba(255,255,255,0.45)",
        tabBarIcon: ({ color, size }) => {
          const map = {
            Lobby: "game-controller",
            Leaderboard: "trophy",
            Profile: "person-circle",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Lobby" component={LobbyScreen} options={{ title: "Lobi" }} />
      <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: "Lider" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.indigo} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen name="GameRoom" component={GameRoomScreen} options={{ animation: "slide_from_right" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
