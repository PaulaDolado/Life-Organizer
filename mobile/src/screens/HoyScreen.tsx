import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, SafeAreaView } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useAuth } from "../auth/AuthContext";
import { runSync } from "../sync";
import { listTodayEvents } from "../db/eventsRepo";
import { listTasksDueToday, toggleTaskDone } from "../db/tasksRepo";
import { listHabits, isHabitDoneToday, toggleHabitToday } from "../db/habitsRepo";
import { listNotes, createNoteLocal, toggleNoteChecked, deleteNoteLocal } from "../db/notesRepo";
import { LocalEvent, LocalHabit, LocalNote, LocalTask } from "../types";

const SYNC_INTERVAL_MS = 60_000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function HoyScreen() {
  const { user, logout } = useAuth();
  const { isConnected } = useNetInfo();

  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [habits, setHabits] = useState<(LocalHabit & { done: boolean })[]>([]);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextEvents, nextTasks, nextHabits, nextNotes] = await Promise.all([
      listTodayEvents(),
      listTasksDueToday(),
      listHabits(),
      listNotes(),
    ]);
    const habitsWithDone = await Promise.all(nextHabits.map(async (h) => ({ ...h, done: await isHabitDoneToday(h.id) })));
    setEvents(nextEvents);
    setTasks(nextTasks);
    setHabits(habitsWithDone);
    setNotes(nextNotes);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    const result = await runSync();
    setSyncing(false);
    if (result.success) {
      setLastSyncedAt(result.at);
      await reload();
    } else {
      setSyncError(result.error ?? "No se pudo sincronizar");
    }
  }, [reload]);

  // Carga inicial desde SQLite (instantánea, sin esperar red) y un primer intento de sync.
  useEffect(() => {
    reload();
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reintenta al recuperar conexión, y de fondo cada minuto mientras la pantalla está abierta.
  const wasConnected = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !wasConnected.current) sync();
    wasConnected.current = isConnected;
  }, [isConnected, sync]);

  useEffect(() => {
    const id = setInterval(() => {
      if (isConnected) sync();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, sync]);

  const handleToggleTask = async (id: number) => {
    await toggleTaskDone(id);
    await reload();
    sync();
  };

  const handleToggleHabit = async (id: number) => {
    await toggleHabitToday(id);
    await reload();
    sync();
  };

  const handleToggleNote = async (id: string) => {
    await toggleNoteChecked(id);
    await reload();
    sync();
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNoteLocal(id);
    await reload();
    sync();
  };

  const handleAddNote = async () => {
    const content = noteDraft.trim();
    if (!content) return;
    setNoteDraft("");
    await createNoteLocal(content);
    await reload();
    sync();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hoy</Text>
          <Text style={styles.subtitle}>{user?.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? "#5b6b4f" : "#b3432b" }]} />
          <Text style={styles.statusText}>{isConnected ? "En línea" : "Sin conexión"}</Text>
        </View>
      </View>

      <View style={styles.syncBar}>
        <Text style={styles.syncText}>{syncing ? "Sincronizando…" : lastSyncedAt ? `Última sync: ${formatTime(lastSyncedAt)}` : "Sin sincronizar aún"}</Text>
        <Pressable onPress={sync} disabled={syncing}>
          {syncing ? <ActivityIndicator size="small" /> : <Text style={styles.syncButton}>Sincronizar</Text>}
        </Pressable>
      </View>
      {syncError && <Text style={styles.errorBanner}>{syncError} — se reintentará solo</Text>}

      <FlatList
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <View style={styles.content}>
            <Section title="Eventos de hoy">
              {events.length === 0 && <EmptyText text="Sin eventos hoy" />}
              {events.map((e) => (
                <View key={e.id} style={styles.row}>
                  <Text style={styles.rowTime}>{formatTime(e.startTime)}</Text>
                  <Text style={styles.rowTitle}>{e.title}</Text>
                </View>
              ))}
            </Section>

            <Section title="Tareas de hoy">
              {tasks.length === 0 && <EmptyText text="Sin tareas con vencimiento hoy" />}
              {tasks.map((t) => (
                <Pressable key={t.id} style={styles.row} onPress={() => handleToggleTask(t.id)}>
                  <Checkbox checked={t.status === "done"} />
                  <Text style={[styles.rowTitle, t.status === "done" && styles.rowTitleDone]}>{t.title}</Text>
                  {t.dirty === 1 && <Text style={styles.pendingTag}>pendiente</Text>}
                </Pressable>
              ))}
            </Section>

            <Section title="Hábitos">
              {habits.length === 0 && <EmptyText text="Sin hábitos activos" />}
              {habits.map((h) => (
                <Pressable key={h.id} style={styles.row} onPress={() => handleToggleHabit(h.id)}>
                  <Checkbox checked={h.done} />
                  <Text style={styles.rowTitle}>{h.title}</Text>
                </Pressable>
              ))}
            </Section>

            <Section title="Notas rápidas">
              <View style={styles.noteInputRow}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Nueva nota…"
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  onSubmitEditing={handleAddNote}
                />
                <Pressable style={styles.addButton} onPress={handleAddNote}>
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>
              {notes.length === 0 && <EmptyText text="Sin notas" />}
              {notes.map((n) => (
                <View key={n.id} style={styles.row}>
                  <Pressable style={styles.rowGrow} onPress={() => handleToggleNote(n.id)}>
                    <View style={styles.noteRow}>
                      <Checkbox checked={n.checked === 1} />
                      <Text style={[styles.rowTitle, n.checked === 1 && styles.rowTitleDone]}>{n.content}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteNote(n.id)}>
                    <Text style={styles.deleteText}>Borrar</Text>
                  </Pressable>
                </View>
              ))}
            </Section>

            <Pressable style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function Checkbox({ checked }: { checked: boolean }) {
  return <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkboxMark}>✓</Text>}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f2" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "700", color: "#3a332c" },
  subtitle: { fontSize: 13, color: "#8a8073" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: "#8a8073" },
  syncBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  syncText: { fontSize: 12, color: "#8a8073" },
  syncButton: { fontSize: 12, color: "#5b6b4f", fontWeight: "600" },
  errorBanner: { fontSize: 12, color: "#b3432b", paddingHorizontal: 20, paddingBottom: 8 },
  content: { padding: 20, paddingTop: 4, gap: 24 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#8a8073", textTransform: "uppercase", letterSpacing: 0.5 },
  emptyText: { fontSize: 14, color: "#b3ab9c", fontStyle: "italic" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  rowGrow: { flex: 1 },
  rowTime: { fontSize: 13, color: "#8a8073", width: 44 },
  rowTitle: { fontSize: 15, color: "#3a332c", flexShrink: 1 },
  rowTitleDone: { textDecorationLine: "line-through", color: "#b3ab9c" },
  pendingTag: { fontSize: 10, color: "#b3873a", marginLeft: "auto" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#c9c0b0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#5b6b4f", borderColor: "#5b6b4f" },
  checkboxMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  noteInputRow: { flexDirection: "row", gap: 8 },
  noteInput: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 15 },
  addButton: { width: 44, backgroundColor: "#5b6b4f", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteText: { fontSize: 12, color: "#b3432b" },
  logoutButton: { alignItems: "center", padding: 14 },
  logoutText: { color: "#b3432b", fontSize: 14 },
});
