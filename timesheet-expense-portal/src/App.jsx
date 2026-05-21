import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
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
  'travelHours',
  'workshopHours'
];

const categories = ['Travel', 'Hotel', 'Lunch / Dinner', 'Mileage', 'Other'];

function defaultTimesheet() {
  return Object.fromEntries(
    weekDays.map(day => [
      day,
      {
        projectName: '',
        projectHours: '',
        travelHours: '',
        workshopHours: '',
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
    mileageMiles: '',
    mileagePassenger1: false,
    mileagePassenger2: false,
    receiptName: '',
    receiptPreview: ''
  };
}

function calculateMileageRate(expense) {
  return 0.45 + (expense.mileagePassenger1 ? 0.05 : 0) + (expense.mileagePassenger2 ? 0.05 : 0);
}

function calculateExpenseAmount(expense) {
  if (expense.category === 'Mileage') {
    return Number(expense.mileageMiles || 0) * calculateMileageRate(expense);
  }

  return Number(expense.amount || 0);
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

function calculateDailyTimeInLieu(row, standardHours) {
  const worked =
    Number(row.projectHours || 0) +
    Number(row.travelHours || 0) +
    Number(row.workshopHours || 0);

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
    workshopHours: 0,
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

  const totalWorkingHours = t.projectHours + t.travelHours + t.workshopHours;
  const totalExpense = expenses.reduce((sum, e) => sum + calculateExpenseAmount(e), 0);
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [receipt, setReceipt] = useState(null);

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
        categoryMap[e.category] = (categoryMap[e.category] || 0) + calculateExpenseAmount(e);
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
      workshopHours: totals.workshopHours,
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
            <ClaimList claims={filteredClaims} setReceipt={setReceipt} />
          </>
        )}

        {tab === 'manager' && (
          activeUser.role !== 'Manager'
            ? <div className="card"><div className="card-content muted">Switch to Manager demo user to approve claims.</div></div>
            : <>
                <Filter {...{ search, setSearch, statusFilter, setStatusFilter, setClaims }} />
                <ClaimList claims={filteredClaims} setReceipt={setReceipt} manager updateClaim={updateClaim} />
              </>
        )}
      </div>

      {receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}
    </div>
  );
}

function Dashboard({ visibleClaims, categoryData, totals }) {
  const timesheetClaims = visibleClaims.filter(c => c.type === 'timesheet' || (!c.type && c.timesheet));
  const expenseClaims = visibleClaims.filter(c => c.type === 'expense' || (!c.type && c.expenses));

  const totalWorkingHours = timesheetClaims.reduce((s, c) => s + Number(c.totals?.totalWorkingHours || 0), 0);
  const totalAutoTil = timesheetClaims.reduce((s, c) => s + Number(c.totals?.timeInLieu || 0), 0);
  const latestTilBalance = timesheetClaims[0]?.totals?.tilBalance ?? totals.tilBalance;
  const totalExpenses = expenseClaims.reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);
  const approvedPaidExpenses = expenseClaims
    .filter(c => ['Approved', 'Paid'].includes(c.status))
    .reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);

  return (
    <div className="space-y">
      <div className="grid grid-3">
        <Insight
          title="Total Working Hours"
          value={`${totalWorkingHours.toFixed(2)} hrs`}
          note="Submitted timesheets"
          icon={<Clock />}
        />
        <Insight
          title="Time in Lieu Remaining"
          value={`${Number(latestTilBalance || 0).toFixed(2)} hrs`}
          note="Latest carry forward balance"
          icon={<FileCheck2 />}
        />
        <Insight
          title="Total Auto OT / TIL"
          value={`${totalAutoTil.toFixed(2)} hrs`}
          note="Project + Travel + Workshop - standard hours"
          icon={<TrendingUp />}
        />
      </div>

      <div className="grid grid-3">
        <Insight
          title="Total Expenses"
          value={money(totalExpenses)}
          note="Submitted expense claims"
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
          value={String(visibleClaims.length)}
          note="Timesheet + expense records"
          icon={<CalendarDays />}
        />
      </div>

      <ChartCard title="Expense Categories" sub="By expense claim history">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={95} label>
              {categoryData.map((_, i) => <Cell key={i} />)}
            </Pie>
            <Tooltip formatter={v => money(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function TimesheetForm(p) {
  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content grid grid-4">
          <Field label="Employee Name" value={p.employeeInfo.employeeName} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, employeeName: v })} />
          <Field label="Email" value={p.employeeInfo.email} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, email: v })} />
          <Field label="Employee ID" value={p.employeeInfo.employeeId} onChange={v => p.setEmployeeInfo({ ...p.employeeInfo, employeeId: v })} />
          <div>
            <label className="label">Week</label>
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
            <button className="btn secondary" onClick={() => p.setTab('expense')}>Go to Expense</button>
          </div>

          <div className="wide">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Project / Job</th>
                  <th>Project Hours</th>
                  <th>Travel</th>
                  <th>Workshop</th>
                  <th>Time in Lieu</th>
                  <th>Take back Time in Lieu</th>
                  <th>Holiday</th>
                  <th>Sickness</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {weekDays.map(day => {
                  const row = p.timesheet[day];
                  const dailyHours = Number(p.standardHours || 7.5);
                  const holidayType = row.holidayType || 'none';
                  const sicknessSelected = row.sickness === true;
                  const leaveSelected = holidayType === 'half' || holidayType === 'full' || sicknessSelected;

                  const workedHours = leaveSelected
                    ? 0
                    : Number(row.projectHours || 0) +
                      Number(row.travelHours || 0) +
                      Number(row.workshopHours || 0);

                  const holidayHours =
                    holidayType === 'full' ? dailyHours :
                    holidayType === 'half' ? dailyHours / 2 :
                    0;

                  const takeBackHours = leaveSelected ? 0 : Number(row.takeBackTimeInLieu || 0);
                  const sicknessHours = sicknessSelected ? dailyHours : 0;
                  const autoTimeInLieu = leaveSelected ? 0 : Math.max(0, workedHours - dailyHours);
                  const total = workedHours + takeBackHours + holidayHours + sicknessHours;

                  const clearWorkingInputs = () => {
                    p.updateTimesheet(day, 'projectName', '');
                    p.updateTimesheet(day, 'projectHours', '');
                    p.updateTimesheet(day, 'travelHours', '');
                    p.updateTimesheet(day, 'workshopHours', '');
                  };

                  const setHoliday = (type) => {
                    const nextType = holidayType === type ? 'none' : type;
                    p.updateTimesheet(day, 'holidayType', nextType);
                    p.updateTimesheet(day, 'takeBackTimeInLieu', '');
                    p.updateTimesheet(day, 'sickness', false);
                    if (nextType !== 'none') clearWorkingInputs();
                  };

                  const setSickness = () => {
                    const nextValue = !sicknessSelected;
                    p.updateTimesheet(day, 'sickness', nextValue);
                    p.updateTimesheet(day, 'holidayType', 'none');
                    p.updateTimesheet(day, 'takeBackTimeInLieu', '');
                    if (nextValue) clearWorkingInputs();
                  };

                  return (
                    <tr key={day}>
                      <td><b>{day}</b></td>

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

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.workshopHours}
                          disabled={leaveSelected}
                          onChange={e => p.updateTimesheet(day, 'workshopHours', e.target.value)}
                        />
                      </td>

                      <td><b>{autoTimeInLieu.toFixed(2)}</b></td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          placeholder="0"
                          value={row.takeBackTimeInLieu || ''}
                          disabled={leaveSelected}
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

          {p.expenses.map((e, i) => {
            const mileageRate = calculateMileageRate(e);
            const mileageTotal = calculateExpenseAmount(e);

            return (
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 2fr 1.5fr auto', alignItems: 'start' }} key={e.id}>
                <input className="input" type="date" value={e.date} onChange={ev => p.updateExpense(i, 'date', ev.target.value)} />

                <select className="select" value={e.category} onChange={ev => p.updateExpense(i, 'category', ev.target.value)}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>

                {e.category === 'Mileage' ? (
                  <div className="space-y-sm">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Business miles"
                      value={e.mileageMiles || ''}
                      onChange={ev => p.updateExpense(i, 'mileageMiles', ev.target.value)}
                    />
                    <div className="small muted">
                      Formula: miles × (45p driver + 5p passenger 1 + 5p passenger 2)
                    </div>
                    <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={e.mileagePassenger1 === true}
                        onChange={ev => p.updateExpense(i, 'mileagePassenger1', ev.target.checked)}
                      />
                      Passenger 1 (+5p/mile)
                    </label>
                    <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={e.mileagePassenger2 === true}
                        onChange={ev => p.updateExpense(i, 'mileagePassenger2', ev.target.checked)}
                      />
                      Passenger 2 (+5p/mile)
                    </label>
                    <div className="small">
                      Rate: <b>{money(mileageRate)}</b> / mile · Total: <b>{money(mileageTotal)}</b>
                    </div>
                  </div>
                ) : (
                  <input className="input" type="number" placeholder="Amount" value={e.amount} onChange={ev => p.updateExpense(i, 'amount', ev.target.value)} />
                )}

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
            );
          })}
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

function ClaimList({ claims, setReceipt, manager, updateClaim }) {
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
                      <td><b>{money(calculateExpenseAmount(e))}</b></td>
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
