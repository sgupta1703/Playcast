// app/prepare.tsx
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthContext } from "./auth/AuthProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PrepareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams() as { edit?: string };
  const editMode = params?.edit === "true" || params?.edit === "1";

  const { user, loading: authLoading, preferredSports } = useAuthContext();

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const MIN_MS = 2200; 
  const startRef = useRef<number | null>(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    hasNavigatedRef.current = false;
    
    Animated.timing(progressAnim, {
      toValue: 0.95,
      duration: MIN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    const sub = progressAnim.addListener(({ value }) => setProgress(value));
    return () => {
      progressAnim.removeListener(sub);
    };
  }, [progressAnim]);

  useEffect(() => {
    const checkAndNavigate = () => {
      if (hasNavigatedRef.current) return;
      
      const now = Date.now();
      const elapsed = startRef.current ? now - startRef.current : 0;
      const minOk = elapsed >= MIN_MS;
      const ready = !authLoading && !!user;

      if (ready && minOk) {
        hasNavigatedRef.current = true;
        
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => {
          if (!editMode && Array.isArray(preferredSports) && preferredSports.length > 0) {
            router.replace("/feed");
          } else {
            router.replace("/sport-selection");
          }
        });
      }
    };

    // Check every 100ms
    const intervalId = setInterval(checkAndNavigate, 100);
    
    // Initial check
    checkAndNavigate();

    // Fallback timeout to ensure navigation happens
    const fallbackTimeout = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          if (!editMode && Array.isArray(preferredSports) && preferredSports.length > 0) {
            router.replace("/feed");
          } else {
            router.replace("/sport-selection");
          }
        });
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(fallbackTimeout);
    };
  }, [authLoading, user, preferredSports, router, progressAnim, editMode]);

  if (!fontsLoaded) return null;

  const barWidth = Math.max(8, Math.floor((SCREEN_WIDTH - 64) * progress));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.title}>Compiling sports highlights for you</Text>
        <Text style={styles.subtitle}>We're tailoring your feed — hang tight.</Text>

        <View style={{ height: 20 }} />

        <View style={styles.track}>
          <View style={[styles.fill, { width: barWidth }]} />
        </View>

        <View style={{ height: 12 }} />
        <Text style={styles.small}>Preparing your personalized highlights...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  center: {
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 160,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_600SemiBold" as any,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    fontFamily: "Inter_500Medium" as any,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 20,
  },
  track: {
    width: "100%",
    height: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 24,
  },
  fill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 12,
  },
  small: {
    color: "#6B7280",
    fontSize: 13,
    fontFamily: "Inter_400Regular" as any,
    marginTop: 14,
    textAlign: "center",
  },
});
