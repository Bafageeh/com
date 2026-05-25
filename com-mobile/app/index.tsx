import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://com.pm.sa/api';

const screens = [
  { key: 'dashboard', title: 'الملخص', endpoint: 'dashboard' },
  { key: 'hetzner-costs', title: 'حسابات Hetzner', endpoint: 'hetzner-costs' },
  { key: 'cpanel-server-costs', title: 'سيرفر cPanel', endpoint: 'cpanel-server-costs' },
  { key: 'expenses', title: 'المصروفات', endpoint: 'expenses' },
  { key: 'hostings', title: 'الاستضافات', endpoint: 'hostings' },
];

export default function HomeScreen() {
  const [active, setActive] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<any>(null);

  const activeScreen = screens.find((item) => item.key === active) || screens[0];

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${activeScreen.endpoint}`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      setPayload(json);
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [active]);

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const totals = payload?.totals || payload?.summary || {};

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>COM</Text>
        <Text style={styles.subtitle}>إدارة السيرفر والاستضافات</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {screens.map((screen) => (
          <Pressable
            key={screen.key}
            style={[styles.tab, active === screen.key && styles.activeTab]}
            onPress={() => setActive(screen.key)}
          >
            <Text style={[styles.tabText, active === screen.key && styles.activeTabText]}>
              {screen.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{activeScreen.title}</Text>
          <Text style={styles.sectionSubtitle}>{API_BASE_URL}/{activeScreen.endpoint}</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={load}>
          <Text style={styles.refreshText}>تحديث</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {active === 'dashboard' ? (
            Object.keys(totals).length === 0 ? (
              <Text style={styles.empty}>لا توجد ملخصات بعد</Text>
            ) : (
              Object.entries(totals).map(([key, value]) => (
                <View key={key} style={styles.card}>
                  <Text style={styles.cardLabel}>{key}</Text>
                  <Text style={styles.cardValue}>{String(value)}</Text>
                </View>
              ))
            )
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>لا توجد بيانات بعد</Text>
          ) : (
            rows.map((row: any) => (
              <View key={row.id} style={styles.card}>
                {Object.entries(row).slice(0, 8).map(([key, value]) => (
                  <View key={key} style={styles.row}>
                    <Text style={styles.rowKey}>{key}</Text>
                    <Text style={styles.rowValue}>{String(value ?? '-')}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionSubtitle: { fontSize: 11, color: '#64748b', marginTop: 3, textAlign: 'right' },
  refreshButton: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  refreshText: { color: '#fff', fontWeight: '900' },
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
});
