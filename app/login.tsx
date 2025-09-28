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
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  useEffect(() => {
    if (user && !authLoading && !hasAttemptedLogin) {
      if (Array.isArray(preferredSports) && preferredSports.length > 0) {
        router.replace("/feed");
      } else {
        router.replace("/sport-selection");
      }
    }
  }, [user, authLoading, preferredSports, router, hasAttemptedLogin]);

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    setHasAttemptedLogin(true);
    
    try {
      await signIn(email.trim(), password);
      router.replace("/prepare");
    } catch (e: any) {
      setError(e?.message ?? "Failed to sign in");
      setHasAttemptedLogin(false);
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
          <Text style={styles.small}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={[styles.small, { color: "#3B82F6", marginLeft: 8 }]}>Create account</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  container: {
    paddingHorizontal: 24,
    paddingTop: 64,
    alignItems: "center",
  },
  brand: {
    color: "#fff",
    fontSize: 40,
    fontFamily: "Inter_700Bold" as any,
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 15,
    fontFamily: "Inter_500Medium" as any,
    marginBottom: 32,
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    color: "#fff",
    marginBottom: 16,
    fontFamily: "Inter_400Regular" as any,
    fontSize: 15,
  },
  button: {
    width: "100%",
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold" as any,
  },
  small: {
    color: "#9CA3AF",
    fontFamily: "Inter_400Regular" as any,
    fontSize: 14,
  },
  error: {
    color: "#EF4444",
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
  },
  hint: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    fontFamily: "Inter_400Regular" as any,
    lineHeight: 18,
  },
});
