// app/sport-selection.tsx
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
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
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // initialize local state from saved prefs
  useEffect(() => {
    setSelectedSports(preferredSports ?? []);
  }, [preferredSports]);

  // Redirect to feed automatically if user is signed in, not loading, and has saved prefs,
  // unless the screen was opened with edit=true
  useEffect(() => {
    if (!loading && user && !editMode && Array.isArray(preferredSports) && preferredSports.length > 0) {
      // replace so there's no back button to selection on first login
      router.replace("/feed");
    }
  }, [loading, user, preferredSports, editMode, router]);

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) => (prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId]));
  };

  const handleContinue = async () => {
    try {
      await setPreferredSports(selectedSports);
    } catch (e) {
      console.warn("Failed to save preferences:", e);
    }
    // navigate to feed and pass selections for immediate filtering
    router.push({ pathname: "/feed", params: { selectedSports: JSON.stringify(selectedSports) } });
  };

  const selectAll = () => setSelectedSports(sportOptions.map((s) => s.id));

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}
      >
        <Text style={{ color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 12 }}>
          Choose Your Sports
        </Text>
        <Text style={{ color: "#9CA3AF", fontSize: 16, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 40 }}>
          Select the sports you want to see highlights for
        </Text>

        <TouchableOpacity onPress={selectAll} style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ color: "#fff", fontSize: 16, textAlign: "center", fontFamily: "Inter_500Medium" }}>Select All Sports</Text>
        </TouchableOpacity>

        <View style={{ gap: 16, marginBottom: 40 }}>
          {sportOptions.map((sport) => {
            const isSelected = selectedSports.includes(sport.id);
            return (
              <TouchableOpacity
                key={sport.id}
                onPress={() => toggleSport(sport.id)}
                style={{
                  backgroundColor: isSelected ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: isSelected ? "#3B82F6" : "rgba(255,255,255,0.1)",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 32, marginRight: 16 }}>{sport.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 4 }}>{sport.name}</Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 14, fontFamily: "Inter_400Regular" }}>{sport.description}</Text>
                </View>
                {isSelected && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, paddingTop: 20 }}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={selectedSports.length === 0}
          style={{
            backgroundColor: selectedSports.length > 0 ? "#3B82F6" : "rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: 18,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: selectedSports.length > 0 ? "#fff" : "#6B7280",
              fontSize: 18,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Continue {selectedSports.length > 0 && `(${selectedSports.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
