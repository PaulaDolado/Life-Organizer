import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import {
  addRow,
  createSchedule,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  deleteRow,
  deleteSchedule,
  listRows,
  listSchedules,
  moveRow,
  moveSchedule,
  renameSchedule,
  Schedule,
  ScheduleRow,
  updateRow,
} from "../api/schedule";
import { colors, fonts, radius, shadow } from "../theme";
import { useSidebar, SIDEBAR_CLIP_CLEARANCE } from "../navigation/SidebarContext";

// Puerto directo de dashboard/src/pages/SchedulePage.tsx — mismo modelo (Schedule con nombre
// propio + ScheduleRow de texto libre lunes-viernes, sin fechas). Como Objetivos, no pasa por
// SQLite: ver el comentario de src/api/schedule.ts para el porqué. Simplificaciones deliberadas
// frente a la web: solo modo "Flechas" (un horario a la vez — más natural en pantalla estrecha
// que "Apilado"), y sin el calendario anual con leyenda (`AnnualCalendarLegend`, un componente
// aparte sin relación con un horario concreto) — quedan documentadas en mobile/README.md.

export function HorarioScreen() {
  const { collapsed } = useSidebar();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);

  const active = schedules[activeIndex] ?? null;

  const reloadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    setError(null);
    try {
      setSchedules(await listSchedules());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los horarios");
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSchedules();
    }, [reloadSchedules])
  );

  // Si se borra el horario activo (o cambia el total), el índice no debe quedar fuera de rango.
  useEffect(() => {
    if (activeIndex > schedules.length - 1) setActiveIndex(Math.max(0, schedules.length - 1));
  }, [schedules.length, activeIndex]);

  // En cuanto el horario recién creado aparece en `schedules`, salta a él — mismo patrón que
  // dashboard/src/pages/SchedulePage.tsx:93-101.
  useEffect(() => {
    if (pendingFocusId === null) return;
    const index = schedules.findIndex((s) => s.id === pendingFocusId);
    if (index !== -1) {
      setActiveIndex(index);
      setPendingFocusId(null);
    }
  }, [schedules, pendingFocusId]);

  const reloadRows = useCallback(async (scheduleId: number) => {
    setLoadingRows(true);
    setRowError(null);
    try {
      setRows(await listRows(scheduleId));
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo cargar el horario");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    if (active) reloadRows(active.id);
    else setRows([]);
    setRenaming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const handleCreateSchedule = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = await createSchedule(trimmed);
    setNewName("");
    setShowCreate(false);
    setPendingFocusId(created.id);
    await reloadSchedules();
  };

  const handleRename = async () => {
    if (!active) return;
    const trimmed = nameDraft.trim();
    setRenaming(false);
    if (!trimmed || trimmed === active.name) return;
    await renameSchedule(active.id, trimmed);
    await reloadSchedules();
  };

  const handleDeleteSchedule = async () => {
    if (!active) return;
    await deleteSchedule(active.id);
    await reloadSchedules();
  };

  const handleMoveSchedule = async (direction: "up" | "down") => {
    if (!active) return;
    await moveSchedule(active.id, direction);
    await reloadSchedules();
  };

  const updateLocalCell = (rowId: number, field: DayKey | "timeLabel", value: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  const persistCell = async (rowId: number, field: DayKey | "timeLabel", value: string) => {
    if (!active) return;
    try {
      await updateRow(active.id, rowId, { [field]: value });
      setRowError(null);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  };

  const handleAddRow = async () => {
    if (!active) return;
    await addRow(active.id);
    await reloadRows(active.id);
  };

  const handleDeleteRow = async (rowId: number) => {
    if (!active) return;
    await deleteRow(active.id, rowId);
    await reloadRows(active.id);
  };

  const handleMoveRow = async (rowId: number, direction: "up" | "down") => {
    if (!active) return;
    await moveRow(active.id, rowId, direction);
    await reloadRows(active.id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, collapsed && { paddingLeft: SIDEBAR_CLIP_CLEARANCE }]}>
        <Text style={styles.title}>Horario</Text>
        <Pressable style={styles.newButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.newButtonText}>+ Nuevo</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      {loadingSchedules && schedules.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : schedules.length === 0 ? (
        <View style={styles.content}>
          <Text style={styles.emptyText}>Aún no tienes ningún horario. Crea uno para empezar.</Text>
        </View>
      ) : (
        <>
          <View style={styles.nav}>
            <Pressable disabled={activeIndex === 0} onPress={() => setActiveIndex((i) => i - 1)}>
              <Text style={[styles.navArrow, activeIndex === 0 && styles.navArrowDisabled]}>‹</Text>
            </Pressable>

            {renaming ? (
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={handleRename}
                onSubmitEditing={handleRename}
                autoFocus
              />
            ) : (
              <Pressable
                style={styles.nameButton}
                onPress={() => {
                  setNameDraft(active?.name ?? "");
                  setRenaming(true);
                }}
              >
                <Text style={styles.navTitle}>{active?.name}</Text>
              </Pressable>
            )}

            <Pressable disabled={activeIndex >= schedules.length - 1} onPress={() => setActiveIndex((i) => i + 1)}>
              <Text style={[styles.navArrow, activeIndex >= schedules.length - 1 && styles.navArrowDisabled]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            <Text style={styles.toolbarHint}>
              {activeIndex + 1} de {schedules.length}
            </Text>
            <View style={styles.toolbarActions}>
              <Pressable onPress={() => handleMoveSchedule("up")} disabled={activeIndex === 0}>
                <Text style={[styles.toolbarAction, activeIndex === 0 && styles.navArrowDisabled]}>↑</Text>
              </Pressable>
              <Pressable onPress={() => handleMoveSchedule("down")} disabled={activeIndex >= schedules.length - 1}>
                <Text style={[styles.toolbarAction, activeIndex >= schedules.length - 1 && styles.navArrowDisabled]}>↓</Text>
              </Pressable>
              <Pressable onPress={handleDeleteSchedule}>
                <Text style={[styles.toolbarAction, styles.toolbarDelete]}>Eliminar horario</Text>
              </Pressable>
            </View>
          </View>

          {rowError && <Text style={styles.errorBanner}>{rowError}</Text>}

          {loadingRows ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView horizontal contentContainerStyle={styles.tableScroll} showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.cell, styles.timeCell]}>
                    <Text style={styles.headerText}>Hora</Text>
                  </View>
                  {DAY_KEYS.map((key) => (
                    <View key={key} style={[styles.cell, styles.dayCell]}>
                      <Text style={styles.headerText}>{DAY_LABELS[key]}</Text>
                    </View>
                  ))}
                  <View style={[styles.cell, styles.actionsCell]} />
                </View>

                {rows.map((row, index) => (
                  <View key={row.id} style={styles.tableRow}>
                    <View style={[styles.cell, styles.timeCell]}>
                      <TextInput
                        style={styles.timeCellInput}
                        value={row.timeLabel}
                        placeholder="08:00 - 10:00"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        onChangeText={(v) => updateLocalCell(row.id, "timeLabel", v)}
                        onBlur={() => persistCell(row.id, "timeLabel", row.timeLabel)}
                      />
                    </View>
                    {DAY_KEYS.map((key) => (
                      <View key={key} style={[styles.cell, styles.dayCell]}>
                        <TextInput
                          style={styles.dayCellInput}
                          value={row[key]}
                          placeholder="—"
                          placeholderTextColor={colors.border}
                          multiline
                          onChangeText={(v) => updateLocalCell(row.id, key, v)}
                          onBlur={() => persistCell(row.id, key, row[key])}
                        />
                      </View>
                    ))}
                    <View style={[styles.cell, styles.actionsCell]}>
                      <Pressable onPress={() => handleMoveRow(row.id, "up")} disabled={index === 0}>
                        <Text style={[styles.rowAction, index === 0 && styles.navArrowDisabled]}>↑</Text>
                      </Pressable>
                      <Pressable onPress={() => handleMoveRow(row.id, "down")} disabled={index === rows.length - 1}>
                        <Text style={[styles.rowAction, index === rows.length - 1 && styles.navArrowDisabled]}>↓</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeleteRow(row.id)}>
                        <Text style={[styles.rowAction, styles.toolbarDelete]}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                <Pressable style={styles.addRowButton} onPress={handleAddRow}>
                  <Text style={styles.addRowButtonText}>+ Añadir franja horaria</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Nuevo horario</Text>
            <TextInput style={styles.input} placeholder="Ej. 1r trimestre" value={newName} onChangeText={setNewName} autoFocus />
            <Pressable style={styles.saveButton} onPress={handleCreateSchedule}>
              <Text style={styles.saveButtonText}>Crear horario</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const TIME_COL_WIDTH = 96;
const DAY_COL_WIDTH = 128;
const ACTIONS_COL_WIDTH = 60;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },
  newButton: { backgroundColor: colors.foreground, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  newButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.background },
  content: { padding: 20 },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 20, paddingBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },

  nav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 20 },
  navArrow: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.mutedForeground },
  navArrowDisabled: { opacity: 0.3 },
  navTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, textAlign: "center" },
  nameButton: { flex: 1, alignItems: "center" },
  nameInput: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.foreground,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },

  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  toolbarHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  toolbarAction: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  toolbarDelete: { color: colors.destructive },

  tableScroll: { paddingHorizontal: 20, paddingBottom: 30 },
  table: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    ...shadow,
  },
  tableHeaderRow: { flexDirection: "row", backgroundColor: colors.muted },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  cell: { borderRightWidth: 1, borderRightColor: colors.border, padding: 8, justifyContent: "center" },
  timeCell: { width: TIME_COL_WIDTH },
  dayCell: { width: DAY_COL_WIDTH },
  actionsCell: { width: ACTIONS_COL_WIDTH, borderRightWidth: 0, flexDirection: "row", justifyContent: "center", gap: 4 },
  headerText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.mutedForeground,
  },
  timeCellInput: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground, minHeight: 40 },
  dayCellInput: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground, minHeight: 40 },
  rowAction: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, padding: 2 },
  addRowButton: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border },
  addRowButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(45,41,38,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: 20,
  },
  modalTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, marginBottom: 16 },
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
