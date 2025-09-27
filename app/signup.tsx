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
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  container: {
    paddingHorizontal: 24,
    paddingTop: 64,
    alignItems: "center",
  },
  brand: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold" as any,
    marginBottom: 8,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "Inter_500Medium" as any,
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
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
    marginBottom: 14,
    fontFamily: "Inter_400Regular" as any,
    fontSize: 15,
  },
  button: {
    width: "100%",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#10B981",
    shadowOpacity: 0.35,
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
    color: "#F87171",
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
  },
});
