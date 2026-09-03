import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { CustomPage, deleteCustomPage, GalleryContent, GalleryEntry, getCustomPage, TEMPLATE_LABELS, updateCustomPage } from "../api/customPages";
import { colors, fonts, radius, shadow } from "../theme";
import { PaginasStackParamList } from "./PaginasScreen";

// Detalle de una página personalizada — puerto de dashboard/src/pages/CustomPagePage.tsx. Título/
// subtítulo se editan igual para cualquier plantilla (PUT /custom-pages/:id); el contenido solo
// tiene editor propio para "galeria" (lo pedido) — ver mobile/README.md para el resto.
// Simplificación deliberada frente a la web: guardado explícito con un botón en vez de
// autoguardado a los 600ms de cada pulsación (mismo criterio que el resto de modales del móvil,
// p.ej. AgendaScreen/PlanificadorScreen).

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // igual límite que CustomPagePage.tsx (MAX_IMAGE_BYTES)

type Props = NativeStackScreenProps<PaginasStackParamList, "Detalle">;

export function PaginaDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [page, setPage] = useState<CustomPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [editingEntry, setEditingEntry] = useState<GalleryEntry | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await getCustomPage(id);
      setPage(loaded);
      setTitle(loaded.title);
      setSubtitle(loaded.subtitle ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la página");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const galleryItems: GalleryEntry[] = page?.template === "galeria" ? ((page.content as GalleryContent).items ?? []) : [];

  const saveTitleAndSubtitle = async () => {
    if (!page) return;
    if (title.trim() === page.title && subtitle === (page.subtitle ?? "")) return;
    const updated = await updateCustomPage(id, { title: title.trim() || page.title, subtitle: subtitle.trim() || null });
    setPage(updated);
    navigation.setParams({ title: updated.title });
  };

  const saveGalleryItems = async (items: GalleryEntry[]) => {
    if (!page) return;
    const updated = await updateCustomPage(id, { content: { items } });
    setPage(updated);
  };

  const handleAddEntry = async () => {
    const entry: GalleryEntry = { id: Crypto.randomUUID() };
    await saveGalleryItems([entry, ...galleryItems]);
    setEditingEntry(entry);
  };

  const handleSaveEntry = async (entry: GalleryEntry) => {
    const next = galleryItems.map((e) => (e.id === entry.id ? entry : e));
    await saveGalleryItems(next);
    setEditingEntry(null);
  };

  const handleRemoveEntry = async (entryId: string) => {
    await saveGalleryItems(galleryItems.filter((e) => e.id !== entryId));
    setEditingEntry(null);
  };

  const handleDeletePage = async () => {
    await deleteCustomPage(id);
    navigation.goBack();
  };

  if (loading && !page) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (error && !page) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorBanner}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} onBlur={saveTitleAndSubtitle} placeholder="Título" />
        <TextInput
          style={styles.subtitleInput}
          value={subtitle}
          onChangeText={setSubtitle}
          onBlur={saveTitleAndSubtitle}
          placeholder={page ? TEMPLATE_LABELS[page.template] : ""}
        />

        {page?.template === "galeria" ? (
          <>
            <Pressable style={styles.addButton} onPress={handleAddEntry}>
              <Text style={styles.addButtonText}>+ Nueva entrada</Text>
            </Pressable>
            {galleryItems.length === 0 ? (
              <Text style={styles.emptyText}>Sin entradas todavía.</Text>
            ) : (
              <View style={styles.masonry}>
                <View style={styles.masonryColumn}>
                  {galleryItems.filter((_, i) => i % 2 === 0).map((entry) => (
                    <GalleryTile key={entry.id} entry={entry} onPress={() => setEditingEntry(entry)} />
                  ))}
                </View>
                <View style={styles.masonryColumn}>
                  {galleryItems.filter((_, i) => i % 2 === 1).map((entry) => (
                    <GalleryTile key={entry.id} entry={entry} onPress={() => setEditingEntry(entry)} />
                  ))}
                </View>
              </View>
            )}
          </>
        ) : page ? (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackText}>
              La plantilla "{TEMPLATE_LABELS[page.template]}" todavía no tiene editor en el móvil — ábrela desde el dashboard web para
              ver o cambiar su contenido. El título y el subtítulo sí se guardan desde aquí.
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.deletePageButton} onPress={handleDeletePage}>
          <Text style={styles.deletePageText}>Eliminar página</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={editingEntry !== null} animationType="slide" transparent onRequestClose={() => setEditingEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {editingEntry && (
              <GalleryItemForm
                entry={editingEntry}
                onSave={handleSaveEntry}
                onRemove={() => handleRemoveEntry(editingEntry.id)}
                onClose={() => setEditingEntry(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Mismo criterio que `placeholderColorFor` en dashboard/src/utils/galleryPalette.ts: un color de
// fondo estable derivado del id, para que una entrada sin imagen no se vea como un hueco vacío.
const PLACEHOLDER_COLORS = [colors.primaryTint, colors.warningTint, colors.habitTint, colors.hobbyTint, colors.coverTint];
function placeholderColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function GalleryTile({ entry, onPress }: { entry: GalleryEntry; onPress: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      {entry.imageData ? (
        <Image source={{ uri: entry.imageData }} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <View style={[styles.tilePlaceholder, { backgroundColor: placeholderColorFor(entry.id) }]} />
      )}
      {(entry.title || entry.text) && (
        <View style={styles.tileCaption}>
          {entry.title ? <Text style={styles.tileTitle}>{entry.title}</Text> : null}
          {entry.text ? (
            <Text style={styles.tileText} numberOfLines={3}>
              {entry.text}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function GalleryItemForm({
  entry,
  onSave,
  onRemove,
  onClose,
}: {
  entry: GalleryEntry;
  onSave: (entry: GalleryEntry) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(entry.title ?? "");
  const [text, setText] = useState(entry.text ?? "");
  const [imageData, setImageData] = useState<string | null | undefined>(entry.imageData);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", "Activa el acceso a tus fotos para añadir una imagen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return;
    const base64 = result.assets[0].base64;
    if (base64.length * 0.75 > MAX_IMAGE_BYTES) {
      Alert.alert("Imagen demasiado grande", "El límite es de 3 MB por imagen.");
      return;
    }
    setImageData(`data:image/jpeg;base64,${base64}`);
  };

  const submit = async () => {
    setSaving(true);
    await onSave({ ...entry, title: title.trim() || undefined, text: text.trim() || undefined, imageData });
    setSaving(false);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.modalTitle}>Entrada de galería</Text>

      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {imageData ? (
          <Image source={{ uri: imageData }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <Text style={styles.imagePickerText}>Toca para elegir una imagen</Text>
        )}
      </Pressable>
      {imageData && (
        <Pressable onPress={() => setImageData(null)}>
          <Text style={styles.removeImageText}>Quitar imagen</Text>
        </Pressable>
      )}

      <TextInput style={styles.input} placeholder="Título (opcional)" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Texto (opcional)"
        value={text}
        onChangeText={setText}
        multiline
      />

      <Pressable style={styles.saveButton} onPress={submit} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Guardar"}</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={onRemove}>
        <Text style={styles.deleteButtonText}>Eliminar entrada</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cerrar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  errorBanner: { fontFamily: fonts.sans, fontSize: 13, color: colors.destructive, padding: 20 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },

  titleInput: { fontFamily: fonts.serif, fontSize: 28, color: colors.foreground, padding: 0 },
  subtitleInput: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, padding: 0, marginBottom: 8 },

  addButton: { alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10 },
  addButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 13 },

  masonry: { flexDirection: "row", gap: 10 },
  masonryColumn: { flex: 1, gap: 10 },
  tile: {
    borderRadius: radius.input,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  tileImage: { width: "100%", height: 140 },
  tilePlaceholder: { width: "100%", height: 100 },
  tileCaption: { padding: 8, gap: 2 },
  tileTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.foreground },
  tileText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },

  fallbackCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadow,
  },
  fallbackText: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, lineHeight: 19 },

  deletePageButton: { alignItems: "center", padding: 14, marginTop: 12 },
  deletePageText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(45,41,38,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: 20,
    maxHeight: "88%",
  },
  modalTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, marginBottom: 16 },
  imagePicker: {
    height: 160,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePickerText: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  removeImageText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive, marginBottom: 12, textAlign: "center" },
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
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 15, alignItems: "center", marginTop: 8 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  deleteButton: { alignItems: "center", padding: 14 },
  deleteButtonText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 14 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 14 },
});
