import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";

// No hay pantalla de registro en el móvil: la cuenta se crea desde el dashboard web (Fase 1 es
// deliberadamente mínima, ver mobile/README.md) — aquí solo se inicia sesión con una cuenta ya
// existente.
export function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    if (!email || !password) return;
    login(email, password).catch(() => {
      /* el error ya queda expuesto en `error` desde AuthContext */
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Tidely</Text>
      <Text style={styles.subtitle}>Inicia sesión para sincronizar tu Hoy</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        onSubmitEditing={handleSubmit}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#faf7f2" },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: "#3a332c" },
  subtitle: { fontSize: 14, textAlign: "center", color: "#8a8073", marginTop: 4, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd4c6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  error: { color: "#b3432b", marginBottom: 12, textAlign: "center" },
  button: { backgroundColor: "#5b6b4f", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
