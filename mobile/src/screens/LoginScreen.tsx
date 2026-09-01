import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../auth/AuthContext";

// Misma lógica que dashboard/src/pages/LoginPage.tsx (mismo toggle login/registro, mismos
// campos) — antes esta pantalla solo tenía login y la cuenta se creaba desde el dashboard web
// (Fase 1 deliberadamente mínima); ahora el registro también está disponible aquí.
function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function LoginScreen() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  // En login, un único campo sirve como username O email (ver authService.login: busca por
  // cualquiera de los dos) — de ahí `identifier`, separado de `email` (que en registro sí tiene
  // que ser un correo real). Mismo criterio que dashboard/src/pages/LoginPage.tsx.
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Solo en registro: repetir la contraseña para evitar errores de tecleo al crear la cuenta —
  // mismo criterio que dashboard/src/pages/LoginPage.tsx.
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setFormError(null);
    setConfirmPassword("");
  };

  const handleSubmit = () => {
    setFormError(null);
    if (mode === "login") {
      if (!identifier || !password) return;
      login(identifier, password).catch(() => {
        /* el error ya queda expuesto en `error` desde AuthContext */
      });
    } else {
      if (!name || !username || !email || !password || !confirmPassword) return;
      if (password !== confirmPassword) {
        setFormError("Las contraseñas no coinciden.");
        return;
      }
      register(username, email, password, name, detectTimezone()).catch(() => {
        /* el error ya queda expuesto en `error` desde AuthContext */
      });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Tidely</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Inicia sesión para sincronizar tu Hoy" : "Crea tu cuenta para empezar a sincronizar"}
        </Text>

        {mode === "register" && (
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
        )}

        {mode === "register" && (
          <TextInput
            style={styles.input}
            placeholder="Nuevo nombre de usuario"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            editable={!loading}
          />
        )}

        {mode === "login" ? (
          <TextInput
            style={styles.input}
            placeholder="Introduce el usuario o email"
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
            editable={!loading}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Tu correo electrónico"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder={mode === "register" ? "Contraseña nueva" : "Introduce la contraseña"}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          onSubmitEditing={mode === "login" ? handleSubmit : undefined}
        />

        {mode === "register" && (
          <TextInput
            style={styles.input}
            placeholder="Repite la contraseña nueva"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        )}

        {mode === "register" && (
          <Text style={styles.hint}>
            Después de registrarte tendrás que verificar tu email — mientras tanto puedes usar la app con normalidad.
          </Text>
        )}

        {(formError || error) && <Text style={styles.error}>{formError || error}</Text>}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === "login" ? "Entrar" : "Registrarse"}</Text>}
        </Pressable>

        <Pressable onPress={switchMode} disabled={loading}>
          <Text style={styles.switchModeText}>{mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f2" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
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
  hint: { fontSize: 12, color: "#8a8073", marginBottom: 12, marginTop: -4 },
  error: { color: "#b3432b", marginBottom: 12, textAlign: "center" },
  button: { backgroundColor: "#5b6b4f", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  switchModeText: { textAlign: "center", color: "#8a8073", fontSize: 13, marginTop: 16 },
});
