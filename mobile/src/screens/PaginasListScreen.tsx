import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  CUSTOM_PAGE_TEMPLATES,
  CustomPageSummary,
  CustomPageTemplate,
  createCustomPage,
  deleteCustomPage,
  listCustomPages,
  moveCustomPage,
  TEMPLATE_LABELS,
} from "../api/customPages";
import { colors, fonts, radius, shadow } from "../theme";
import { PaginasStackParamList } from "./PaginasScreen";

// Lista de "Páginas personalizadas" — puerto de la parte de gestión de páginas que en la web vive
// repartida entre dashboard/src/pages/DashboardPage.tsx (fetch/crear/renombrar/borrar) y el menú
// lateral de AppShell.tsx (crear/reordenar/borrar). Aquí es su propia pantalla porque el móvil no
// tiene un menú lateral persistente — tocar una página navega al detalle (ver
// PaginaDetailScreen.tsx) dentro de la misma pestaña (pila anidada, ver PaginasScreen.tsx).
// Solo la plantilla "Galería" tiene editor propio en el móvil por ahora (ver
// mobile/README.md) — el resto se puede crear/ver/renombrar/borrar, pero su contenido solo se
// edita desde la web.

type Props = NativeStackScreenProps<PaginasStackParamList, "Lista">;

export function PaginasListScreen({ navigation }: Props) {
  const [pages, setPages] = useState<CustomPageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPages(await listCustomPages());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las páginas");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleCreate = async (title: string, template: CustomPageTemplate) => {
    const created = await createCustomPage(title, template);
    setShowCreate(false);
    await reload();
    navigation.navigate("Detalle", { id: created.id, title: created.title });
  };

  const handleDelete = async (id: number) => {
    await deleteCustomPage(id);
    await reload();
  };

  const handleMove = async (id: number, direction: "up" | "down") => {
    await moveCustomPage(id, direction);
    await reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Páginas</Text>
        <Pressable style={styles.newButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.newButtonText}>+ Nueva</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.errorBanner}>{error}</Text>}
        {loading && pages.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : pages.length === 0 ? (
          <Text style={styles.emptyText}>Aún no tienes páginas personalizadas. Crea una para empezar.</Text>
        ) : (
          pages.map((page, index) => (
            <Pressable
              key={page.id}
              style={styles.pageRow}
              onPress={() => navigation.navigate("Detalle", { id: page.id, title: page.title })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>{page.title}</Text>
                <Text style={styles.pageMeta}>{page.subtitle || TEMPLATE_LABELS[page.template]}</Text>
              </View>
              <View style={styles.pageActions}>
                <Pressable onPress={() => handleMove(page.id, "up")} disabled={index === 0} hitSlop={8}>
                  <Text style={[styles.actionText, index === 0 && styles.actionDisabled]}>↑</Text>
                </Pressable>
                <Pressable onPress={() => handleMove(page.id, "down")} disabled={index === pages.length - 1} hitSlop={8}>
                  <Text style={[styles.actionText, index === pages.length - 1 && styles.actionDisabled]}>↓</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(page.id)} hitSlop={8}>
                  <Text style={[styles.actionText, styles.actionDelete]}>Borrar</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <NewPageForm onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NewPageForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, template: CustomPageTemplate) => Promise<void>;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState<CustomPageTemplate>("galeria");
  const [title, setTitle] = useState(TEMPLATE_LABELS.galeria);
  const [titleTouched, setTitleTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectTemplate = (t: CustomPageTemplate) => {
    setTemplate(t);
    if (!titleTouched) setTitle(TEMPLATE_LABELS[t]);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit(title.trim(), template);
    setSaving(false);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.modalTitle}>Nueva página</Text>

      <Text style={styles.fieldLabel}>Plantilla</Text>
      <View style={styles.chipRow}>
        {CUSTOM_PAGE_TEMPLATES.map((t) => (
          <Pressable key={t} style={[styles.chip, template === t && styles.chipSelected]} onPress={() => selectTemplate(t)}>
            <Text style={[styles.chipText, template === t && styles.chipTextSelected]}>{TEMPLATE_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>
      {template !== "galeria" && (
        <Text style={styles.hint}>Esta plantilla se crea igual que en la web, pero de momento solo se edita desde ahí.</Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Título"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setTitleTouched(true);
        }}
      />

      <Pressable style={styles.saveButton} onPress={submit} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Creando…" : "Crear página"}</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },
  newButton: { backgroundColor: colors.foreground, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  newButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 10, paddingBottom: 40 },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },

  pageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow,
  },
  pageTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.foreground },
  pageMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  pageActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  actionDisabled: { opacity: 0.3 },
  actionDelete: { color: colors.destructive },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(45,41,38,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: 20,
    maxHeight: "88%",
  },
  modalTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, marginBottom: 16 },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: -6, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  chipText: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  chipTextSelected: { fontFamily: fonts.sansMedium, color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    padding: 12,
    marginBottom: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 15, alignItems: "center", marginTop: 8 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 14 },
});
