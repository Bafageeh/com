import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://com.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);

const screens = [
  { key: 'dashboard', title: 'الملخص', endpoint: 'dashboard', fields: [] },
  { key: 'hetzner-costs', title: 'حسابات Hetzner', endpoint: 'hetzner-costs', fields: [['cost_date', 'التاريخ', 'date'], ['cost_eur', 'التكلفة باليورو', 'number'], ['cost_sar', 'التكلفة بالريال', 'number'], ['notes', 'ملاحظات', 'text']] },
  { key: 'cpanel-server-costs', title: 'سيرفر cPanel', endpoint: 'cpanel-server-costs', fields: [['cost_date', 'التاريخ', 'date'], ['cost_usd', 'التكلفة بالدولار', 'number'], ['cost_sar', 'التكلفة بالريال', 'number'], ['notes', 'ملاحظات', 'text']] },
  { key: 'expenses', title: 'المصروفات', endpoint: 'expenses', fields: [['expense_date', 'التاريخ', 'date'], ['expense_type', 'نوع الصرف', 'text'], ['amount_sar', 'المبلغ بالريال', 'number'], ['notes', 'ملاحظات', 'text']] },
  { key: 'hostings', title: 'الاستضافات', endpoint: 'hostings', fields: [['company_name', 'اسم الشركة', 'text'], ['domain', 'الدومين', 'text'], ['current_space_mb', 'المساحة الحالية MB', 'number'], ['allowed_space_mb', 'المساحة المسموح بها G', 'text'], ['domain_renewal_cost_sar', 'تكلفة تجديد النطاق', 'number'], ['hosting_cost_sar', 'تكلفة الاستضافة', 'number'], ['tax_sar', 'ضريبة', 'number'], ['domain_renewal_date', 'تجديد الدومين', 'date'], ['hosting_renewal_date', 'تجديد الهوست', 'date'], ['notes', 'ملاحظات', 'text']] },
];

function App() {
  const [active, setActive] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const activeScreen = useMemo(() => screens.find((item) => item.key === active) || screens[0], [active]);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const totals = payload?.totals || payload?.summary || {};

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}/${path}`, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'تعذر تنفيذ الطلب');
    return json;
  }

  async function load() {
    setLoading(true);
    try {
      setPayload(await api(activeScreen.endpoint));
    } catch (error) {
      Alert.alert('خطأ', error?.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [active]);

  function blankForm() {
    const next = {};
    activeScreen.fields.forEach(([key, , type]) => {
      next[key] = type === 'date' ? today() : '';
    });
    return next;
  }

  function addRecord() {
    setEditing(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function editRecord(row) {
    const next = blankForm();
    activeScreen.fields.forEach(([key]) => {
      next[key] = row[key] == null ? '' : String(row[key]);
    });
    setEditing(row);
    setForm(next);
    setModalOpen(true);
  }

  async function saveRecord() {
    try {
      const body = { ...form };
      activeScreen.fields.forEach(([key, , type]) => {
        if (type === 'number' && (body[key] === '' || body[key] == null)) body[key] = '0';
      });
      if (editing?.id) {
        await api(`${activeScreen.endpoint}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api(activeScreen.endpoint, { method: 'POST', body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (error) {
      Alert.alert('تعذر الحفظ', error?.message || 'راجع البيانات');
    }
  }

  async function deleteRecord(row) {
    Alert.alert('حذف', 'هل تريد حذف السجل؟', [
      { text: 'إلغاء' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`${activeScreen.endpoint}/${row.id}`, { method: 'DELETE' });
            load();
          } catch (error) {
            Alert.alert('خطأ', error?.message || 'تعذر الحذف');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>COM</Text>
        <Text style={styles.subtitle}>إدارة السيرفر والاستضافات</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {screens.map((screen) => (
          <Pressable key={screen.key} onPress={() => setActive(screen.key)} style={[styles.tab, active === screen.key && styles.activeTab]}>
            <Text style={[styles.tabText, active === screen.key && styles.activeTabText]}>{screen.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{activeScreen.title}</Text>
          <Text style={styles.sectionSubtitle}>{API_BASE_URL}/{activeScreen.endpoint}</Text>
        </View>
        {active === 'dashboard' ? (
          <Pressable style={styles.addButton} onPress={load}><Text style={styles.addText}>تحديث</Text></Pressable>
        ) : (
          <Pressable style={styles.addButton} onPress={addRecord}><Text style={styles.addText}>+ إضافة</Text></Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator /><Text style={styles.loadingText}>جاري التحميل...</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {active === 'dashboard' ? (
            Object.keys(totals).length === 0 ? <Text style={styles.empty}>لا توجد ملخصات بعد</Text> : Object.entries(totals).map(([key, value]) => <MetricCard key={key} label={key} value={String(value ?? 0)} />)
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>لا توجد بيانات بعد</Text>
          ) : (
            rows.map((row) => <RecordCard key={row.id} row={row} onEdit={() => editRecord(row)} onDelete={() => deleteRecord(row)} />)
          )}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? 'تعديل' : 'إضافة'} {activeScreen.title}</Text>
            <ScrollView>
              {activeScreen.fields.map(([key, label, type]) => (
                <View key={key} style={styles.group}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    value={form[key] || ''}
                    onChangeText={(text) => setForm((current) => ({ ...current, [key]: text }))}
                    placeholder={type === 'date' ? 'YYYY-MM-DD' : label}
                    keyboardType={type === 'number' ? 'decimal-pad' : 'default'}
                    style={styles.input}
                    textAlign="right"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable>
              <Pressable onPress={saveRecord} style={styles.primary}><Text style={styles.primaryText}>حفظ</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricCard({ label, value }) {
  return <View style={styles.card}><Text style={styles.cardLabel}>{label}</Text><Text style={styles.cardValue}>{value}</Text></View>;
}

function RecordCard({ row, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      {Object.entries(row).slice(0, 10).map(([key, value]) => (
        <View key={key} style={styles.row}><Text style={styles.rowKey}>{key}</Text><Text style={styles.rowValue}>{String(value ?? '-')}</Text></View>
      ))}
      <View style={styles.actions}>
        <Pressable onPress={onDelete} style={styles.secondary}><Text style={styles.secondaryText}>حذف</Text></Pressable>
        <Pressable onPress={onEdit} style={styles.primary}><Text style={styles.primaryText}>تعديل</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 54 },
  header: { paddingHorizontal: 20, paddingBottom: 12, alignItems: 'flex-end' },
  title: { fontSize: 34, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  tabs: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#e2e8f0' },
  activeTab: { backgroundColor: '#0f172a' },
  tabText: { color: '#334155', fontWeight: '700' },
  activeTabText: { color: '#fff' },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionSubtitle: { fontSize: 11, color: '#64748b', marginTop: 3, textAlign: 'right' },
  addButton: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  addText: { color: '#fff', fontWeight: '900' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#64748b' },
  content: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardLabel: { color: '#64748b', fontSize: 14, textAlign: 'right' },
  cardValue: { color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'right' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  rowKey: { color: '#64748b', fontSize: 12 },
  rowValue: { color: '#0f172a', fontWeight: '700', flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { flex: 1, backgroundColor: '#0f172a', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.35)', justifyContent: 'flex-end' },
  modal: { maxHeight: '86%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 12 },
  group: { marginBottom: 12 },
  label: { textAlign: 'right', color: '#475569', marginBottom: 6, fontWeight: '700' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#0f172a' },
});

registerRootComponent(App);
