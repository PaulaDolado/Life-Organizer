import { StatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HoyScreen } from "./src/screens/HoyScreen";
import { AgendaScreen } from "./src/screens/AgendaScreen";
import { PlanificadorScreen } from "./src/screens/PlanificadorScreen";

// 3 pestañas (Hoy / Agenda / Planificador) — ver mobile/README.md para el resto de secciones de
// la web que aún no tienen pantalla propia (Proyectos, Finanzas, Metas...). Cada pantalla pinta
// su propia cabecera dentro de su SafeAreaView, así que la barra de pestañas no lleva cabecera
// propia (`headerShown: false`) — mismo criterio que ya usaba el stack de una sola pantalla.
export type RootTabParamList = {
  Hoy: undefined;
  Agenda: undefined;
  Planificador: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, string> = { Hoy: "☀", Agenda: "🗓", Planificador: "📋" };

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

  if (!user) return <LoginScreen />;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#5b6b4f",
          tabBarInactiveTintColor: "#8a8073",
          tabBarStyle: { backgroundColor: "#fff" },
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>{TAB_ICONS[route.name as keyof RootTabParamList]}</Text>,
        })}
      >
        <Tab.Screen name="Hoy" component={HoyScreen} />
        <Tab.Screen name="Agenda" component={AgendaScreen} />
        <Tab.Screen name="Planificador" component={PlanificadorScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
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
