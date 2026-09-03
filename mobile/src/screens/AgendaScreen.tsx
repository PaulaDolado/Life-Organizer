import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Switch, Platform } from "react-native";
// Ver el comentario de este mismo import en HoyScreen.tsx: el `SafeAreaView` de "react-native"
// está deprecado, este es el reemplazo recomendado.
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { runSync } from "../sync";
import { listExpandedEvents, createEventLocal, updateEventLocal, deleteEventLocal, ParsedEvent } from "../db/eventsRepo";
import { EventOccurrence } from "../utils/recurrence";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EventType,
  RECURRING_PATTERNS,
  RECURRING_PATTERN_LABELS,
  RecurringPattern,
  REMINDER_PRESETS_MINUTES,
  REMINDER_PRESET_LABELS,
} from "../types";
import { colors, eventTypeStyle, fonts, radius, shadow } from "../theme";

// Etiquetas de día en el mismo criterio "clave UTC" que `todayKey()` usa en el resto de la app
// (ver eventsRepo.ts) — una simplificación deliberada frente al manejo de timezone del backend
// (dateHelpers.ts/safeTimezone), documentada en el plan de esta fase.
const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayOfWeek(date: Date): Date {
  const day = date.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
  return monday;
}

function addDaysUTC(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

interface EventForm {
  id: string | null;
  title: string;
  description: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  location: string;
  isRecurring: boolean;
  recurringPattern: RecurringPattern;
  reminders: Set<number>;
  guestsText: string;
}

function defaultForm(dateKey: string): EventForm {
  const startTime = new Date(`${dateKey}T12:00:00.000Z`);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  return {
    id: null,
    title: "",
    description: "",
    type: "otro",
    startTime,
    endTime,
    location: "",
    isRecurring: false,
    recurringPattern: "weekly",
    reminders: new Set(),
    guestsText: "",
  };
}

function formToOccurrenceEditor(event: ParsedEvent): EventForm {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    type: event.type as EventType,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    location: event.location ?? "",
    isRecurring: event.isRecurring,
    recurringPattern: (event.recurringPattern ?? "weekly") as RecurringPattern,
    reminders: new Set(event.reminderMinutesBefore),
    guestsText: event.guests.join(", "),
  };
}

export function AgendaScreen() {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKeyOf(new Date()));
  const [occurrences, setOccurrences] = useState<EventOccurrence<ParsedEvent>[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<"start-date" | "start-time" | "end-date" | "end-time" | null>(null);

  const reload = useCallback(async () => {
    const rangeStart = weekStart;
    const rangeEnd = addDaysUTC(weekStart, 7);
    const rows = await listExpandedEvents(rangeStart, rangeEnd);
    setOccurrences(rows);
  }, [weekStart]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    const result = await runSync();
    setSyncing(false);
    if (result.success) {
      await reload();
    } else {
      setSyncError(result.error ?? "No se pudo sincronizar");
    }
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
      sync();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekStart])
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i));
  const dayEvents = occurrences
    .filter((occ) => dateKeyOf(occ.startTime) === selectedDateKey)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const goToWeek = (deltaWeeks: number) => setWeekStart((w) => addDaysUTC(w, deltaWeeks * 7));
  const goToToday = () => {
    const today = new Date();
    setWeekStart(mondayOfWeek(today));
    setSelectedDateKey(dateKeyOf(today));
  };

  const openCreate = () => setForm(defaultForm(selectedDateKey));
  const openEdit = (occ: EventOccurrence<ParsedEvent>) => setForm(formToOccurrenceEditor(occ.event));
  const closeForm = () => {
    setForm(null);
    setPicker(null);
  };

  const toggleReminder = (minutes: number) => {
    if (!form) return;
    const next = new Set(form.reminders);
    if (next.has(minutes)) next.delete(minutes);
    else next.add(minutes);
    setForm({ ...form, reminders: next });
  };

  const handleSave = async () => {
    if (!form || !form.title.trim() || form.endTime.getTime() <= form.startTime.getTime()) return;
    setSaving(true);
    const guests = form.guestsText
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const input = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      startTime: form.startTime.toISOString(),
      endTime: form.endTime.toISOString(),
      location: form.location.trim() || null,
      isRecurring: form.isRecurring,
      recurringPattern: form.isRecurring ? form.recurringPattern : null,
      reminderMinutesBefore: Array.from(form.reminders),
      guests,
    };
    if (form.id) {
      await updateEventLocal(form.id, input);
    } else {
      await createEventLocal(input);
    }
    setSaving(false);
    closeForm();
    await reload();
    sync();
  };

  const handleDelete = async () => {
    if (!form?.id) return;
    await deleteEventLocal(form.id);
    closeForm();
    await reload();
    sync();
  };

  const onPickerChange = (field: "startTime" | "endTime", mode: "date" | "time") => (_event: DateTimePickerChangeEvent, selected: Date) => {
    setPicker(null);
    if (!form) return;
    const current = new Date(form[field]);
    if (mode === "date") current.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    else current.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setForm({ ...form, [field]: current });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
        <View style={styles.headerRight}>
          <Text style={styles.syncText}>{syncing ? "Sincronizando…" : ""}</Text>
        </View>
      </View>
      {syncError && <Text style={styles.errorBanner}>{syncError} — se reintentará solo</Text>}

      <View style={styles.weekNav}>
        <Pressable onPress={() => goToWeek(-1)}>
          <Text style={styles.navButton}>‹ Semana</Text>
        </Pressable>
        <Pressable onPress={goToToday}>
          <Text style={styles.navButtonToday}>Hoy</Text>
        </Pressable>
        <Pressable onPress={() => goToWeek(1)}>
          <Text style={styles.navButton}>Semana ›</Text>
        </Pressable>
      </View>

      <View style={styles.weekStrip}>
        {weekDays.map((day) => {
          const key = dateKeyOf(day);
          const selected = key === selectedDateKey;
          return (
            <Pressable key={key} style={[styles.dayChip, selected && styles.dayChipSelected]} onPress={() => setSelectedDateKey(key)}>
              <Text style={[styles.dayChipWeekday, selected && styles.dayChipTextSelected]}>{WEEKDAY_LABELS[day.getUTCDay()]}</Text>
              <Text style={[styles.dayChipNumber, selected && styles.dayChipTextSelected]}>{day.getUTCDate()}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {dayEvents.length === 0 && <Text style={styles.emptyText}>Sin eventos este día</Text>}
        {dayEvents.map((occ) => (
          <Pressable key={`${occ.event.id}-${occ.startTime.toISOString()}`} style={styles.eventCard} onPress={() => openEdit(occ)}>
            <Text style={styles.eventTime}>
              {occ.startTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} –{" "}
              {occ.endTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{occ.event.title}</Text>
              <View style={[styles.eventTypeBadge, { backgroundColor: eventTypeStyle(occ.event.type).bg }]}>
                <Text style={[styles.eventTypeText, { color: eventTypeStyle(occ.event.type).text }]}>
                  {EVENT_TYPE_LABELS[occ.event.type as EventType] ?? occ.event.type}
                </Text>
              </View>
              {occ.event.location ? <Text style={styles.eventLocation}>{occ.event.location}</Text> : null}
            </View>
            {occ.event.isRecurring && <Text style={styles.recurringBadge}>↻</Text>}
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={form !== null} animationType="slide" onRequestClose={closeForm} transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{form?.id ? "Editar evento" : "Nuevo evento"}</Text>

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

              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.chipRow}>
                {EVENT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, form?.type === type && styles.chipSelected]}
                    onPress={() => form && setForm({ ...form, type })}
                  >
                    <Text style={[styles.chipText, form?.type === type && styles.chipTextSelected]}>{EVENT_TYPE_LABELS[type]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Empieza</Text>
              <View style={styles.dateRow}>
                <Pressable style={styles.dateButton} onPress={() => setPicker("start-date")}>
                  <Text style={styles.dateButtonText}>{form?.startTime.toLocaleDateString("es-ES")}</Text>
                </Pressable>
                <Pressable style={styles.dateButton} onPress={() => setPicker("start-time")}>
                  <Text style={styles.dateButtonText}>
                    {form?.startTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Termina</Text>
              <View style={styles.dateRow}>
                <Pressable style={styles.dateButton} onPress={() => setPicker("end-date")}>
                  <Text style={styles.dateButtonText}>{form?.endTime.toLocaleDateString("es-ES")}</Text>
                </Pressable>
                <Pressable style={styles.dateButton} onPress={() => setPicker("end-time")}>
                  <Text style={styles.dateButtonText}>{form?.endTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Ubicación (opcional)"
                value={form?.location ?? ""}
                onChangeText={(t) => form && setForm({ ...form, location: t })}
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Se repite</Text>
                <Switch
                  value={form?.isRecurring ?? false}
                  onValueChange={(v) => {
                    if (form) setForm({ ...form, isRecurring: v });
                  }}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>
              {form?.isRecurring && (
                <View style={styles.chipRow}>
                  {RECURRING_PATTERNS.map((pattern) => (
                    <Pressable
                      key={pattern}
                      style={[styles.chip, form.recurringPattern === pattern && styles.chipSelected]}
                      onPress={() => setForm({ ...form, recurringPattern: pattern })}
                    >
                      <Text style={[styles.chipText, form.recurringPattern === pattern && styles.chipTextSelected]}>
                        {RECURRING_PATTERN_LABELS[pattern]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Avisos</Text>
              <View style={styles.chipRow}>
                {REMINDER_PRESETS_MINUTES.map((minutes) => (
                  <Pressable
                    key={minutes}
                    style={[styles.chip, form?.reminders.has(minutes) && styles.chipSelected]}
                    onPress={() => toggleReminder(minutes)}
                  >
                    <Text style={[styles.chipText, form?.reminders.has(minutes) && styles.chipTextSelected]}>
                      {REMINDER_PRESET_LABELS[minutes]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Invitados, separados por coma"
                value={form?.guestsText ?? ""}
                onChangeText={(t) => form && setForm({ ...form, guestsText: t })}
              />

              <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Guardar"}</Text>
              </Pressable>
              {form?.id && (
                <Pressable style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>Borrar evento</Text>
                </Pressable>
              )}
              <Pressable style={styles.cancelButton} onPress={closeForm}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {form && picker === "start-date" && (
        <DateTimePicker
          value={form.startTime}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onValueChange={onPickerChange("startTime", "date")}
          onDismiss={() => setPicker(null)}
        />
      )}
      {form && picker === "start-time" && (
        <DateTimePicker
          value={form.startTime}
          mode="time"
          display="default"
          onValueChange={onPickerChange("startTime", "time")}
          onDismiss={() => setPicker(null)}
        />
      )}
      {form && picker === "end-date" && (
        <DateTimePicker
          value={form.endTime}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onValueChange={onPickerChange("endTime", "date")}
          onDismiss={() => setPicker(null)}
        />
      )}
      {form && picker === "end-time" && (
        <DateTimePicker
          value={form.endTime}
          mode="time"
          display="default"
          onValueChange={onPickerChange("endTime", "time")}
          onDismiss={() => setPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  syncText: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive, paddingHorizontal: 20, paddingBottom: 8 },
  weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  navButton: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  navButtonToday: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary },
  weekStrip: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  dayChip: { alignItems: "center", padding: 8, borderRadius: radius.input, width: 42 },
  dayChipSelected: { backgroundColor: colors.primary },
  dayChipWeekday: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  dayChipNumber: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground, marginTop: 2 },
  dayChipTextSelected: { color: colors.primaryForeground },
  list: { padding: 20, paddingTop: 8, gap: 10 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...shadow,
  },
  eventTime: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, width: 76 },
  eventInfo: { flex: 1, gap: 4 },
  eventTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.foreground },
  eventTypeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  eventTypeText: { fontFamily: fonts.sansMedium, fontSize: 11 },
  eventLocation: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  recurringBadge: { fontSize: 16, color: colors.primary },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  fabText: { color: colors.primaryForeground, fontSize: 28, fontFamily: fonts.sansBold, marginTop: -2 },
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
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
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
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 15, alignItems: "center", marginTop: 8 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  deleteButton: { alignItems: "center", padding: 14 },
  deleteButtonText: { fontFamily: fonts.sansMedium, color: colors.destructive, fontSize: 14 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 14 },
});
