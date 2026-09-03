import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, fonts, radius, shadow } from "../theme";

// Misma lógica que dashboard/src/pages/LoginPage.tsx (mismo toggle login/registro, mismos
// campos) — antes esta pantalla solo tenía login y la cuenta se creaba desde el dashboard web
// (Fase 1 deliberadamente mínima); ahora el registro también está disponible aquí. Estilo:
// mismo `.card-soft` + paleta que la web (ver src/theme.ts) — tarjeta blanca centrada sobre el
// fondo "paper", título en Instrument Serif, resto en Outfit.
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
        <View style={styles.card}>
          <Text style={styles.title}>Tidely</Text>
          <Text style={styles.subtitle}>
            {mode === "login" ? "Inicia sesión para sincronizar tu Hoy" : "Crea tu cuenta para empezar a sincronizar"}
          </Text>

          {mode === "register" && (
            <>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} editable={!loading} />
            </>
          )}

          {mode === "register" && (
            <>
              <Text style={styles.label}>Nombre de usuario</Text>
              <TextInput
                style={styles.input}
                placeholder="Nuevo nombre de usuario"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                editable={!loading}
              />
            </>
          )}

          <Text style={styles.label}>{mode === "login" ? "Usuario o email" : "Email"}</Text>
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

          <Text style={styles.label}>Contraseña</Text>
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
            <>
              <Text style={styles.label}>Repite la contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Repite la contraseña nueva"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
                onSubmitEditing={handleSubmit}
              />
            </>
          )}

          {mode === "register" && (
            <Text style={styles.hint}>
              Después de registrarte tendrás que verificar tu email — mientras tanto puedes usar la app con normalidad.
            </Text>
          )}

          {(formError || error) && <Text style={styles.error}>{formError || error}</Text>}

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>{mode === "login" ? "Entrar" : "Registrarse"}</Text>
            )}
          </Pressable>

          <Pressable onPress={switchMode} disabled={loading}>
            <Text style={styles.switchModeText}>{mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 12,
    ...shadow,
  },
  title: { fontFamily: fonts.serif, fontSize: 32, textAlign: "center", color: colors.foreground },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: "center", color: colors.mutedForeground, marginTop: -4, marginBottom: 8 },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.mutedForeground,
    marginBottom: -6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: -4 },
  error: {
    fontFamily: fonts.sans,
    color: colors.destructive,
    fontSize: 12,
    textAlign: "center",
    backgroundColor: colors.destructiveTint,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.input,
    padding: 10,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  switchModeText: { fontFamily: fonts.sans, textAlign: "center", color: colors.mutedForeground, fontSize: 12, marginTop: 8 },
});
