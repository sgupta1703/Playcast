import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { useAuthContext } from "./auth/AuthProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const sportOptions = [
  { id: "NBA", name: "Basketball", emoji: "🏀", description: "NBA highlights and plays" },
  { id: "World Cup", name: "Soccer", emoji: "⚽", description: "World Cup matches" },
  { id: "NFL", name: "Football", emoji: "🏈", description: "NFL touchdowns and plays" },
  { id: "Wimbledon", name: "Tennis", emoji: "🎾", description: "Wimbledon highlights" },
  { id: "MLB", name: "Baseball", emoji: "⚾", description: "MLB home runs and plays" },
];

export default function SportSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams() as { edit?: string };
  const editMode = params?.edit === "true" || params?.edit === "1";

  const { preferredSports, setPreferredSports, user, loading } = useAuthContext();

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    setSelectedSports(preferredSports ?? []);
  }, [preferredSports]);

  useEffect(() => {
    if (
      !loading &&
      user &&
      !editMode &&
      Array.isArray(preferredSports) &&
      preferredSports.length > 0
    ) {
      router.replace("/feed");
    }
  }, [loading, user, preferredSports, editMode, router]);

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((id) => id !== sportId)
        : [...prev, sportId]
    );
  };

  const handleContinue = async () => {
    try {
      await setPreferredSports(selectedSports);
    } catch (e) {
      console.warn("Failed to save preferences:", e);
    }
    router.push({
      pathname: "/feed",
      params: { selectedSports: JSON.stringify(selectedSports) },
    });
  };

  const selectAll = () => setSelectedSports(sportOptions.map((s) => s.id));

  if (!fontsLoaded) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
        }}
      >
        <Text style={styles.title}>Choose Your Sports</Text>
        <Text style={styles.subtitle}>
          Select the sports you want to see highlights for
        </Text>

        <TouchableOpacity onPress={selectAll} style={styles.selectAll}>
          <Text style={styles.selectAllText}>Select All Sports</Text>
        </TouchableOpacity>

        <View style={{ gap: 16, marginBottom: 40 }}>
          {sportOptions.map((sport) => {
            const isSelected = selectedSports.includes(sport.id);
            return (
              <TouchableOpacity
                key={sport.id}
                onPress={() => toggleSport(sport.id)}
                style={[
                  styles.card,
                  isSelected && styles.cardSelected,
                ]}
                activeOpacity={0.9}
              >
                <Text style={styles.emoji}>{sport.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{sport.name}</Text>
                  <Text style={styles.cardDesc}>{sport.description}</Text>
                </View>
                {isSelected && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.check}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={selectedSports.length === 0}
          style={[
            styles.button,
            selectedSports.length === 0 && styles.buttonDisabled,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              selectedSports.length === 0 && styles.buttonTextDisabled,
            ]}
          >
            Continue {selectedSports.length > 0 && `(${selectedSports.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  title: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 12,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
  selectAll: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: "center",
  },
  selectAllText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
  },
  cardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59,130,246,0.15)",
  },
  emoji: { fontSize: 32, marginRight: 16 },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  cardDesc: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  check: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
  },
  button: {
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  buttonTextDisabled: { color: "#6B7280" },
});
