import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useRouter } from "expo-router";
import { useAuthContext } from "./auth/AuthProvider";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { signIn, user, loading: authLoading, preferredSports } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  useEffect(() => {
    if (user && !authLoading) {
      if (Array.isArray(preferredSports) && preferredSports.length > 0) {
        router.replace("/feed");
      } else {
        router.replace("/sport-selection");
      }
    }
  }, [user, authLoading, preferredSports, router]);

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.brand}>PlayCast</Text>
        <Text style={styles.subtitle}>Log in to view highlights</Text>

        <View style={{ height: 18 }} />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={handleLogin} style={[styles.button, loading && { opacity: 0.7 }]} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in"}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Text style={styles.small}>Don’t have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={[styles.small, { color: "#3B82F6", marginLeft: 8 }]}>Create account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.hint}>Test account: use any email + password (signup allowed)</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  container: { paddingHorizontal: 24, paddingTop: 48, alignItems: "center" },
  brand: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold" as any, marginBottom: 6 },
  subtitle: { color: "#9CA3AF", fontSize: 14, fontFamily: "Inter_500Medium" as any, marginBottom: 24 },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    color: "#fff",
    marginBottom: 12,
    fontFamily: "Inter_400Regular" as any,
  },
  button: {
    width: "100%",
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" as any },
  small: { color: "#9CA3AF", fontFamily: "Inter_400Regular" as any },
  error: { color: "#FF6B6B", marginTop: 8, marginBottom: 4 },
  hint: { color: "#6B7280", fontSize: 12, textAlign: "center", marginTop: 8, fontFamily: "Inter_400Regular" as any },
});
