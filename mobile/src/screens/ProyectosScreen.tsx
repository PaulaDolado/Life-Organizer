import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, fonts } from "../theme";
import { ProyectosListScreen } from "./ProyectosListScreen";
import { ProyectoDetailScreen } from "./ProyectoDetailScreen";

// "Proyectos" necesita drill-down (galería → cuaderno de un proyecto), así que monta su propia
// pila anidada dentro de la pestaña — mismo patrón que "Páginas" (ver PaginasScreen.tsx).
export type ProyectosStackParamList = {
  Lista: undefined;
  Detalle: { id: number; title: string };
};

const Stack = createNativeStackNavigator<ProyectosStackParamList>();

export function ProyectosScreen() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Lista" component={ProyectosListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Detalle"
        component={ProyectoDetailScreen}
        options={({ route }) => ({
          title: route.params.title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: fonts.sansSemiBold },
          headerShadowVisible: false,
        })}
      />
    </Stack.Navigator>
  );
}
