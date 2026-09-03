import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import {
  createTransaction,
  deleteTransaction,
  FinanceAnalytics,
  getAnalytics,
  getMonthlyBalance,
  listSavingsGoals,
  listTransactions,
  MonthlyBalance,
  NewTransactionInput,
  Transaction,
  TransactionType,
} from "../api/finance";
import { colors, fonts, radius, shadow } from "../theme";
import { useSidebar, SIDEBAR_CLIP_CLEARANCE } from "../navigation/SidebarContext";

// Puerto directo de dashboard/src/pages/FinanzasPage.tsx — mismos datos (balance del mes,
// movimientos, análisis, resumen de metas de ahorro). No pasa por SQLite: ver el comentario de
// src/api/finance.ts para el porqué. Simplificaciones deliberadas frente a la web: sin
// exportación CSV (descargar/compartir ficheros añade permisos y UI que no compensan para una
// función secundaria) y sin el panel "Resumen del mes" duplicado (las tarjetas ya lo cubren en
// una pantalla de una sola columna) — ver mobile/README.md.

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(amount);
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function FinanzasScreen() {
  const { collapsed } = useSidebar();
  const [balance, setBalance] = useState<MonthlyBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<FinanceAnalytics | null>(null);
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const [bal, txs, stats, savingsGoals] = await Promise.all([
        getMonthlyBalance(now.getMonth() + 1, now.getFullYear()),
        listTransactions(15),
        getAnalytics(),
        listSavingsGoals("all"),
      ]);
      setBalance(bal);
      setTransactions(txs);
      setAnalytics(stats);
      setSavingsTotal(savingsGoals.filter((g) => g.type === "ahorro").reduce((sum, g) => sum + g.currentAmount, 0));
      setInvestmentTotal(savingsGoals.filter((g) => g.type === "inversion").reduce((sum, g) => sum + g.currentAmount, 0));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las finanzas");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleCreate = async (input: NewTransactionInput) => {
    await createTransaction(input);
    setShowCreate(false);
    await reload();
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    await reload();
  };

  const maxTrend = Math.max(1, ...(analytics?.monthlyTrend.map((m) => Math.max(Math.abs(m.income), Math.abs(m.expense))) ?? [1]));

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, collapsed && { paddingLeft: SIDEBAR_CLIP_CLEARANCE }]}>
        <Text style={styles.title}>Finanzas</Text>
        <Pressable style={styles.newButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.newButtonText}>+ Nuevo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.errorBanner}>{error}</Text>}
        {loading && !balance ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard label="Ingresos" value={formatMoney(balance?.income ?? 0)} color={colors.positive} />
              <SummaryCard label="Gastos" value={formatMoney(balance?.expense ?? 0)} color={colors.destructive} />
              <SummaryCard
                label="Balance"
                value={formatMoney(balance?.balance ?? 0)}
                color={(balance?.balance ?? 0) >= 0 ? colors.positive : colors.destructive}
              />
              <SummaryCard label="Ahorro" value={formatMoney(savingsTotal)} color={colors.habit} />
              <SummaryCard label="Inversión" value={formatMoney(investmentTotal)} color={colors.hobby} />
            </View>

            {analytics && analytics.monthlyTrend.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Tendencia (últimos {analytics.monthlyTrend.length} meses)</Text>
                <View style={styles.trendRow}>
                  {analytics.monthlyTrend.map((m) => {
                    const positive = m.balance >= 0;
                    const height = Math.max(4, (Math.abs(m.balance) / maxTrend) * 60);
                    return (
                      <View key={`${m.year}-${m.month}`} style={styles.trendBarWrap}>
                        <View style={styles.trendBarTrack}>
                          <View
                            style={[
                              styles.trendBar,
                              { height, backgroundColor: positive ? colors.positive : colors.destructive },
                            ]}
                          />
                        </View>
                        <Text style={styles.trendLabel}>{MONTH_LABELS[m.month - 1]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {analytics && analytics.topCategories.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top categorías de gasto (este mes)</Text>
                <View style={{ gap: 8 }}>
                  {analytics.topCategories.map((c) => (
                    <View key={c.category} style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{c.category}</Text>
                      <Text style={styles.categoryAmount}>{formatMoney(c.total)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {analytics && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Proyección anual</Text>
                <Text style={styles.projectionText}>
                  Con el ritmo de los últimos {analytics.projectedAnnual.basedOnMonths} meses (balance medio{" "}
                  {formatMoney(analytics.projectedAnnual.avgMonthlyBalance)}/mes), acabarías el año con un balance proyectado de{" "}
                  <Text style={{ fontFamily: fonts.sansBold }}>{formatMoney(analytics.projectedAnnual.projectedYearEnd)}</Text>.
                </Text>
              </View>
            )}

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Movimientos recientes</Text>
              {transactions.length === 0 ? (
                <Text style={styles.emptyText}>Sin movimientos todavía.</Text>
              ) : (
                transactions.map((t) => (
                  <View key={t.id} style={styles.transactionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transactionTitle}>{t.description || t.category}</Text>
                      <Text style={styles.transactionMeta}>
                        {t.category} · {new Date(t.date).toLocaleDateString("es-ES")}
                      </Text>
                    </View>
                    <Text style={[styles.transactionAmount, { color: t.type === "income" ? colors.positive : colors.destructive }]}>
                      {t.type === "income" ? "+" : "-"}
                      {formatMoney(t.amount)}
                    </Text>
                    <Pressable onPress={() => handleDelete(t.id)}>
                      <Text style={styles.deleteText}>Borrar</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <NewMovementForm onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function NewMovementForm({ onSubmit, onCancel }: { onSubmit: (input: NewTransactionInput) => Promise<void>; onCancel: () => void }) {
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<TransactionType>("expense");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!concept.trim() || !n || !category.trim()) return;
    setSaving(true);
    await onSubmit({ type: kind, amount: Math.abs(n), category: category.trim(), description: concept.trim() });
    setSaving(false);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.modalTitle}>Nuevo movimiento</Text>

      <View style={styles.chipRow}>
        {(["expense", "income"] as TransactionType[]).map((k) => (
          <Pressable key={k} style={[styles.chip, kind === k && styles.chipSelected]} onPress={() => setKind(k)}>
            <Text style={[styles.chipText, kind === k && styles.chipTextSelected]}>{k === "income" ? "Ingreso" : "Gasto"}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Concepto" value={concept} onChangeText={setConcept} />
      <TextInput style={styles.input} placeholder="Importe" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Categoría" value={category} onChangeText={setCategory} />

      <Pressable style={styles.saveButton} onPress={submit} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Guardar movimiento"}</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.foreground },
  newButton: { backgroundColor: colors.foreground, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  newButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 16, paddingBottom: 40 },
  errorBanner: { fontFamily: fonts.sans, fontSize: 12, color: colors.destructive },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },

  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    flexBasis: "31%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
    ...shadow,
  },
  summaryLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.mutedForeground,
  },
  summaryValue: { fontFamily: fonts.serif, fontSize: 18 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...shadow,
  },
  cardTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.mutedForeground,
  },
  trendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 90 },
  trendBarWrap: { alignItems: "center", gap: 6, flex: 1 },
  trendBarTrack: { height: 64, justifyContent: "flex-end" },
  trendBar: { width: 18, borderRadius: 4 },
  trendLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.mutedForeground },

  categoryRow: { flexDirection: "row", justifyContent: "space-between" },
  categoryName: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground, textTransform: "capitalize" },
  categoryAmount: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.destructive },

  projectionText: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, lineHeight: 19 },

  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  transactionTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  transactionMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, textTransform: "capitalize" },
  transactionAmount: { fontFamily: fonts.sansBold, fontSize: 14 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },

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
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: 15, alignItems: "center", marginTop: 8 },
  saveButtonText: { fontFamily: fonts.sansMedium, color: colors.primaryForeground, fontSize: 15 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelButtonText: { fontFamily: fonts.sans, color: colors.mutedForeground, fontSize: 14 },
});
