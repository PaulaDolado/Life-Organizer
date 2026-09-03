import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { runSync } from "../sync";
import {listAllTasks,createTaskLocal,updateTaskLocal,moveTask,deleteTaskLocal,parseTaskTags,} from "../db/tasksRepo";
import { listForTask, createSubtaskLocal, toggleSubtask, deleteSubtaskLocal } from "../db/subtasksRepo";
import { LocalSubtask, LocalTask, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, TaskPriority, TaskStatus } from "../types";
import { colors, dueDateStyle, fonts, priorityStyle, radius, shadow } from "../theme";
import { useSidebar, SIDEBAR_CLIP_CLEARANCE } from "../navigation/SidebarContext";

const VIEW_MODES = ["kanban", "tabla"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const BOARD_VIEWS = ["flechas", "apilado"] as const;
type BoardViewMode = (typeof BOARD_VIEWS)[number];

// Estilos de columnas por estado (igual que web)
const COLUMN_BG_COLORS: Record<TaskStatus, string> = {
  todo: colors.card,
  in_progress: "rgba(200,123,0,0.1)", // warning 10%
  done: "rgba(95,113,97,0.1)", // positive 10%
};

const COLUMN_BORDER_COLORS: Record<TaskStatus, string> = {
  todo: colors.border,
  in_progress: "rgba(200,123,0,0.3)", // warning 30%
  done: "rgba(95,113,97,0.3)", // positive 30%
};

const COLUMN_HEADERS: Record<TaskStatus, string> = {
  todo: "Por hacer",
  in_progress: "En progreso",
  done: "Hecho",
};

function nextPriority(p: TaskPriority): TaskPriority {
  const idx = TASK_PRIORITIES.indexOf(p);
  return TASK_PRIORITIES[(idx + 1) % TASK_PRIORITIES.length];
}

function dueBadge(dueDate: string | null, done: boolean): { label: string; bg: string; text: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysDiff = Math.round((dueDay - todayDay) / 86_400_000);
  const label = daysDiff < 0 ? `Venció ${due.toLocaleDateString("es-ES")}` : daysDiff === 0 ? "Hoy" : due.toLocaleDateString("es-ES");
  return { label, ...dueDateStyle(daysDiff, done) };
}

interface TaskForm {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  tagsText: string;
}

function toForm(task: LocalTask): TaskForm {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    tagsText: parseTaskTags(task).join(", "),
  };
}

export function PlanificadorScreen() {
  const { collapsed } = useSidebar();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [drafts, setDrafts] = useState<Record<TaskStatus, string>>({ todo: "", in_progress: "", done: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm | null>(null);
  const [subtasks, setSubtasks] = useState<LocalSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [boardView, setBoardView] = useState<BoardViewMode>("apilado");
  const [activeStatusIndex, setActiveStatusIndex] = useState(0);

  const reload = useCallback(async () => {
    setTasks(await listAllTasks());
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    const result = await runSync();
    setSyncing(false);
    if (result.success) await reload();
    else setSyncError(result.error ?? "No se pudo sincronizar");
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
      sync();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const reloadSubtasks = useCallback(async (taskId: string) => {
    setSubtasks(await listForTask(taskId));
  }, []);

  const openTask = async (task: LocalTask) => {
    setForm(toForm(task));
    await reloadSubtasks(task.id);
  };

  const closeTask = () => {
    setForm(null);
    setSubtasks([]);
    setSubtaskDraft("");
    setShowDuePicker(false);
  };

  const handleQuickAdd = async (status: TaskStatus) => {
    const title = drafts[status].trim();
    if (!title) return;
    setDrafts({ ...drafts, [status]: "" });
    await createTaskLocal({ title, description: null, status, priority: "medium", dueDate: null, tags: [] });
    await reload();
    sync();
  };

  const handleCyclePriority = async (task: LocalTask) => {
    await updateTaskLocal(task.id, {
      title: task.title,
      description: task.description,
      priority: nextPriority(task.priority),
      dueDate: task.dueDate,
      tags: parseTaskTags(task),
    });
    await reload();
    sync();
  };

  const handleMoveStatus = async (status: TaskStatus) => {
    if (!form) return;
    await moveTask(form.id, status, null);
    setForm({ ...form, status });
    await reload();
    sync();
  };

  const handleSaveForm = async () => {
    if (!form || !form.title.trim()) return;
    const tags = form.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateTaskLocal(form.id, {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      dueDate: form.dueDate ? form.dueDate.toISOString() : null,
      tags,
    });
    closeTask();
    await reload();
    sync();
  };

  const handleDeleteTask = async () => {
    if (!form) return;
    await deleteTaskLocal(form.id);
    closeTask();
    await reload();
    sync();
  };

  const handleAddSubtask = async () => {
    if (!form || !subtaskDraft.trim()) return;
    const title = subtaskDraft.trim();
    setSubtaskDraft("");
    await createSubtaskLocal(form.id, title);
    await reloadSubtasks(form.id);
    sync();
  };

  const handleToggleSubtask = async (id: string) => {
    await toggleSubtask(id);
    if (form) await reloadSubtasks(form.id);
    sync();
  };

  const handleDeleteSubtask = async (id: string) => {
    await deleteSubtaskLocal(id);
    if (form) await reloadSubtasks(form.id);
    sync();
  };

  const onDuePickerChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    setShowDuePicker(false);
    if (!form) return;
    setForm({ ...form, dueDate: selected });
  };

  const visibleStatuses = boardView === "flechas" ? [TASK_STATUSES[activeStatusIndex]] : TASK_STATUSES;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, collapsed && { paddingLeft: SIDEBAR_CLIP_CLEARANCE }]}>
        <Text style={styles.title}>Planificador</Text>
      </View>

      {/* VISTA Y NAVEGACIÓN */}
      <View style={styles.controlBar}>
        <View style={styles.viewToggle}>
          {VIEW_MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[styles.viewToggleButton, viewMode === mode && styles.viewToggleButtonActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                {mode === "kanban" ? "Kanban" : "Lista"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.boardToggle}>
          {BOARD_VIEWS.map((mode) => (
            <Pressable
              key={mode}
              style={[styles.boardToggleButton, boardView === mode && styles.boardToggleButtonActive]}
              onPress={() => setBoardView(mode)}
            >
              <Text style={[styles.boardToggleText, boardView === mode && styles.boardToggleTextActive]}>
                {mode === "flechas" ? "Flechas" : "Apilado"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {syncError && <Text style={styles.errorBanner}>{syncError} — se reintentará solo</Text>}

      {/* NAVEGACIÓN FLECHAS (solo en vista flechas) */}
      {boardView === "flechas" && (
        <View style={styles.navigationBar}>
          <Pressable
            style={[styles.navButton, activeStatusIndex === 0 && styles.navButtonDisabled]}
            onPress={() => setActiveStatusIndex(Math.max(0, activeStatusIndex - 1))}
            disabled={activeStatusIndex === 0}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.navLabel}>
            {COLUMN_HEADERS[TASK_STATUSES[activeStatusIndex]]} ({activeStatusIndex + 1}/{TASK_STATUSES.length})
          </Text>
          <Pressable
            style={[styles.navButton, activeStatusIndex === TASK_STATUSES.length - 1 && styles.navButtonDisabled]}
            onPress={() => setActiveStatusIndex(Math.min(TASK_STATUSES.length - 1, activeStatusIndex + 1))}
            disabled={activeStatusIndex === TASK_STATUSES.length - 1}
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>
      )}

      {syncing && (
        <View style={styles.syncBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.syncText}>Sincronizando…</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {viewMode === "kanban" ? (
          <View style={styles.kanbanContainer}>
            {visibleStatuses.map((status) => {
              const columnTasks = tasks.filter((t) => t.status === status);
              return (
                <View
                  key={status}
                  style={[
                    styles.kanbanColumn,
                    {
                      backgroundColor: COLUMN_BG_COLORS[status],
                      borderColor: COLUMN_BORDER_COLORS[status],
                    },
                  ]}
                >
                  <Text style={styles.columnHeader}>{COLUMN_HEADERS[status]}</Text>
                  <Text style={styles.columnCount}>{columnTasks.length}</Text>

                  {columnTasks.length === 0 ? (
                    <Text style={styles.emptyText}>Sin tareas</Text>
                  ) : (
                    columnTasks.map((task) => {
                      const badge = dueBadge(task.dueDate, task.status === "done");
                      return (
                        <Pressable key={task.id} style={styles.taskCard} onPress={() => openTask(task)}>
                          <View style={[styles.priorityDot, { backgroundColor: priorityStyle(task.priority).text }]} />
                          <View style={styles.taskCardContent}>
                            <Text style={[styles.taskTitle, task.status === "done" && styles.taskTitleDone]}>{task.title}</Text>
                            {badge && (
                              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                              </View>
                            )}
                          </View>
                          {(task.synced === 0 || task.pendingOp === "update") && (
                            <Text style={styles.pendingTag}>pendiente</Text>
                          )}
                        </Pressable>
                      );
                    })
                  )}

                  <View style={styles.quickAddRow}>
                    <TextInput
                      style={styles.quickAddInput}
                      placeholder="Nueva tarea…"
                      value={drafts[status]}
                      onChangeText={(t) => setDrafts({ ...drafts, [status]: t })}
                      onSubmitEditing={() => handleQuickAdd(status)}
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Pressable style={styles.addButton} onPress={() => handleQuickAdd(status)}>
                      <Text style={styles.addButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          // VISTA LISTA
          <View style={styles.listContainer}>
            {TASK_STATUSES.map((status) => {
              const columnTasks = tasks.filter((t) => t.status === status);
              return (
                <View key={status} style={styles.listSection}>
                  <Text style={styles.listSectionHeader}>{COLUMN_HEADERS[status]}</Text>

                  {columnTasks.length === 0 ? (
                    <Text style={styles.emptyText}>Sin tareas</Text>
                  ) : (
                    columnTasks.map((task) => {
                      const badge = dueBadge(task.dueDate, task.status === "done");
                      return (
                        <Pressable key={task.id} style={styles.listTaskRow} onPress={() => openTask(task)}>
                          <Pressable
                            style={[styles.listPriorityDot, { backgroundColor: priorityStyle(task.priority).text }]}
                            onPress={() => handleCyclePriority(task)}
                          />
                          <View style={styles.listTaskInfo}>
                            <Text style={[styles.listTaskTitle, task.status === "done" && styles.taskTitleDone]}>{task.title}</Text>
                            {badge && (
                              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                              </View>
                            )}
                          </View>
                          {(task.synced === 0 || task.pendingOp === "update") && (
                            <Text style={styles.pendingTag}>pendiente</Text>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE EDICIÓN */}
      <Modal visible={form !== null} animationType="slide" onRequestClose={closeTask} transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Tarea</Text>

              <TextInput
                style={styles.input}
                placeholder="Título"
                value={form?.title ?? ""}
                onChangeText={(t) => form && setForm({ ...form, title: t })}
                placeholderTextColor={colors.mutedForeground}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Descripción (opcional)"
                value={form?.description ?? ""}
                onChangeText={(t) => form && setForm({ ...form, description: t })}
                multiline
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.fieldLabel}>Estado</Text>
              <View style={styles.chipRow}>
                {TASK_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.chip, form?.status === status && styles.chipSelected]}
                    onPress={() => handleMoveStatus(status)}
                  >
                    <Text style={[styles.chipText, form?.status === status && styles.chipTextSelected]}>
                      {TASK_STATUS_LABELS[status]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Prioridad</Text>
              <View style={styles.chipRow}>
                {TASK_PRIORITIES.map((priority) => (
                  <Pressable
                    key={priority}
                    style={[styles.chip, form?.priority === priority && styles.chipSelected]}
                    onPress={() => form && setForm({ ...form, priority })}
                  >
                    <Text style={[styles.chipText, form?.priority === priority && styles.chipTextSelected]}>
                      {TASK_PRIORITY_LABELS[priority]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Fecha límite</Text>
              <View style={styles.dateRow}>
                <Pressable style={styles.dateButton} onPress={() => setShowDuePicker(true)}>
                  <Text style={styles.dateButtonText}>{form?.dueDate ? form.dueDate.toLocaleDateString("es-ES") : "Sin fecha"}</Text>
                </Pressable>
                {form?.dueDate && (
                  <Pressable style={styles.clearDateButton} onPress={() => form && setForm({ ...form, dueDate: null })}>
                    <Text style={styles.clearDateButtonText}>Quitar</Text>
                  </Pressable>
                )}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Tags, separados por coma"
                value={form?.tagsText ?? ""}
                onChangeText={(t) => form && setForm({ ...form, tagsText: t })}
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.fieldLabel}>Subtareas</Text>
              {subtasks.map((s) => (
                <View key={s.id} style={styles.subtaskRow}>
                  <Pressable style={styles.subtaskCheckRow} onPress={() => handleToggleSubtask(s.id)}>
                    <View style={[styles.checkbox, s.completed === 1 && styles.checkboxChecked]}>
                      {s.completed === 1 && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={[styles.subtaskTitle, s.completed === 1 && styles.taskTitleDone]}>{s.title}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteSubtask(s.id)}>
                    <Text style={styles.deleteText}>Borrar</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.quickAddRow}>
                <TextInput
                  style={styles.quickAddInput}
                  placeholder="Nueva subtarea…"
                  value={subtaskDraft}
                  onChangeText={setSubtaskDraft}
                  onSubmitEditing={handleAddSubtask}
                  placeholderTextColor={colors.mutedForeground}
                />
                <Pressable style={styles.addButton} onPress={handleAddSubtask}>
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>

              <Pressable style={styles.saveButton} onPress={handleSaveForm}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={handleDeleteTask}>
                <Text style={styles.deleteButtonText}>Borrar tarea</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={closeTask}>
                <Text style={styles.cancelButtonText}>Cerrar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showDuePicker && (
        <DateTimePicker
          value={form?.dueDate ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onDismiss={() => setShowDuePicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },

  // CONTROL BAR
  controlBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  viewToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.foreground,
  },
  viewToggleText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: "600",
  },
  viewToggleTextActive: {
    color: colors.background,
  },
  boardToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  boardToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  boardToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  boardToggleText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: "600",
  },
  boardToggleTextActive: {
    color: colors.primaryForeground,
  },

  // NAVIGATION BAR (flechas)
  navigationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.foreground,
  },
  navLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
    textAlign: "center",
  },

  // SYNC BAR
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  syncText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  errorBanner: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.destructive,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.destructive + "10",
  },

  // CONTENT
  content: { padding: 16, paddingBottom: 32, gap: 16 },

  // KANBAN VIEW
  kanbanContainer: { gap: 16 },
  kanbanColumn: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  columnHeader: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  columnCount: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    ...shadow,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  taskCardContent: { flex: 1, gap: 4 },
  taskTitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.mutedForeground },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 10 },
  pendingTag: { fontFamily: fonts.sansMedium, fontSize: 9, color: colors.warning },

  // LIST VIEW
  listContainer: { gap: 16 },
  listSection: { gap: 8 },
  listSectionHeader: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  listTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    ...shadow,
  },
  listPriorityDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listTaskInfo: { flex: 1, gap: 4 },
  listTaskTitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },

  // QUICK ADD
  quickAddRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  quickAddInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.foreground,
  },
  addButton: {
    width: 40,
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: colors.primaryForeground, fontSize: 20, fontFamily: fonts.sansBold },

  // MODAL
  modalBackdrop: { flex: 1, backgroundColor: "rgba(45,41,38,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: 20,
    maxHeight: "88%",
  },
  modalTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.foreground, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 12,
    marginBottom: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  chipText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  chipTextSelected: { fontFamily: fonts.sansMedium, color: colors.primary, fontWeight: "600" },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 12,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  dateButtonText: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },
  clearDateButton: { padding: 8 },
  clearDateButtonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive, fontWeight: "600" },
  subtaskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  subtaskCheckRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  subtaskTitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground, flexShrink: 1 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.primaryForeground, fontSize: 11, fontFamily: fonts.sansBold },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.destructive, fontWeight: "600" },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 14, alignItems: "center", marginTop: 12 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 14, fontWeight: "600" },
  deleteButton: { alignItems: "center", padding: 12 },
  deleteButtonText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 13, fontWeight: "600" },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 13 },
});
