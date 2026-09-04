import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
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
import { AnnualCalendarLegend } from "../components/AnnualCalendarLegend";

// Puerto directo de dashboard/src/pages/SchedulePage.tsx — mismo modelo (Schedule con nombre
// propio + ScheduleRow de texto libre lunes-viernes, sin fechas). Como Objetivos, no pasa por
// SQLite: ver el comentario de cabecera de src/api/schedule.ts para el porqué. Con paridad
// completa con la web: los dos modos de vista ("Flechas" — un horario a la vez — y "Apilado" —
// todos uno debajo de otro) y el calendario anual con leyenda (AnnualCalendarLegend) debajo.
// Simplificación deliberada frente a la web: los borrados (horario/franja) son de un solo toque,
// sin el "¿Confirmar?" de doble clic — ese patrón depende de un hover que no existe en táctil.

const VIEW_MODE_KEY = "life-organizer.schedule-view-mode";
type ViewMode = "flechas" | "apilado";

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
  const [viewMode, setViewMode] = useState<ViewMode>("flechas");

  const active = schedules[activeIndex] ?? null;

  // Preferencia persistida — equivalente móvil del `localStorage` que usa SchedulePage.tsx, pero
  // asíncrono (SecureStore), así que arranca en "flechas" y cambia en cuanto carga el valor
  // guardado (si lo hay).
  useEffect(() => {
    SecureStore.getItemAsync(VIEW_MODE_KEY).then((stored) => {
      if (stored === "apilado" || stored === "flechas") setViewMode(stored);
    });
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    SecureStore.setItemAsync(VIEW_MODE_KEY, mode);
  };

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

  // Versiones "por id" de las acciones de arriba, para el modo Apilado: ahí cada
  // ScheduleTableCard gestiona su propio horario, no el `active` de la vista Flechas.
  const renameScheduleById = async (id: number, name: string) => {
    await renameSchedule(id, name);
    await reloadSchedules();
  };
  const deleteScheduleById = async (id: number) => {
    await deleteSchedule(id);
    await reloadSchedules();
  };
  const moveScheduleById = async (id: number, direction: "up" | "down") => {
    await moveSchedule(id, direction);
    await reloadSchedules();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, collapsed && { paddingLeft: SIDEBAR_CLIP_CLEARANCE }]}>
        <Text style={styles.title}>Horario</Text>
        <Pressable style={styles.newButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.newButtonText}>+ Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.viewModeRow}>
        <View style={styles.viewModePill}>
          <Pressable
            style={[styles.viewModeButton, viewMode === "flechas" && styles.viewModeButtonActive]}
            onPress={() => changeViewMode("flechas")}
          >
            <Text style={[styles.viewModeButtonText, viewMode === "flechas" && styles.viewModeButtonTextActive]}>Flechas</Text>
          </Pressable>
          <Pressable
            style={[styles.viewModeButton, viewMode === "apilado" && styles.viewModeButtonActive]}
            onPress={() => changeViewMode("apilado")}
          >
            <Text style={[styles.viewModeButtonText, viewMode === "apilado" && styles.viewModeButtonTextActive]}>Apilado</Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.screenScroll}>
        {loadingSchedules && schedules.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : schedules.length === 0 ? (
          <View style={styles.content}>
            <Text style={styles.emptyText}>Aún no tienes ningún horario. Crea uno para empezar.</Text>
          </View>
        ) : viewMode === "flechas" ? (
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

            <ScheduleTableGrid
              rows={rows}
              loading={loadingRows}
              onCellChange={updateLocalCell}
              onCellBlur={persistCell}
              onAddRow={handleAddRow}
              onDeleteRow={handleDeleteRow}
              onMoveRow={handleMoveRow}
            />
          </>
        ) : (
          <View style={styles.stackedList}>
            {schedules.map((schedule, index) => (
              <ScheduleTableCard
                key={schedule.id}
                schedule={schedule}
                canMoveUp={index > 0}
                canMoveDown={index < schedules.length - 1}
                onRename={(name) => renameScheduleById(schedule.id, name)}
                onDelete={() => deleteScheduleById(schedule.id)}
                onMoveUp={() => moveScheduleById(schedule.id, "up")}
                onMoveDown={() => moveScheduleById(schedule.id, "down")}
              />
            ))}
          </View>
        )}

        <AnnualCalendarLegend />
      </ScrollView>

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

/** Tabla lunes-viernes pura: recibe `rows` ya cargadas y solo dispara los callbacks — la usan
 * tanto el modo Flechas (rows del `active` de arriba) como cada ScheduleTableCard del modo
 * Apilado (rows propias de ese horario), evitando duplicar el marcado de la tabla dos veces. */
function ScheduleTableGrid({
  rows,
  loading,
  onCellChange,
  onCellBlur,
  onAddRow,
  onDeleteRow,
  onMoveRow,
}: {
  rows: ScheduleRow[];
  loading: boolean;
  onCellChange: (rowId: number, field: DayKey | "timeLabel", value: string) => void;
  onCellBlur: (rowId: number, field: DayKey | "timeLabel", value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: number) => void;
  onMoveRow: (rowId: number, direction: "up" | "down") => void;
}) {
  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />;

  return (
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
                onChangeText={(v) => onCellChange(row.id, "timeLabel", v)}
                onBlur={() => onCellBlur(row.id, "timeLabel", row.timeLabel)}
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
                  onChangeText={(v) => onCellChange(row.id, key, v)}
                  onBlur={() => onCellBlur(row.id, key, row[key])}
                />
              </View>
            ))}
            <View style={[styles.cell, styles.actionsCell]}>
              <Pressable onPress={() => onMoveRow(row.id, "up")} disabled={index === 0}>
                <Text style={[styles.rowAction, index === 0 && styles.navArrowDisabled]}>↑</Text>
              </Pressable>
              <Pressable onPress={() => onMoveRow(row.id, "down")} disabled={index === rows.length - 1}>
                <Text style={[styles.rowAction, index === rows.length - 1 && styles.navArrowDisabled]}>↓</Text>
              </Pressable>
              <Pressable onPress={() => onDeleteRow(row.id)}>
                <Text style={[styles.rowAction, styles.toolbarDelete]}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable style={styles.addRowButton} onPress={onAddRow}>
          <Text style={styles.addRowButtonText}>+ Añadir franja horaria</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** Un horario completo (título propio + su ScheduleTableGrid) del modo Apilado — puerto de
 * ScheduleTable en dashboard/src/pages/SchedulePage.tsx: a diferencia del modo Flechas (que
 * comparte el `rows`/`reloadRows` de HorarioScreen), aquí cada tarjeta carga y guarda sus propias
 * filas, porque en Apilado hay varios horarios visibles a la vez. */
function ScheduleTableCard({
  schedule,
  canMoveUp,
  canMoveDown,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  schedule: Schedule;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowError, setRowError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(schedule.name);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listRows(schedule.id));
      setRowError(null);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo cargar el horario");
    } finally {
      setLoading(false);
    }
  }, [schedule.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setNameDraft(schedule.name);
  }, [schedule.name]);

  const updateLocalCell = (rowId: number, field: DayKey | "timeLabel", value: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  const persistCell = async (rowId: number, field: DayKey | "timeLabel", value: string) => {
    try {
      await updateRow(schedule.id, rowId, { [field]: value });
      setRowError(null);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  };

  const handleAddRow = async () => {
    await addRow(schedule.id);
    await reload();
  };

  const handleDeleteRow = async (rowId: number) => {
    await deleteRow(schedule.id, rowId);
    await reload();
  };

  const handleMoveRow = async (rowId: number, direction: "up" | "down") => {
    await moveRow(schedule.id, rowId, direction);
    await reload();
  };

  const handleRename = () => {
    const trimmed = nameDraft.trim();
    setRenaming(false);
    if (!trimmed || trimmed === schedule.name) {
      setNameDraft(schedule.name);
      return;
    }
    onRename(trimmed);
  };

  return (
    <View>
      <View style={styles.stackedHeader}>
        {renaming ? (
          <TextInput
            style={styles.stackedNameInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            onBlur={handleRename}
            onSubmitEditing={handleRename}
            autoFocus
          />
        ) : (
          <Pressable
            style={styles.stackedTitleButton}
            onPress={() => {
              setNameDraft(schedule.name);
              setRenaming(true);
            }}
          >
            <Text style={styles.stackedTitle} numberOfLines={1}>
              {schedule.name}
            </Text>
          </Pressable>
        )}
        <View style={styles.toolbarActions}>
          <Pressable onPress={onMoveUp} disabled={!canMoveUp}>
            <Text style={[styles.toolbarAction, !canMoveUp && styles.navArrowDisabled]}>↑</Text>
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={!canMoveDown}>
            <Text style={[styles.toolbarAction, !canMoveDown && styles.navArrowDisabled]}>↓</Text>
          </Pressable>
          <Pressable onPress={onDelete}>
            <Text style={[styles.toolbarAction, styles.toolbarDelete]}>Eliminar horario</Text>
          </Pressable>
        </View>
      </View>

      {rowError && <Text style={styles.errorBanner}>{rowError}</Text>}

      <ScheduleTableGrid
        rows={rows}
        loading={loading}
        onCellChange={updateLocalCell}
        onCellBlur={persistCell}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onMoveRow={handleMoveRow}
      />
    </View>
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

  // rounded-full border border-border p-1 de la web (SchedulePage.tsx) — el toggle Flechas/Apilado.
  viewModeRow: { paddingHorizontal: 20, paddingBottom: 8 },
  viewModePill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  viewModeButton: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  viewModeButtonActive: { backgroundColor: colors.primary },
  viewModeButtonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  viewModeButtonTextActive: { color: colors.primaryForeground },

  screenScroll: { paddingBottom: 20 },

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

  // ========== MODO APILADO ==========
  stackedList: { gap: 28 },
  stackedHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  stackedTitleButton: { flexShrink: 1, minWidth: 0 },
  stackedTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.foreground },
  stackedNameInput: {
    flex: 1,
    minWidth: 120,
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.foreground,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },

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
