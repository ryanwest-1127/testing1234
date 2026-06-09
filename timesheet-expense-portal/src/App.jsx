import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Plus, Trash2, Upload, CheckCircle2, XCircle, Clock,
  ReceiptText, Users, FileCheck2, Search, WalletCards,
  CalendarDays, TrendingUp, Eye, RefreshCw, Building2
} from 'lucide-react';

const STORAGE_KEY = 'timesheet-expense-saas-demo-v2';

const employees = [
  { id: 'EMP001', name: 'Ryan Hei', email: 'ryan@example.com', role: 'Employee', department: 'Production' },
  { id: 'EMP002', name: 'Alex Chan', email: 'alex@example.com', role: 'Employee', department: 'Operations' },
  { id: 'MGR001', name: 'Manager', email: 'manager@example.com', role: 'Manager', department: 'Management' },
];

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fields = [
  'projectHours',
  'travelHours'
];

const categories = ['Travel', 'Hotel', 'Lunch / Dinner', 'Training', 'Mileage', 'Other'];

function formatDateDDMMYYYY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function getMondayFromWeekValue(weekValue) {
  if (!weekValue || !weekValue.includes('-W')) return new Date();
  const [yearStr, weekStr] = weekValue.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  return monday;
}

function getWeekDates(weekValue) {
  const monday = getMondayFromWeekValue(weekValue);
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { day, date, label: formatDateDDMMYYYY(date) };
  });
}


function defaultTimesheet() {
  return Object.fromEntries(
    weekDays.map(day => [
      day,
      {
        projectName: '',
        projectHours: '',
        travelHours: '',
        holidayType: 'none',
        takeBackTimeInLieu: '',
        sickness: false,
      }
    ])
  );
}

function makeExpense() {
  return {
    id: crypto.randomUUID(),
    date: '',
    category: 'Travel',
    description: '',
    amount: '',
    receiptName: '',
    receiptPreview: ''
  };
}

function money(v) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(Number(v || 0));
}

function weekLabel(week) {
  const [y, w] = week.split('-W');
  return `Week ${w}, ${y}`;
}

function getDateForWeekDay(week, dayIndex) {
  if (!week || !week.includes('-W')) return '';

  const [yearText, weekText] = week.split('-W');
  const year = Number(yearText);
  const weekNumber = Number(weekText);

  if (!year || !weekNumber) return '';

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (weekNumber - 1) * 7 + dayIndex);

  return monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function calculateDailyTimeInLieu(row, standardHours) {
  const worked =
    Number(row.projectHours || 0) +
    Number(row.travelHours || 0);

  return Math.max(0, worked - Number(standardHours || 7.5));
}

function calculateHolidayHours(row, standardHours) {
  const dailyHours = Number(standardHours || 7.5);

  if (row.holidayType === 'full') return dailyHours;
  if (row.holidayType === 'half') return dailyHours / 2;

  // Backwards compatibility for older saved demo data.
  return Number(row.holiday || 0);
}

function calculateSicknessHours(row, standardHours) {
  const dailyHours = Number(standardHours || 7.5);

  if (row.sickness === true) return dailyHours;

  // Backwards compatibility for older saved demo data.
  return Number(row.sickness || 0);
}

function calculateTakeBackTimeInLieuHours(row) {
  return Number(row.takeBackTimeInLieu || 0);
}

function isLeaveDay(row) {
  return row.holidayType === 'half' || row.holidayType === 'full' || row.sickness === true;
}

function calculateTotals(timesheet, expenses, til, standardHours) {
  const t = {
    projectHours: 0,
    travelHours: 0,
    timeInLieu: 0,
    takeBackTimeInLieu: 0,
    holiday: 0,
    sickness: 0
  };

  weekDays.forEach(day => {
    const row = timesheet[day] || {};

    if (!isLeaveDay(row)) {
      fields.forEach(f => {
        t[f] += Number(row?.[f] || 0);
      });

      t.timeInLieu += calculateDailyTimeInLieu(row, standardHours);
    }

    t.holiday += calculateHolidayHours(row, standardHours);
    t.takeBackTimeInLieu += calculateTakeBackTimeInLieuHours(row);
    t.sickness += calculateSicknessHours(row, standardHours);
  });

  const totalWorkingHours = t.projectHours + t.travelHours;
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const tilBalance = Number(til.broughtForward || 0) + t.timeInLieu - t.takeBackTimeInLieu;

  return { ...t, totalWorkingHours, totalExpense, tilBalance };
}

function tabLabel(tab) {
  if (tab === 'timesheet') return 'Timesheet';
  if (tab === 'expense') return 'Expense';
  return tab[0].toUpperCase() + tab.slice(1);
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [activeUser, setActiveUser] = useState(employees[0]);
  const [claims, setClaims] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('2026-W21');

  const [employeeInfo, setEmployeeInfo] = useState({
    employeeId: 'EMP001',
    employeeName: 'Ryan Hei',
    email: 'ryan@example.com',
    notes: ''
  });

  const [timesheet, setTimesheet] = useState(defaultTimesheet());
  const [expenses, setExpenses] = useState([makeExpense()]);
  const [timeInLieu, setTimeInLieu] = useState({ broughtForward: '0', used: '0' });
  const [standardHours, setStandardHours] = useState('7.5');
  const [weeklyStandardHours, setWeeklyStandardHours] = useState('37.5');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [receipt, setReceipt] = useState(null);
  const [editingClaimId, setEditingClaimId] = useState(null);

  useEffect(() => {
    try {
      setClaims(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').claims || []);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ claims }));
  }, [claims]);

  useEffect(() => {
    const user = activeUser.role === 'Manager' ? employees[0] : activeUser;
    setEmployeeInfo({
      employeeId: user.id,
      employeeName: user.name,
      email: user.email,
      notes: ''
    });
  }, [activeUser]);

  const totals = useMemo(
    () => calculateTotals(timesheet, expenses, timeInLieu, standardHours),
    [timesheet, expenses, timeInLieu, standardHours]
  );

  const visibleClaims =
    activeUser.role === 'Manager'
      ? claims
      : claims.filter(c => c.employeeId === employeeInfo.employeeId);

  const filteredClaims = visibleClaims.filter(c =>
    (!search || `${c.employeeName} ${c.email} ${c.week}`.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'All' || c.status === statusFilter)
  );

  const categoryMap = {};
  visibleClaims
    .filter(c => c.type === 'expense' || (!c.type && c.expenses))
    .forEach(c =>
      c.expenses?.forEach(e => {
        categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount || 0);
      })
    );

  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  const pending = claims.filter(c => c.status === 'Submitted').length;

  const updateTimesheet = (day, field, value) => {
    setTimesheet(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const updateExpense = (i, field, value) => {
    setExpenses(prev =>
      prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e)
    );
  };

  const uploadReceipt = (i, file) => {
    if (!file) return;

    updateExpense(i, 'receiptName', file.name);

    const reader = new FileReader();
    reader.onload = () => updateExpense(i, 'receiptPreview', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const commonClaimFields = status => ({
    id: crypto.randomUUID(),
    employeeId: employeeInfo.employeeId,
    employeeName: employeeInfo.employeeName,
    email: employeeInfo.email,
    department: employees.find(e => e.id === employeeInfo.employeeId)?.department || 'Production',
    week: selectedWeek,
    weekLabel: weekLabel(selectedWeek),
    status,
    submittedAt: status === 'Submitted' ? new Date().toLocaleString('en-GB') : '',
    notes: employeeInfo.notes,
    managerNote: ''
  });

  const buildTimesheetClaim = status => ({
    ...commonClaimFields(status),
    type: 'timesheet',
    timesheet,
    timeInLieu,
    standardHours,
    totals: {
      projectHours: totals.projectHours,
      travelHours: totals.travelHours,
      holiday: totals.holiday,
      takeBackTimeInLieu: totals.takeBackTimeInLieu,
      sickness: totals.sickness,
      timeInLieu: totals.timeInLieu,
      totalWorkingHours: totals.totalWorkingHours,
      tilBalance: totals.tilBalance
    }
  });

  const buildExpenseClaim = status => ({
    ...commonClaimFields(status),
    type: 'expense',
    expenses,
    totals: { totalExpense: totals.totalExpense }
  });

  const saveDraft = () => {
    setClaims(prev => [buildTimesheetClaim('Draft'), ...prev]);
  };

  const submitTimesheet = () => {
    setClaims(prev => [buildTimesheetClaim('Submitted'), ...prev]);
    setTimeInLieu({
      broughtForward: String(totals.tilBalance || 0),
      used: '0'
    });
    setTimesheet(defaultTimesheet());
    setEmployeeInfo(p => ({ ...p, notes: '' }));
    setTab('dashboard');
  };

  const submitExpense = () => {
    setClaims(prev => [buildExpenseClaim('Submitted'), ...prev]);
    setExpenses([makeExpense()]);
    setTab('dashboard');
  };

  const updateClaim = (id, patch) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const resetDemoData = () => {
    if (window.confirm('Are you sure you want to delete all demo data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };


  const startEditClaim = (claim) => {
    setTimesheet(claim.timesheet || defaultTimesheet());
    setExpenses(claim.expenses || [makeExpense()]);
    setTimeInLieu(claim.timeInLieu || { broughtForward: '0', used: '0', earned: '0' });
    if (claim.standardHours) setStandardHours(String(claim.standardHours));
    if (claim.week) setSelectedWeek(claim.week);
    setEditingClaimId(claim.id);
    setTab('timesheet');
  };

  const saveEditedClaim = () => {
    if (!editingClaimId) return;
    const updatedTotals = calculateTotals(timesheet, expenses, timeInLieu, standardHours);
    setClaims(prev => prev.map(c => c.id === editingClaimId ? {
      ...c,
      timesheet,
      expenses,
      timeInLieu,
      standardHours,
      week: selectedWeek,
      totals: updatedTotals,
      status: 'Submitted',
      editedAt: new Date().toLocaleString('en-GB')
    } : c));
    setEditingClaimId(null);
    setTab('history');
  };

  const cancelEditClaim = () => {
    setEditingClaimId(null);
    setTimesheet(defaultTimesheet());
    setExpenses([makeExpense()]);
    setTimeInLieu({ broughtForward: '0', used: '0', earned: '0' });
  };

  return (
    <div className="bg-gradient min-h-screen">
      <div className="container space-y">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-dark"
        >
          <div className="flex justify-between gap-lg" style={{ flexWrap: 'wrap' }}>
            <div>
              <div className="flex items-center gap">
                <Building2 />
                <div>
                  <p className="small" style={{ color: '#cbd5e1' }}>SaaS Demo</p>
                  <h1 className="title">Timesheet & Expense Portal</h1>
                </div>
              </div>
              <p className="subtitle">
                Weekly timesheets, time in lieu carry-forward, receipt expenses,
                manager approval and reporting dashboard.
              </p>
            </div>

            <div>
              <label className="label" style={{ color: '#cbd5e1' }}>Demo user</label>
              <select
                className="select"
                value={activeUser.id}
                onChange={e => setActiveUser(employees.find(u => u.id === e.target.value))}
              >
                {employees.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.header>

        <div className="grid grid-4">
          <Metric label="This Week Hours" value={totals.totalWorkingHours.toFixed(2)} sub="Current form" icon={<Clock />} />
          <Metric label="This Week Expense" value={money(totals.totalExpense)} sub="Current form" icon={<ReceiptText />} />
          <Metric label="TIL Carry Forward" value={`${totals.tilBalance.toFixed(2)} hrs`} sub="Auto carried" icon={<FileCheck2 />} />
          <Metric
            label="Pending Approval"
            value={String(activeUser.role === 'Manager' ? pending : filteredClaims.filter(c => c.status === 'Submitted').length)}
            sub="Submitted claims"
            icon={<Users />}
          />
        </div>

        <div className="tabs">
          <button className="btn danger" onClick={resetDemoData}>Reset Demo Data</button>
          {['dashboard', 'timesheet', 'expense', 'history', 'manager'].map(t => (
            <button
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              key={t}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <Dashboard
            visibleClaims={visibleClaims}
            categoryData={categoryData}
            totals={totals}
            weeklyStandardHours={weeklyStandardHours}
            setWeeklyStandardHours={setWeeklyStandardHours}
            activeUser={activeUser}
            selectedWeek={selectedWeek}
          />
        )}

        {tab === 'timesheet' && (
          <TimesheetForm
            {...{
              employeeInfo,
              setEmployeeInfo,
              selectedWeek,
              setSelectedWeek,
              timesheet,
              updateTimesheet,
              timeInLieu,
              setTimeInLieu,
              standardHours,
              setStandardHours,
              activeUser,
              totals,
              saveDraft,
              submitTimesheet,
              setTab
            }}
          />
        )}

        {tab === 'expense' && (
          <ExpenseForm
            {...{
              employeeInfo,
              selectedWeek,
              totals,
              expenses,
              setExpenses,
              updateExpense,
              uploadReceipt,
              setReceipt,
              submitExpense
            }}
          />
        )}

        {tab === 'history' && (
          <>
            <Filter {...{ search, setSearch, statusFilter, setStatusFilter, setClaims }} />
            <ClaimList claims={filteredClaims} setReceipt={setReceipt} startEditClaim={startEditClaim} activeUser={activeUser} />
          </>
        )}

        {tab === 'manager' && (
          activeUser.role !== 'Manager'
            ? <div className="card"><div className="card-content muted">Switch to Manager demo user to approve claims.</div></div>
            : <>
                <Filter {...{ search, setSearch, statusFilter, setStatusFilter, setClaims }} />
                <ClaimList claims={filteredClaims} setReceipt={setReceipt} manager updateClaim={updateClaim} startEditClaim={startEditClaim} activeUser={activeUser} />
              </>
        )}
      </div>

      {receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}
    </div>
  );
}



function Dashboard({ visibleClaims, categoryData, totals, weeklyStandardHours, setWeeklyStandardHours, activeUser, selectedWeek }) {
  const [chartType, setChartType] = useState('bar');
  const [categoryView, setCategoryView] = useState('timesheet');
  const [dashboardWeek, setDashboardWeek] = useState('current');

  const chartColors = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];

  const timesheetClaims = visibleClaims.filter(c => c.type === 'timesheet' || (!c.type && c.timesheet));
  const expenseClaims = visibleClaims.filter(c => c.type === 'expense' || (!c.type && c.expenses));

  const weekOptions = Array.from(new Set(visibleClaims.map(c => c.week).filter(Boolean))).sort().reverse();
  const latestSubmittedWeek = weekOptions.length ? weekOptions[0] : selectedWeek;
  const currentWeekLimit = dashboardWeek === 'current' ? (selectedWeek || latestSubmittedWeek) : dashboardWeek;

  const isWeekOnOrBefore = (week, limit) => {
    if (!week || !limit) return false;
    return String(week) <= String(limit);
  };

  // IMPORTANT:
  // Current data = cumulative Week 1 up to current/selected week.
  // Specific week view = also cumulative Week 1 up to that selected week, not only that week.
  const cumulativeTimesheetClaims = timesheetClaims.filter(c => isWeekOnOrBefore(c.week, currentWeekLimit));
  const cumulativeExpenseClaims = expenseClaims.filter(c => isWeekOnOrBefore(c.week, currentWeekLimit));

  const selectedTimesheetClaims = cumulativeTimesheetClaims;
  const selectedExpenseClaims = cumulativeExpenseClaims;

  // Total Working Hours is NOT cumulative: it shows the selected/current week only.
  const selectedWeekOnly = dashboardWeek === 'current' ? (selectedWeek || latestSubmittedWeek) : dashboardWeek;
  const weekOnlyTimesheetClaims = timesheetClaims.filter(c => c.week === selectedWeekOnly);

  const totalSubmittedHours = weekOnlyTimesheetClaims.reduce((s, c) => s + Number(c.totals?.totalWorkingHours || 0), 0);
  const totalAutoTil = selectedTimesheetClaims.reduce((s, c) => s + Number(c.totals?.timeInLieu || 0), 0);
  const totalTakeBackTil = selectedTimesheetClaims.reduce((s, c) => s + Number(c.totals?.takeBackTimeInLieu || 0), 0);

  const latestTilBalance = selectedTimesheetClaims.length
    ? Number([...selectedTimesheetClaims].sort((a, b) => String(b.week).localeCompare(String(a.week)))[0]?.totals?.tilBalance || 0)
    : 0;

  const totalExpenseClaims = selectedExpenseClaims.reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);
  const approvedPaidExpenses = selectedExpenseClaims
    .filter(c => ['Approved', 'Paid'].includes(c.status))
    .reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);

  // Outstanding expenses = total claims minus approved/paid.
  const totalExpenses = Math.max(0, totalExpenseClaims - approvedPaidExpenses);

  const targetHours = Number(weeklyStandardHours || 0);

  const timesheetCategoryMap = {
    'Project / Workshop Hours': 0,
    Travel: 0,
    'Time in Lieu': 0,
    'Take back TIL': 0,
    Holiday: 0,
    Sickness: 0
  };

  selectedTimesheetClaims.forEach(c => {
    timesheetCategoryMap['Project / Workshop Hours'] += Number(c.totals?.projectHours || 0);
    timesheetCategoryMap.Travel += Number(c.totals?.travelHours || 0);
    timesheetCategoryMap['Time in Lieu'] += Number(c.totals?.timeInLieu || 0);
    timesheetCategoryMap['Take back TIL'] += Number(c.totals?.takeBackTimeInLieu || 0);
    timesheetCategoryMap.Holiday += Number(c.totals?.holiday || 0);
    timesheetCategoryMap.Sickness += Number(c.totals?.sickness || 0);
  });

  const timesheetCategoryData = Object.entries(timesheetCategoryMap)
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0);

  const selectedExpenseCategoryMap = {};
  selectedExpenseClaims.forEach(c => c.expenses?.forEach(e => {
    selectedExpenseCategoryMap[e.category] = (selectedExpenseCategoryMap[e.category] || 0) + Number(e.amount || 0);
  }));
  const selectedExpenseCategoryData = Object.entries(selectedExpenseCategoryMap).map(([name, value]) => ({ name, value }));

  const selectedCategoryData = categoryView === 'timesheet' ? timesheetCategoryData : selectedExpenseCategoryData;
  const chartValueFormatter = categoryView === 'timesheet'
    ? (value) => `${Number(value || 0).toFixed(2)} hrs`
    : (value) => money(value);

  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content flex gap items-center" style={{ flexWrap: 'wrap' }}>
          <label className="label">Dashboard data</label>
          <select className="select" value={dashboardWeek} onChange={e => setDashboardWeek(e.target.value)} style={{ width: 330 }}>
            <option value="current">Current data: {weekLabel(selectedWeek || latestSubmittedWeek)}</option>
            {weekOptions.map(week => (
              <option key={week} value={week}>{weekLabel(week)}</option>
            ))}
          </select>
          <p className="small muted">
            TIL and expenses are cumulative up to the selected week. Total Working Hours shows selected week only.
          </p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-content flex gap items-center">
            <Clock />
            <div>
              <p className="small muted">Total Working Hours</p>
              <p className="metric-value">{totalSubmittedHours.toFixed(2)} / {targetHours.toFixed(2)} hrs</p>
              <p className="xsmall muted">Selected week actual / weekly target</p>
              {activeUser?.role === 'Manager' && (
                <div style={{ marginTop: 8 }}>
                  <label className="xsmall muted">Manager weekly target</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.25"
                    value={weeklyStandardHours}
                    onChange={e => setWeeklyStandardHours(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <Insight
          title="Time in Lieu Remaining"
          value={`${Number(latestTilBalance || 0).toFixed(2)} hrs`}
          note="Cumulative carry forward balance"
          icon={<FileCheck2 />}
        />
        <Insight
          title="Total Time in Lieu"
          value={`${totalAutoTil.toFixed(2)} hrs`}
          note={`Take back: ${totalTakeBackTil.toFixed(2)} hrs`}
          icon={<TrendingUp />}
        />
      </div>

      <div className="grid grid-3">
        <Insight
          title="Outstanding Expenses"
          value={money(totalExpenses)}
          note={`Total claimed ${money(totalExpenseClaims)} - approved/paid ${money(approvedPaidExpenses)}`}
          icon={<WalletCards />}
        />
        <Insight
          title="Approved / Paid Expenses"
          value={money(approvedPaidExpenses)}
          note="Manager confirmed amount"
          icon={<CheckCircle2 />}
        />
        <Insight
          title="Records Count"
          value={String(selectedTimesheetClaims.length + selectedExpenseClaims.length)}
          note="Cumulative timesheet + expense records"
          icon={<CalendarDays />}
        />
      </div>

      <ChartCard title="Categories" sub={categoryView === 'timesheet' ? 'Timesheet hours breakdown' : 'Expense claim breakdown'}>
        <div className="flex gap items-center" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={categoryView === 'timesheet'}
              onChange={() => setCategoryView('timesheet')}
            />
            Timesheet
          </label>
          <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={categoryView === 'expense'}
              onChange={() => setCategoryView('expense')}
            />
            Expense
          </label>

          <span className="muted">|</span>

          <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={chartType === 'bar'}
              onChange={() => setChartType('bar')}
            />
            Bar chart
          </label>
          <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={chartType === 'pie'}
              onChange={() => setChartType('pie')}
            />
            Pie chart
          </label>
        </div>

        {selectedCategoryData.length === 0 ? (
          <div className="muted" style={{ padding: 24 }}>No category data yet.</div>
        ) : chartType === 'pie' ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={selectedCategoryData} dataKey="value" nameKey="name" outerRadius={95} label>
                {selectedCategoryData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
              </Pie>
              <Tooltip formatter={chartValueFormatter} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={selectedCategoryData} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={160} />
              <Tooltip formatter={chartValueFormatter} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {selectedCategoryData.map((_, i) => <Cell key={`bar-${i}`} fill={chartColors[i % chartColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}


function TimesheetForm(p) {
  const weekDates = getWeekDates(p.selectedWeek);
  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content grid grid-4">
          <Field label="Employee Name" value={p.employeeInfo.employeeName} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, employeeName: v })} />
          <Field label="Email" value={p.employeeInfo.email} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, email: v })} />
          <Field label="Employee ID" value={p.employeeInfo.employeeId} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, employeeId: v })} />
          <div>
            <label className="label">Week (Mon Tue Wed Thu Fri Sat Sun)</label>
            <input className="input" type="week" value={p.selectedWeek} onChange={e => p.setSelectedWeek(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2>Weekly Timesheet</h2>
              <p className="small muted">Fill working hours here. Expenses are now in a separate page.</p>
            </div>
          </div>

          <div className="wide">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Project / Job</th>
                  <th>Project / Workshop Hours</th>
                  <th>Travel</th>
                  <th>Time in Lieu</th>
                  <th>Take back Time in Lieu</th>
                  <th>Holiday</th>
                  <th>Sickness</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {weekDays.map((day, dayIndex) => {
                  const row = p.timesheet[day];
                  const dailyHours = Number(p.standardHours || 7.5);
                  const holidayType = row.holidayType || 'none';
                  const sicknessSelected = row.sickness === true;
                  const takeBackHours = Number(row.takeBackTimeInLieu || 0);
                  const leaveSelected = holidayType === 'half' || holidayType === 'full' || sicknessSelected;

                  const workedHours = leaveSelected
                    ? 0
                    : Number(row.projectHours || 0) +
                      Number(row.travelHours || 0);

                  const holidayHours =
                    holidayType === 'full' ? dailyHours :
                    holidayType === 'half' ? dailyHours / 2 :
                    0;

                  const sicknessHours = sicknessSelected ? dailyHours : 0;
                  const autoTimeInLieu = leaveSelected ? 0 : Math.max(0, workedHours - dailyHours);
                  const total = leaveSelected ? holidayHours + sicknessHours : workedHours + takeBackHours;

                  const clearWorkingInputs = () => {
                    p.updateTimesheet(day, 'projectName', '');
                    p.updateTimesheet(day, 'projectHours', '');
                    p.updateTimesheet(day, 'travelHours', '');
                  };

                  const setHoliday = (type) => {
                    const nextType = holidayType === type ? 'none' : type;
                    p.updateTimesheet(day, 'holidayType', nextType);
                    p.updateTimesheet(day, 'sickness', false);
                    if (nextType !== 'none') clearWorkingInputs();
                  };

                  const setSickness = () => {
                    const nextValue = !sicknessSelected;
                    p.updateTimesheet(day, 'sickness', nextValue);
                    p.updateTimesheet(day, 'holidayType', 'none');
                    if (nextValue) clearWorkingInputs();
                  };

                  return (
                    <tr key={day}>
                      <td><b>{day}</b><br /><span className="xsmall muted">{getDateForWeekDay(p.selectedWeek, dayIndex)}</span></td>

                      <td>
                        <input
                          className="input"
                          type="text"
                          placeholder={leaveSelected ? 'Locked - leave/sickness selected' : 'Project / Job name'}
                          value={row.projectName || ''}
                          disabled={leaveSelected}
                          onChange={e => p.updateTimesheet(day, 'projectName', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.projectHours}
                          disabled={leaveSelected}
                          onChange={e => p.updateTimesheet(day, 'projectHours', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.travelHours}
                          disabled={leaveSelected}
                          onChange={e => p.updateTimesheet(day, 'travelHours', e.target.value)}
                        />
                      </td>


                      <td><b>{autoTimeInLieu.toFixed(2)}</b></td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.takeBackTimeInLieu || ''}
                          onChange={e => p.updateTimesheet(day, 'takeBackTimeInLieu', e.target.value)}
                        />
                      </td>

                      <td>
                        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={holidayType === 'half'}
                              onChange={() => setHoliday('half')}
                            />
                            Half ({(dailyHours / 2).toFixed(2)}h)
                          </label>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={holidayType === 'full'}
                              onChange={() => setHoliday('full')}
                            />
                            Full ({dailyHours.toFixed(2)}h)
                          </label>
                        </div>
                      </td>

                      <td>
                        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={sicknessSelected}
                            onChange={setSickness}
                          />
                          Sick ({dailyHours.toFixed(2)}h)
                        </label>
                      </td>

                      <td><b>{total.toFixed(2)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content grid grid-4">
          <Field
            label="Daily Standard Hours"
            type="number"
            value={p.standardHours}
            onChange={v => p.setStandardHours(v)}
            disabled={p.activeUser?.role !== 'Manager'}
          />

          <ReadOnlyField
            label="Time owed brought forward"
            value={`${Number(p.timeInLieu.broughtForward || 0).toFixed(2)} hrs`}
          />

          <ReadOnlyField
            label="Time taken this week"
            value={`${p.totals.takeBackTimeInLieu.toFixed(2)} hrs`}
          />

          <div className="card-dark">
            <p className="small">Carry Forward</p>
            <h2>{p.totals.tilBalance.toFixed(2)} hrs</h2>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <label className="label">Employee Notes</label>
          <textarea className="textarea" value={p.employeeInfo.notes} onChange={e => p.setEmployeeInfo({ ...p.employeeInfo, notes: e.target.value })} />

          <button className="btn secondary" onClick={p.saveDraft}>Save Timesheet Draft</button>
          {' '}
          <button className="btn" onClick={p.submitTimesheet}>Submit Timesheet</button>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm(p) {
  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content grid grid-4">
          <Mini label="Employee" value={p.employeeInfo.employeeName} />
          <Mini label="Week" value={weekLabel(p.selectedWeek)} />
          <Mini label="Timesheet Hours" value={`${p.totals.totalWorkingHours.toFixed(2)} hrs`} />
          <Mini label="Expense Total" value={money(p.totals.totalExpense)} />
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <div className="flex justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2>Expense Claims</h2>
              <p className="small muted">Add expense items and upload receipt proof here.</p>
            </div>
            <button className="btn secondary" onClick={() => p.setExpenses(prev => [...prev, makeExpense()])}>
              <Plus size={16} /> Add Expense
            </button>
          </div>

          {p.expenses.map((e, i) => (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 2fr 1.5fr auto' }} key={e.id}>
              <input className="input" type="date" value={e.date} onChange={ev => p.updateExpense(i, 'date', ev.target.value)} />

              <select className="select" value={e.category} onChange={ev => p.updateExpense(i, 'category', ev.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>

              <input className="input" type="number" placeholder="Amount" value={e.amount} onChange={ev => p.updateExpense(i, 'amount', ev.target.value)} />
              <input className="input" placeholder="Description" value={e.description} onChange={ev => p.updateExpense(i, 'description', ev.target.value)} />

              <label className="btn secondary">
                <Upload size={16} /> Upload
                <input hidden type="file" accept="image/*,.pdf" onChange={ev => p.uploadReceipt(i, ev.target.files?.[0])} />
              </label>

              <button className="btn ghost" onClick={() => p.setExpenses(prev => prev.filter((_, idx) => idx !== i))}>
                <Trash2 size={16} />
              </button>

              {e.receiptName && (
                <button className="btn ghost" onClick={() => p.setReceipt(e)}>
                  View {e.receiptName}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <h2>Ready to Submit Expense</h2>
          <p className="small muted">This will submit expense only. It is no longer linked to the weekly timesheet.</p>
          <button className="btn" onClick={p.submitExpense}>Submit Expense Claim</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, icon }) {
  return (
    <div className="card">
      <div className="card-content flex justify-between items-center">
        <div>
          <p className="small muted">{label}</p>
          <p className="metric-value">{value}</p>
          <p className="xsmall muted">{sub}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function Insight({ title, value, note, icon }) {
  return (
    <div className="card">
      <div className="card-content flex gap items-center">
        {icon}
        <div>
          <p className="small muted">{title}</p>
          <p className="metric-value">{value}</p>
          <p className="xsmall muted">{note}</p>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, sub, icon, children }) {
  return (
    <div className="card">
      <div className="card-content">
        <div className="flex justify-between items-center">
          <div>
            <h2>{title}</h2>
            {sub && <p className="small muted">{sub}</p>}
          </div>
          {icon}
        </div>
        <div style={{ marginTop: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} disabled readOnly />
    </div>
  );
}

function Filter({ search, setSearch, statusFilter, setStatusFilter, setClaims }) {
  return (
    <div className="card">
      <div className="card-content flex gap" style={{ flexWrap: 'wrap' }}>
        <div className="flex items-center gap" style={{ flex: 1 }}>
          <Search size={16} />
          <input className="input" placeholder="Search employee, email or week..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select className="select" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {['All', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'].map(s => <option key={s}>{s}</option>)}
        </select>

        <button className="btn secondary" onClick={() => setClaims([])}>
          <RefreshCw size={16} /> Clear demo data
        </button>
      </div>
    </div>
  );
}

function ClaimList({ claims, setReceipt, manager, updateClaim, startEditClaim, activeUser }) {
  if (!claims.length) {
    return (
      <div className="card">
        <div className="card-content muted">No records yet. Submit a claim first.</div>
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      {claims.map(c => (
        <div className="card" key={c.id}>
          <div className="card-content">
            <div className="flex justify-between gap" style={{ flexWrap: 'wrap' }}>
              <div>
                <h3>
                  {c.employeeName} — {c.weekLabel || c.week}
                  {' '}
                  <span className={`badge ${c.status}`}>{c.status}</span>
                </h3>
                <p className="small muted">
                  {c.email} • {c.department} {c.submittedAt ? `• Submitted ${c.submittedAt}` : ''}
                </p>
              </div>

              <div>
                <p className="small muted">Expense Total</p>
                <h2>{money(c.totals?.totalExpense)}</h2>
              </div>
            </div>

            <div className="grid grid-4">
              <Mini label="Working Hours" value={`${c.totals?.totalWorkingHours?.toFixed?.(2) || '0.00'} hrs`} />
              <Mini label="Travel Hours" value={`${c.totals?.travelHours?.toFixed?.(2) || '0.00'} hrs`} />
              <Mini label="TIL C/F" value={`${c.totals?.tilBalance?.toFixed?.(2) || '0.00'} hrs`} />
              <Mini label="Receipts" value={`${c.expenses?.filter(e => e.receiptName).length || 0}/${c.expenses?.length || 0}`} />
            </div>

            <div className="wide">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Proof</th>
                  </tr>
                </thead>

                <tbody>
                  {c.expenses?.map(e => (
                    <tr key={e.id}>
                      <td>{e.date || '—'}</td>
                      <td>{e.category}</td>
                      <td>{e.description || '—'}</td>
                      <td><b>{money(e.amount)}</b></td>
                      <td>
                        {e.receiptName
                          ? <button className="btn ghost" onClick={() => setReceipt(e)}><Eye size={16} /> View</button>
                          : 'Missing'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!manager && startEditClaim && <div style={{marginTop:16}}><button className="btn secondary" onClick={() => startEditClaim(c)}>Edit submitted data</button></div>}
            {manager && (
              <div className="space-y-sm" style={{ background: '#f8fafc', padding: 16, borderRadius: 20, marginTop: 16 }}>
                <label className="label">Manager Note</label>
                <textarea className="textarea" value={c.managerNote || ''} onChange={e => updateClaim(c.id, { managerNote: e.target.value })} />

                <button className="btn" onClick={() => updateClaim(c.id, { status: 'Approved' })}>
                  <CheckCircle2 size={16} /> Approve
                </button>
                {' '}
                <button className="btn danger" onClick={() => updateClaim(c.id, { status: 'Rejected' })}>
                  <XCircle size={16} /> Reject
                </button>
                {' '}
                <button className="btn secondary" onClick={() => updateClaim(c.id, { status: 'Paid' })}>
                  Mark as Paid
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 16, padding: 12, marginTop: 12 }}>
      <p className="xsmall muted">{label}</p>
      <b>{value}</b>
    </div>
  );
}

function ReceiptModal({ receipt, close }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between">
          <h2>Receipt Proof</h2>
          <button className="btn secondary" onClick={close}>Close</button>
        </div>

        {receipt.receiptPreview?.startsWith('data:image')
          ? <img className="receipt-thumb" src={receipt.receiptPreview} alt="Receipt" />
          : (
            <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 20 }}>
              <ReceiptText />
              <h3>{receipt.receiptName}</h3>
              <p className="muted">PDF preview will open from Supabase Storage in production.</p>
            </div>
          )}
      </div>
    </div>
  );
}
