import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Platform, SafeAreaView } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
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

const PRIORITY_COLORS: Record<TaskPriority, string> = { low: "#8a8073", medium: "#b3873a", high: "#b3432b" };

function nextPriority(p: TaskPriority): TaskPriority {
  const idx = TASK_PRIORITIES.indexOf(p);
  return TASK_PRIORITIES[(idx + 1) % TASK_PRIORITIES.length];
}

/** Mismo criterio de colores/etiquetas que `dueBadge` en dashboard/src/pages/PlanificadorPage.tsx
 * (líneas 69-82): vencido/hoy en rojo, ≤2 días en ámbar, resto en gris; una tarea ya hecha
 * siempre en gris (ya no importa si "venció"). */
function dueBadge(dueDate: string | null, done: boolean): { label: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysDiff = Math.round((dueDay - todayDay) / 86_400_000);
  const label = daysDiff < 0 ? `Venció ${due.toLocaleDateString("es-ES")}` : daysDiff === 0 ? "Hoy" : due.toLocaleDateString("es-ES");
  if (done) return { label, color: "#b3ab9c" };
  if (daysDiff <= 0) return { label, color: "#b3432b" };
  if (daysDiff <= 2) return { label, color: "#b3873a" };
  return { label, color: "#8a8073" };
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

  const onDuePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDuePicker(false);
    if (event.type !== "set" || !selected || !form) return;
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
                      style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]}
                      onPress={() => handleCyclePriority(task)}
                    />
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, task.status === "done" && styles.taskTitleDone]}>{task.title}</Text>
                      {badge && <Text style={[styles.dueBadge, { color: badge.color }]}>{badge.label}</Text>}
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
          onChange={onDuePickerChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f2" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "700", color: "#3a332c" },
  syncText: { fontSize: 12, color: "#8a8073" },
  errorBanner: { fontSize: 12, color: "#b3432b", paddingHorizontal: 20, paddingBottom: 8 },
  content: { padding: 20, paddingTop: 4, gap: 24, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#8a8073", textTransform: "uppercase", letterSpacing: 0.5 },
  emptyText: { fontSize: 14, color: "#b3ab9c", fontStyle: "italic" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, color: "#3a332c" },
  taskTitleDone: { textDecorationLine: "line-through", color: "#b3ab9c" },
  dueBadge: { fontSize: 11, marginTop: 2 },
  pendingTag: { fontSize: 10, color: "#b3873a" },
  quickAddRow: { flexDirection: "row", gap: 8 },
  quickAddInput: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 15 },
  addButton: { width: 44, backgroundColor: "#5b6b4f", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#faf7f2", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "88%" },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#3a332c", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#ddd4c6", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: "#fff" },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#8a8073", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd4c6" },
  chipSelected: { backgroundColor: "#5b6b4f", borderColor: "#5b6b4f" },
  chipText: { fontSize: 13, color: "#3a332c" },
  chipTextSelected: { color: "#fff" },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  dateButton: { flex: 1, borderWidth: 1, borderColor: "#ddd4c6", borderRadius: 12, padding: 12, backgroundColor: "#fff", alignItems: "center" },
  dateButtonText: { fontSize: 14, color: "#3a332c" },
  clearDateButton: { padding: 8 },
  clearDateButtonText: { fontSize: 13, color: "#b3432b" },
  subtaskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  subtaskCheckRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  subtaskTitle: { fontSize: 14, color: "#3a332c", flexShrink: 1 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: "#c9c0b0", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#5b6b4f", borderColor: "#5b6b4f" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  deleteText: { fontSize: 12, color: "#b3432b" },
  saveButton: { backgroundColor: "#5b6b4f", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  deleteButton: { alignItems: "center", padding: 14 },
  deleteButtonText: { color: "#b3432b", fontSize: 14 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { color: "#8a8073", fontSize: 14 },
});
