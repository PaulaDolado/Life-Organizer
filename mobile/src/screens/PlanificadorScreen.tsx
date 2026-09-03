import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Platform } from "react-native";
// Ver el comentario de este mismo import en HoyScreen.tsx: el `SafeAreaView` de "react-native"
// está deprecado, este es el reemplazo recomendado.
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { runSync } from "../sync";
import {
  listAllTasks,
  createTaskLocal,
  updateTaskLocal,
  moveTask,
  deleteTaskLocal,
  parseTaskTags,
} from "../db/tasksRepo";
import { listForTask, createSubtaskLocal, toggleSubtask, deleteSubtaskLocal } from "../db/subtasksRepo";
import { LocalSubtask, LocalTask, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, TaskPriority, TaskStatus } from "../types";
import { colors, dueDateStyle, fonts, priorityStyle, radius, shadow } from "../theme";

function nextPriority(p: TaskPriority): TaskPriority {
  const idx = TASK_PRIORITIES.indexOf(p);
  return TASK_PRIORITIES[(idx + 1) % TASK_PRIORITIES.length];
}

/** Mismo criterio que `dueBadge` en dashboard/src/pages/PlanificadorPage.tsx (líneas 69-82):
 * vencido/hoy en destructive, ≤2 días en warning, resto en muted; una tarea ya hecha siempre en
 * muted (ya no importa si "venció"). Los colores exactos vienen de `dueDateStyle` (src/theme.ts). */
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
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [drafts, setDrafts] = useState<Record<TaskStatus, string>>({ todo: "", in_progress: "", done: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm | null>(null);
  const [subtasks, setSubtasks] = useState<LocalSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [showDuePicker, setShowDuePicker] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Planificador</Text>
        <Text style={styles.syncText}>{syncing ? "Sincronizando…" : ""}</Text>
      </View>
      {syncError && <Text style={styles.errorBanner}>{syncError} — se reintentará solo</Text>}

      <ScrollView contentContainerStyle={styles.content}>
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <View key={status} style={styles.section}>
              <Text style={styles.sectionTitle}>{TASK_STATUS_LABELS[status]}</Text>

              {columnTasks.length === 0 && <Text style={styles.emptyText}>Sin tareas</Text>}
              {columnTasks.map((task) => {
                const badge = dueBadge(task.dueDate, task.status === "done");
                return (
                  <Pressable key={task.id} style={styles.taskRow} onPress={() => openTask(task)}>
                    <Pressable
                      style={[styles.priorityDot, { backgroundColor: priorityStyle(task.priority).text }]}
                      onPress={() => handleCyclePriority(task)}
                    />
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, task.status === "done" && styles.taskTitleDone]}>{task.title}</Text>
                      {badge && (
                        <View style={[styles.dueBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.dueBadgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    {(task.synced === 0 || task.pendingOp === "update") && <Text style={styles.pendingTag}>pendiente</Text>}
                  </Pressable>
                );
              })}

              <View style={styles.quickAddRow}>
                <TextInput
                  style={styles.quickAddInput}
                  placeholder="Nueva tarea…"
                  value={drafts[status]}
                  onChangeText={(t) => setDrafts({ ...drafts, [status]: t })}
                  onSubmitEditing={() => handleQuickAdd(status)}
                />
                <Pressable style={styles.addButton} onPress={() => handleQuickAdd(status)}>
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

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
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Descripción (opcional)"
                value={form?.description ?? ""}
                onChangeText={(t) => form && setForm({ ...form, description: t })}
                multiline
              />

              <Text style={styles.fieldLabel}>Estado</Text>
              <View style={styles.chipRow}>
                {TASK_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.chip, form?.status === status && styles.chipSelected]}
                    onPress={() => handleMoveStatus(status)}
                  >
                    <Text style={[styles.chipText, form?.status === status && styles.chipTextSelected]}>{TASK_STATUS_LABELS[status]}</Text>
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
                    <Text style={[styles.chipText, form?.priority === priority && styles.chipTextSelected]}>{TASK_PRIORITY_LABELS[priority]}</Text>
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
          onValueChange={onDuePickerChange}
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
  syncText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 20, paddingBottom: 8 },
  content: { padding: 20, paddingTop: 4, gap: 24, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadow,
  },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  taskInfo: { flex: 1, gap: 4 },
  taskTitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.foreground },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.mutedForeground },
  dueBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  dueBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11 },
  pendingTag: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.warning },
  quickAddRow: { flexDirection: "row", gap: 8 },
  quickAddInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  addButton: { width: 44, backgroundColor: colors.primary, borderRadius: radius.input, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: colors.primaryForeground, fontSize: 20, fontFamily: fonts.sansBold },
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
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    padding: 12,
    marginBottom: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
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
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    padding: 12,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  dateButtonText: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground },
  clearDateButton: { padding: 8 },
  clearDateButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.destructive },
  subtaskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  subtaskCheckRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  subtaskTitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground, flexShrink: 1 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.primaryForeground, fontSize: 12, fontFamily: fonts.sansBold },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 15, alignItems: "center", marginTop: 12 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  deleteButton: { alignItems: "center", padding: 14 },
  deleteButtonText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 14 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 14 },
});
