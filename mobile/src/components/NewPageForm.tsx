import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { CUSTOM_PAGE_TEMPLATES, CustomPageTemplate, TEMPLATE_LABELS } from "../api/customPages";
import { colors, fonts, radius } from "../theme";

// Formulario de "Nueva página personalizada" (plantilla + título) — extraído de
// PaginasListScreen.tsx para poder reutilizarlo también desde AppSidebar.tsx (ver el botón
// "+ Nueva página" al final del menú, puerto del mismo botón en dashboard/src/components/
// AppShell.tsx). Mismo comportamiento: elegir plantilla autocompleta el título con su etiqueta
// hasta que el usuario lo edite a mano.
export function NewPageForm({
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
