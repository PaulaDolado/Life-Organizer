import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HoyScreen } from "./src/screens/HoyScreen";

function Root() {
  const { user, ready } = useAuth();

  if (!ready) {
    // Comprobando si había sesión guardada en SecureStore — instantáneo en la práctica, pero
    // evita un parpadeo Login→Hoy si el dispositivo tarda un poco.
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#5b6b4f" />
      </View>
    );
  }

  return user ? <HoyScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f2" },
});
