import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
// El `SafeAreaView` de "react-native" está deprecado (avisa en cada arranque y, en el emulador,
// su banner de aviso llega a tapar la barra de pestañas) — el de `react-native-safe-area-context`
// (ya en package.json, usado por `App.tsx`) es el reemplazo recomendado, mismo API de props.
import { SafeAreaView } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { useAuth } from "../auth/AuthContext";
import { runSync } from "../sync";
import { listTodayEvents, ParsedEvent } from "../db/eventsRepo";
import { listTasksDueToday, toggleTaskDone } from "../db/tasksRepo";
import { listHabits, isHabitDoneToday, toggleHabitToday } from "../db/habitsRepo";
import { listNotes, createNoteLocal, toggleNoteChecked, deleteNoteLocal } from "../db/notesRepo";
import { EventOccurrence } from "../utils/recurrence";
import { LocalHabit, LocalNote, LocalTask } from "../types";
import { colors, fonts, radius } from "../theme";

const SYNC_INTERVAL_MS = 60_000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function HoyScreen() {
  const { user, logout } = useAuth();
  const { isConnected } = useNetInfo();

  const [events, setEvents] = useState<EventOccurrence<ParsedEvent>[]>([]);
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

  const handleToggleTask = async (id: string) => {
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
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.primary : colors.destructive }]} />
          <Text style={styles.statusText}>{isConnected ? "En línea" : "Sin conexión"}</Text>
        </View>
      </View>

      <View style={styles.syncBar}>
        <Text style={styles.syncText}>
          {syncing ? "Sincronizando…" : lastSyncedAt ? `Última sync: ${formatTime(new Date(lastSyncedAt))}` : "Sin sincronizar aún"}
        </Text>
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
              {events.map((occ) => (
                <View key={`${occ.event.id}-${occ.startTime.toISOString()}`} style={styles.row}>
                  <Text style={styles.rowTime}>{formatTime(occ.startTime)}</Text>
                  <Text style={styles.rowTitle}>{occ.event.title}</Text>
                </View>
              ))}
            </Section>

            <Section title="Tareas de hoy">
              {tasks.length === 0 && <EmptyText text="Sin tareas con vencimiento hoy" />}
              {tasks.map((t) => (
                <Pressable key={t.id} style={styles.row} onPress={() => handleToggleTask(t.id)}>
                  <Checkbox checked={t.status === "done"} />
                  <Text style={[styles.rowTitle, t.status === "done" && styles.rowTitleDone]}>{t.title}</Text>
                  {(t.synced === 0 || t.pendingOp === "update") && <Text style={styles.pendingTag}>pendiente</Text>}
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  syncBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  syncText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  syncButton: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.primary },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 20, paddingBottom: 8 },
  content: { padding: 20, paddingTop: 4, gap: 24 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  rowGrow: { flex: 1 },
  rowTime: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, width: 44 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, flexShrink: 1 },
  rowTitleDone: { textDecorationLine: "line-through", color: colors.mutedForeground },
  pendingTag: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.warning, marginLeft: "auto" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.primaryForeground, fontSize: 13, fontFamily: fonts.sansBold },
  noteInputRow: { flexDirection: "row", gap: 8 },
  noteInput: {
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
  noteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  logoutButton: { alignItems: "center", padding: 14 },
  logoutText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 14 },
});
