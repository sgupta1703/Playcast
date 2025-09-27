import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useRouter } from "expo-router";
import { useAuthContext } from "./auth/AuthProvider";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  if (!fontsLoaded) return null;

  const handleSignup = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      router.replace("/sport-selection");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.brand}>Create account</Text>
        <Text style={styles.subtitle}>Join PlayCast — quickly rate plays and follow sports</Text>

        <View style={{ height: 18 }} />

        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry style={styles.input} />
        <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm password" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={handleSignup} disabled={loading} style={[styles.button, loading && { opacity: 0.7 }]}>
          <Text style={styles.buttonText}>{loading ? "Creating..." : "Create account"}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Text style={styles.small}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={[styles.small, { color: "#3B82F6", marginLeft: 8 }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  container: { paddingHorizontal: 24, paddingTop: 48, alignItems: "center" },
  brand: { color: "#fff", fontSize: 28, fontFamily: "Inter_600SemiBold" as any, marginBottom: 6 },
  subtitle: { color: "#9CA3AF", fontSize: 13, fontFamily: "Inter_500Medium" as any, marginBottom: 24, textAlign: "center" },
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
  button: { width: "100%", backgroundColor: "#3B82F6", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" as any },
  small: { color: "#9CA3AF", fontFamily: "Inter_400Regular" as any },
  error: { color: "#FF6B6B", marginTop: 8, marginBottom: 4 },
});
