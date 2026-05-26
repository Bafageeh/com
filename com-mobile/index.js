import React, { useEffect, useMemo, useState } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL = 'http://com.pm.sa/api';

function toNumber(value) {
  if (value === null || value === undefined) return 0;

  let text = String(value).trim();

  if (!text || text === '-' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') {
    return 0;
  }

  text = text
    .replace(/,/g, '')
    .replace(/SAR/gi, '')
    .replace(/ريال/g, '')
    .replace(/\s+/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^0-9.\-]/g, '');

  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

function pickNumber(item, keys) {
  for (const key of keys) {
    if (item && Object.prototype.hasOwnProperty.call(item, key)) {
      const n = toNumber(item[key]);
      if (n !== 0) return n;
    }
  }

  return 0;
}

function annualExpenseAmount(item) {
  const amount = toNumber(item?.amount_sar);
  const cycle = String(item?.billing_cycle || 'yearly').toLowerCase();
  const isMonthly = cycle === 'monthly' || cycle === 'شهري';
  return isMonthly ? amount * 12 : amount;
}

function money(value) {
  const n = toNumber(value);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatNumber(value) {
  const n = toNumber(value);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}


const DEFAULT_CATEGORIES = [
  'Hetzner',
  'cpanel',
  'السجل',
  'الغرفة التجارية',
  'الزكاه والدخل',
  'التأكيد السنوي',
  'تجديد النطاقات',
];

const emptyHostingForm = {
  company_name: '',
  domain: '',
  current_space_mb: '',
  allowed_space_mb: '',
  domain_renewal_cost_sar: '',
  hosting_cost_sar: '',
  tax_sar: '',
  domain_renewal_date: '',
  hosting_renewal_date: '',
  notes: '',
};

const emptyExpenseForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  expense_type: 'Hetzner',
  amount_sar: '',
  billing_cycle: 'yearly',
  notes: '',
};

function App() {
  const [active, setActive] = useState('expenses');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [hostings, setHostings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const [hostingModal, setHostingModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [dropdown, setDropdown] = useState(null);

  const [editingHosting, setEditingHosting] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const [hostingForm, setHostingForm] = useState(emptyHostingForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [newCategory, setNewCategory] = useState('');

  const pageTitle =
    active === 'expenses' ? 'المصروفات' :
    active === 'hostings' ? 'الاستضافات' :
    'الملخص';

  const pageIcon =
    active === 'expenses' ? '💳' :
    active === 'hostings' ? '🌐' :
    '📊';

  const yearlyTotal = useMemo(() => {
    const manualTotal = expenses.reduce((sum, item) => {
      const amount = toNumber(item.amount_sar);
      const cycle = String(item.billing_cycle || 'yearly').toLowerCase();
      return sum + (cycle === 'monthly' ? amount * 12 : amount);
    }, 0);

    return manualTotal + fixedHostingExpensesTotal;
  }, [expenses, fixedHostingExpensesTotal]);

  const monthlyEquivalent = useMemo(() => yearlyTotal / 12, [yearlyTotal]);

  const fixedDomainRenewalTotal = useMemo(() => {
    return hostings.reduce((sum, item) => {
      return sum + pickNumber(item, [
        'domain_renewal_cost_sar',
        'domain_renewal_cost',
        'domain_cost_sar',
        'domain_cost',
        'renewal_cost_sar',
        'domain_renewal_price',
        'domain_price',
      ]);
    }, 0);
  }, [hostings]);

  const fixedHostingTotal = useMemo(() => {
    return hostings.reduce((sum, item) => {
      return sum + pickNumber(item, [
        'hosting_cost_sar',
        'hosting_cost',
        'hosting_renewal_cost_sar',
        'hosting_renewal_cost',
        'hosting_price',
        'host_cost_sar',
        'host_cost',
      ]);
    }, 0);
  }, [hostings]);

  const fixedHostingExpensesTotal = useMemo(() => {
    return fixedDomainRenewalTotal + fixedHostingTotal;
  }, [fixedDomainRenewalTotal, fixedHostingTotal]);


  const manualExpensesTotal = useMemo(() => {
    return expenses.reduce((sum, item) => {
      return sum + annualExpenseAmount(item);
    }, 0);
  }, [expenses]);

  // المصروف السنوي = المصروفات اليدوية + تجديد النطاقات فقط
  const annualExpensesTotal = useMemo(() => {
    return manualExpensesTotal + fixedDomainRenewalTotal;
  }, [manualExpensesTotal, fixedDomainRenewalTotal]);

  // دخل الاستضافات السنوي = مجموع قيمة الاستضافة من شاشة الاستضافات
  const annualHostingIncomeTotal = useMemo(() => {
    return fixedHostingTotal;
  }, [fixedHostingTotal]);

  const annualNetTotal = useMemo(() => {
    return annualHostingIncomeTotal - annualExpensesTotal;
  }, [annualHostingIncomeTotal, annualExpensesTotal]);

  const monthlyNetTotal = useMemo(() => {
    return annualNetTotal / 12;
  }, [annualNetTotal]);

  const personNetTotal = useMemo(() => {
    return monthlyNetTotal / 2;
  }, [monthlyNetTotal]);

  const monthlyExpensesAverage = useMemo(() => {
    return annualExpensesTotal / 12;
  }, [annualExpensesTotal]);

  const monthlyIncomeAverage = useMemo(() => {
    return annualHostingIncomeTotal / 12;
  }, [annualHostingIncomeTotal]);

  const expensesCount = expenses.length;
  const hostingsCount = hostings.length;

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}/${path}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'تعذر تنفيذ الطلب');
    return json;
  }

  async function loadHostings(silent = false) {
    if (!silent) setLoading(true);
    try {
      const json = await api('hostings');
      setHostings(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      Alert.alert('خطأ', e?.message || 'تعذر تحميل الاستضافات');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadExpenses(silent = false) {
    if (!silent) setLoading(true);
    try {
      const json = await api('expenses');
      const rows = Array.isArray(json.data) ? json.data : [];
      setExpenses(rows);
      const fromRows = rows.map((x) => x.expense_type).filter(Boolean);
      setCategories((old) => Array.from(new Set([...old, ...fromRows])));
    } catch (e) {
      Alert.alert('خطأ', e?.message || 'تعذر تحميل المصروفات');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadDashboard(silent = false) {
    if (!silent) setLoading(true);
    try {
      const json = await api('dashboard');
      setTotals(json.totals || {});
    } catch (e) {
      Alert.alert('خطأ', e?.message || 'تعذر تحميل الملخص');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadCurrent(silent = false) {
    if (active === 'hostings') return loadHostings(silent);

    if (active === 'expenses') {
      if (!silent) setLoading(true);
      try {
        await Promise.all([
          loadExpenses(true),
          loadHostings(true),
        ]);
      } finally {
        if (!silent) setLoading(false);
      }
      return;
    }

    return loadDashboard(silent);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCurrent(true);
    setRefreshing(false);
  }

  useEffect(() => {
    loadCurrent();
  }, [active]);

  function openAddHosting() {
    setEditingHosting(null);
    setHostingForm(emptyHostingForm);
    setHostingModal(true);
  }

  function openEditHosting(item) {
    setEditingHosting(item);
    setHostingForm({
      company_name: String(item.company_name ?? ''),
      domain: String(item.domain ?? ''),
      current_space_mb: String(item.current_space_mb ?? ''),
      allowed_space_mb: String(item.allowed_space_mb ?? ''),
      domain_renewal_cost_sar: String(item.domain_renewal_cost_sar ?? ''),
      hosting_cost_sar: String(item.hosting_cost_sar ?? ''),
      tax_sar: String(item.tax_sar ?? ''),
      domain_renewal_date: String(item.domain_renewal_date ?? ''),
      hosting_renewal_date: String(item.hosting_renewal_date ?? ''),
      notes: String(item.notes ?? ''),
    });
    setHostingModal(true);
  }

  async function saveHosting() {
    try {
      const body = {
        company_name: hostingForm.company_name || hostingForm.domain || 'بدون اسم',
        domain: hostingForm.domain || hostingForm.company_name,
        current_space_mb: hostingForm.current_space_mb || '0',
        allowed_space_mb: hostingForm.allowed_space_mb || '',
        domain_renewal_cost_sar: hostingForm.domain_renewal_cost_sar || '0',
        hosting_cost_sar: hostingForm.hosting_cost_sar || '0',
        tax_sar: hostingForm.tax_sar || '0',
        domain_renewal_date: hostingForm.domain_renewal_date || null,
        hosting_renewal_date: hostingForm.hosting_renewal_date || null,
        notes: hostingForm.notes || '',
      };

      if (!body.domain) {
        Alert.alert('تنبيه', 'الدومين مطلوب');
        return;
      }

      if (editingHosting?.id) {
        await api(`hostings/${editingHosting.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('hostings', { method: 'POST', body: JSON.stringify(body) });
      }

      setHostingModal(false);
      await loadHostings(true);
    } catch (e) {
      Alert.alert('تعذر الحفظ', e?.message || 'راجع البيانات');
    }
  }

  async function deleteHosting(item) {
    Alert.alert('حذف', `هل تريد حذف ${item.domain || item.company_name}؟`, [
      { text: 'إلغاء' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`hostings/${item.id}`, { method: 'DELETE' });
            await loadHostings(true);
          } catch (e) {
            Alert.alert('تعذر الحذف', e?.message || 'حدث خطأ');
          }
        },
      },
    ]);
  }

  function openAddExpense() {
    setEditingExpense(null);
    setExpenseForm({ ...emptyExpenseForm, expense_type: categories[0] || 'Hetzner' });
    setExpenseModal(true);
  }

  function openEditExpense(item) {
    setEditingExpense(item);
    setExpenseForm({
      expense_date: String(item.expense_date ?? new Date().toISOString().slice(0, 10)),
      expense_type: String(item.expense_type ?? categories[0] ?? 'Hetzner'),
      amount_sar: String(item.amount_sar ?? ''),
      billing_cycle: String(item.billing_cycle ?? 'yearly'),
      notes: String(item.notes ?? ''),
    });
    setExpenseModal(true);
  }

  async function saveExpense() {
    try {
      if (!expenseForm.expense_type) {
        Alert.alert('تنبيه', 'اختر نوع المصروف');
        return;
      }

      if (!expenseForm.amount_sar) {
        Alert.alert('تنبيه', 'أدخل المبلغ');
        return;
      }

      const body = {
        expense_date: expenseForm.expense_date || new Date().toISOString().slice(0, 10),
        expense_type: expenseForm.expense_type,
        amount_sar: expenseForm.amount_sar || '0',
        billing_cycle: expenseForm.billing_cycle || 'yearly',
        notes: expenseForm.notes || '',
      };

      if (editingExpense?.id) {
        await api(`expenses/${editingExpense.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('expenses', { method: 'POST', body: JSON.stringify(body) });
      }

      setExpenseModal(false);
      await loadExpenses(true);
    } catch (e) {
      Alert.alert('تعذر الحفظ', e?.message || 'راجع البيانات');
    }
  }

  async function deleteExpense(item) {
    Alert.alert('حذف', `هل تريد حذف مصروف ${item.expense_type}؟`, [
      { text: 'إلغاء' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`expenses/${item.id}`, { method: 'DELETE' });
            await loadExpenses(true);
          } catch (e) {
            Alert.alert('تعذر الحذف', e?.message || 'حدث خطأ');
          }
        },
      },
    ]);
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setCategories((old) => Array.from(new Set([...old, name])));
    setNewCategory('');
  }

  function removeCategory(name) {
    Alert.alert('حذف التصنيف', `حذف تصنيف ${name}؟`, [
      { text: 'إلغاء' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          setCategories((old) => old.filter((x) => x !== name));
          if (expenseForm.expense_type === name) {
            setExpenseForm((old) => ({ ...old, expense_type: categories.find((x) => x !== name) || '' }));
          }
        },
      },
    ]);
  }

  function openDropdown(title, options, selectedValue, onSelect) {
    setDropdown({ title, options, selectedValue, onSelect });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.topTitleBar}>
        <Text style={styles.topTitleText}>{pageTitle}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#c4b5fd" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#c4b5fd"
              colors={['#8b5cf6']}
            />
          }
        >
          {active === 'dashboard' && renderDashboard()}
          {active === 'expenses' && renderExpenses()}
          {active === 'hostings' && renderHostings()}
        </ScrollView>
      )}

      {active === 'expenses' && (
        <View style={styles.floatingActions}>
          <IconButton label="تصنيفات" icon="⚙️" variant="secondary" onPress={() => setCategoryModal(true)} />
          <IconButton label="مصروف" icon="＋" variant="primary" onPress={openAddExpense} />
        </View>
      )}

      {active === 'hostings' && (
        <View style={styles.floatingActions}>
        </View>
      )}

      <View style={styles.bottomTabs}>
        <BottomTab active={active === 'expenses'} title="المصروفات" icon="💳" onPress={() => setActive('expenses')} />
        <BottomTab active={active === 'hostings'} title="الاستضافات" icon="🌐" onPress={() => setActive('hostings')} />
        <BottomTab active={active === 'dashboard'} title="الملخص" icon="📊" onPress={() => setActive('dashboard')} />

          {active === 'hostings' ? (
            <Pressable style={styles.hostingFab} onPress={openAddHosting}>
              <Text style={styles.hostingFabText}>＋</Text>
            </Pressable>
          ) : null}
      </View>

      {renderExpenseModal()}
      {renderHostingModal()}
      {renderCategoryModal()}
      {renderDropdownModal()}
    </View>
  );

  function renderDashboard() {
    const entries = Object.entries(totals);

    return (
      <>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryIcon}>💜</Text>
            <Text style={styles.summaryTitle}>ملخص المصروفات</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, styles.expenseSummaryItem]}>
              <Text style={styles.summaryLabel}>مصروف سنوي</Text>
              <Text style={styles.summaryValue}>{money(annualExpensesTotal)}</Text>
            </View>

            <View style={[styles.summaryItem, styles.incomeSummaryItem]}>
              <Text style={styles.summaryLabel}>دخل سنوي</Text>
              <Text style={styles.summaryValue}>{money(annualHostingIncomeTotal)}</Text>
            </View>
          </View>

          <View style={styles.netSummaryBox}>
            <View style={styles.netRow}>
              <Text style={styles.netValue}>{money(annualNetTotal)}</Text>
              <Text style={styles.netLabel}>الصافي السنوي</Text>
            </View>

            <View style={styles.netRow}>
              <Text style={styles.netValue}>{money(monthlyNetTotal)}</Text>
              <Text style={styles.netLabel}>الصافي الشهري</Text>
            </View>

            <View style={styles.personNetRow}>
              <Text style={styles.personNetValue}>{money(personNetTotal)}</Text>
              <Text style={styles.personNetLabel}>صافي الشخص</Text>
            </View>
          </View>
        </View>

        {entries.length === 0 ? (
          <Text style={styles.empty}>لا توجد ملخصات أخرى بعد</Text>
        ) : (
          entries.map(([key, value]) => (
            <View key={key} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{key}</Text>
              <Text style={styles.metricValue}>{String(value ?? 0)}</Text>
            </View>
          ))
        )}
      </>
    );
  }

  function renderExpenses() {
    return (
      <>

        <View style={styles.fixedCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>🔒</Text>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>تجديد النطاقات</Text>
              <Text style={styles.cardSub}>مصروف سنوي ثابت من شاشة الاستضافات</Text>
            </View>
          </View>
          <InfoGrid>
            <Info label="طريقة الاحتساب" value="سنوي" />
            <Info label="التكلفة السنوية" value={money(fixedDomainRenewalTotal)} />
          </InfoGrid>
        </View>

        <View style={styles.incomeCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>💰</Text>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>دخل الاستضافات السنوي</Text>
              <Text style={styles.cardSub}>دخل سنوي من شاشة الاستضافات</Text>
            </View>
          </View>
          <InfoGrid>
            <Info label="طريقة الاحتساب" value="سنوي" />
            <Info label="التكلفة السنوية" value={money(fixedHostingTotal)} />
          </InfoGrid>
        </View>

        {expenses.length === 0 ? (
          <Text style={styles.empty}>لا توجد مصروفات يدوية</Text>
        ) : (
          expenses.map((item) => {
            const amount = toNumber(item.amount_sar);
            const cycle = String(item.billing_cycle || 'yearly').toLowerCase();
            const yearly = annualExpenseAmount(item);

            return (
                                  <View key={item.id} style={styles.expenseCard}>
                <View style={styles.expenseTop}>
                  <View style={styles.expenseLeftActions}>
                    <Pressable style={styles.iconEditOnly} onPress={() => openEditExpense(item)}>
                      <Text style={styles.iconOnlyText}>✏️</Text>
                    </Pressable>
                    <Pressable style={styles.iconDeleteOnly} onPress={() => deleteExpense(item)}>
                      <Text style={styles.iconOnlyText}>🗑</Text>
                    </Pressable>
                  </View>

                  <View style={styles.expenseTitleWrap}>
                    <Text style={styles.expenseTitle}>{item.expense_type}</Text>
                    <Text style={styles.expenseDate}>{item.expense_date || '-'}</Text>
                  </View>

                  <View style={styles.expenseIconBox}>
                    <Text style={styles.expenseIcon}>💳</Text>
                  </View>
                </View>

                <View style={styles.expenseAmountBox}>
                  <Text style={styles.expenseAmountLabel}>التكلفة السنوية</Text>
                  <Text style={styles.expenseAmount}>{money(yearly)}</Text>
                </View>

                <View style={styles.expenseFooter}>
                  <View style={styles.expenseChip}>
                    <Text style={styles.expenseChipText}>{(cycle === 'monthly' || cycle === 'شهري') ? 'شهري × 12' : 'سنوي'}</Text>
                  </View>
                  {!!item.notes && (
                    <Text style={styles.expenseNote} numberOfLines={1}>{item.notes}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </>
    );
  }

  function renderHostings() {
    return (
      <>
        {hostings.length === 0 ? (
          <Text style={styles.empty}>لا توجد بيانات استضافة</Text>
        ) : (
          hostings.map((item) => (
            <View key={item.id || item.domain} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardIcon}>🌐</Text>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{item.domain || item.company_name}</Text>
                  <Text style={styles.cardSub}>{item.company_name || 'استضافة'}</Text>
                </View>
              </View>

              <InfoGrid>
                <Info label="المساحة MB" value={formatNumber(item.current_space_mb)} />
                <Info label="المسموح G" value={item.allowed_space_mb ? formatNumber(item.allowed_space_mb) : '-'} />
                <Info label="النطاق" value={money(item.domain_renewal_cost_sar)} />
                <Info label="الاستضافة" value={money(item.hosting_cost_sar)} />
                <Info label="الضريبة" value={money(item.tax_sar)} />
                <Info label="تجديد الدومين" value={item.domain_renewal_date} />
                <Info label="تجديد الهوست" value={item.hosting_renewal_date} />
              </InfoGrid>

              <View style={styles.iconActions}>
                <Pressable style={styles.smallEdit} onPress={() => openEditHosting(item)}>
                  <Text style={styles.smallActionText}>✏️ تعديل</Text>
                </Pressable>
                <Pressable style={styles.smallDelete} onPress={() => deleteHosting(item)}>
                  <Text style={styles.smallActionText}>🗑 حذف</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </>
    );
  }

  function renderExpenseModal() {
    return (
      <Modal visible={expenseModal} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingExpense ? '✏️ تعديل مصروف' : '＋ إضافة مصروف'}</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="التاريخ YYYY-MM-DD" value={expenseForm.expense_date} onChangeText={(v) => setExpenseForm({ ...expenseForm, expense_date: v })} />

              <DropField
                label="نوع المصروف"
                value={expenseForm.expense_type}
                onPress={() => openDropdown(
                  'نوع المصروف',
                  categories,
                  expenseForm.expense_type,
                  (value) => setExpenseForm((old) => ({ ...old, expense_type: value }))
                )}
              />

              <DropField
                label="طريقة الاحتساب"
                value={expenseForm.billing_cycle === 'monthly' ? 'شهري' : 'سنوي'}
                onPress={() => openDropdown(
                  'طريقة الاحتساب',
                  [
                    { label: 'شهري', value: 'monthly' },
                    { label: 'سنوي', value: 'yearly' },
                  ],
                  expenseForm.billing_cycle,
                  (value) => setExpenseForm((old) => ({ ...old, billing_cycle: value }))
                )}
              />

              <Field label="المبلغ" value={expenseForm.amount_sar} keyboardType="decimal-pad" onChangeText={(v) => setExpenseForm({ ...expenseForm, amount_sar: v })} />
              <Field label="ملاحظات" value={expenseForm.notes} onChangeText={(v) => setExpenseForm({ ...expenseForm, notes: v })} />
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setExpenseModal(false)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveExpense}>
                <Text style={styles.saveText}>حفظ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderHostingModal() {
    return (
      <Modal visible={hostingModal} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingHosting ? '✏️ تعديل استضافة' : '＋ إضافة استضافة'}</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="اسم الشركة" value={hostingForm.company_name} onChangeText={(v) => setHostingForm({ ...hostingForm, company_name: v })} />
              <Field label="الدومين" value={hostingForm.domain} onChangeText={(v) => setHostingForm({ ...hostingForm, domain: v })} />
              <Field label="المساحة الحالية MB" value={hostingForm.current_space_mb} keyboardType="decimal-pad" onChangeText={(v) => setHostingForm({ ...hostingForm, current_space_mb: v })} />
              <Field label="المساحة المسموح بها G" value={hostingForm.allowed_space_mb} onChangeText={(v) => setHostingForm({ ...hostingForm, allowed_space_mb: v })} />
              <Field label="تكلفة تجديد النطاق" value={hostingForm.domain_renewal_cost_sar} keyboardType="decimal-pad" onChangeText={(v) => setHostingForm({ ...hostingForm, domain_renewal_cost_sar: v })} />
              <Field label="تكلفة الاستضافة" value={hostingForm.hosting_cost_sar} keyboardType="decimal-pad" onChangeText={(v) => setHostingForm({ ...hostingForm, hosting_cost_sar: v })} />
              <Field label="ضريبة" value={hostingForm.tax_sar} keyboardType="decimal-pad" onChangeText={(v) => setHostingForm({ ...hostingForm, tax_sar: v })} />
              <Field label="تجديد الدومين YYYY-MM-DD" value={hostingForm.domain_renewal_date} onChangeText={(v) => setHostingForm({ ...hostingForm, domain_renewal_date: v })} />
              <Field label="تجديد الهوست YYYY-MM-DD" value={hostingForm.hosting_renewal_date} onChangeText={(v) => setHostingForm({ ...hostingForm, hosting_renewal_date: v })} />
              <Field label="ملاحظات" value={hostingForm.notes} onChangeText={(v) => setHostingForm({ ...hostingForm, notes: v })} />
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setHostingModal(false)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveHosting}>
                <Text style={styles.saveText}>حفظ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderCategoryModal() {
    return (
      <Modal visible={categoryModal} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>⚙️ تصنيفات المصروفات</Text>

            <View style={styles.addCategoryRow}>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                style={[styles.input, { flex: 1 }]}
                textAlign="right"
                placeholder="تصنيف جديد"
                placeholderTextColor="#8b8797"
              />
              <Pressable style={styles.saveBtnSmall} onPress={addCategory}>
                <Text style={styles.saveText}>＋</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {categories.map((cat) => (
                <View key={cat} style={styles.categoryLine}>
                  <Pressable style={styles.deleteSmall} onPress={() => removeCategory(cat)}>
                    <Text style={styles.actionText}>🗑</Text>
                  </Pressable>
                  <Text style={styles.categoryName}>{cat}</Text>
                </View>
              ))}
            </ScrollView>

            <Pressable style={styles.cancelBtn} onPress={() => setCategoryModal(false)}>
              <Text style={styles.cancelText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  function renderDropdownModal() {
    if (!dropdown) return null;

    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.dropdownBackdrop}>
          <View style={styles.dropdownBox}>
            <Text style={styles.dropdownTitle}>{dropdown.title}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {dropdown.options.map((item) => {
                const option = typeof item === 'string' ? { label: item, value: item } : item;
                const isActive = option.value === dropdown.selectedValue;

                return (
                  <Pressable
                    key={option.value}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => {
                      dropdown.onSelect(option.value);
                      setDropdown(null);
                    }}
                  >
                    <Text style={[styles.dropdownText, isActive && styles.dropdownTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.cancelBtn} onPress={() => setDropdown(null)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{String(value)}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function IconButton({ label, icon, variant, full, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconButton,
        variant === 'secondary' ? styles.iconButtonSecondary : styles.iconButtonPrimary,
        full && { flex: 1 },
      ]}
    >
      <Text style={styles.iconButtonIcon}>{icon}</Text>
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

function BottomTab({ active, title, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.bottomTab, active && styles.bottomTabActive]}>
      <Text style={styles.bottomIcon}>{icon}</Text>
      <Text style={[styles.bottomText, active && styles.bottomTextActive]}>{title}</Text>
    </Pressable>
  );
}

function InfoGrid({ children }) {
  return <View style={styles.infoGrid}>{children}</View>;
}

function Info({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoValue}>{value == null || value === '' ? '-' : String(value)}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowValue}>{value == null || value === '' ? '-' : String(value)}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType = 'default' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
        textAlign="right"
        placeholder={label}
        placeholderTextColor="#8b8797"
      />
    </View>
  );
}

function DropField({ label, value, onPress }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dropdownInput} onPress={onPress}>
        <Text style={styles.dropdownInputArrow}>⌄</Text>
        <Text style={styles.dropdownInputText}>{value || 'اختر'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topTitleText: {
    color: '#150b2e',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 32,
  },
  topTitleBar: {
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 0,
    borderRadius: 0,
    marginTop: 0,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: '#12091f',
    paddingTop: 28,
  },
  hero: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 10,
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlowOne: {
    display: 'none',
  },
  heroGlowTwo: {
    display: 'none',
  },
  heroTop: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadge: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontSize: 26,
  },
  heroText: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pageTitle: {
    color: '#150b2e',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 32,
  },
  pageHint: {
    color: '#a78bfa',
    fontSize: 11,
    marginTop: 3,
  },
  quickStats: {
    display: 'none',
  },
  miniStat: {
    display: 'none',
  },
  miniValue: {
    display: 'none',
  },
  miniLabel: {
    display: 'none',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#c4b5fd',
    marginTop: 10,
  },
  content: {
    padding: 10,
    gap: 8,
    paddingBottom: 140,
  },
  empty: {
    color: '#c4b5fd',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fbfaff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  fixedCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  incomeCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  expenseSummaryItem: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  incomeSummaryItem: {
    backgroundColor: '#14532d',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  netSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 10,
    marginTop: 9,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  netLabel: {
    color: '#5b21b6',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  netValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  personNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 38,
    marginTop: 4,
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  personNetLabel: {
    color: '#4c1d95',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  personNetValue: {
    color: '#4c1d95',
    fontSize: 18,
    fontWeight: '900',
  },
  fixedBreakdown: {
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 14,
    padding: 8,
    marginTop: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardIcon: {
    width: 34,
    height: 34,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#ede9fe',
    borderRadius: 13,
    fontSize: 18,
    overflow: 'hidden',
  },
  cardTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    color: '#150b2e',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardSub: {
    color: '#7c6f91',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  summaryCard: {
    backgroundColor: '#25104a',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryIcon: {
    fontSize: 20,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.1)',
    borderRadius: 14,
    padding: 7,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#ddd6fe',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoItem: {
    width: '49%',
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 7,
    minHeight: 46,
    justifyContent: 'center',
  },
  infoLabel: {
    color: '#7c6f91',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 1,
  },
  infoValue: {
    color: '#150b2e',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  metricCard: {
    backgroundColor: '#fbfaff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  metricLabel: {
    color: '#7c6f91',
    fontWeight: '800',
    textAlign: 'right',
  },
  metricValue: {
    color: '#150b2e',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  rowLabel: {
    color: '#7c6f91',
    fontWeight: '800',
    textAlign: 'right',
  },
  rowValue: {
    color: '#150b2e',
    fontWeight: '900',
    flex: 1,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  smallEdit: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 13,
    paddingVertical: 8,
    alignItems: 'center',
  },
  smallDelete: {
    flex: 1,
    backgroundColor: '#be123c',
    borderRadius: 13,
    paddingVertical: 8,
    alignItems: 'center',
  },
  smallActionText: {
    color: '#fff',
    fontWeight: '900',
  },
  actionText: {
    color: '#fff',
    fontWeight: '900',
  },
  floatingActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
  },
  iconButtonPrimary: {
    backgroundColor: '#8b5cf6',
    borderColor: '#a78bfa',
  },
  iconButtonSecondary: {
    backgroundColor: '#4c1d95',
    borderColor: '#7c3aed',
  },
  iconButtonIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  iconButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  hostingFab: {
    position: 'absolute',
    left: 18,
    bottom: 82,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  hostingFabText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    marginTop: -2,
  },

  bottomTabs: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: '#211033',
    borderRadius: 30,
    padding: 7,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#4c1d95',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 24,
  },
  bottomTabActive: {
    backgroundColor: '#7c3aed',
  },
  bottomIcon: {
    fontSize: 17,
    marginBottom: 1,
  },
  bottomText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '900',
  },
  bottomTextActive: {
    color: '#fff',
  },
  expenseCard: {
    backgroundColor: '#fbfaff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  expenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseLeftActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconEditOnly: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDeleteOnly: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#be123c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnlyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  expenseTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  expenseTitle: {
    color: '#150b2e',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  expenseDate: {
    color: '#8b8797',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  expenseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIcon: {
    fontSize: 18,
  },
  expenseAmountBox: {
    marginTop: 8,
    backgroundColor: '#f3e8ff',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  expenseAmountLabel: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '900',
  },
  expenseAmount: {
    color: '#150b2e',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 1,
  },
  expenseFooter: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expenseChip: {
    backgroundColor: '#7c3aed',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  expenseChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  expenseNote: {
    flex: 1,
    color: '#6b6478',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,9,31,.64)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 18,
    maxHeight: '88%',
  },
  modalTitle: {
    color: '#150b2e',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 12,
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#5b516e',
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 5,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#faf7ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#150b2e',
    fontWeight: '800',
  },
  dropdownInput: {
    backgroundColor: '#faf7ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownInputText: {
    color: '#150b2e',
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
  },
  dropdownInputArrow: {
    color: '#7c3aed',
    fontSize: 20,
    marginRight: 10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    marginTop: 18,
    paddingBottom: 10,
  },
  cancelBtn: {
    width: 112,
    minHeight: 54,
    backgroundColor: '#ede9fe',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveBtn: {
    flex: 1,
    minHeight: 54,
    backgroundColor: '#7c3aed',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#4c1d95',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  addCategoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  saveBtnSmall: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  categoryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#faf7ff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  categoryName: {
    color: '#150b2e',
    fontWeight: '900',
    fontSize: 16,
  },
  deleteSmall: {
    backgroundColor: '#be123c',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,9,31,.66)',
    justifyContent: 'center',
    padding: 22,
  },
  dropdownBox: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 16,
    maxHeight: '75%',
  },
  dropdownTitle: {
    color: '#150b2e',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 12,
  },
  dropdownItem: {
    backgroundColor: '#faf7ff',
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  dropdownItemActive: {
    backgroundColor: '#7c3aed',
  },
  dropdownText: {
    color: '#150b2e',
    fontWeight: '900',
    textAlign: 'right',
    fontSize: 16,
  },
  dropdownTextActive: {
    color: '#fff',
  },


});

registerRootComponent(App);
