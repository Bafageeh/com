#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${COM_MOBILE_DIR:-/home/pmsa/apps/com/com-mobile}"
if [ ! -d "$APP_DIR" ]; then APP_DIR="/mnt/home-storage/home/pmsa/apps/com/com-mobile"; fi
cd "$APP_DIR"
cat > package.json <<'JSON'
{
  "name": "com-mobile",
  "main": "App.js",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~55.0.0",
    "expo-status-bar": "~2.3.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-web": "^0.21.0"
  },
  "devDependencies": {}
}
JSON
cat > .env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=https://com.pm.sa/api
EOF
cat > App.js <<'JS'
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://com.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);

const sections = [
  { key: 'dashboard', title: 'الملخص', endpoint: 'dashboard', fields: [] },
  { key: 'hetzner-costs', title: 'حسابات Hetzner', endpoint: 'hetzner-costs', fields: [['cost_date','التاريخ','date'],['cost_eur','التكلفة باليورو','number'],['cost_sar','التكلفة بالريال','number'],['notes','ملاحظات','text']] },
  { key: 'cpanel-server-costs', title: 'سيرفر cPanel', endpoint: 'cpanel-server-costs', fields: [['cost_date','التاريخ','date'],['cost_usd','التكلفة بالدولار','number'],['cost_sar','التكلفة بالريال','number'],['notes','ملاحظات','text']] },
  { key: 'expenses', title: 'المصروفات', endpoint: 'expenses', fields: [['expense_date','التاريخ','date'],['expense_type','نوع الصرف','text'],['amount_sar','المبلغ بالريال','number'],['notes','ملاحظات','text']] },
  { key: 'hostings', title: 'الاستضافات', endpoint: 'hostings', fields: [['company_name','اسم الشركة','text'],['domain','الدومين','text'],['current_space_mb','المساحة الحالية MB','number'],['allowed_space_mb','المساحة المسموح بها MB','number'],['domain_renewal_cost_sar','تكلفة تجديد النطاق','number'],['hosting_cost_sar','تكلفة الاستضافة','number'],['record_date','التاريخ','date'],['tax_sar','الضريبة','number'],['hosting_renewal_date','تاريخ تجديد الهوست','date'],['domain_renewal_date','تاريخ تجديد الدومين','date'],['notes','ملاحظات','text']] },
];

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const section = sections.find((item) => item.key === active) || sections[0];
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const totals = payload?.totals || payload?.summary || {};

  useEffect(() => { load(); }, [active]);

  async function call(path, options = {}) {
    const response = await fetch(`${API}/${path}`, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...options });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || 'تعذر تنفيذ الطلب');
    return json;
  }

  async function load() {
    setLoading(true);
    try { setPayload(await call(section.endpoint)); }
    catch (error) { Alert.alert('خطأ', error.message || 'تعذر تحميل البيانات'); }
    finally { setLoading(false); }
  }

  function emptyForm() {
    const next = {};
    section.fields.forEach(([key,, type]) => { next[key] = type === 'date' ? today() : ''; });
    return next;
  }

  function add() { setEditing(null); setForm(emptyForm()); setModal(true); }
  function edit(row) {
    const next = emptyForm();
    section.fields.forEach(([key]) => { next[key] = row[key] == null ? '' : String(row[key]); });
    setEditing(row); setForm(next); setModal(true);
  }

  async function save() {
    try {
      const body = { ...form };
      section.fields.forEach(([key,, type]) => { if (type === 'number' && !body[key]) body[key] = '0'; });
      if (editing?.id) await call(`${section.endpoint}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await call(section.endpoint, { method: 'POST', body: JSON.stringify(body) });
      setModal(false); load();
    } catch (error) { Alert.alert('تعذر الحفظ', error.message || 'راجع البيانات'); }
  }

  function remove(row) {
    Alert.alert('حذف', 'هل تريد حذف السجل؟', [
      { text: 'إلغاء' },
      { text: 'حذف', style: 'destructive', onPress: async () => { await call(`${section.endpoint}/${row.id}`, { method: 'DELETE' }); load(); } },
    ]);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.title}>COM</Text><Text style={styles.subtitle}>إدارة السيرفر والاستضافات</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{sections.map((item) => <Pressable key={item.key} onPress={() => setActive(item.key)} style={[styles.tab, active === item.key && styles.activeTab]}><Text style={[styles.tabText, active === item.key && styles.activeTabText]}>{item.title}</Text></Pressable>)}</ScrollView>
      <View style={styles.bar}><View><Text style={styles.heading}>{section.title}</Text><Text style={styles.url}>{API}/{section.endpoint}</Text></View>{active === 'dashboard' ? <Button label="تحديث" onPress={load} /> : <Button label="+ إضافة" onPress={add} />}</View>
      {loading ? <View style={styles.loading}><ActivityIndicator /><Text>جاري التحميل...</Text></View> : <ScrollView contentContainerStyle={styles.content}>{active === 'dashboard' ? Object.entries(totals).map(([key, value]) => <Card key={key} label={key} value={value} />) : rows.length ? rows.map((row) => <View key={row.id} style={styles.card}>{Object.entries(row).slice(0, 8).map(([key, value]) => <View key={key} style={styles.row}><Text style={styles.key}>{key}</Text><Text style={styles.value}>{String(value ?? '-')}</Text></View>)}<View style={styles.actions}><Pressable onPress={() => remove(row)} style={styles.secondary}><Text style={styles.secondaryText}>حذف</Text></Pressable><Pressable onPress={() => edit(row)} style={styles.primary}><Text style={styles.primaryText}>تعديل</Text></Pressable></View></View>) : <Text style={styles.empty}>لا توجد بيانات بعد</Text>}</ScrollView>}
      <Modal visible={modal} transparent animationType="slide"><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>{editing ? 'تعديل' : 'إضافة'} {section.title}</Text><ScrollView>{section.fields.map(([key, label, type]) => <View key={key} style={styles.group}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={form[key] || ''} onChangeText={(text) => setForm((current) => ({ ...current, [key]: text }))} keyboardType={type === 'number' ? 'decimal-pad' : 'default'} placeholder={type === 'date' ? 'YYYY-MM-DD' : label} textAlign="right" /></View>)}</ScrollView><View style={styles.actions}><Pressable onPress={() => setModal(false)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable onPress={save} style={styles.primary}><Text style={styles.primaryText}>حفظ</Text></Pressable></View></View></View></Modal>
    </View>
  );
}

function Button({ label, onPress }) { return <Pressable onPress={onPress} style={styles.add}><Text style={styles.addText}>{label}</Text></Pressable>; }
function Card({ label, value }) { return <View style={styles.card}><Text style={styles.key}>{label}</Text><Text style={styles.big}>{String(value ?? 0)}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 54 }, header: { paddingHorizontal: 20, paddingBottom: 12, alignItems: 'flex-end' }, title: { fontSize: 34, fontWeight: '900', color: '#0f172a' }, subtitle: { color: '#64748b' }, tabs: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 }, tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#e2e8f0' }, activeTab: { backgroundColor: '#0f172a' }, tabText: { color: '#334155', fontWeight: '700' }, activeTabText: { color: '#fff' }, bar: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heading: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' }, url: { fontSize: 10, color: '#64748b', textAlign: 'right' }, add: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }, addText: { color: '#fff', fontWeight: '900' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 16, gap: 12 }, empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 }, card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 }, key: { color: '#64748b', fontSize: 12 }, value: { color: '#0f172a', fontWeight: '700', flex: 1, textAlign: 'right' }, big: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 14 }, primary: { flex: 1, backgroundColor: '#0f172a', paddingVertical: 12, borderRadius: 15, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '900' }, secondary: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 12, borderRadius: 15, alignItems: 'center' }, secondaryText: { color: '#0f172a', fontWeight: '900' }, backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.35)', justifyContent: 'flex-end' }, modal: { maxHeight: '86%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18 }, modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 12 }, group: { marginBottom: 12 }, label: { textAlign: 'right', color: '#475569', marginBottom: 6, fontWeight: '700' }, input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#0f172a' }
});
JS
rm -rf app .expo node_modules package-lock.json
npm install
chown -R pmsa:pmsa "$APP_DIR" || true
echo "COM mobile converted to plain App.js"
