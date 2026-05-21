import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Plus, Trash2, Upload, CheckCircle2, XCircle, Clock,
  ReceiptText, Users, FileCheck2, Search, WalletCards,
  CalendarDays, Eye, RefreshCw, Building2, CalendarPlus
} from 'lucide-react';

const STORAGE_KEY = 'timesheet-expense-saas-demo-v3';

const employees = [
  { id: 'EMP001', name: 'Ryan Hei', email: 'ryan@example.com', role: 'Employee', department: 'Production' },
  { id: 'EMP002', name: 'Alex Chan', email: 'alex@example.com', role: 'Employee', department: 'Operations' },
  { id: 'MGR001', name: 'Manager', email: 'manager@example.com', role: 'Manager', department: 'Management' },
];

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const fields = [
  'projectHours',
  'travelHours',
  'workshopHours',
  'holiday',
  'sickness'
];

const categories = ['Travel', 'Hotel', 'Lunch / Dinner', 'Training', 'Mileage', 'Other'];
const leaveTypes = ['Annual Leave', 'Sick Leave', 'Unpaid Leave', 'Other'];
const leaveStatuses = ['All', 'Submitted', 'Approved', 'Rejected'];

function defaultTimesheet() {
  return Object.fromEntries(
    weekDays.map(day => [
      day,
      {
        projectName: '',
        projectHours: '',
        travelHours: '',
        workshopHours: '',
        timeInLieu: '',
        holiday: '',
        sickness: '',
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

function calculateDailyTimeInLieu(row, standardHours) {
  const worked =
    Number(row.projectHours || 0) +
    Number(row.travelHours || 0) +
    Number(row.workshopHours || 0);

  return Math.max(0, worked - Number(standardHours || 7.5));
}

function calculateTotals(timesheet, expenses, til, standardHours) {
  const t = {
    projectHours: 0,
    travelHours: 0,
    workshopHours: 0,
    timeInLieu: 0,
    holiday: 0,
    sickness: 0
  };

  weekDays.forEach(day => {
    fields.forEach(f => {
      t[f] += Number(timesheet[day]?.[f] || 0);
    });

    t.timeInLieu += calculateDailyTimeInLieu(timesheet[day], standardHours);
  });

  const totalWorkingHours = t.projectHours + t.travelHours + t.workshopHours;
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const earnedThisWeek = t.timeInLieu;
  const tilBalance = Number(til.broughtForward || 0) + earnedThisWeek - Number(til.used || 0);

  return { ...t, earnedThisWeek, totalWorkingHours, totalExpense, tilBalance };
}

function getDateList(start, end) {
  if (!start || !end) return [];
  const dates = [];
  const current = new Date(`${start}T00:00:00`);
  const final = new Date(`${end}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(final.getTime()) || current > final) return [];

  while (current <= final) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function countWorkingDays(start, end) {
  return getDateList(start, end).filter(date => {
    const day = new Date(`${date}T00:00:00`).getDay();
    return day !== 0 && day !== 6;
  }).length;
}

function makeCalendarDays(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstGridDay = new Date(firstDay);
  firstGridDay.setDate(firstGridDay.getDate() - ((firstGridDay.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(firstGridDay);
    d.setDate(firstGridDay.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      dayNumber: d.getDate(),
      isCurrentMonth: d.getMonth() === monthIndex
    };
  });
}

function monthLabel(year, monthIndex) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1));
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [activeUser, setActiveUser] = useState(employees[0]);
  const [claims, setClaims] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
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
  const [annualLeaveEntitlement, setAnnualLeaveEntitlement] = useState('28');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('All');
  const [receipt, setReceipt] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [leaveForm, setLeaveForm] = useState({
    type: 'Annual Leave',
    startDate: '',
    endDate: '',
    note: ''
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      setClaims(saved.claims || []);
      setLeaveRequests(saved.leaveRequests || []);
      if (saved.annualLeaveEntitlement) setAnnualLeaveEntitlement(saved.annualLeaveEntitlement);
      if (saved.standardHours) setStandardHours(saved.standardHours);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ claims, leaveRequests, annualLeaveEntitlement, standardHours }));
  }, [claims, leaveRequests, annualLeaveEntitlement, standardHours]);

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

  const visibleLeaveRequests =
    activeUser.role === 'Manager'
      ? leaveRequests
      : leaveRequests.filter(l => l.employeeId === employeeInfo.employeeId);

  const filteredClaims = visibleClaims.filter(c =>
    (!search || `${c.employeeName} ${c.email} ${c.week}`.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'All' || c.status === statusFilter)
  );

  const filteredLeaveRequests = visibleLeaveRequests.filter(l =>
    leaveStatusFilter === 'All' || l.status === leaveStatusFilter
  );

  const categoryMap = {};
  visibleClaims.forEach(c =>
    c.expenses?.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount || 0);
    })
  );

  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  const pending = claims.filter(c => c.status === 'Submitted').length;
  const pendingLeave = leaveRequests.filter(l => l.status === 'Submitted').length;

  const tilOverview = useMemo(() => {
    const visible = activeUser.role === 'Manager' ? claims : claims.filter(c => c.employeeId === employeeInfo.employeeId);
    const historyEarned = visible.reduce((sum, c) => sum + Number(c.totals?.earnedThisWeek || c.totals?.timeInLieu || 0), 0);
    const historyTaken = visible.reduce((sum, c) => sum + Number(c.timeInLieu?.used || 0), 0);
    const currentEarned = Number(totals.earnedThisWeek || 0);
    const currentTaken = Number(timeInLieu.used || 0);
    const broughtForward = Number(timeInLieu.broughtForward || 0);
    const remaining = broughtForward + currentEarned - currentTaken;

    return {
      broughtForward,
      currentEarned,
      currentTaken,
      remaining,
      historyEarned,
      historyTaken
    };
  }, [activeUser.role, claims, employeeInfo.employeeId, totals, timeInLieu]);

  const annualLeaveOverview = useMemo(() => {
    const approvedAL = visibleLeaveRequests
      .filter(l => l.status === 'Approved' && l.type === 'Annual Leave')
      .reduce((sum, l) => sum + Number(l.days || 0), 0);
    const pendingAL = visibleLeaveRequests
      .filter(l => l.status === 'Submitted' && l.type === 'Annual Leave')
      .reduce((sum, l) => sum + Number(l.days || 0), 0);
    const entitlement = Number(annualLeaveEntitlement || 28);
    return { entitlement, approvedAL, pendingAL, remaining: entitlement - approvedAL };
  }, [visibleLeaveRequests, annualLeaveEntitlement]);

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

  const buildClaim = status => ({
    id: crypto.randomUUID(),
    employeeId: employeeInfo.employeeId,
    employeeName: employeeInfo.employeeName,
    email: employeeInfo.email,
    department: employees.find(e => e.id === employeeInfo.employeeId)?.department || 'Production',
    week: selectedWeek,
    weekLabel: weekLabel(selectedWeek),
    status,
    submittedAt: status === 'Submitted' ? new Date().toLocaleString('en-GB') : '',
    timesheet,
    expenses,
    timeInLieu: { ...timeInLieu, earned: String(totals.earnedThisWeek || 0) },
    standardHours,
    totals,
    notes: employeeInfo.notes,
    managerNote: ''
  });

  const saveDraft = () => {
    setClaims(prev => [buildClaim('Draft'), ...prev]);
  };

  const submit = () => {
    setClaims(prev => [buildClaim('Submitted'), ...prev]);
    setTimeInLieu({
      broughtForward: String(totals.tilBalance || 0),
      used: '0'
    });
    setTimesheet(defaultTimesheet());
    setExpenses([makeExpense()]);
    setEmployeeInfo(p => ({ ...p, notes: '' }));
    setTab('dashboard');
  };

  const submitLeave = () => {
    const days = countWorkingDays(leaveForm.startDate, leaveForm.endDate);
    if (!leaveForm.startDate || !leaveForm.endDate || days <= 0) return;

    const request = {
      id: crypto.randomUUID(),
      employeeId: employeeInfo.employeeId,
      employeeName: employeeInfo.employeeName,
      email: employeeInfo.email,
      department: employees.find(e => e.id === employeeInfo.employeeId)?.department || 'Production',
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      days,
      note: leaveForm.note,
      status: 'Submitted',
      submittedAt: new Date().toLocaleString('en-GB'),
      managerNote: ''
    };

    setLeaveRequests(prev => [request, ...prev]);
    setLeaveForm({ type: 'Annual Leave', startDate: '', endDate: '', note: '' });
  };

  const updateClaim = (id, patch) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const updateLeave = (id, patch) => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const clearDemoData = () => {
    setClaims([]);
    setLeaveRequests([]);
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
                  <h1 className="title">Timesheet, Expenses & Leave Portal</h1>
                </div>
              </div>
              <p className="subtitle">
                Weekly timesheets, time in lieu carry-forward, receipt expenses,
                annual leave calendar, manager approval and reporting dashboard.
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
          <Metric label="TIL Remaining" value={`${tilOverview.remaining.toFixed(2)} hrs`} sub="Current balance" icon={<FileCheck2 />} />
          <Metric
            label="Pending Approval"
            value={String(activeUser.role === 'Manager' ? pending + pendingLeave : filteredClaims.filter(c => c.status === 'Submitted').length + visibleLeaveRequests.filter(l => l.status === 'Submitted').length)}
            sub="Claims + leave"
            icon={<Users />}
          />
        </div>

        <div className="tabs">
          {['dashboard', 'submit', 'leave', 'history', 'manager'].map(t => (
            <button
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              key={t}
            >
              {t === 'leave' ? 'Annual Leave' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="space-y">
            <div className="grid grid-2-1">
              <TimeInLieuOverview overview={tilOverview} standardHours={standardHours} />

              <ChartCard title="Expense Categories" sub="By claim history">
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

            <div className="grid grid-3">
              <Insight
                title="Total Expenses"
                value={money(visibleClaims.reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0))}
                note="All visible saved claims"
                icon={<WalletCards />}
              />
              <Insight
                title="Approved / Paid"
                value={money(visibleClaims.filter(c => ['Approved', 'Paid'].includes(c.status)).reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0))}
                note="Manager confirmed amount"
                icon={<CheckCircle2 />}
              />
              <Insight
                title="Annual Leave Remaining"
                value={`${annualLeaveOverview.remaining.toFixed(1)} days`}
                note={`${annualLeaveOverview.approvedAL.toFixed(1)} used / ${annualLeaveOverview.entitlement.toFixed(1)} entitlement`}
                icon={<CalendarDays />}
              />
            </div>

            <AnnualLeaveSummary overview={annualLeaveOverview} />
          </div>
        )}

        {tab === 'submit' && (
          <SubmitForm
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
              totals,
              expenses,
              setExpenses,
              updateExpense,
              uploadReceipt,
              setReceipt,
              saveDraft,
              submit
            }}
          />
        )}

        {tab === 'leave' && (
          <AnnualLeavePage
            {...{
              activeUser,
              employeeInfo,
              annualLeaveEntitlement,
              setAnnualLeaveEntitlement,
              annualLeaveOverview,
              leaveForm,
              setLeaveForm,
              submitLeave,
              calendarMonth,
              setCalendarMonth,
              leaveRequests: filteredLeaveRequests,
              allVisibleLeaveRequests: visibleLeaveRequests,
              leaveStatusFilter,
              setLeaveStatusFilter,
              updateLeave
            }}
          />
        )}

        {tab === 'history' && (
          <>
            <Filter {...{ search, setSearch, statusFilter, setStatusFilter, clearDemoData }} />
            <ClaimList claims={filteredClaims} setReceipt={setReceipt} />
          </>
        )}

        {tab === 'manager' && (
          activeUser.role !== 'Manager'
            ? <div className="card"><div className="card-content muted">Switch to Manager demo user to approve claims and leave requests.</div></div>
            : <>
                <Filter {...{ search, setSearch, statusFilter, setStatusFilter, clearDemoData }} />
                <ClaimList claims={filteredClaims} setReceipt={setReceipt} manager updateClaim={updateClaim} />
                <ManagerLeaveQueue leaveRequests={leaveRequests} updateLeave={updateLeave} />
              </>
        )}
      </div>

      {receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}
    </div>
  );
}

function SubmitForm(p) {
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
          <h2>Weekly Timesheet</h2>

          <div className="wide">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Project / Job</th>
                  <th>Project Hours</th>
                  <th>Travel</th>
                  <th>Workshop</th>
                  <th>Auto Time in Lieu / OT</th>
                  <th>Holiday</th>
                  <th>Sickness</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {weekDays.map(day => {
                  const row = p.timesheet[day];

                  const workedHours =
                    Number(row.projectHours || 0) +
                    Number(row.travelHours || 0) +
                    Number(row.workshopHours || 0);

                  const autoTimeInLieu = Math.max(
                    0,
                    workedHours - Number(p.standardHours || 7.5)
                  );

                  const total =
                    workedHours +
                    Number(row.holiday || 0) +
                    Number(row.sickness || 0);

                  return (
                    <tr key={day}>
                      <td><b>{day}</b></td>

                      <td>
                        <input
                          className="input"
                          type="text"
                          placeholder="Project / Job name"
                          value={row.projectName || ''}
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
                          value={row.holiday}
                          onChange={e => p.updateTimesheet(day, 'holiday', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.sickness}
                          onChange={e => p.updateTimesheet(day, 'sickness', e.target.value)}
                        />
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
          />

          <Field
            label="Time owed brought forward"
            type="number"
            value={p.timeInLieu.broughtForward}
            onChange={v => p.setTimeInLieu({ ...p.timeInLieu, broughtForward: v })}
          />

          <Field
            label="Time taken this week"
            type="number"
            value={p.timeInLieu.used}
            onChange={v => p.setTimeInLieu({ ...p.timeInLieu, used: v })}
          />

          <div className="card-dark">
            <p className="small">Carry Forward</p>
            <h2>{p.totals.tilBalance.toFixed(2)} hrs</h2>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <div className="flex justify-between">
            <h2>Expense Claims</h2>
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
          <label className="label">Employee Notes</label>
          <textarea className="textarea" value={p.employeeInfo.notes} onChange={e => p.setEmployeeInfo({ ...p.employeeInfo, notes: e.target.value })} />

          <button className="btn secondary" onClick={p.saveDraft}>Save Draft</button>
          {' '}
          <button className="btn" onClick={p.submit}>Submit Claim</button>
        </div>
      </div>
    </div>
  );
}

function AnnualLeavePage({
  activeUser,
  employeeInfo,
  annualLeaveEntitlement,
  setAnnualLeaveEntitlement,
  annualLeaveOverview,
  leaveForm,
  setLeaveForm,
  submitLeave,
  calendarMonth,
  setCalendarMonth,
  leaveRequests,
  allVisibleLeaveRequests,
  leaveStatusFilter,
  setLeaveStatusFilter,
  updateLeave
}) {
  const isManager = activeUser.role === 'Manager';
  const selectedDays = countWorkingDays(leaveForm.startDate, leaveForm.endDate);
  const calendarDays = makeCalendarDays(calendarMonth.year, calendarMonth.month);

  const moveMonth = direction => {
    const next = new Date(calendarMonth.year, calendarMonth.month + direction, 1);
    setCalendarMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  const requestsForDate = date => allVisibleLeaveRequests.filter(req => getDateList(req.startDate, req.endDate).includes(date));

  return (
    <div className="space-y">
      <div className="grid grid-4">
        <Metric label="AL Entitlement" value={`${annualLeaveOverview.entitlement.toFixed(1)} days`} sub="Manager configurable" icon={<CalendarDays />} />
        <Metric label="AL Used" value={`${annualLeaveOverview.approvedAL.toFixed(1)} days`} sub="Approved only" icon={<CheckCircle2 />} />
        <Metric label="AL Pending" value={`${annualLeaveOverview.pendingAL.toFixed(1)} days`} sub="Waiting approval" icon={<Clock />} />
        <Metric label="AL Remaining" value={`${annualLeaveOverview.remaining.toFixed(1)} days`} sub="Entitlement - approved" icon={<FileCheck2 />} />
      </div>

      <div className="grid grid-2-1">
        <div className="card">
          <div className="card-content space-y-sm">
            <div className="flex justify-between" style={{ flexWrap: 'wrap' }}>
              <div>
                <h2>Apply Annual Leave</h2>
                <p className="small muted">Create a leave event and submit it for manager approval.</p>
              </div>
              {isManager && (
                <div style={{ width: 220 }}>
                  <Field label="AL entitlement days" type="number" value={annualLeaveEntitlement} onChange={setAnnualLeaveEntitlement} />
                </div>
              )}
            </div>

            <div className="grid grid-4">
              <div>
                <label className="label">Leave Type</label>
                <select className="select" value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}>
                  {leaveTypes.map(type => <option key={type}>{type}</option>)}
                </select>
              </div>
              <Field label="Start Date" type="date" value={leaveForm.startDate} onChange={v => setLeaveForm({ ...leaveForm, startDate: v })} />
              <Field label="End Date" type="date" value={leaveForm.endDate} onChange={v => setLeaveForm({ ...leaveForm, endDate: v })} />
              <div className="card-dark">
                <p className="small">Working Days</p>
                <h2>{selectedDays}</h2>
              </div>
            </div>

            <label className="label">Note / Reason</label>
            <textarea className="textarea" value={leaveForm.note} onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })} placeholder="Optional note for manager..." />

            <button className="btn" onClick={submitLeave}>
              <CalendarPlus size={16} /> Submit Leave Request
            </button>
          </div>
        </div>

        <AnnualLeaveSummary overview={annualLeaveOverview} />
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <div className="flex justify-between" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2>Leave Calendar</h2>
              <p className="small muted">Google Calendar style monthly overview.</p>
            </div>
            <div className="flex gap">
              <button className="btn secondary" onClick={() => moveMonth(-1)}>Previous</button>
              <h3 style={{ minWidth: 180, textAlign: 'center' }}>{monthLabel(calendarMonth.year, calendarMonth.month)}</h3>
              <button className="btn secondary" onClick={() => moveMonth(1)}>Next</button>
            </div>
          </div>

          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="calendar-head">{day}</div>
            ))}
            {calendarDays.map(day => {
              const events = requestsForDate(day.date);
              return (
                <div key={day.date} className="calendar-cell" style={{ opacity: day.isCurrentMonth ? 1 : 0.35 }}>
                  <div className="small"><b>{day.dayNumber}</b></div>
                  {events.slice(0, 3).map(event => (
                    <div key={event.id} className={`leave-pill ${event.status}`} title={`${event.employeeName} - ${event.type}`}>
                      {event.employeeName.split(' ')[0]} • {event.type.replace('Annual Leave', 'AL')}
                    </div>
                  ))}
                  {events.length > 3 && <div className="xsmall muted">+{events.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <div className="flex justify-between" style={{ flexWrap: 'wrap' }}>
            <h2>Leave Requests</h2>
            <select className="select" style={{ width: 180 }} value={leaveStatusFilter} onChange={e => setLeaveStatusFilter(e.target.value)}>
              {leaveStatuses.map(status => <option key={status}>{status}</option>)}
            </select>
          </div>
          <LeaveList leaveRequests={leaveRequests} manager={isManager} updateLeave={updateLeave} />
        </div>
      </div>
    </div>
  );
}

function AnnualLeaveSummary({ overview }) {
  const usedPercent = overview.entitlement > 0 ? Math.min(100, (overview.approvedAL / overview.entitlement) * 100) : 0;
  const pendingPercent = overview.entitlement > 0 ? Math.min(100, (overview.pendingAL / overview.entitlement) * 100) : 0;

  return (
    <div className="card">
      <div className="card-content space-y-sm">
        <h2>Annual Leave Overview</h2>
        <p className="small muted">Based on approved annual leave requests.</p>
        <div style={{ background: '#e2e8f0', borderRadius: 999, height: 14, overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', width: `${usedPercent}%`, height: '100%' }} />
        </div>
        <div className="grid grid-3">
          <Mini label="Entitlement" value={`${overview.entitlement.toFixed(1)} days`} />
          <Mini label="Approved Used" value={`${overview.approvedAL.toFixed(1)} days`} />
          <Mini label="Remaining" value={`${overview.remaining.toFixed(1)} days`} />
        </div>
        <p className="small muted">Pending AL: {overview.pendingAL.toFixed(1)} days ({pendingPercent.toFixed(0)}% of entitlement)</p>
      </div>
    </div>
  );
}

function TimeInLieuOverview({ overview, standardHours }) {
  return (
    <div className="card">
      <div className="card-content space-y-sm">
        <h2>Time in Lieu Overview</h2>
        <p className="small muted">Auto-calculated from Project Hours + Travel + Workshop minus daily standard hours.</p>
        <div className="card-dark">
          <p className="small">Remaining Time in Lieu</p>
          <h2>{overview.remaining.toFixed(2)} hrs</h2>
          <p className="small">Daily standard hours: {Number(standardHours || 7.5).toFixed(2)} hrs</p>
        </div>
        <div className="grid grid-3">
          <Mini label="Brought Forward" value={`${overview.broughtForward.toFixed(2)} hrs`} />
          <Mini label="Earned This Week" value={`${overview.currentEarned.toFixed(2)} hrs`} />
          <Mini label="Taken This Week" value={`${overview.currentTaken.toFixed(2)} hrs`} />
        </div>
        <div className="grid grid-2">
          <Mini label="History Earned" value={`${overview.historyEarned.toFixed(2)} hrs`} />
          <Mini label="History Taken" value={`${overview.historyTaken.toFixed(2)} hrs`} />
        </div>
      </div>
    </div>
  );
}

function ManagerLeaveQueue({ leaveRequests, updateLeave }) {
  return (
    <div className="card">
      <div className="card-content space-y-sm">
        <h2>Manager Leave Approval Queue</h2>
        <LeaveList leaveRequests={leaveRequests} manager updateLeave={updateLeave} />
      </div>
    </div>
  );
}

function LeaveList({ leaveRequests, manager, updateLeave }) {
  if (!leaveRequests.length) {
    return <div className="muted">No leave requests yet.</div>;
  }

  return (
    <div className="wide">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            <th>Note</th>
            {manager && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {leaveRequests.map(req => (
            <tr key={req.id}>
              <td><b>{req.employeeName}</b><br /><span className="small muted">{req.department}</span></td>
              <td>{req.type}</td>
              <td>{req.startDate} → {req.endDate}</td>
              <td><b>{req.days}</b></td>
              <td><span className={`badge ${req.status}`}>{req.status}</span></td>
              <td>{req.note || '—'}</td>
              {manager && (
                <td>
                  <button className="btn" onClick={() => updateLeave(req.id, { status: 'Approved' })}><CheckCircle2 size={16} />Approve</button>
                  {' '}
                  <button className="btn danger" onClick={() => updateLeave(req.id, { status: 'Rejected' })}><XCircle size={16} />Reject</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
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

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Filter({ search, setSearch, statusFilter, setStatusFilter, clearDemoData }) {
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

        <button className="btn secondary" onClick={clearDemoData}>
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
              <Mini label="TIL Earned" value={`${(c.totals?.earnedThisWeek || c.totals?.timeInLieu || 0).toFixed?.(2) || '0.00'} hrs`} />
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

