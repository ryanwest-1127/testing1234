import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tooltip, ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Legend
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
  { id: 'EMP003', name: 'Jordan Lee', email: 'jordan@example.com', role: 'Employee', department: 'Workshop' },
  { id: 'EMP004', name: 'Sam Wong', email: 'sam@example.com', role: 'Employee', department: 'Accounts' },
  { id: 'MGR001', name: 'Boss', email: 'boss@example.com', role: 'Manager', department: 'Management' },
];

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fields = [
  'projectHours',
  'travelHours'
];

const categories = ['Travel', 'Hotel', 'Lunch / Dinner', 'Training', 'Mileage', 'Other'];

const vatRateOptions = [
  { value: '20', label: '20% VAT' },
  { value: '5', label: '5% VAT' },
  { value: '0', label: 'No VAT / 0%' },
  { value: 'custom', label: 'Custom' },
];

function formatDateDDMMYYYY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function parseWeekValue(weekValue) {
  const match = String(weekValue || '').match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const year = new Date().getFullYear();
    return { year, week: 1 };
  }
  return { year: Number(match[1]), week: Number(match[2]) };
}

function makeWeekValue(year, week) {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getBusinessYearFirstMonday(year) {
  const jan1 = new Date(Number(year), 0, 1);
  const jan1Day = jan1.getDay() || 7; // Mon = 1, Sun = 7
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - (jan1Day - 1));
  return firstMonday;
}

function getWeeksInBusinessYear(year) {
  const firstMonday = getBusinessYearFirstMonday(year);
  const dec31 = new Date(Number(year), 11, 31);
  const days = Math.floor((dec31 - firstMonday) / 86400000) + 1;
  return Math.ceil(days / 7);
}

function getBusinessWeekStart(weekValue) {
  const { year, week } = parseWeekValue(weekValue);
  const firstMonday = getBusinessYearFirstMonday(year);
  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (Number(week || 1) - 1) * 7);
  return start;
}

function getWeekDates(weekValue) {
  const { year } = parseWeekValue(weekValue);
  const start = getBusinessWeekStart(weekValue);

  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      day,
      date,
      label: date.getFullYear() === year ? formatDateDDMMYYYY(date) : '',
      inYear: date.getFullYear() === year
    };
  });
}

function getBusinessWeekNumberFromDate(date, businessYear = date.getFullYear()) {
  const firstMonday = getBusinessYearFirstMonday(businessYear);
  const diffDays = Math.floor((date - firstMonday) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function getDateForWeekDay(week, dayIndex) {
  const item = getWeekDates(week)[dayIndex];
  return item?.label || '—';
}

function weekLabel(week) {
  const { year, week: weekNumber } = parseWeekValue(week);
  return `Week ${weekNumber}, ${year}`;
}

function currentBusinessWeekValue() {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.min(getWeeksInBusinessYear(year), Math.max(1, getBusinessWeekNumberFromDate(now, year)));
  return makeWeekValue(year, week);
}

function nearestCurrentOrPastWeekClaim(claims) {
  if (!claims.length) return null;
  const currentWeek = currentBusinessWeekValue();
  const sortedClaims = [...claims].sort((a, b) => String(a.week || '').localeCompare(String(b.week || '')));
  return [...sortedClaims].reverse().find(claim => String(claim.week || '') <= currentWeek) || sortedClaims[0];
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthValue) {
  const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthValue || 'No month';

  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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
        sicknessType: 'none',
        sickness: false,
      }
    ])
  );
}

function makeExpense() {
  return {
    id: crypto.randomUUID(),
    date: '',
    projectName: '',
    category: 'Travel',
    description: '',
    amount: '',
    vatRate: '20',
    vat: '',
    receiptName: '',
    receiptPreview: ''
  };
}

function calculateVATFromGrossAmount(amount, rate) {
  const gross = Number(amount || 0);
  const vatRate = Number(rate || 0);

  if (!gross || !vatRate) return '';

  return (gross * vatRate / (100 + vatRate)).toFixed(2);
}

function money(v) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(Number(v || 0));
}








function getWeekStartDate(weekValue) {
  if (!weekValue || !weekValue.includes('-W')) return new Date();
  const [yearText, weekText] = weekValue.split('-W');
  const year = Number(yearText);
  const weekNumber = Number(weekText);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (weekNumber - 1) * 7);
  return monday;
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

  if (row.sicknessType === 'full') return dailyHours;
  if (row.sicknessType === 'half') return dailyHours / 2;
  if (row.sickness === true) return dailyHours;

  // Backwards compatibility for older saved demo data.
  return Number(row.sickness || 0);
}

function calculateTakeBackTimeInLieuHours(row) {
  return Number(row.takeBackTimeInLieu || 0);
}

function isLeaveDay(row) {
  return row.holidayType === 'half' ||
    row.holidayType === 'full' ||
    row.sicknessType === 'half' ||
    row.sicknessType === 'full' ||
    row.sickness === true;
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
  const totalVAT = expenses.reduce((sum, e) => sum + Number(e.vat || 0), 0);
  const tilBalance = t.timeInLieu - t.takeBackTimeInLieu;

  return { ...t, totalWorkingHours, totalExpense, totalVAT, tilBalance };
}




function getDatesBetween(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function calculateLeaveDays(request) {
  const dates = getDatesBetween(request.startDate, request.endDate);
  const workingDates = dates.filter(d => {
    const day = d.getDay();
    return day !== 0 && day !== 6;
  });
  return workingDates.length * (request.duration === 'half' ? 0.5 : 1);
}

function calculateApprovedLeaveDays(requests) {
  return requests
    .filter(r => r.status === 'Approved')
    .reduce((sum, r) => sum + calculateLeaveDays(r), 0);
}

function formatISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function approvedSicknessItemsFromClaims(claims) {
  return (claims || [])
    .filter(claim => claimTypeOf(claim) === 'timesheet' && claim.status === 'Approved')
    .flatMap(claim => weekDays.flatMap((day, index) => {
      const row = claim.timesheet?.[day] || {};
      const sicknessHours = calculateSicknessHours(row, claim.standardHours || 7.5);
      if (!sicknessHours) return [];

      const weekDate = getWeekDates(claim.week || '')[index];
      if (!weekDate?.date || !weekDate.inYear) return [];

      const date = formatISODateLocal(weekDate.date);
      return [{
        id: `${claim.id}-${day}-sickness`,
        employeeId: claim.employeeId,
        employeeName: claim.employeeName,
        startDate: date,
        endDate: date,
        status: 'Sickness',
        duration: sicknessHours < Number(claim.standardHours || 7.5) ? 'half' : 'full',
        calendarType: 'sickness'
      }];
    }));
}


function claimTypeOf(claim) {
  return claim.type || (claim.expenses ? 'expense' : 'timesheet');
}

function claimPeriodKey(claim) {
  return claimTypeOf(claim) === 'expense'
    ? claim.expenseMonth || claim.month || claim.week || ''
    : claim.week || '';
}

function getClaimExpenseMonth(claim) {
  return claim.expenseMonth ||
    claim.month ||
    claim.expenses?.find(expense => expense.date)?.date?.slice(0, 7) ||
    currentMonthValue();
}

function claimUniqueKey(claim) {
  return `${claim.employeeId || ''}|${claimPeriodKey(claim)}|${claimTypeOf(claim)}`;
}

function uniqueClaimsByEmployeeWeekType(claims) {
  const seen = new Set();
  const result = [];

  (claims || []).forEach(claim => {
    const key = claimUniqueKey(claim);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(claim);
  });

  return result;
}

function sanitizeFilenamePart(value) {
  return String(value || 'receipt')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'receipt';
}

function receiptDownloadItemsFromClaims(claims) {
  const receiptItems = uniqueClaimsByEmployeeWeekType(claims || [])
    .filter(claim => claimTypeOf(claim) === 'expense')
    .flatMap(claim => (claim.expenses || [])
      .filter(expense => expense.receiptName && expense.receiptPreview)
      .map(expense => ({ claim, expense })));

  return receiptItems.map(({ claim, expense }, index) => {
    const datePart = sanitizeFilenamePart(
      (expense.date || claim.expenseMonth || getClaimExpenseMonth(claim) || 'no-date').replaceAll('-', '_')
    );
    const categoryPart = sanitizeFilenamePart(expense.category || 'Expense');
    const projectPart = sanitizeFilenamePart(expense.projectName || expense.description || claim.employeeName || 'PJ');
    const originalExtension = String(expense.receiptName || '').match(/\.[a-z0-9]+$/i)?.[0] || '';

    return {
      href: expense.receiptPreview,
      filename: `${datePart}_${categoryPart}_${projectPart}_${String(index + 1).padStart(3, '0')}${originalExtension}`
    };
  });
}

function downloadReceiptItems(items) {
  (items || []).forEach((item, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = item.href;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 150);
  });
}

function expensesMissingReceipts(expenses) {
  return (expenses || []).some(expense => !expense.receiptName || !expense.receiptPreview);
}

function getDashboardSummary(claims, selectedWeek, weeklyStandardHours, leaveRequests = []) {
  const cleanClaims = uniqueClaimsByEmployeeWeekType(claims);
  const timesheetClaims = cleanClaims.filter(c => c.type === 'timesheet' || (!c.type && c.timesheet));
  const expenseClaims = cleanClaims.filter(c => c.type === 'expense' || (!c.type && c.expenses));

  const weekOptions = Array.from(new Set(timesheetClaims.map(c => c.week).filter(Boolean))).sort();
  const latestSubmittedWeek = weekOptions.length ? weekOptions[weekOptions.length - 1] : selectedWeek;

  const selectedWeekOnly = selectedWeek || latestSubmittedWeek;
  const weekOnlyTimesheetClaims = timesheetClaims.filter(c => c.week === selectedWeekOnly);

  const totalWorkingHours = weekOnlyTimesheetClaims.reduce((s, c) => s + Number(c.totals?.totalWorkingHours || 0), 0);
  const targetHours = Number(weeklyStandardHours || 0);

  const timeInLieuRemaining = timesheetClaims.reduce(
    (s, c) => s + Number(c.totals?.timeInLieu || 0) - Number(c.totals?.takeBackTimeInLieu || 0),
    0
  );

  const totalExpenseClaims = expenseClaims.reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);
  const approvedPaidExpenses = expenseClaims
    .filter(c => ['Approved', 'Paid'].includes(c.status))
    .reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);

  const outstandingExpenses = Math.max(0, totalExpenseClaims - approvedPaidExpenses);
  const pendingApproval = cleanClaims.filter(c => c.status === 'Submitted').length;

  return {
    totalWorkingHours,
    targetHours,
    timeInLieuRemaining,
    totalExpenseClaims,
    approvedPaidExpenses,
    outstandingExpenses,
    pendingApproval,
    annualLeaveRemaining: Math.max(0, 28 - calculateApprovedLeaveDays(leaveRequests)),
    annualLeaveTotal: 28
  };
}



function sanitizeTimesheetForSelectedWeek(timesheet, selectedWeek) {
  const weekDates = getWeekDates(selectedWeek);
  const cleaned = { ...timesheet };

  weekDays.forEach((day, index) => {
    if (weekDates[index]?.inYear === false) {
      cleaned[day] = {
        ...cleaned[day],
        projectName: '',
        projectHours: '',
        travelHours: '',
        holidayType: 'none',
        takeBackTimeInLieu: '',
        sicknessType: 'none',
        sickness: false
      };
    }
  });

  return cleaned;
}

function tabLabel(tab) {
  if (tab === 'timesheet') return 'Timesheet';
  if (tab === 'expense') return 'Expense';
  if (tab === 'annualLeave') return 'Annual Leave';
  return tab[0].toUpperCase() + tab.slice(1);
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [activeUser, setActiveUser] = useState(employees[0]);
  const [managerDataMode, setManagerDataMode] = useState('overall');
  const [viewEmployeeId, setViewEmployeeId] = useState('All');
  const [claims, setClaims] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [alForm, setAlForm] = useState({ startDate: '', endDate: '', duration: 'full', reason: '' });
  const [alError, setAlError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [alMonth, setAlMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [highlightedLeaveId, setHighlightedLeaveId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('2026-W21');
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState(currentMonthValue());

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
  const [historyTypeFilter, setHistoryTypeFilter] = useState('All');
  const [receipt, setReceipt] = useState(null);
  const [editingClaimId, setEditingClaimId] = useState(null);
  const [editingOriginalClaim, setEditingOriginalClaim] = useState(null);
  const [reviewingClaimId, setReviewingClaimId] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      setClaims(saved.claims || []);
      setLeaveRequests(saved.leaveRequests || []);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ claims, leaveRequests }));
  }, [claims, leaveRequests]);

  useEffect(() => {
    const defaultEmployee = activeUser.role === 'Manager' && managerDataMode === 'overall'
      ? employees.find(e => e.role !== 'Manager') || activeUser
      : activeUser;

    if (activeUser.role === 'Manager') {
      setViewEmployeeId('All');
    } else {
      setViewEmployeeId(activeUser.id);
    }

    setEmployeeInfo({
      employeeId: defaultEmployee.id,
      employeeName: defaultEmployee.name,
      email: defaultEmployee.email,
      notes: ''
    });
    setReviewingClaimId(null);
  }, [activeUser, managerDataMode]);

  const totals = useMemo(
  () => calculateTotals(timesheet, expenses, timeInLieu, standardHours),
  [timesheet, expenses, timeInLieu, standardHours]
);

  const currentExpenseTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );

  const currentVATTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.vat || 0), 0),
    [expenses]
  );

  const cleanClaims = uniqueClaimsByEmployeeWeekType(claims);

  const accountClaims =
    activeUser.role === 'Manager' && managerDataMode === 'overall'
      ? cleanClaims
      : cleanClaims.filter(c => c.employeeId === activeUser.id);

  const visibleClaims =
    activeUser.role === 'Manager' && managerDataMode === 'overall' && viewEmployeeId !== 'All'
      ? accountClaims.filter(c => c.employeeId === viewEmployeeId)
      : accountClaims;

  const accountLeaveRequests =
    activeUser.role === 'Manager' && managerDataMode === 'overall'
      ? leaveRequests
      : leaveRequests.filter(r => r.employeeId === activeUser.id);

  const summaryLeaveRequests =
    activeUser.role === 'Manager' && managerDataMode === 'overall' && viewEmployeeId !== 'All'
      ? accountLeaveRequests.filter(r => r.employeeId === viewEmployeeId)
      : accountLeaveRequests;

  const dashboardSummary = useMemo(
    () => getDashboardSummary(visibleClaims, selectedWeek, weeklyStandardHours, summaryLeaveRequests),
    [visibleClaims, selectedWeek, weeklyStandardHours, summaryLeaveRequests]
  );

  const topCardClaims = cleanClaims.filter(c => c.employeeId === activeUser.id);
  const topCardLeaveRequests = leaveRequests.filter(r => r.employeeId === activeUser.id);

  const topCardSummary = useMemo(
    () => getDashboardSummary(topCardClaims, selectedWeek, weeklyStandardHours, topCardLeaveRequests),
    [topCardClaims, selectedWeek, weeklyStandardHours, topCardLeaveRequests]
  );
  const companyTopCardClaims = cleanClaims.filter(c => employees.some(employee => employee.role !== 'Manager' && employee.id === c.employeeId));
  const companyTopCardLeaveRequests = leaveRequests.filter(r => employees.some(employee => employee.role !== 'Manager' && employee.id === r.employeeId));
  const companyTopCardSummary = useMemo(
    () => getDashboardSummary(companyTopCardClaims, selectedWeek, weeklyStandardHours, companyTopCardLeaveRequests),
    [companyTopCardClaims, selectedWeek, weeklyStandardHours, companyTopCardLeaveRequests]
  );
  const companyAlSubmitted = companyTopCardLeaveRequests.filter(request => request.status === 'Submitted').length;
  const companyAlApproved = companyTopCardLeaveRequests.filter(request => request.status === 'Approved').length;
  const companyTilByEmployee = employees
    .filter(employee => employee.role !== 'Manager')
    .map(employee => {
      const employeeClaims = companyTopCardClaims.filter(claim => claim.employeeId === employee.id && claimTypeOf(claim) === 'timesheet');
      const balance = employeeClaims.reduce(
        (sum, claim) => sum + Number(claim.totals?.timeInLieu || 0) - Number(claim.totals?.takeBackTimeInLieu || 0),
        0
      );

      return { name: employee.name, balance };
    })
    .filter(item => item.balance > 0);
  const companyTilTotal = companyTilByEmployee.reduce((sum, item) => sum + item.balance, 0);
  const companyTilSummary = companyTilByEmployee.length
    ? companyTilByEmployee.map(item => `${item.name}: ${item.balance.toFixed(2)}h`).join(' | ')
    : 'No employee TIL balance';
  const companyExpenseClaimsForCards = companyTopCardClaims.filter(claim => claimTypeOf(claim) === 'expense');
  const companyExpenseSubmittedTotal = companyExpenseClaimsForCards
    .filter(claim => claim.status === 'Submitted')
    .reduce((sum, claim) => sum + Number(claim.totals?.totalExpense || 0), 0);
  const companyExpenseApprovedTotal = companyExpenseClaimsForCards
    .filter(claim => claim.status === 'Approved')
    .reduce((sum, claim) => sum + Number(claim.totals?.totalExpense || 0), 0);
  const companyExpensePendingTotal = companyExpenseSubmittedTotal + companyExpenseApprovedTotal;
  const summaryCardsMode = activeUser.role === 'Manager' ? managerDataMode : 'personal';
  const summaryCardsData = summaryCardsMode === 'overall' ? companyTopCardSummary : topCardSummary;
  const reviewingClaim = reviewingClaimId
    ? claims.find(claim => claim.id === reviewingClaimId)
    : null;
  const managerPersonalMode = activeUser.role === 'Manager' && managerDataMode === 'personal';
  const visibleTabs = activeUser.role === 'Manager'
    ? managerDataMode === 'overall'
      ? []
      : ['dashboard', 'timesheet', 'expense', 'annualLeave', 'history']
    : ['dashboard', 'timesheet', 'expense', 'annualLeave', 'history'];

  const switchManagerDataMode = (mode) => {
    setManagerDataMode(mode);
    setReviewingClaimId(null);
    setEditingClaimId(null);
    setEditingOriginalClaim(null);
    setExpenseError('');
    setTab('dashboard');
    setViewEmployeeId(mode === 'overall' ? 'All' : activeUser.id);
  };

  const filteredClaims = visibleClaims.filter(c => {
    const claimType = c.type || (c.expenses ? 'expense' : 'timesheet');
    const periodText = c.periodLabel || c.expenseMonth || c.weekLabel || c.week || '';

    return (
      (!search || `${c.employeeName} ${c.email} ${periodText}`.toLowerCase().includes(search.toLowerCase())) &&
      (historyTypeFilter === 'All' || claimType === historyTypeFilter)
    );
  });

  const setClaimEmployee = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId) || employees[0];
    setEmployeeInfo(prev => ({
      ...prev,
      employeeId: employee.id,
      employeeName: employee.name,
      email: employee.email
    }));
  };

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
    setExpenseError('');
    setExpenses(prev =>
      prev.map((e, idx) => {
        if (idx !== i) return e;

        const updated = { ...e, [field]: value };
        const selectedVatRate = updated.vatRate || 'custom';

        if (field === 'vat') {
          return { ...updated, vatRate: 'custom' };
        }

        if (selectedVatRate !== 'custom' && (field === 'amount' || field === 'vatRate')) {
          return {
            ...updated,
            vat: calculateVATFromGrossAmount(updated.amount, selectedVatRate)
          };
        }

        return updated;
      })
    );
  };

  const uploadReceipt = (i, file) => {
    if (!file) return;

    setExpenseError('');
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

  const buildTimesheetClaim = status => {
    const cleanedTimesheet = sanitizeTimesheetForSelectedWeek(timesheet, selectedWeek);
    const cleanedTotals = calculateTotals(cleanedTimesheet, expenses, timeInLieu, standardHours);

    return {
      ...commonClaimFields(status),
      type: 'timesheet',
      timesheet: cleanedTimesheet,
      timeInLieu,
      standardHours,
      totals: {
        projectHours: cleanedTotals.projectHours,
        travelHours: cleanedTotals.travelHours,
        holiday: cleanedTotals.holiday,
        takeBackTimeInLieu: cleanedTotals.takeBackTimeInLieu,
        sickness: cleanedTotals.sickness,
        timeInLieu: cleanedTotals.timeInLieu,
        totalWorkingHours: cleanedTotals.totalWorkingHours,
        tilBalance: cleanedTotals.tilBalance
      }
    };
  };

  const buildExpenseClaim = status => ({
    ...commonClaimFields(status),
    type: 'expense',
    week: '',
    weekLabel: '',
    expenseMonth: expenses.find(expense => expense.date)?.date?.slice(0, 7) || selectedExpenseMonth || currentMonthValue(),
    periodLabel: monthLabel(expenses.find(expense => expense.date)?.date?.slice(0, 7) || selectedExpenseMonth || currentMonthValue()),
    expenses,
    totals: { totalExpense: currentExpenseTotal, totalVAT: currentVATTotal }
  });

  const saveDraft = () => {
    upsertClaim(buildTimesheetClaim('Draft'));
  };

  const submitTimesheet = () => {
    upsertClaim(buildTimesheetClaim('Submitted'));
    setTimeInLieu({ used: '0' });
    setTimesheet(defaultTimesheet());
    setEmployeeInfo(p => ({ ...p, notes: '' }));
    setTab('dashboard');
  };

  const submitExpense = () => {
    setExpenseError('');

    if (expensesMissingReceipts(expenses)) {
      setExpenseError('Every expense item needs a receipt proof before it can be submitted.');
      return;
    }

    upsertClaim(buildExpenseClaim('Submitted'));
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
    setReviewingClaimId(null);
    setTimesheet(claim.timesheet || defaultTimesheet());
    setExpenses(claim.expenses || [makeExpense()]);
    setTimeInLieu(claim.timeInLieu || { used: '0', earned: '0' });
    setEmployeeInfo({
      employeeId: claim.employeeId,
      employeeName: claim.employeeName,
      email: claim.email,
      notes: claim.notes || ''
    });
    if (claim.standardHours) setStandardHours(String(claim.standardHours));
    if (claim.week) setSelectedWeek(claim.week);
    if (claimTypeOf(claim) === 'expense') {
      setSelectedExpenseMonth(getClaimExpenseMonth(claim));
    }
    setEditingClaimId(claim.id);
    setEditingOriginalClaim(claim);
    setTab(claim.type === 'expense' ? 'expense' : 'timesheet');
  };

  const openClaimForReview = (claim) => {
    setEditingClaimId(null);
    setEditingOriginalClaim(null);
    setReviewingClaimId(claim.id);
    setViewEmployeeId(claim.employeeId);
    setTab(claimTypeOf(claim));
  };

  const saveEditedClaim = () => {
    if (!editingClaimId || !editingOriginalClaim) return;

    const originalType = editingOriginalClaim.type || (editingOriginalClaim.expenses ? 'expense' : 'timesheet');

    let updatedClaim;

    if (originalType === 'expense') {
      setExpenseError('');

      if (expensesMissingReceipts(expenses)) {
        setExpenseError('Every expense item needs a receipt proof before expense changes can be saved.');
        setTab('expense');
        return;
      }

      const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const vatTotal = expenses.reduce((sum, e) => sum + Number(e.vat || 0), 0);
      const selectedEmployee = employees.find(e => e.id === employeeInfo.employeeId);
      const inferredExpenseMonth = expenses.find(expense => expense.date)?.date?.slice(0, 7) || getClaimExpenseMonth(editingOriginalClaim) || currentMonthValue();

      updatedClaim = {
        ...editingOriginalClaim,
        employeeId: employeeInfo.employeeId,
        employeeName: employeeInfo.employeeName,
        email: employeeInfo.email,
        department: selectedEmployee?.department || editingOriginalClaim.department || 'Production',
        week: '',
        weekLabel: '',
        expenseMonth: inferredExpenseMonth,
        periodLabel: monthLabel(inferredExpenseMonth),
        expenses,
        totals: { totalExpense: expenseTotal, totalVAT: vatTotal },
        notes: employeeInfo.notes,
        status: editingOriginalClaim.status || 'Submitted',
        editedAt: new Date().toLocaleString('en-GB')
      };
    } else {
      const cleanedTimesheet = sanitizeTimesheetForSelectedWeek(timesheet, selectedWeek);
      const cleanedTotals = calculateTotals(cleanedTimesheet, expenses, timeInLieu, standardHours);
      const selectedEmployee = employees.find(e => e.id === employeeInfo.employeeId);

      updatedClaim = {
        ...editingOriginalClaim,
        employeeId: employeeInfo.employeeId,
        employeeName: employeeInfo.employeeName,
        email: employeeInfo.email,
        department: selectedEmployee?.department || editingOriginalClaim.department || 'Production',
        week: selectedWeek,
        weekLabel: weekLabel(selectedWeek),
        timesheet: cleanedTimesheet,
        timeInLieu,
        standardHours,
        totals: cleanedTotals,
        notes: employeeInfo.notes,
        status: editingOriginalClaim.status || 'Submitted',
        editedAt: new Date().toLocaleString('en-GB')
      };
    }

    const updatedType = updatedClaim.type || (updatedClaim.expenses ? 'expense' : 'timesheet');

    setClaims(prev => {
      const withoutOldAndConflicts = prev.filter(c => {
        const type = c.type || (c.expenses ? 'expense' : 'timesheet');

        if (c.id === editingClaimId) return false;

        return !(
          c.employeeId === updatedClaim.employeeId &&
          claimPeriodKey(c) === claimPeriodKey(updatedClaim) &&
          type === updatedType
        );
      });

      return [updatedClaim, ...withoutOldAndConflicts];
    });

    setEditingClaimId(null);
    setEditingOriginalClaim(null);
    setTimesheet(defaultTimesheet());
    setExpenses([makeExpense()]);
    setTimeInLieu({ used: '0', earned: '0' });
    setTab('history');
  };

  const cancelEditClaim = () => {
    setEditingClaimId(null);
    setEditingOriginalClaim(null);
    setTimesheet(defaultTimesheet());
    setExpenses([makeExpense()]);
    setTimeInLieu({ used: '0', earned: '0' });
  };


  const upsertClaim = (newClaim) => {
    setClaims(prev => {
      const newType = newClaim.type || (newClaim.expenses ? 'expense' : 'timesheet');
      const existingIndex = prev.findIndex(c => {
        const existingType = c.type || (c.expenses ? 'expense' : 'timesheet');
        return c.employeeId === newClaim.employeeId &&
          claimPeriodKey(c) === claimPeriodKey(newClaim) &&
          existingType === newType;
      });

      if (existingIndex >= 0) {
        return prev.map((c, index) =>
          index === existingIndex
            ? {
                ...c,
                ...newClaim,
                id: c.id,
                type: newType,
                status: newClaim.status || c.status || 'Submitted',
                updatedAt: new Date().toLocaleString('en-GB')
              }
            : c
        );
      }

      return [{ ...newClaim, type: newType }, ...prev];
    });
  };

  const visibleLeaveRequests =
    activeUser.role === 'Manager' && managerDataMode === 'overall' && viewEmployeeId !== 'All'
      ? leaveRequests.filter(r => r.employeeId === viewEmployeeId)
      : activeUser.role === 'Manager' && managerDataMode === 'overall'
        ? leaveRequests
        : leaveRequests.filter(r => r.employeeId === activeUser.id);

  const approvedLeaveUsed = calculateApprovedLeaveDays(visibleLeaveRequests);

  const annualLeaveTotal = 28;
  const annualLeaveRemaining = Math.max(0, annualLeaveTotal - approvedLeaveUsed);

  const leaveRequestDateKeys = (request) =>
    getDatesBetween(request.startDate, request.endDate)
      .filter(d => {
        const day = d.getDay();
        return day !== 0 && day !== 6;
      })
      .map(d => formatISODateLocal(d));

  const hasOverlappingLeave = (candidate) => {
    const candidateKeys = new Set(leaveRequestDateKeys(candidate));

    return leaveRequests.some(existing => {
      if (existing.employeeId !== activeUser.id) return false;
      if (existing.status === 'Rejected') return false;
      return leaveRequestDateKeys(existing).some(key => candidateKeys.has(key));
    });
  };

  const submitAnnualLeave = () => {
    setAlError('');

    if (!alForm.startDate || !alForm.endDate) {
      setAlError('Please select start date and end date.');
      return;
    }

    if (new Date(alForm.endDate) < new Date(alForm.startDate)) {
      setAlError('End date cannot be before start date.');
      return;
    }

    if (calculateLeaveDays(alForm) <= 0) {
      setAlError('Annual leave must include at least one weekday.');
      return;
    }

    if (hasOverlappingLeave(alForm)) {
      setAlError('This employee already has an annual leave request on one or more selected dates.');
      return;
    }

    const newRequest = {
      id: crypto.randomUUID(),
      employeeId: activeUser.id,
      employeeName: activeUser.name,
      status: 'Submitted',
      submittedAt: new Date().toLocaleString('en-GB'),
      ...alForm
    };

    setLeaveRequests(prev => [newRequest, ...prev]);
    setAlForm({ startDate: '', endDate: '', duration: 'full', reason: '' });
  };

  const updateLeaveRequest = (id, patch) => {
    setLeaveRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (r.status !== 'Submitted') return r;
      return { ...r, ...patch };
    }));
  };

  const cancelLeaveRequest = (id) => {
    setLeaveRequests(prev =>
      prev.filter(r => !(r.id === id && r.employeeId === activeUser.id && r.status === 'Submitted'))
    );
  };

  const selectAnnualLeaveDate = (date) => {
    const key = formatISODateLocal(date);
    setAlError('');
    setAlForm(prev => {
      if (!prev.startDate || (prev.startDate && prev.endDate)) {
        return { ...prev, startDate: key, endDate: '' };
      }

      if (new Date(key) < new Date(prev.startDate)) {
        return { ...prev, startDate: key, endDate: prev.startDate };
      }

      return { ...prev, endDate: key };
    });
  };

  const [alYear, alMonthNumber] = alMonth.split('-').map(Number);
  const alMonthStart = new Date(alYear, alMonthNumber - 1, 1);
  const alMonthEnd = new Date(alYear, alMonthNumber, 0);
  const alFirstDay = alMonthStart.getDay() || 7;
  const alBlanks = Array.from({ length: alFirstDay - 1 });
  const alDays = Array.from({ length: alMonthEnd.getDate() }, (_, i) => new Date(alYear, alMonthNumber - 1, i + 1));
  const approvedSicknessCalendarItems = approvedSicknessItemsFromClaims(accountClaims);

  const leaveRequestsForDate = (date) => {
    const key = formatISODateLocal(date);
    return [...visibleLeaveRequests, ...approvedSicknessCalendarItems]
      .filter(r => getDatesBetween(r.startDate, r.endDate).some(d => formatISODateLocal(d) === key));
  };

  const findPreviousAnnualLeave = () => {
    setAlError('');

    const todayKey = formatISODateLocal(new Date());
    const sortedRequests = [...visibleLeaveRequests]
      .filter(r => r.startDate)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    const previousRequest = sortedRequests.find(r => r.startDate < todayKey) || sortedRequests[0];

    if (!previousRequest) {
      setAlError('No annual leave request found.');
      return;
    }

    setAlMonth(previousRequest.startDate.slice(0, 7));
    setHighlightedLeaveId(previousRequest.id);

    window.setTimeout(() => {
      document.getElementById(`leave-row-${previousRequest.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 50);
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
              {activeUser.role === 'Manager' && (
                <div className="manager-mode-switch">
                  <button
                    className={managerDataMode === 'overall' ? 'active' : ''}
                    type="button"
                    onClick={() => switchManagerDataMode('overall')}
                  >
                    Approval Dashboard
                  </button>
                  <button
                    className={managerDataMode === 'personal' ? 'active' : ''}
                    type="button"
                    onClick={() => switchManagerDataMode('personal')}
                  >
                    My Input
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap" style={{ flexWrap: 'wrap' }}>
              <div>
                <label className="label" style={{ color: '#cbd5e1' }}>Account</label>
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
          </div>
        </motion.header>

        {activeUser.role === 'Manager' && managerDataMode === 'personal' && (
          <div className="card">
            <div className="card-content flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Personal Snapshot</p>
                <h2>My Manager Account Data</h2>
                <p className="small muted">These cards show Boss personal AL, TIL, expense and pending items only.</p>
              </div>
              <span className="badge Approved">Personal</span>
            </div>
          </div>
        )}

        {!(activeUser.role === 'Manager' && managerDataMode === 'overall') && (
        <div className="grid grid-4">
          <Metric
            label={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? 'Company AL Applications' : 'Personal Annual Leave'
              : 'Annual Leave Remaining'}
            value={activeUser.role === 'Manager' && summaryCardsMode === 'overall'
              ? `${companyAlSubmitted} pending`
              : `${summaryCardsData.annualLeaveRemaining} / ${summaryCardsData.annualLeaveTotal} days`}
            sub={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? `${companyAlApproved} approved | ${companyTopCardLeaveRequests.length} total AL application(s)` : 'Boss personal status only'
              : 'Quick status'}
            icon={<CalendarDays />}
          />
          <Metric
            label={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? 'Employees With TIL' : 'Personal Time in Lieu'
              : 'Time in Lieu Remaining'}
            value={activeUser.role === 'Manager' && summaryCardsMode === 'overall'
              ? `${companyTilTotal.toFixed(2)} hrs`
              : `${summaryCardsData.timeInLieuRemaining.toFixed(2)} hrs`}
            sub={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? companyTilSummary : 'Boss personal status only'
              : 'Quick status'}
            icon={<FileCheck2 />}
          />
          <Metric
            label={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? 'Company Expense Pending' : 'Personal Total Expense'
              : 'Total Expense'}
            value={activeUser.role === 'Manager' && summaryCardsMode === 'overall'
              ? money(companyExpensePendingTotal)
              : money(summaryCardsData.outstandingExpenses)}
            sub={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall'
                ? `Submitted ${money(companyExpenseSubmittedTotal)} | Approved unpaid ${money(companyExpenseApprovedTotal)}`
                : `Personal claims ${money(summaryCardsData.totalExpenseClaims)} - approved/paid ${money(summaryCardsData.approvedPaidExpenses)}`
              : `All claims ${money(summaryCardsData.totalExpenseClaims)} - approved/paid ${money(summaryCardsData.approvedPaidExpenses)}`}
            icon={<ReceiptText />}
          />
          <Metric
            label={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? 'Company Pending Items' : 'Personal Pending Items'
              : 'Pending Approval'}
            value={String(summaryCardsData.pendingApproval)}
            sub={activeUser.role === 'Manager'
              ? summaryCardsMode === 'overall' ? 'Submitted employee applications' : 'Boss personal submissions only'
              : 'Submitted items'}
            icon={<Users />}
          />
        </div>
        )}

        {visibleTabs.length > 0 && (
        <div className="tabs">
          <button className="btn danger" onClick={resetDemoData}>Reset Demo Data</button>
          {visibleTabs.map(t => (
            <button
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => {
                setReviewingClaimId(null);
                setTab(t);
              }}
              key={t}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            visibleClaims={visibleClaims}
            allEmployeeClaims={accountClaims}
            allLeaveRequests={accountLeaveRequests}
            employees={employees}
            viewEmployeeId={viewEmployeeId}
            setViewEmployeeId={setViewEmployeeId}
            updateClaim={updateClaim}
            updateLeaveRequest={updateLeaveRequest}
            weeklyStandardHours={weeklyStandardHours}
            setWeeklyStandardHours={setWeeklyStandardHours}
            activeUser={activeUser}
            selectedWeek={selectedWeek}
            managerDataMode={managerDataMode}
            openClaimForReview={openClaimForReview}
            setTab={setTab}
            setAlMonth={setAlMonth}
            setHighlightedLeaveId={setHighlightedLeaveId}
          />
        )}

        {tab === 'timesheet' && (
          activeUser.role === 'Manager' && managerDataMode === 'overall' && reviewingClaim && claimTypeOf(reviewingClaim) === 'timesheet' ? (
            <ManagerClaimReview
              claim={reviewingClaim}
              updateClaim={updateClaim}
              setReceipt={setReceipt}
              closeReview={() => {
                setReviewingClaimId(null);
                setTab('dashboard');
              }}
            />
          ) : activeUser.role === 'Manager' && managerDataMode === 'overall' ? (
            <ManagerAdminCategory
              title="Timesheet Admin"
              note="Review and approve employee timesheet applications."
              claims={accountClaims.filter(claim => claimTypeOf(claim) === 'timesheet')}
              employees={employees}
              setReceipt={setReceipt}
              updateClaim={updateClaim}
              closeAdmin={() => setTab('dashboard')}
              setTab={setTab}
              currentTab="timesheet"
              approvalCounts={{
                annualLeave: companyAlSubmitted,
                timesheets: accountClaims.filter(claim => claimTypeOf(claim) === 'timesheet' && claim.status === 'Submitted').length,
                expenses: accountClaims.filter(claim => claimTypeOf(claim) === 'expense' && claim.status === 'Submitted').length
              }}
            />
          ) : (
            <TimesheetForm
              {...{
                employeeInfo,
                setEmployeeInfo,
                setClaimEmployee,
                employees,
                activeUser,
                personalMode: managerPersonalMode,
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
                editingClaimId,
                saveEditedClaim,
                cancelEditClaim,
                setTab
              }}
            />
          )
        )}

        {tab === 'expense' && (
          activeUser.role === 'Manager' && managerDataMode === 'overall' && reviewingClaim && claimTypeOf(reviewingClaim) === 'expense' ? (
            <ManagerClaimReview
              claim={reviewingClaim}
              updateClaim={updateClaim}
              setReceipt={setReceipt}
              closeReview={() => {
                setReviewingClaimId(null);
                setTab('dashboard');
              }}
            />
          ) : activeUser.role === 'Manager' && managerDataMode === 'overall' ? (
            <ManagerAdminCategory
              title="Expense Admin"
              note="Review expense claims and download all uploaded receipt proof."
              claims={accountClaims.filter(claim => claimTypeOf(claim) === 'expense')}
              employees={employees}
              setReceipt={setReceipt}
              updateClaim={updateClaim}
              closeAdmin={() => setTab('dashboard')}
              setTab={setTab}
              currentTab="expense"
              approvalCounts={{
                annualLeave: companyAlSubmitted,
                timesheets: accountClaims.filter(claim => claimTypeOf(claim) === 'timesheet' && claim.status === 'Submitted').length,
                expenses: accountClaims.filter(claim => claimTypeOf(claim) === 'expense' && claim.status === 'Submitted').length
              }}
              showReceiptDownload
            />
          ) : (
            <ExpenseForm
              {...{
                employeeInfo,
                setClaimEmployee,
                employees,
                activeUser,
                personalMode: managerPersonalMode,
                selectedExpenseMonth,
                setSelectedExpenseMonth,
                totals,
                expenses,
                setExpenses,
                updateExpense,
                uploadReceipt,
                setReceipt,
                submitExpense,
                expenseError,
                editingClaimId,
                saveEditedClaim,
                cancelEditClaim
              }}
            />
          )
        )}


        {tab === 'annualLeave' && (
          activeUser.role === 'Manager' && managerDataMode === 'overall' ? (
            <ManagerAnnualLeaveAdmin
              leaveRequests={visibleLeaveRequests}
              employees={employees}
              updateLeaveRequest={updateLeaveRequest}
              closeAdmin={() => setTab('dashboard')}
              setTab={setTab}
              approvalCounts={{
                annualLeave: companyAlSubmitted,
                timesheets: accountClaims.filter(claim => claimTypeOf(claim) === 'timesheet' && claim.status === 'Submitted').length,
                expenses: accountClaims.filter(claim => claimTypeOf(claim) === 'expense' && claim.status === 'Submitted').length
              }}
              alMonth={alMonth}
              setAlMonth={setAlMonth}
              alBlanks={alBlanks}
              alDays={alDays}
              leaveRequestsForDate={leaveRequestsForDate}
              highlightedLeaveId={highlightedLeaveId}
            />
          ) : (
          <div className="space-y">
            <div className="card">
              <div className="card-content flex justify-between gap items-center" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h2>Annual Leave Calendar</h2>
                  <p className="small muted">
                    {activeUser.role === 'Manager' && managerDataMode === 'overall'
                      ? 'Admin view for company annual leave applications.'
                      : 'Click a date to apply AL. Manager approval deducts from Annual Leave Remaining.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-3">
              <Insight title="Annual Leave Remaining" value={`${annualLeaveRemaining} / ${annualLeaveTotal} days`} note="Approved AL deducted" icon={<CalendarDays />} />
              <Insight title="Pending AL" value={String(visibleLeaveRequests.filter(r => r.status === 'Submitted').length)} note="Waiting for approval" icon={<Clock />} />
              <Insight title="Approved AL Used" value={`${approvedLeaveUsed} days`} note="Approved requests only" icon={<CheckCircle2 />} />
            </div>

            <div className="grid grid-2-1">
              <AnnualLeaveCalendar
                alMonth={alMonth}
                setAlMonth={setAlMonth}
                alBlanks={alBlanks}
                alDays={alDays}
                leaveRequestsForDate={leaveRequestsForDate}
                alForm={alForm}
                selectAnnualLeaveDate={selectAnnualLeaveDate}
              />

              {!(activeUser.role === 'Manager' && managerDataMode === 'overall') && (
              <div className="card">
                <div className="card-content space-y-sm">
                  <h2>Apply Annual Leave</h2>

                  {alError && (
                    <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 12 }}>
                      {alError}
                    </div>
                  )}

                  <Field label="Start Date" type="date" value={alForm.startDate} onChange={v => setAlForm(p => ({ ...p, startDate: v }))} />
                  <Field label="End Date" type="date" value={alForm.endDate} onChange={v => setAlForm(p => ({ ...p, endDate: v }))} />

                  <div>
                    <label className="label">Duration</label>
                    <select className="select" value={alForm.duration} onChange={e => setAlForm(p => ({ ...p, duration: e.target.value }))}>
                      <option value="full">Full day</option>
                      <option value="half">Half day</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Reason / Notes</label>
                    <textarea className="textarea" value={alForm.reason} onChange={e => setAlForm(p => ({ ...p, reason: e.target.value }))} />
                  </div>

                  <div className="card-dark" style={{ padding: 16 }}>
                    <p className="small">Selected AL Days</p>
                    <h2>{calculateLeaveDays(alForm)} day(s)</h2>
                    <p className="xsmall" style={{ color: '#cbd5e1' }}>Weekends are not deducted. Submitted AL is deducted only after approval.</p>
                  </div>

                  <button className="btn" onClick={submitAnnualLeave}>Submit Annual Leave</button>
                </div>
              </div>
              )}
            </div>

            <div className="card">
              <div className="card-content">
                <h2>Annual Leave Requests</h2>
                {visibleLeaveRequests.length === 0 ? (
                  <p className="muted">No annual leave requests yet.</p>
                ) : (
                  <div className="wide">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Dates</th>
                          <th>Duration</th>
                          <th>Days</th>
                          <th>Status</th>
                          <th>Reason</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLeaveRequests.map(r => {
                          const isLocked = r.status === 'Approved';
                          const canManagerAction = activeUser.role === 'Manager' && r.status === 'Submitted';
                          const canEmployeeCancel = activeUser.role !== 'Manager' &&
                            r.employeeId === activeUser.id &&
                            r.status === 'Submitted';
                          const isHighlighted = highlightedLeaveId === r.id;

                          return (
                          <tr
                            key={r.id}
                            id={`leave-row-${r.id}`}
                            style={isHighlighted ? { background: '#dbeafe' } : undefined}
                          >
                            <td>{r.employeeName}</td>
                            <td>{r.startDate} → {r.endDate}</td>
                            <td>{r.duration === 'half' ? 'Half day' : 'Full day'}</td>
                            <td>{calculateLeaveDays(r)}</td>
                            <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                            <td>
                              {r.reason || '—'}
                              {isLocked && <div className="xsmall muted">Locked after approval</div>}
                            </td>
                            <td>
                              {canManagerAction ? (
                                <>
                                  <button className="btn" onClick={() => updateLeaveRequest(r.id, { status: 'Approved' })}>Approve</button>
                                  {' '}
                                  <button className="btn danger" onClick={() => updateLeaveRequest(r.id, { status: 'Rejected' })}>Reject</button>
                                </>
                              ) : canEmployeeCancel ? (
                                <button className="btn secondary" onClick={() => cancelLeaveRequest(r.id)}>Cancel Request</button>
                              ) : (
                                <span className="small muted">Locked</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          )
        )}

        {tab === 'history' && (
          <>
            <Filter {...{ search, setSearch, historyTypeFilter, setHistoryTypeFilter, setClaims }} />
            <ClaimList claims={filteredClaims} setReceipt={setReceipt} startEditClaim={startEditClaim} activeUser={activeUser} />
          </>
        )}

        {tab === 'manager' && (
          activeUser.role !== 'Manager'
            ? <div className="card"><div className="card-content muted">Switch to Manager demo user to approve claims.</div></div>
            : <>
                <Filter {...{ search, setSearch, historyTypeFilter, setHistoryTypeFilter, setClaims }} />
                <ClaimList claims={filteredClaims} setReceipt={setReceipt} manager updateClaim={updateClaim} startEditClaim={startEditClaim} activeUser={activeUser} />
              </>
        )}
      </div>

      {receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}
    </div>
  );
}



function Dashboard({
  visibleClaims,
  allEmployeeClaims,
  allLeaveRequests,
  employees,
  viewEmployeeId,
  setViewEmployeeId,
  updateClaim,
  updateLeaveRequest,
  weeklyStandardHours,
  setWeeklyStandardHours,
  activeUser,
  selectedWeek,
  managerDataMode,
  openClaimForReview,
  setTab,
  setAlMonth,
  setHighlightedLeaveId
}) {
  const [dashboardWeek, setDashboardWeek] = useState('current');
  const isManager = activeUser?.role === 'Manager';
  const isManagerPersonalDashboard = isManager && managerDataMode === 'personal';
  const isManagerOverallDashboard = isManager && managerDataMode === 'overall';
  const managerPersonalClaims = isManager
    ? uniqueClaimsByEmployeeWeekType(allEmployeeClaims || []).filter(claim => claim.employeeId === activeUser.id)
    : [];
  const managerPersonalLeaveRequests = isManager
    ? (allLeaveRequests || []).filter(request => request.employeeId === activeUser.id)
    : [];
  const cleanVisibleClaims = uniqueClaimsByEmployeeWeekType(
    isManagerPersonalDashboard ? managerPersonalClaims : visibleClaims
  );

  const timesheetClaims = cleanVisibleClaims.filter(c => c.type === 'timesheet' || (!c.type && c.timesheet));
  const expenseClaims = cleanVisibleClaims.filter(c => c.type === 'expense' || (!c.type && c.expenses));

  const weekOptions = Array.from(new Set(timesheetClaims.map(c => c.week).filter(Boolean))).sort().reverse();
  const latestSubmittedWeek = weekOptions.length ? weekOptions[0] : selectedWeek;
  const isCurrentStatus = dashboardWeek === 'current';
  const selectedWeekOnly = dashboardWeek === 'current' ? (selectedWeek || latestSubmittedWeek) : dashboardWeek;
  const weekOnlyTimesheetClaims = timesheetClaims.filter(c => c.week === selectedWeekOnly);

  const totalSubmittedHours = weekOnlyTimesheetClaims.reduce((s, c) => s + Number(c.totals?.totalWorkingHours || 0), 0);
  const timeInLieuThisWeek = weekOnlyTimesheetClaims.reduce(
    (s, c) => s + Number(c.totals?.timeInLieu || 0) - Number(c.totals?.takeBackTimeInLieu || 0),
    0
  );

  const latestTilBalance = timesheetClaims.reduce(
    (s, c) => s + Number(c.totals?.timeInLieu || 0) - Number(c.totals?.takeBackTimeInLieu || 0),
    0
  );

  const totalExpenseClaims = expenseClaims.reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);
  const approvedPaidExpenses = expenseClaims
    .filter(c => ['Approved', 'Paid'].includes(c.status))
    .reduce((s, c) => s + Number(c.totals?.totalExpense || 0), 0);
  const totalExpenses = Math.max(0, totalExpenseClaims - approvedPaidExpenses);
  const totalVATClaims = expenseClaims.reduce((s, c) => s + Number(c.totals?.totalVAT || 0), 0);
  const approvedPaidVAT = expenseClaims
    .filter(c => ['Approved', 'Paid'].includes(c.status))
    .reduce((s, c) => s + Number(c.totals?.totalVAT || 0), 0);

  const statusChartData = [
    {
      name: 'Time in Lieu Remaining',
      value: Number(latestTilBalance || 0),
      display: `${Number(latestTilBalance || 0).toFixed(2)} hrs`,
      fill: '#dc2626'
    },
    {
      name: 'Total Expense',
      value: Number(totalExpenses || 0),
      display: money(totalExpenses),
      fill: '#2563eb'
    }
  ];

  const employeeIds = new Set(employees.filter(employee => employee.role !== 'Manager').map(employee => employee.id));
  const managerPersonalSummary = isManager
    ? getDashboardSummary(managerPersonalClaims, selectedWeek, weeklyStandardHours, managerPersonalLeaveRequests)
    : null;
  const managerPersonalChartData = managerPersonalSummary
    ? [
        {
          name: 'My Time in Lieu',
          value: Number(managerPersonalSummary.timeInLieuRemaining || 0),
          display: `${Number(managerPersonalSummary.timeInLieuRemaining || 0).toFixed(2)} hrs`,
          fill: '#dc2626'
        },
        {
          name: 'My Total Expense',
          value: Number(managerPersonalSummary.outstandingExpenses || 0),
          display: money(managerPersonalSummary.outstandingExpenses),
          fill: '#2563eb'
        }
      ]
    : [];

  const companyExpenseClaims = isManager
    ? uniqueClaimsByEmployeeWeekType(allEmployeeClaims || [])
        .filter(claim => employeeIds.has(claim.employeeId) && claimTypeOf(claim) === 'expense')
    : [];
  const companyExpenseGross = companyExpenseClaims.reduce((sum, claim) => sum + Number(claim.totals?.totalExpense || 0), 0);
  const companyExpenseApprovedPaid = companyExpenseClaims
    .filter(claim => ['Approved', 'Paid'].includes(claim.status))
    .reduce((sum, claim) => sum + Number(claim.totals?.totalExpense || 0), 0);
  const companyExpenseTotal = Math.max(0, companyExpenseGross - companyExpenseApprovedPaid);
  const companyVATTotal = companyExpenseClaims.reduce((sum, claim) => sum + Number(claim.totals?.totalVAT || 0), 0);
  const companyExpenseByCategory = Object.values(
    companyExpenseClaims.reduce((groups, claim) => {
      (claim.expenses || []).forEach(expense => {
        const category = expense.category || 'Other';
        const existing = groups[category] || { name: category, value: 0, vat: 0, count: 0 };
        groups[category] = {
          ...existing,
          value: existing.value + Number(expense.amount || 0),
          vat: existing.vat + Number(expense.vat || 0),
          count: existing.count + 1
        };
      });
      return groups;
    }, {})
  ).sort((a, b) => b.value - a.value);
  const expensePieColors = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#7c3aed', '#0891b2', '#f97316', '#64748b'];
  const companyReceiptItems = receiptDownloadItemsFromClaims(companyExpenseClaims);

  const bossEmployeeSummaries = isManager
    ? employees
        .filter(employee => employee.role !== 'Manager')
        .map(employee => {
          const employeeClaims = (allEmployeeClaims || []).filter(claim => claim.employeeId === employee.id);
          const employeeLeaveRequests = (allLeaveRequests || []).filter(request => request.employeeId === employee.id);
          const summary = getDashboardSummary(employeeClaims, selectedWeek, weeklyStandardHours, employeeLeaveRequests);

          return {
            ...employee,
            summary
          };
        })
    : [];

  const selectedBossEmployee = isManager && viewEmployeeId !== 'All'
    ? bossEmployeeSummaries.find(employee => employee.id === viewEmployeeId)
    : null;

  const allPendingApplications = isManager
    ? [
        ...(allEmployeeClaims || [])
          .filter(claim => claim.status === 'Submitted')
          .map(claim => ({
            id: claim.id,
            employeeId: claim.employeeId,
            employeeName: claim.employeeName,
            type: claimTypeOf(claim) === 'expense' ? 'Expense' : 'Timesheet',
            claimType: claimTypeOf(claim),
            period: claimTypeOf(claim) === 'expense'
              ? (claim.periodLabel || monthLabel(getClaimExpenseMonth(claim)))
              : (claim.weekLabel || claim.week),
            summary: claimTypeOf(claim) === 'expense'
              ? money(claim.totals?.totalExpense)
              : `${Number(claim.totals?.totalWorkingHours || 0).toFixed(2)} hrs`,
            source: 'claim'
          })),
        ...(allLeaveRequests || [])
          .filter(request => request.status === 'Submitted')
          .map(request => ({
            id: request.id,
            employeeId: request.employeeId,
            employeeName: request.employeeName,
            type: 'Annual Leave',
            claimType: 'annualLeave',
            period: `${request.startDate} -> ${request.endDate}`,
            summary: `${calculateLeaveDays(request)} day(s)`,
            source: 'leave'
          }))
      ]
    : [];

  const managerApprovalCounts = {
    timesheets: allPendingApplications.filter(application => application.claimType === 'timesheet').length,
    expenses: allPendingApplications.filter(application => application.claimType === 'expense').length,
    annualLeave: allPendingApplications.filter(application => application.claimType === 'annualLeave').length
  };

  const approvedExpensesAwaitingPayment = isManager
    ? (allEmployeeClaims || [])
        .filter(claim => claimTypeOf(claim) === 'expense' && claim.status === 'Approved')
        .map(claim => ({
          id: claim.id,
          employeeId: claim.employeeId,
          employeeName: claim.employeeName,
          period: claim.periodLabel || monthLabel(getClaimExpenseMonth(claim)),
          summary: money(claim.totals?.totalExpense),
          vat: money(claim.totals?.totalVAT)
        }))
    : [];

  const selectedEmployeeLeaveRequests = selectedBossEmployee
    ? (allLeaveRequests || []).filter(request => request.employeeId === selectedBossEmployee.id)
    : [];

  const selectedEmployeeClaims = selectedBossEmployee
    ? uniqueClaimsByEmployeeWeekType(allEmployeeClaims || [])
        .filter(claim => claim.employeeId === selectedBossEmployee.id)
    : [];
  const selectedEmployeeReceiptItems = receiptDownloadItemsFromClaims(selectedEmployeeClaims);

  const selectedEmployeeApplications = selectedBossEmployee
    ? [
        ...selectedEmployeeClaims.map(claim => ({
          id: claim.id,
          type: claimTypeOf(claim) === 'expense' ? 'Expense' : 'Timesheet',
          claimType: claimTypeOf(claim),
          period: claimTypeOf(claim) === 'expense'
            ? (claim.periodLabel || monthLabel(getClaimExpenseMonth(claim)))
            : (claim.weekLabel || claim.week),
          status: claim.status,
          summary: claimTypeOf(claim) === 'expense'
            ? money(claim.totals?.totalExpense)
            : `${Number(claim.totals?.totalWorkingHours || 0).toFixed(2)} hrs`,
          source: 'claim'
        })),
        ...selectedEmployeeLeaveRequests.map(request => ({
          id: request.id,
          type: 'Annual Leave',
          claimType: 'annualLeave',
          period: `${request.startDate} -> ${request.endDate}`,
          status: request.status,
          summary: `${calculateLeaveDays(request)} day(s)`,
          source: 'leave'
        }))
      ].sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')))
    : [];

  const approveApplication = (application) => {
    if (application.source === 'leave') {
      updateLeaveRequest(application.id, { status: 'Approved' });
      return;
    }

    updateClaim(application.id, { status: 'Approved' });
  };

  const rejectApplication = (application) => {
    if (application.source === 'leave') {
      updateLeaveRequest(application.id, { status: 'Rejected' });
      return;
    }

    updateClaim(application.id, { status: 'Rejected' });
  };

  const markApplicationPaid = (application) => {
    updateClaim(application.id, { status: 'Paid' });
  };

  const viewEmployeeProfile = (employeeId) => {
    setViewEmployeeId(employeeId);
    setDashboardWeek('current');
    window.setTimeout(() => {
      document.getElementById('manager-employee-profile')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 50);
  };

  const openApplication = (application) => {
    if (application.source === 'leave') {
      const request = (allLeaveRequests || []).find(item => item.id === application.id);
      if (!request) return;

      setViewEmployeeId(request.employeeId);
      setAlMonth(request.startDate?.slice(0, 7) || currentMonthValue());
      setHighlightedLeaveId(request.id);
      setTab('annualLeave');

      window.setTimeout(() => {
        document.getElementById(`leave-row-${request.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
      return;
    }

    const claim = (allEmployeeClaims || []).find(item => item.id === application.id);
    if (claim) openClaimForReview(claim);
  };

  const targetHours = Number(weeklyStandardHours || 0);

  const dailyStandardHours = 7.5;
  const weekDateLabels = getWeekDates(selectedWeekOnly);

  const dailyHoursData = weekDays.map((day, index) => {
    const projectHours = weekOnlyTimesheetClaims.reduce((sum, claim) => {
      const row = claim.timesheet?.[day] || {};
      return sum + Number(row.projectHours || 0);
    }, 0);

    const travelHours = weekOnlyTimesheetClaims.reduce((sum, claim) => {
      const row = claim.timesheet?.[day] || {};
      return sum + Number(row.travelHours || 0);
    }, 0);

    const takeBackTimeInLieu = weekOnlyTimesheetClaims.reduce((sum, claim) => {
      const row = claim.timesheet?.[day] || {};
      return sum + Number(row.takeBackTimeInLieu || 0);
    }, 0);

    const leaveHours = weekOnlyTimesheetClaims.reduce((sum, claim) => {
      const row = claim.timesheet?.[day] || {};
      const standardHours = Number(claim.standardHours || dailyStandardHours);
      const holidayType = row.holidayType || 'none';
      const holidayHours = holidayType === 'full'
        ? standardHours
        : holidayType === 'half'
          ? standardHours / 2
          : 0;
      const sicknessHours = row.sickness ? standardHours : 0;
      return sum + holidayHours + sicknessHours;
    }, 0);

    const paidLeaveAndTakeBack = leaveHours + takeBackTimeInLieu;
    const totalWorked = projectHours + travelHours;
    const standardProject = Math.min(projectHours, dailyStandardHours);
    const remainingStandardAfterProject = Math.max(0, dailyStandardHours - standardProject);
    const standardTravel = Math.min(travelHours, remainingStandardAfterProject);
    const timeInLieu = Math.max(0, totalWorked - dailyStandardHours);

    return {
      day: `${day.slice(0, 3)} ${weekDateLabels[index]?.label || ''}`,
      project: standardProject,
      travel: standardTravel,
      paidLeaveAndTakeBack,
      timeInLieu,
      total: totalWorked + paidLeaveAndTakeBack
    };
  });

  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content flex justify-between gap items-center" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2>Dashboard</h2>
            <p className="small muted">
              {isManager
                ? isManagerOverallDashboard
                  ? 'Overall company approval dashboard.'
                  : 'Personal dashboard for your own manager account data.'
                : 'Select Current for status, or choose a week for detailed breakdown.'}
            </p>
          </div>

          <div className="flex gap items-center" style={{ flexWrap: 'wrap' }}>
            {(!isManager || isManagerPersonalDashboard) && (
              <>
                <label className="label">View week</label>
                <select className="select" value={dashboardWeek} onChange={e => setDashboardWeek(e.target.value)} style={{ width: 260 }}>
                  <option value="current">Current status</option>
                  {weekOptions.map(week => (
                    <option key={week} value={week}>{weekLabel(week)}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {isManagerOverallDashboard && (
        <div className="card">
          <div className="card-content">
            <div>
              <p className="small muted">Approval Dashboard</p>
              <h2>Applications Waiting For Review</h2>
              <p className="small muted">Open each application database to review details and approve or reject records.</p>
            </div>

            <div className="grid grid-3" style={{ marginTop: 16 }}>
              <button
                className={`approval-tile ${managerApprovalCounts.annualLeave ? 'pending' : ''}`}
                type="button"
                onClick={() => setTab('annualLeave')}
              >
                <span className="status-light" />
                <div>
                  <h2 className="approval-tile-title">Company AL Applications</h2>
                  <p className="approval-tile-count">{managerApprovalCounts.annualLeave} pending</p>
                  <p className="small muted">{(allLeaveRequests || []).length} total annual leave application(s)</p>
                </div>
              </button>

              <button
                className={`approval-tile ${managerApprovalCounts.timesheets ? 'pending' : ''}`}
                type="button"
                onClick={() => setTab('timesheet')}
              >
                <span className="status-light" />
                <div>
                  <h2 className="approval-tile-title">Timesheet Applications</h2>
                  <p className="approval-tile-count">{managerApprovalCounts.timesheets} pending</p>
                  <p className="small muted">{(allEmployeeClaims || []).filter(claim => claimTypeOf(claim) === 'timesheet').length} total timesheet application(s)</p>
                </div>
              </button>

              <button
                className={`approval-tile ${managerApprovalCounts.expenses || approvedExpensesAwaitingPayment.length ? 'pending' : ''}`}
                type="button"
                onClick={() => setTab('expense')}
              >
                <span className="status-light" />
                <div>
                  <h2 className="approval-tile-title">Company Expense Applications</h2>
                  <p className="approval-tile-count">{managerApprovalCounts.expenses} pending</p>
                  <p className="small muted">{approvedExpensesAwaitingPayment.length} approved awaiting payment</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {isManagerOverallDashboard && (
        <div className="card">
          <div className="card-content">
            <div>
              <p className="small muted">Company Overview</p>
              <h2>Employee Overall Summary</h2>
              <p className="small muted">Quick status across all employees for manager review.</p>
            </div>

            <div className="wide" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Current Week Hours</th>
                    <th>AL Remaining</th>
                    <th>TIL Remaining</th>
                    <th>Expense Total</th>
                    <th>Pending Items</th>
                  </tr>
                </thead>
                <tbody>
                  {bossEmployeeSummaries.map(({ summary, ...employee }) => (
                    <tr key={employee.id}>
                      <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                      <td>{employee.department}</td>
                      <td>{Number(summary.totalWorkingHours || 0).toFixed(2)} / {Number(summary.targetHours || 0).toFixed(2)} hrs</td>
                      <td>{summary.annualLeaveRemaining} / {summary.annualLeaveTotal} days</td>
                      <td>{Number(summary.timeInLieuRemaining || 0).toFixed(2)} hrs</td>
                      <td>{money(summary.outstandingExpenses)}</td>
                      <td><span className={`badge ${summary.pendingApproval ? 'Submitted' : ''}`}>{summary.pendingApproval}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isManagerOverallDashboard && (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Company Expense Overview</p>
                <h2>Expense Overall Summary</h2>
                <p className="small muted">Company expense by category, built from all employee expense items.</p>
              </div>
              <button
                className="btn secondary"
                type="button"
                disabled={companyReceiptItems.length === 0}
                onClick={() => downloadReceiptItems(companyReceiptItems)}
              >
                Download All Receipts ({companyReceiptItems.length})
              </button>
            </div>

            <div className="grid grid-4" style={{ marginTop: 14 }}>
              <Mini label="Company Expense Total" value={money(companyExpenseTotal)} />
              <Mini label="All Expense Claims" value={money(companyExpenseGross)} />
              <Mini label="Approved / Paid" value={money(companyExpenseApprovedPaid)} />
              <Mini label="Company VAT Total" value={money(companyVATTotal)} />
            </div>

            <div className="grid grid-2-1" style={{ marginTop: 18 }}>
              <div>
                {companyExpenseByCategory.length === 0 ? (
                  <div className="muted" style={{ padding: 24 }}>No expense category data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={companyExpenseByCategory}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {companyExpenseByCategory.map((item, index) => (
                          <Cell key={item.name} fill={expensePieColors[index % expensePieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="wide">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyExpenseByCategory.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="muted">No expense category data yet.</td>
                      </tr>
                    ) : companyExpenseByCategory.map((category, index) => (
                      <tr key={category.name}>
                        <td>
                          <span
                            aria-hidden="true"
                            style={{
                              display: 'inline-block',
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: expensePieColors[index % expensePieColors.length],
                              marginRight: 8
                            }}
                          />
                          <b>{category.name}</b>
                        </td>
                        <td>{category.count}</td>
                        <td>{money(category.value)}</td>
                        <td>{money(category.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManagerPersonalDashboard && managerPersonalSummary && isCurrentStatus && (
        <div className="card">
          <div className="card-content space-y-sm">
            <div>
              <p className="small muted">Personal Dashboard</p>
              <h2>My Personal Status</h2>
              <p className="small muted">Your own leave, TIL and expense status is kept separate from company reporting.</p>
            </div>

            <div className="grid grid-4">
              <Mini label="My Annual Leave" value={`${managerPersonalSummary.annualLeaveRemaining} / ${managerPersonalSummary.annualLeaveTotal} days`} />
              <Mini label="My TIL Remaining" value={`${Number(managerPersonalSummary.timeInLieuRemaining || 0).toFixed(2)} hrs`} />
              <Mini label="My Total Expense" value={money(managerPersonalSummary.outstandingExpenses)} />
              <Mini label="My Pending Items" value={String(managerPersonalSummary.pendingApproval)} />
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={managerPersonalChartData} margin={{ left: 20, right: 20, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(_, __, item) => item?.payload?.display || ''} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {managerPersonalChartData.map(item => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {false && isManagerOverallDashboard && (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Overall Dashboard</p>
                <h2>All Employees Summary</h2>
                <p className="small muted">Overall employee status, expense totals and application workload.</p>
              </div>
              <button
                className="btn secondary"
                type="button"
                disabled={companyReceiptItems.length === 0}
                onClick={() => downloadReceiptItems(companyReceiptItems)}
              >
                Download All Receipts ({companyReceiptItems.length})
              </button>
            </div>

            <div className="grid grid-4" style={{ marginTop: 14 }}>
              <Mini label="Company Expense Total" value={money(companyExpenseTotal)} />
              <Mini label="All Expense Claims" value={money(companyExpenseGross)} />
              <Mini label="Approved / Paid" value={money(companyExpenseApprovedPaid)} />
              <Mini label="Company VAT Total" value={money(companyVATTotal)} />
            </div>

            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <Mini label="Pending Timesheets" value={String(managerApprovalCounts.timesheets)} />
              <Mini label="Pending Expenses" value={String(managerApprovalCounts.expenses)} />
              <Mini label="Pending Annual Leave" value={String(managerApprovalCounts.annualLeave)} />
              <Mini label="Expenses Awaiting Payment" value={String(approvedExpensesAwaitingPayment.length)} />
            </div>

            <div className="grid grid-2-1" style={{ marginTop: 18 }}>
              <div className="wide">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Current Week Hours</th>
                      <th>AL Remaining</th>
                      <th>TIL Remaining</th>
                      <th>Total Expense</th>
                      <th>Pending</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bossEmployeeSummaries.map(({ summary, ...employee }) => (
                      <tr key={employee.id} style={viewEmployeeId === employee.id ? { background: '#dbeafe' } : undefined}>
                        <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                        <td>{employee.department}</td>
                        <td>{Number(summary.totalWorkingHours || 0).toFixed(2)} / {Number(summary.targetHours || 0).toFixed(2)} hrs</td>
                        <td>{summary.annualLeaveRemaining} / {summary.annualLeaveTotal} days</td>
                        <td>{Number(summary.timeInLieuRemaining || 0).toFixed(2)} hrs</td>
                        <td>{money(summary.outstandingExpenses)}</td>
                        <td><span className={`badge ${summary.pendingApproval ? 'Submitted' : ''}`}>{summary.pendingApproval}</span></td>
                        <td>
                          <button className="btn secondary" type="button" onClick={() => viewEmployeeProfile(employee.id)}>
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 style={{ marginTop: 0 }}>Expense by Category</h3>
                <p className="small muted">Based on all employee expense claims.</p>
                {companyExpenseByCategory.length === 0 ? (
                  <div className="muted" style={{ padding: 24 }}>No expense category data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={companyExpenseByCategory}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={92}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {companyExpenseByCategory.map((item, index) => (
                          <Cell key={item.name} fill={expensePieColors[index % expensePieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {false && isManagerOverallDashboard && (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Pending Applications</h2>
                <p className="small muted">Approve or reject all submitted AL, timesheet and expense applications from the dashboard.</p>
              </div>
              <span className={`badge ${allPendingApplications.length ? 'Submitted' : ''}`}>
                {allPendingApplications.length} pending
              </span>
            </div>

            {allPendingApplications.length === 0 ? (
              <p className="muted" style={{ marginTop: 14 }}>No pending applications.</p>
            ) : (
              <div className="wide" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Application</th>
                      <th>Period</th>
                      <th>Summary</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPendingApplications.map(application => (
                      <tr key={`${application.source}-${application.id}`}>
                        <td>{application.employeeName}</td>
                        <td>{application.type}</td>
                        <td>{application.period}</td>
                        <td>{application.summary}</td>
                        <td>
                          <button className="btn" onClick={() => approveApplication(application)}>Approve</button>
                          {' '}
                          <button className="btn danger" onClick={() => rejectApplication(application)}>Reject</button>
                          {' '}
                          <button className="btn secondary" onClick={() => openApplication(application)}>Open Application</button>
                          {' '}
                          <button className="btn ghost" onClick={() => viewEmployeeProfile(application.employeeId)}>View Profile</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {false && isManagerOverallDashboard && approvedExpensesAwaitingPayment.length > 0 && (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Expenses Awaiting Payment</h2>
                <p className="small muted">Approved expense claims that still need to be marked as paid.</p>
              </div>
              <span className="badge Approved">{approvedExpensesAwaitingPayment.length} approved</span>
            </div>

            <div className="wide" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Month</th>
                    <th>Expense Total</th>
                    <th>VAT</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedExpensesAwaitingPayment.map(expense => (
                    <tr key={expense.id}>
                      <td>{expense.employeeName}</td>
                      <td>{expense.period}</td>
                      <td>{expense.summary}</td>
                      <td>{expense.vat}</td>
                      <td>
                        <button className="btn secondary" onClick={() => markApplicationPaid(expense)}>
                          Mark as Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {false && isManagerOverallDashboard && selectedBossEmployee && (
        <div className="card" id="manager-employee-profile">
          <div className="card-content space-y-sm">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Employee Profile</p>
                <h2>{selectedBossEmployee.name}</h2>
                <p className="small muted">{selectedBossEmployee.email} · {selectedBossEmployee.department}</p>
                <p className="xsmall muted">{selectedEmployeeApplications.length} saved application(s)</p>
              </div>
              <button className="btn secondary" type="button" onClick={() => setViewEmployeeId('All')}>
                Back to All Employees
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={selectedEmployeeReceiptItems.length === 0}
                onClick={() => downloadReceiptItems(selectedEmployeeReceiptItems)}
              >
                Download Employee Receipts ({selectedEmployeeReceiptItems.length})
              </button>
            </div>

            <div className="grid grid-4">
              <Mini label="Current Week Hours" value={`${Number(selectedBossEmployee.summary.totalWorkingHours || 0).toFixed(2)} / ${Number(selectedBossEmployee.summary.targetHours || 0).toFixed(2)} hrs`} />
              <Mini label="AL Remaining" value={`${selectedBossEmployee.summary.annualLeaveRemaining} / ${selectedBossEmployee.summary.annualLeaveTotal} days`} />
              <Mini label="TIL Remaining" value={`${Number(selectedBossEmployee.summary.timeInLieuRemaining || 0).toFixed(2)} hrs`} />
              <Mini label="Total Expense" value={money(selectedBossEmployee.summary.outstandingExpenses)} />
            </div>

            <div className="wide">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployeeApplications.map(application => {
                    return (
                      <tr key={`${application.source}-${application.id}`}>
                        <td>{application.type}</td>
                        <td>{application.period}</td>
                        <td><span className={`badge ${application.status}`}>{application.status}</span></td>
                        <td>{application.summary}</td>
                        <td>
                          {application.status === 'Submitted' ? (
                            <>
                              <button className="btn" onClick={() => approveApplication(application)}>Approve</button>
                              {' '}
                              <button className="btn danger" onClick={() => rejectApplication(application)}>Reject</button>
                            </>
                          ) : application.claimType === 'expense' && application.status === 'Approved' ? (
                            <button className="btn secondary" onClick={() => markApplicationPaid(application)}>Mark as Paid</button>
                          ) : (
                            <span className="small muted">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {selectedEmployeeApplications.length === 0 && (
                    <tr>
                      <td colSpan="5" className="muted">No saved applications for this employee yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isCurrentStatus && !isManager && (
        <>
          <div className="grid grid-4">
            <Insight
              title="Time in Lieu Remaining"
              value={`${Number(latestTilBalance || 0).toFixed(2)} hrs`}
              note="All saved timesheet records"
              icon={<FileCheck2 />}
            />
            <Insight
              title="Total Expense"
              value={money(totalExpenses)}
              note="All expense claims - approved/paid"
              icon={<WalletCards />}
            />
            <Insight
              title="All Expense Claims"
              value={money(totalExpenseClaims)}
              note={`${expenseClaims.length} saved expense claim(s)`}
              icon={<ReceiptText />}
            />
            <Insight
              title="Approved / Paid"
              value={money(approvedPaidExpenses)}
              note={`VAT in claims: ${money(totalVATClaims)} | approved/paid VAT: ${money(approvedPaidVAT)}`}
              icon={<CheckCircle2 />}
            />
          </div>

          <ChartCard title="Current Status" sub="Only Time in Lieu Remaining and Total Expense are shown here.">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusChartData} margin={{ left: 20, right: 20, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(_, __, item) => item?.payload?.display || ''} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusChartData.map(item => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {!isCurrentStatus && (
        <>
          <div className="grid grid-4">
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
              note="All saved timesheet records"
              icon={<FileCheck2 />}
            />

            <Insight
              title="Time in Lieu This Week"
              value={`${timeInLieuThisWeek.toFixed(2)} hrs`}
              note={`${weekLabel(selectedWeekOnly)} only`}
              icon={<TrendingUp />}
            />

            <Insight
              title="Total Expense"
              value={money(totalExpenses)}
              note={`All claims ${money(totalExpenseClaims)} - approved/paid ${money(approvedPaidExpenses)}`}
              icon={<WalletCards />}
            />
          </div>

          <ChartCard title="Daily Hours Breakdown vs 7.5h Standard" sub="Project / Workshop, Travel, AL / SL / Take back TIL and Time in Lieu are shown separately.">
            {dailyHoursData.every(item => item.total === 0) ? (
              <div className="muted" style={{ padding: 24 }}>No timesheet data for this week yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={dailyHoursData} margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" angle={-20} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value || 0).toFixed(2)} hrs`,
                      name === 'project'
                        ? 'Project / Workshop'
                        : name === 'travel'
                          ? 'Travel'
                          : name === 'paidLeaveAndTakeBack'
                            ? 'AL / SL / Take back TIL'
                            : 'Time in Lieu'
                    ]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="project" stackId="hours" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="travel" stackId="hours" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="paidLeaveAndTakeBack" stackId="hours" fill="#eab308" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="timeInLieu" stackId="hours" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="flex gap items-center" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <span className="small muted"><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2563eb', borderRadius: 3, marginRight: 6 }} />Project / Workshop</span>
              <span className="small muted"><span style={{ display: 'inline-block', width: 12, height: 12, background: '#16a34a', borderRadius: 3, marginRight: 6 }} />Travel</span>
              <span className="small muted"><span style={{ display: 'inline-block', width: 12, height: 12, background: '#eab308', borderRadius: 3, marginRight: 6 }} />AL / SL / Take back TIL</span>
              <span className="small muted"><span style={{ display: 'inline-block', width: 12, height: 12, background: '#dc2626', borderRadius: 3, marginRight: 6 }} />Time in Lieu over 7.5h</span>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}




function BusinessWeekPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const { year, week } = parseWeekValue(value);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(() => {
    const start = getBusinessWeekStart(value);
    return start.getMonth();
  });

  const currentYear = new Date().getFullYear();
  const weeksInYear = getWeeksInBusinessYear(viewYear);

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(viewYear, i, 1).toLocaleDateString('en-GB', { month: 'long' })
  );

  const pickWeek = (targetYear, targetWeek, closeAfterPick = false) => {
    const safeWeek = Math.max(1, Math.min(Number(targetWeek), getWeeksInBusinessYear(targetYear)));
    const nextValue = makeWeekValue(targetYear, safeWeek);
    const nextStart = getBusinessWeekStart(nextValue);
    setViewYear(targetYear);
    setViewMonth(nextStart.getMonth());
    onChange(nextValue);
    if (closeAfterPick) setOpen(false);
  };

  const getWeeksForMonth = () => {
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 0);
    const firstWeek = Math.max(1, getBusinessWeekNumberFromDate(start, viewYear));
    const lastWeek = Math.min(getWeeksInBusinessYear(viewYear), getBusinessWeekNumberFromDate(end, viewYear));

    const weeks = [];
    for (let w = firstWeek; w <= lastWeek; w += 1) {
      weeks.push(w);
    }
    return weeks;
  };

  const weeksForMonth = getWeeksForMonth();
  const formatDay = (date) => String(date.getDate()).padStart(2, '0');

  const buildWeekRow = (weekNumber) => {
    const weekValue = makeWeekValue(viewYear, weekNumber);
    const dates = getWeekDates(weekValue);
    return { weekNumber, dates };
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="input"
        onClick={() => setOpen(v => !v)}
        style={{ textAlign: 'left', cursor: 'pointer' }}
      >
        {weekLabel(value)} 📅
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            zIndex: 50,
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 500,
            boxShadow: '0 24px 60px rgba(15,23,42,.18)'
          }}
        >
          <div className="card-content space-y-sm">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label className="xsmall muted">Year</label>
                <select
                  className="select"
                  value={viewYear}
                  onChange={e => {
                    const nextYear = Number(e.target.value);
                    const nextWeek = Math.min(week, getWeeksInBusinessYear(nextYear));
                    pickWeek(nextYear, nextWeek);
                  }}
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="xsmall muted">Month</label>
                <select
                  className="select"
                  value={viewMonth}
                  onChange={e => setViewMonth(Number(e.target.value))}
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="xsmall muted">Week</label>
                <select
                  className="select"
                  value={week}
                  onChange={e => pickWeek(viewYear, Number(e.target.value), true)}
                >
                  {Array.from({ length: weeksInYear }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '64px repeat(7, 1fr)',
                gap: 6,
                textAlign: 'center',
                alignItems: 'center'
              }}
            >
              <b className="xsmall muted">Week</b>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <b key={`${d}-${i}`} className="xsmall muted">{d}</b>
              ))}

              {weeksForMonth.map(weekNumber => {
                const row = buildWeekRow(weekNumber);
                const isSelectedWeek = viewYear === year && weekNumber === week;

                return (
                  <React.Fragment key={`week-row-${weekNumber}`}>
                    <button
                      type="button"
                      onClick={() => pickWeek(viewYear, weekNumber, true)}
                      style={{
                        border: '1px solid ' + (isSelectedWeek ? '#2563eb' : '#e2e8f0'),
                        background: isSelectedWeek ? '#dbeafe' : '#f8fafc',
                        borderRadius: 10,
                        minHeight: 44,
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      {weekNumber}
                    </button>

                    {row.dates.map(({ date, inYear }, dayIndex) => {
                      const isCurrentMonth = inYear && date.getMonth() === viewMonth;
                      const isSelected = isSelectedWeek;
                      const isWeekend = dayIndex >= 5;

                      return (
                        <button
                          type="button"
                          key={`${weekNumber}-${dayIndex}`}
                          onClick={() => pickWeek(viewYear, weekNumber, true)}
                          style={{
                            border: '1px solid ' + (isSelected ? '#2563eb' : '#e2e8f0'),
                            background: isSelected
                              ? '#dbeafe'
                              : isCurrentMonth
                                ? '#ffffff'
                                : '#f1f5f9',
                            color: isCurrentMonth ? '#0f172a' : '#94a3b8',
                            borderRadius: 10,
                            minHeight: 44,
                            cursor: 'pointer',
                            fontWeight: isSelected ? 700 : 500,
                            opacity: isWeekend ? 0.85 : 1
                          }}
                        >
                          {inYear ? formatDay(date) : '—'}
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="xsmall muted">
              Calendar follows the real weekday layout. Out-of-year dates are locked in the timesheet.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimesheetForm(p) {
  const weekDates = getWeekDates(p.selectedWeek);
  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content grid grid-4">
          <div>
            <label className="label">Employee</label>
            {p.activeUser?.role === 'Manager' && !p.personalMode ? (
              <select className="select" value={p.employeeInfo.employeeId} onChange={e => p.setClaimEmployee(e.target.value)}>
                {p.employees.filter(u => u.role !== 'Manager').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            ) : (
              <input className="input" value={p.employeeInfo.employeeName} disabled readOnly />
            )}
          </div>
          <ReadOnlyField label="Email" value={p.employeeInfo.email} />
          <ReadOnlyField label="Employee ID" value={p.employeeInfo.employeeId} />
          <div>
            <label className="label">Week</label>
            <BusinessWeekPicker value={p.selectedWeek} onChange={p.setSelectedWeek} />
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
                  const dateInfo = weekDates[dayIndex];
                  const isLockedOutsideYear = dateInfo && dateInfo.inYear === false;
                  const dailyHours = Number(p.standardHours || 7.5);
                  const holidayType = row.holidayType || 'none';
                  const sicknessType = row.sicknessType || (row.sickness === true ? 'full' : 'none');
                  const sicknessSelected = sicknessType === 'half' || sicknessType === 'full';
                  const takeBackHours = Number(row.takeBackTimeInLieu || 0);
                  const leaveSelected = holidayType === 'half' || holidayType === 'full' || sicknessSelected;

                  const workedHours = leaveSelected || isLockedOutsideYear
                    ? 0
                    : Number(row.projectHours || 0) +
                      Number(row.travelHours || 0);

                  const holidayHours = isLockedOutsideYear ? 0 :
                    holidayType === 'full' ? dailyHours :
                    holidayType === 'half' ? dailyHours / 2 :
                    0;

                  const sicknessHours = isLockedOutsideYear ? 0 :
                    sicknessType === 'full' ? dailyHours :
                    sicknessType === 'half' ? dailyHours / 2 :
                    0;
                  const autoTimeInLieu = leaveSelected || isLockedOutsideYear ? 0 : Math.max(0, workedHours - dailyHours);
                  const total = isLockedOutsideYear ? 0 : (leaveSelected ? holidayHours + sicknessHours : workedHours + takeBackHours);

                  const clearWorkingInputs = () => {
                    p.updateTimesheet(day, 'projectName', '');
                    p.updateTimesheet(day, 'projectHours', '');
                    p.updateTimesheet(day, 'travelHours', '');
                  };

                  const setHoliday = (type) => {
                    if (isLockedOutsideYear) return;
                    const nextType = holidayType === type ? 'none' : type;
                    p.updateTimesheet(day, 'holidayType', nextType);
                    p.updateTimesheet(day, 'sicknessType', 'none');
                    p.updateTimesheet(day, 'sickness', false);
                    if (nextType !== 'none') clearWorkingInputs();
                  };

                  const setSickness = (type) => {
                    if (isLockedOutsideYear) return;
                    const nextType = sicknessType === type ? 'none' : type;
                    p.updateTimesheet(day, 'sicknessType', nextType);
                    p.updateTimesheet(day, 'sickness', nextType === 'full');
                    p.updateTimesheet(day, 'holidayType', 'none');
                    if (nextType !== 'none') clearWorkingInputs();
                  };

                  return (
                    <tr key={day} style={isLockedOutsideYear ? { opacity: 0.55, background: '#f8fafc' } : undefined}>
                      <td><b>{day}</b><br /><span className="xsmall muted">{dateInfo?.label || "Outside year"}</span>{isLockedOutsideYear && <><br /><span className="xsmall muted">Locked</span></>}</td>

                      <td>
                        <input
                          className="input"
                          type="text"
                          placeholder={leaveSelected ? 'Locked - leave/sickness selected' : 'Project / Job name'}
                          value={row.projectName || ''}
                          disabled={leaveSelected || isLockedOutsideYear}
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
                          disabled={leaveSelected || isLockedOutsideYear}
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
                          disabled={leaveSelected || isLockedOutsideYear}
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
                          disabled={isLockedOutsideYear}
                          onChange={e => p.updateTimesheet(day, 'takeBackTimeInLieu', e.target.value)}
                        />
                      </td>

                      <td>
                        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={holidayType === 'half'}
                              disabled={isLockedOutsideYear}
                              onChange={() => setHoliday('half')}
                            />
                            Half ({(dailyHours / 2).toFixed(2)}h)
                          </label>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={holidayType === 'full'}
                              disabled={isLockedOutsideYear}
                              onChange={() => setHoliday('full')}
                            />
                            Full ({dailyHours.toFixed(2)}h)
                          </label>
                        </div>
                      </td>

                      <td>
                        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={sicknessType === 'half'}
                              disabled={isLockedOutsideYear}
                              onChange={() => setSickness('half')}
                            />
                            Half sick ({(dailyHours / 2).toFixed(2)}h)
                          </label>
                          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={sicknessType === 'full'}
                              disabled={isLockedOutsideYear}
                              onChange={() => setSickness('full')}
                            />
                            Full sick ({dailyHours.toFixed(2)}h)
                          </label>
                        </div>
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
        <div className="card-content space-y-sm">
          <label className="label">Employee Notes</label>
          <textarea className="textarea" value={p.employeeInfo.notes} onChange={e => p.setEmployeeInfo({ ...p.employeeInfo, notes: e.target.value })} />

          {p.editingClaimId ? (
            <>
              <button className="btn" onClick={p.saveEditedClaim}>Save Changes</button>
              {' '}
              <button className="btn secondary" onClick={p.cancelEditClaim}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn secondary" onClick={p.saveDraft}>Save Timesheet Draft</button>
              {' '}
              <button className="btn" onClick={p.submitTimesheet}>Submit Timesheet</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function ExpenseForm(p) {
  const currentExpenseTotal = p.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const currentVATTotal = p.expenses.reduce((sum, e) => sum + Number(e.vat || 0), 0);

  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content grid grid-4">
          <div>
            <label className="label">Employee</label>
            {p.activeUser?.role === 'Manager' && !p.personalMode ? (
              <select className="select" value={p.employeeInfo.employeeId} onChange={e => p.setClaimEmployee(e.target.value)}>
                {p.employees.filter(u => u.role !== 'Manager').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            ) : (
              <input className="input" value={p.employeeInfo.employeeName} disabled readOnly />
            )}
          </div>
          <Mini label="Month Sorting" value="Auto by item date" />
          <Mini label="Current Expense Total" value={money(currentExpenseTotal)} />
          <Mini label="Current VAT Total" value={money(currentVATTotal)} />
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
            const selectedVatRate = e.vatRate || 'custom';
            const vatIsCustom = selectedVatRate === 'custom';
            const hasReceiptProof = Boolean(e.receiptName && e.receiptPreview);

            return (
            <div className="grid expense-row" key={e.id}>
              <input className="input" type="date" value={e.date} onChange={ev => p.updateExpense(i, 'date', ev.target.value)} />

              <select className="select" value={e.category} onChange={ev => p.updateExpense(i, 'category', ev.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>

              <input className="input" type="number" placeholder="Amount" value={e.amount} onChange={ev => p.updateExpense(i, 'amount', ev.target.value)} />
              <select className="select" value={selectedVatRate} onChange={ev => p.updateExpense(i, 'vatRate', ev.target.value)}>
                {vatRateOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                placeholder="VAT"
                value={e.vat || ''}
                disabled={!vatIsCustom}
                onChange={ev => p.updateExpense(i, 'vat', ev.target.value)}
              />
              <input className="input" placeholder="PJ name" value={e.projectName || ''} onChange={ev => p.updateExpense(i, 'projectName', ev.target.value)} />
              <input className="input" placeholder="Description" value={e.description} onChange={ev => p.updateExpense(i, 'description', ev.target.value)} />

              <div className="receipt-proof-cell">
                {hasReceiptProof ? (
                  <div className="receipt-proof">
                    <button
                      className="btn secondary receipt-proof-trigger"
                      type="button"
                      aria-label={`Receipt uploaded: ${e.receiptName}`}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <div className="receipt-proof-popover">
                      <p className="xsmall muted">Uploaded proof</p>
                      <b>{e.receiptName}</b>
                      <div className="flex gap" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                        <button className="btn ghost" type="button" onClick={() => p.setReceipt(e)}>
                          <Eye size={16} /> View
                        </button>
                        <label className="btn ghost">
                          Replace
                          <input hidden type="file" accept="image/*,.pdf" onChange={ev => p.uploadReceipt(i, ev.target.files?.[0])} />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="btn secondary">
                    <Upload size={16} /> Upload
                    <input hidden type="file" accept="image/*,.pdf" onChange={ev => p.uploadReceipt(i, ev.target.files?.[0])} />
                  </label>
                )}
              </div>

              <button className="btn ghost" onClick={() => p.setExpenses(prev => prev.filter((_, idx) => idx !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-content space-y-sm">
          <h2>{p.editingClaimId ? 'Save Expense Changes' : 'Ready to Submit Expense'}</h2>
          <p className="small muted">
            {p.editingClaimId
              ? 'This updates the existing expense record for the selected employee, month and claim type.'
              : 'This will submit expense only. It is no longer linked to the weekly timesheet.'}
          </p>
          {p.expenseError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 12 }}>
              {p.expenseError}
            </div>
          )}

          {p.editingClaimId ? (
            <div className="flex gap" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={p.saveEditedClaim}>Save Changes</button>
              <button className="btn secondary" onClick={p.cancelEditClaim}>Cancel</button>
            </div>
          ) : (
            <button className="btn" onClick={p.submitExpense}>Submit Expense Claim</button>
          )}
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

function Filter({ search, setSearch, historyTypeFilter, setHistoryTypeFilter, setClaims }) {
  return (
    <div className="card">
      <div className="card-content flex gap" style={{ flexWrap: 'wrap' }}>
        <div className="flex items-center gap" style={{ flex: 1 }}>
          <Search size={16} />
          <input className="input" placeholder="Search employee, email, week or month..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select
          className="select"
          value={historyTypeFilter}
          onChange={e => setHistoryTypeFilter(e.target.value)}
          style={{ maxWidth: 180 }}
          aria-label="Filter claim type"
        >
          <option value="All">All</option>
          <option value="timesheet">Timesheet</option>
          <option value="expense">Expense</option>
        </select>

        <button className="btn secondary" onClick={() => setClaims([])}>
          <RefreshCw size={16} /> Clear demo data
        </button>
      </div>
    </div>
  );
}

function ApprovalDashboardNav({ setTab, currentTab, counts = {}, hideBeforeCurrent = false }) {
  const items = [
    { key: 'dashboard', title: 'Dashboard', count: null, note: 'Approval overview' },
    { key: 'annualLeave', title: 'AL Applications', count: counts.annualLeave || 0, note: 'Annual leave requests' },
    { key: 'timesheet', title: 'Timesheet Applications', count: counts.timesheets || 0, note: 'Timesheet submissions' },
    { key: 'expense', title: 'Expense Applications', count: counts.expenses || 0, note: 'Expense claims' }
  ];
  const visibleItems = hideBeforeCurrent
    ? items.slice(Math.max(0, items.findIndex(item => item.key === currentTab)))
    : items;

  return (
    <div className="card">
      <div className="card-content">
        <p className="small muted">Approval Dashboard</p>
        <div className="grid grid-4" style={{ marginTop: 12 }}>
          {visibleItems.map(item => (
            <button
              key={item.key}
              type="button"
              className={`approval-nav-tile ${currentTab === item.key ? 'active' : ''} ${item.count ? 'pending' : ''}`}
              onClick={() => setTab(item.key)}
            >
              <span className="approval-nav-title">{item.title}</span>
              {item.count !== null && <span className="approval-nav-count">{item.count} pending</span>}
              <span className="xsmall muted">{item.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerAnnualLeaveAdmin({
  leaveRequests,
  employees,
  updateLeaveRequest,
  closeAdmin,
  setTab,
  approvalCounts,
  alMonth,
  setAlMonth,
  alBlanks,
  alDays,
  leaveRequestsForDate,
  highlightedLeaveId
}) {
  const [searchText, setSearchText] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');

  const matchesSearch = (request) => {
    const haystack = [
      request.employeeName,
      request.startDate,
      request.endDate,
      request.status,
      request.reason,
      request.managerNote
    ].join(' ').toLowerCase();

    return haystack.includes(searchText.toLowerCase());
  };

  const pendingRequests = leaveRequests.filter(request => request.status === 'Submitted');
  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId);
  const selectedEmployeeAllRequests = selectedEmployeeId
    ? leaveRequests.filter(request => request.employeeId === selectedEmployeeId)
    : [];
  const selectedEmployeeDisplayRequests = selectedEmployeeAllRequests
    .filter(matchesSearch)
    .sort((a, b) => {
      const statusRank = { Submitted: 0, Approved: 1, Rejected: 2 };
      return (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3) ||
        String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
    });
  const selectedEmployeeSelectedRequest = selectedEmployeeDisplayRequests.find(request => request.id === selectedRequestId) ||
    selectedEmployeeDisplayRequests[0] ||
    null;
  const selectedEmployeeApprovedUsed = calculateApprovedLeaveDays(selectedEmployeeAllRequests);
  const selectedEmployeePending = selectedEmployeeAllRequests.filter(request => request.status === 'Submitted').length;
  const selectedEmployeeRemaining = Math.max(0, 28 - selectedEmployeeApprovedUsed);

  const employeeRows = employees
    .filter(employee => employee.role !== 'Manager')
    .map(employee => {
      const employeeRequests = leaveRequests.filter(request => employee.id === request.employeeId);
      return {
        ...employee,
        total: employeeRequests.length,
        pending: employeeRequests.filter(request => request.status === 'Submitted').length,
        approved: employeeRequests.filter(request => request.status === 'Approved').length,
        rejected: employeeRequests.filter(request => request.status === 'Rejected').length
      };
    })
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));

  useEffect(() => {
    setSelectedRequestId(selectedEmployeeDisplayRequests[0]?.id || '');
  }, [selectedEmployeeId, searchText, leaveRequests.length]);

  useEffect(() => {
    if (selectedEmployeeSelectedRequest?.startDate) {
      setAlMonth(selectedEmployeeSelectedRequest.startDate.slice(0, 7));
    }
  }, [selectedEmployeeSelectedRequest?.id]);

  return (
    <div className="space-y">
      <ApprovalDashboardNav setTab={setTab} currentTab="annualLeave" counts={approvalCounts} />

      {!selectedEmployeeId ? (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Annual Leave Requests</p>
                <h2>Employee Summary</h2>
                <p className="small muted">{pendingRequests.length} AL request(s) waiting. Open an employee to view their calendar and full annual leave data.</p>
              </div>
            </div>

            <div className="flex gap items-center" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <Search size={16} />
              <input
                className="input"
                style={{ maxWidth: 420 }}
                placeholder="Search employee, date, status or note..."
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
              />
            </div>

            <div className="wide" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Rejected</th>
                    <th>Total</th>
                    <th>Full Data</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map(employee => (
                    <tr key={employee.id} className={employee.pending ? 'employee-row-pending' : ''}>
                      <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                      <td>{employee.department}</td>
                      <td>
                        {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                        {employee.pending}
                      </td>
                      <td>{employee.approved}</td>
                      <td>{employee.rejected}</td>
                      <td>{employee.total}</td>
                      <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="small muted">Annual Leave Requests</p>
              <h2>{selectedEmployee?.name || 'Employee'} Annual Leave</h2>
            </div>
          </div>

          <div className="grid grid-3">
            <Insight title="Annual Leave Remaining" value={`${selectedEmployeeRemaining} / 28 days`} note="Approved AL deducted" icon={<CalendarDays />} />
            <Insight title="Pending AL" value={String(selectedEmployeePending)} note="Waiting for approval" icon={<Clock />} />
            <Insight title="Approved AL Used" value={`${selectedEmployeeApprovedUsed} days`} note="Approved requests only" icon={<CheckCircle2 />} />
          </div>

          <div className="grid grid-2-1">
            <AnnualLeaveCalendar
              alMonth={alMonth}
              setAlMonth={setAlMonth}
              alBlanks={alBlanks}
              alDays={alDays}
              leaveRequestsForDate={(day) => leaveRequestsForDate(day).filter(request => request.employeeId === selectedEmployeeId)}
              readOnly
            />

            <AnnualLeaveRequestsPanel
              requests={selectedEmployeeDisplayRequests}
              request={selectedEmployeeSelectedRequest}
              selectedRequestId={selectedRequestId}
              setSelectedRequestId={setSelectedRequestId}
              updateLeaveRequest={updateLeaveRequest}
            />
          </div>

          <div className="card">
            <div className="card-content">
              <h2>AL Employee Summary</h2>
              <p className="small muted">Pending staff stay at the top with a green light.</p>
              <div className="wide" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Pending</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Total</th>
                      <th>Full Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeRows.map(employee => (
                      <tr key={employee.id} className={employee.pending ? 'employee-row-pending' : ''}>
                        <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                        <td>{employee.department}</td>
                        <td>
                          {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                          {employee.pending}
                        </td>
                        <td>{employee.approved}</td>
                        <td>{employee.rejected}</td>
                        <td>{employee.total}</td>
                        <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId('')}>Back to Summary</button>
          </div>
        </>
      )}
    </div>
  );
}

function AnnualLeaveCalendar({ alMonth, setAlMonth, alBlanks, alDays, leaveRequestsForDate, readOnly = false, alForm = {}, selectAnnualLeaveDate }) {
  const changeMonth = (delta) => {
    const [year, month] = alMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setAlMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const calendarStart = alDays[0] ? new Date(alDays[0]) : new Date();
  calendarStart.setDate(calendarStart.getDate() - alBlanks.length);
  const calendarCells = [
    ...Array.from({ length: alBlanks.length }, () => null),
    ...alDays
  ];
  const calendarRows = Array.from(
    { length: Math.ceil(calendarCells.length / 7) },
    (_, rowIndex) => calendarCells.slice(rowIndex * 7, rowIndex * 7 + 7)
  );

  return (
    <div className="card">
      <div className="card-content">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div className="month-stepper">
            <button className="btn secondary" type="button" onClick={() => changeMonth(-1)}>{'<'}</button>
            <h2>{monthLabel(alMonth)}</h2>
            <button className="btn secondary" type="button" onClick={() => changeMonth(1)}>{'>'}</button>
          </div>
          <input className="input month-picker-input" type="month" value={alMonth} onChange={event => setAlMonth(event.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', gap: 6, marginBottom: 8, textAlign: 'center' }}>
          <b className="small muted">Week</b>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <b key={d} className="small muted">{d}</b>)}
        </div>

        <div className="al-calendar-grid">
          {calendarRows.map((row, rowIndex) => {
            const monday = new Date(calendarStart);
            monday.setDate(calendarStart.getDate() + rowIndex * 7);
            const weekNumber = getBusinessWeekNumberFromDate(monday, monday.getFullYear());

            return (
              <React.Fragment key={`week-${rowIndex}`}>
                <div className="al-week-number">{weekNumber}</div>
                {row.map((day, dayIndex) => {
                  if (!day) return <div key={`blank-${rowIndex}-${dayIndex}`} />;

            const key = formatISODateLocal(day);
            const items = leaveRequestsForDate(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isSelected = alForm.startDate && (
              alForm.endDate
                ? key >= alForm.startDate && key <= alForm.endDate
                : key === alForm.startDate
            );

            return (
              <button
                type="button"
                key={key}
                onClick={() => {
                  if (!readOnly && selectAnnualLeaveDate) selectAnnualLeaveDate(day);
                }}
                style={{
                  minHeight: 92,
                  textAlign: 'left',
                  padding: 8,
                  borderRadius: 14,
                  border: '1px solid ' + (isSelected ? '#2563eb' : '#e2e8f0'),
                  background: isSelected ? '#dbeafe' : isWeekend ? '#f1f5f9' : '#ffffff',
                  cursor: readOnly ? 'default' : 'pointer'
                }}
              >
                <b>{day.getDate()}</b>
                {isWeekend && <div className="xsmall muted">Weekend</div>}
                <div className="space-y-sm" style={{ marginTop: 6 }}>
                  {items.slice(0, 2).map(item => (
                    <div key={item.id} className={`badge al-status ${item.calendarType === 'sickness' ? 'Sickness' : item.status}`} style={{ display: 'block', whiteSpace: 'normal' }}>
                      {item.employeeName} · {item.calendarType === 'sickness' ? 'Sickness' : item.duration === 'half' ? 'Half day' : 'AL'} · {item.status}
                    </div>
                  ))}
                </div>
              </button>
            );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AnnualLeaveRequestsPanel({ requests, request, selectedRequestId, setSelectedRequestId, updateLeaveRequest }) {
  const [note, setNote] = useState('');
  const selectedIndex = Math.max(0, requests.findIndex(item => item.id === selectedRequestId));
  const canMovePrevious = requests.length > 1 && selectedIndex > 0;
  const canMoveNext = requests.length > 1 && selectedIndex < requests.length - 1;
  const canManagerAction = request?.status === 'Submitted';

  useEffect(() => {
    setNote(request?.managerNote || '');
  }, [request?.id]);

  const moveRequest = (direction) => {
    if (!requests.length) return;
    const nextIndex = Math.min(Math.max(selectedIndex + direction, 0), requests.length - 1);
    setSelectedRequestId(requests[nextIndex]?.id || '');
  };

  return (
    <div className="card">
      <div className="card-content space-y-sm">
        <div className="flex justify-between items-center" style={{ gap: 12 }}>
          <div>
            <h2>Annual Leave Requests</h2>
            <p className="small muted">Use the arrows to move through this employee's AL request records.</p>
          </div>
          <div className="request-stepper">
            <button className="btn secondary" type="button" disabled={!canMovePrevious} onClick={() => moveRequest(-1)}>{'<'}</button>
            <span className="request-stepper-count">{requests.length ? `${selectedIndex + 1} / ${requests.length}` : '0 / 0'}</span>
            <button className="btn secondary" type="button" disabled={!canMoveNext} onClick={() => moveRequest(1)}>{'>'}</button>
          </div>
        </div>

        {!request ? (
          <p className="muted">No AL requests in this view for this employee.</p>
        ) : (
          <>
            <div className="card-dark" style={{ padding: 16 }}>
              <p className="small">Selected AL Days</p>
              <h2>{calculateLeaveDays(request)} day(s)</h2>
              <p className="xsmall" style={{ color: '#cbd5e1' }}>Weekends are not deducted. Submitted AL is deducted only after approval.</p>
            </div>

            <ReadOnlyField label="Employee" value={request.employeeName || ''} />
            <ReadOnlyField label="Start Date" value={request.startDate || ''} />
            <ReadOnlyField label="End Date" value={request.endDate || ''} />
            <ReadOnlyField label="Duration" value={request.duration === 'half' ? 'Half day' : 'Full day'} />
            <div>
              <label className="label">Status</label>
              <span className={`badge al-status ${request.status}`}>{request.status || ''}</span>
            </div>

            <div>
              <label className="label">Reason / Notes</label>
              <textarea className="textarea" value={request.reason || ''} disabled readOnly />
            </div>

            <div>
              <label className="label">Manager Note / Reject Reason</label>
              <textarea
                className="textarea"
                placeholder="Add approval note or reject reason..."
                value={note}
                disabled={!canManagerAction}
                onChange={event => setNote(event.target.value)}
              />
            </div>

            {canManagerAction ? (
              <div className="flex gap" style={{ flexWrap: 'wrap' }}>
                <button className="btn" type="button" onClick={() => updateLeaveRequest(request.id, { status: 'Approved', managerNote: note })}>Approve</button>
                <button className="btn danger" type="button" onClick={() => updateLeaveRequest(request.id, { status: 'Rejected', managerNote: note })}>Reject</button>
              </div>
            ) : (
              <p className="small muted">This request is locked because it is no longer pending.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnnualLeaveRequestTable({ requests, updateLeaveRequest, highlightedLeaveId, manager = false, canEmployeeCancel, cancelLeaveRequest }) {
  const [notes, setNotes] = useState({});

  if (!requests.length) {
    return (
      <div className="card">
        <div className="card-content muted">No annual leave requests yet.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-content">
        <h2>Annual Leave Requests</h2>
        <div className="wide">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dates</th>
                <th>Duration</th>
                <th>Days</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Manager Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => {
                const isLocked = request.status === 'Approved';
                const canManagerAction = manager && request.status === 'Submitted';
                const noteValue = notes[request.id] ?? request.managerNote ?? '';

                return (
                  <tr
                    key={request.id}
                    id={`leave-row-${request.id}`}
                    style={highlightedLeaveId === request.id ? { background: '#dbeafe' } : undefined}
                  >
                    <td>{request.employeeName}</td>
                    <td>{request.startDate} {'->'} {request.endDate}</td>
                    <td>{request.duration === 'half' ? 'Half day' : 'Full day'}</td>
                    <td>{calculateLeaveDays(request)}</td>
                    <td><span className={`badge al-status ${request.status}`}>{request.status}</span></td>
                    <td>
                      {request.reason || '—'}
                      {isLocked && <div className="xsmall muted">Locked after approval</div>}
                    </td>
                    <td>
                      {canManagerAction ? (
                        <textarea
                          className="textarea"
                          placeholder="Note / reject reason"
                          value={noteValue}
                          onChange={event => setNotes(prev => ({ ...prev, [request.id]: event.target.value }))}
                        />
                      ) : (
                        request.managerNote || '—'
                      )}
                    </td>
                    <td>
                      {canManagerAction ? (
                        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
                          <button className="btn" onClick={() => updateLeaveRequest(request.id, { status: 'Approved', managerNote: noteValue })}>Approve</button>
                          <button className="btn danger" onClick={() => updateLeaveRequest(request.id, { status: 'Rejected', managerNote: noteValue })}>Reject</button>
                        </div>
                      ) : canEmployeeCancel?.(request) ? (
                        <button className="btn secondary" onClick={() => cancelLeaveRequest(request.id)}>Cancel Request</button>
                      ) : (
                        <span className="small muted">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ManagerClaimReview({ claim, updateClaim, setReceipt, closeReview }) {
  const isExpense = claimTypeOf(claim) === 'expense';

  return (
    <div className="space-y">
      <div className="card">
        <div className="card-content flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="small muted">Manager Review</p>
            <h2>{isExpense ? 'Employee Expense Application' : 'Employee Timesheet Application'}</h2>
            <p className="small muted">
              Reviewing {claim.employeeName}'s submitted {isExpense ? 'expense claim' : 'timesheet'}.
              This is separate from your personal application form.
            </p>
          </div>

          <button className="btn secondary" type="button" onClick={closeReview}>
            Back to Overall Dashboard
          </button>
        </div>
      </div>

      <ClaimList
        claims={[claim]}
        setReceipt={setReceipt}
        manager
        updateClaim={updateClaim}
      />
    </div>
  );
}

function ManagerAdminCategory({
  title,
  note,
  claims,
  employees,
  setReceipt,
  updateClaim,
  closeAdmin,
  setTab,
  currentTab,
  approvalCounts,
  showReceiptDownload = false
}) {
  const [searchText, setSearchText] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [expenseSummaryMonth, setExpenseSummaryMonth] = useState('All');
  const receiptItems = receiptDownloadItemsFromClaims(claims);
  const isExpenseAdmin = claims.some(claim => claimTypeOf(claim) === 'expense');
  const pendingClaims = claims.filter(claim => claim.status === 'Submitted');
  const expenseMonthOptions = isExpenseAdmin
    ? Array.from(new Set(claims
        .filter(claim => ['Approved', 'Paid'].includes(claim.status))
        .flatMap(claim => (claim.expenses || []).map(expense => expense.date?.slice(0, 7) || getClaimExpenseMonth(claim)).filter(Boolean))
      )).sort().reverse()
    : [];
  const approvedExpenseItemsForSummary = isExpenseAdmin
    ? claims
        .filter(claim => ['Approved', 'Paid'].includes(claim.status))
        .flatMap(claim => (claim.expenses || []).map(expense => ({
          claim,
          expense,
          month: expense.date?.slice(0, 7) || getClaimExpenseMonth(claim)
        })))
        .filter(item => expenseSummaryMonth === 'All' || item.month === expenseSummaryMonth)
    : [];
  const expenseGross = isExpenseAdmin ? approvedExpenseItemsForSummary.reduce((sum, item) => sum + Number(item.expense.amount || 0), 0) : 0;
  const expenseApprovedPaid = expenseGross;
  const expenseVat = isExpenseAdmin ? approvedExpenseItemsForSummary.reduce((sum, item) => sum + Number(item.expense.vat || 0), 0) : 0;
  const expenseByCategory = isExpenseAdmin
    ? Object.values(approvedExpenseItemsForSummary.reduce((groups, item) => {
        const category = item.expense.category || 'Other';
        const existing = groups[category] || { name: category, value: 0, vat: 0, count: 0 };
        groups[category] = {
          ...existing,
          value: existing.value + Number(item.expense.amount || 0),
          vat: existing.vat + Number(item.expense.vat || 0),
          count: existing.count + 1
        };
        return groups;
      }, {})).sort((a, b) => b.value - a.value)
    : [];
  const expensePieColors = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#7c3aed', '#0891b2', '#f97316', '#64748b'];
  const matchesSearch = (claim) => {
    const haystack = [
      claim.employeeName,
      claim.email,
      claim.department,
      claim.status,
      claim.week,
      claim.weekLabel,
      claim.expenseMonth,
      claim.periodLabel,
      claim.managerNote,
      claim.expenses?.map(expense => [expense.category, expense.projectName, expense.description].join(' ')).join(' ')
    ].join(' ').toLowerCase();

    return haystack.includes(searchText.toLowerCase());
  };
  const visibleClaims = claims.filter(matchesSearch);
  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId);
  const selectedEmployeeClaims = selectedEmployeeId
    ? (isExpenseAdmin ? visibleClaims : claims.filter(matchesSearch))
        .filter(claim => claim.employeeId === selectedEmployeeId)
        .sort((a, b) => isExpenseAdmin
          ? String(getClaimExpenseMonth(b)).localeCompare(String(getClaimExpenseMonth(a)))
          : String(a.week || '').localeCompare(String(b.week || '')))
    : [];
  const selectedEmployeeSelectedClaim = selectedEmployeeClaims.find(claim => claim.id === selectedClaimId) ||
    (isExpenseAdmin ? selectedEmployeeClaims[0] : nearestCurrentOrPastWeekClaim(selectedEmployeeClaims)) ||
    null;
  const employeeRows = employees
    .filter(employee => employee.role !== 'Manager')
    .map(employee => {
      const employeeClaims = claims.filter(claim => claim.employeeId === employee.id);
      const pending = employeeClaims.filter(claim => claim.status === 'Submitted').length;
      const approved = employeeClaims.filter(claim => ['Approved', 'Paid'].includes(claim.status)).length;
      const rejected = employeeClaims.filter(claim => claim.status === 'Rejected').length;
      const totalAmount = employeeClaims.reduce((sum, claim) => sum + Number(claim.totals?.totalExpense || 0), 0);
      const totalHours = employeeClaims.reduce((sum, claim) => sum + Number(claim.totals?.totalWorkingHours || 0), 0);
      const projectHours = employeeClaims.reduce((sum, claim) => sum + Number(claim.totals?.projectHours || 0), 0);
      const travelHours = employeeClaims.reduce((sum, claim) => sum + Number(claim.totals?.travelHours || 0), 0);
      const tilRemaining = employeeClaims.reduce(
        (sum, claim) => sum + Number(claim.totals?.timeInLieu || 0) - Number(claim.totals?.takeBackTimeInLieu || 0),
        0
      );
      const latestClaim = [...employeeClaims].sort((a, b) => String(b.week || '').localeCompare(String(a.week || '')))[0];

      return {
        ...employee,
        total: employeeClaims.length,
        pending,
        approved,
        rejected,
        totalAmount,
        totalHours,
        projectHours,
        travelHours,
        tilRemaining,
        latestWeek: latestClaim ? (latestClaim.weekLabel || latestClaim.week) : '—'
      };
    })
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));

  useEffect(() => {
    const defaultClaim = isExpenseAdmin ? selectedEmployeeClaims[0] : nearestCurrentOrPastWeekClaim(selectedEmployeeClaims);
    setSelectedClaimId(defaultClaim?.id || '');
  }, [selectedEmployeeId, searchText, claims.length, isExpenseAdmin]);

  return (
    <div className="space-y">
      <ApprovalDashboardNav
        setTab={setTab}
        currentTab={currentTab}
        counts={approvalCounts}
      />

      {isExpenseAdmin && !selectedEmployeeId && (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">Company Expense Overview</p>
                <h2>Expense Overall Summary</h2>
                <p className="small muted">Approved and paid expenses only. Pending claims are not included yet.</p>
              </div>
              <div className="flex gap items-center" style={{ flexWrap: 'wrap' }}>
                <select className="select" value={expenseSummaryMonth} onChange={event => setExpenseSummaryMonth(event.target.value)} style={{ width: 200 }}>
                  <option value="All">All Approved Months</option>
                  {expenseMonthOptions.map(month => (
                    <option key={month} value={month}>{monthLabel(month)}</option>
                  ))}
                </select>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={receiptItems.length === 0}
                  onClick={() => downloadReceiptItems(receiptItems)}
                >
                  Download All Receipt Proofs ({receiptItems.length})
                </button>
              </div>
            </div>

            <div className="grid grid-4" style={{ marginTop: 14 }}>
              <Mini label="Approved Expense Total" value={money(expenseGross)} />
              <Mini label="Approved Claims" value={money(expenseGross)} />
              <Mini label="Approved / Paid" value={money(expenseApprovedPaid)} />
              <Mini label="Company VAT Total" value={money(expenseVat)} />
            </div>

            <div className="grid grid-2-1" style={{ marginTop: 18 }}>
              <div>
                {expenseByCategory.length === 0 ? (
                  <div className="muted" style={{ padding: 24 }}>No expense category data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" outerRadius={86} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {expenseByCategory.map((item, index) => (
                          <Cell key={item.name} fill={expensePieColors[index % expensePieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="wide">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseByCategory.length === 0 ? (
                      <tr><td colSpan="4" className="muted">No expense category data yet.</td></tr>
                    ) : expenseByCategory.map((category, index) => (
                      <tr key={category.name}>
                        <td>
                          <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: expensePieColors[index % expensePieColors.length], marginRight: 8 }} />
                          <b>{category.name}</b>
                        </td>
                        <td>{category.count}</td>
                        <td>{money(category.value)}</td>
                        <td>{money(category.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedEmployeeId ? (
        <div className="card">
          <div className="card-content">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p className="small muted">{title}</p>
                <h2>Employee Summary</h2>
                <p className="small muted">{pendingClaims.length} {isExpenseAdmin ? 'expense' : 'timesheet'} application(s) waiting. {note}</p>
              </div>
              <div className="flex gap items-center" style={{ flexWrap: 'wrap' }}>
                {showReceiptDownload && (
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={receiptItems.length === 0}
                    onClick={() => downloadReceiptItems(receiptItems)}
                  >
                    Download All Receipt Proofs ({receiptItems.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap items-center" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <Search size={16} />
              <input
                className="input"
                style={{ maxWidth: 440 }}
                placeholder="Search employee, period, project, category or note..."
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
              />
            </div>

            <div className="wide" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  {isExpenseAdmin ? (
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Pending</th>
                      <th>Approved/Paid</th>
                      <th>Rejected</th>
                      <th>Total Claims</th>
                      <th>Total Records</th>
                      <th>Full Data</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Employee</th>
                      <th>Pending</th>
                      <th>Project / Workshop</th>
                      <th>Travel</th>
                      <th>Time in Lieu Remaining</th>
                      <th>Week</th>
                      <th>Full Data</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {employeeRows.map(employee => (
                    <tr key={employee.id} className={employee.pending ? 'employee-row-pending' : ''}>
                      {isExpenseAdmin ? (
                        <>
                          <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                          <td>{employee.department}</td>
                          <td>
                            {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                            {employee.pending}
                          </td>
                          <td>{employee.approved}</td>
                          <td>{employee.rejected}</td>
                          <td>{money(employee.totalAmount)}</td>
                          <td>{employee.total}</td>
                          <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                        </>
                      ) : (
                        <>
                          <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                          <td>
                            {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                            {employee.pending}
                          </td>
                          <td>{Number(employee.projectHours || 0).toFixed(2)} hrs</td>
                          <td>{Number(employee.travelHours || 0).toFixed(2)} hrs</td>
                          <td>{Number(employee.tilRemaining || 0).toFixed(2)} hrs</td>
                          <td>{employee.latestWeek}</td>
                          <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="small muted">{isExpenseAdmin ? 'Expense Applications' : 'Timesheet Applications'}</p>
              <h2>{selectedEmployee?.name || 'Employee'} {isExpenseAdmin ? 'Expense' : 'Timesheet'} Detail</h2>
            </div>
          </div>

          {isExpenseAdmin ? (
            <>
              <ExpenseApprovalDetail
                claims={selectedEmployeeClaims}
                claim={selectedEmployeeSelectedClaim}
                selectedClaimId={selectedClaimId}
                setSelectedClaimId={setSelectedClaimId}
                setReceipt={setReceipt}
                updateClaim={updateClaim}
              />

              <div className="card">
                <div className="card-content">
                  <h2>Expense Employee Summary</h2>
                  <p className="small muted">Pending staff stay at the top with a green light.</p>
                  <div className="wide" style={{ marginTop: 14 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Pending</th>
                          <th>Approved/Paid</th>
                          <th>Rejected</th>
                          <th>Total Claims</th>
                          <th>Total Records</th>
                          <th>Full Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeRows.map(employee => (
                          <tr key={employee.id} className={employee.pending ? 'employee-row-pending' : ''}>
                            <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                            <td>{employee.department}</td>
                            <td>
                              {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                              {employee.pending}
                            </td>
                            <td>{employee.approved}</td>
                            <td>{employee.rejected}</td>
                            <td>{money(employee.totalAmount)}</td>
                            <td>{employee.total}</td>
                            <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <TimesheetApprovalDetail
                claims={selectedEmployeeClaims}
                claim={selectedEmployeeSelectedClaim}
                selectedClaimId={selectedClaimId}
                setSelectedClaimId={setSelectedClaimId}
                updateClaim={updateClaim}
              />

              <div className="card">
                <div className="card-content">
                  <h2>Timesheet Employee Summary</h2>
                  <p className="small muted">Pending staff stay at the top with a green light.</p>
                  <div className="wide" style={{ marginTop: 14 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Pending</th>
                          <th>Project / Workshop</th>
                          <th>Travel</th>
                          <th>Time in Lieu Remaining</th>
                          <th>Week</th>
                          <th>Full Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeRows.map(employee => (
                          <tr key={employee.id} className={employee.pending ? 'employee-row-pending' : ''}>
                            <td><b>{employee.name}</b><br /><span className="xsmall muted">{employee.email}</span></td>
                            <td>
                              {employee.pending ? <span className="pending-dot" aria-hidden="true" /> : null}
                              {employee.pending}
                            </td>
                            <td>{Number(employee.projectHours || 0).toFixed(2)} hrs</td>
                            <td>{Number(employee.travelHours || 0).toFixed(2)} hrs</td>
                            <td>{Number(employee.tilRemaining || 0).toFixed(2)} hrs</td>
                            <td>{employee.latestWeek}</td>
                            <td><button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId(employee.id)}>View Full Data</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <button className="btn secondary" type="button" onClick={() => setSelectedEmployeeId('')}>Back to Summary</button>
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseApprovalDetail({ claims, claim, selectedClaimId, setSelectedClaimId, setReceipt, updateClaim }) {
  const selectedIndex = Math.max(0, claims.findIndex(item => item.id === selectedClaimId));
  const canMovePrevious = claims.length > 1 && selectedIndex > 0;
  const canMoveNext = claims.length > 1 && selectedIndex < claims.length - 1;

  const moveClaim = (direction) => {
    if (!claims.length) return;
    const nextIndex = Math.min(Math.max(selectedIndex + direction, 0), claims.length - 1);
    setSelectedClaimId(claims[nextIndex]?.id || '');
  };

  if (!claim) {
    return (
      <div className="card">
        <div className="card-content muted">No expense records in this view for this employee.</div>
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      <div className="card">
        <div className="card-content flex justify-between items-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Expense Claim Detail</h2>
            <p className="small muted">{claim.employeeName} - {claim.periodLabel || monthLabel(getClaimExpenseMonth(claim))}</p>
          </div>
          <div className="request-stepper">
            <button className="btn secondary" type="button" disabled={!canMovePrevious} onClick={() => moveClaim(-1)}>{'<'}</button>
            <span className="request-stepper-count">{claims.length ? `${selectedIndex + 1} / ${claims.length}` : '0 / 0'}</span>
            <button className="btn secondary" type="button" disabled={!canMoveNext} onClick={() => moveClaim(1)}>{'>'}</button>
          </div>
        </div>
      </div>

      <ClaimList
        claims={[claim]}
        setReceipt={setReceipt}
        manager
        updateClaim={updateClaim}
      />
    </div>
  );
}

function TimesheetApprovalDetail({ claims, claim, selectedClaimId, setSelectedClaimId, updateClaim }) {
  const [note, setNote] = useState('');
  const selectedIndex = Math.max(0, claims.findIndex(item => item.id === selectedClaimId));
  const canMovePrevious = claims.length > 1 && selectedIndex > 0;
  const canMoveNext = claims.length > 1 && selectedIndex < claims.length - 1;
  const statusClass = claim ? `timesheet-detail-${claim.status || 'Draft'}` : '';

  useEffect(() => {
    setNote(claim?.managerNote || '');
  }, [claim?.id]);

  const moveClaim = (direction) => {
    if (!claims.length) return;
    const nextIndex = Math.min(Math.max(selectedIndex + direction, 0), claims.length - 1);
    setSelectedClaimId(claims[nextIndex]?.id || '');
  };

  if (!claim) {
    return (
      <div className="card">
        <div className="card-content muted">No timesheet records in this view for this employee.</div>
      </div>
    );
  }

  return (
    <div className={`card timesheet-detail-card ${statusClass}`}>
      <div className="card-content space-y-sm">
        <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Timesheet Week Detail</h2>
            <p className="small muted">{claim.employeeName} - {claim.weekLabel || claim.week}</p>
          </div>
          <div className="request-stepper">
            <button className="btn secondary" type="button" disabled={!canMovePrevious} onClick={() => moveClaim(-1)}>{'<'}</button>
            <span className="request-stepper-count">{claims.length ? `${selectedIndex + 1} / ${claims.length}` : '0 / 0'}</span>
            <button className="btn secondary" type="button" disabled={!canMoveNext} onClick={() => moveClaim(1)}>{'>'}</button>
          </div>
        </div>

        <div className="grid grid-4">
          <Mini label="Working Hours" value={`${claim.totals?.totalWorkingHours?.toFixed?.(2) || '0.00'} hrs`} />
          <Mini label="Project / Workshop" value={`${claim.totals?.projectHours?.toFixed?.(2) || '0.00'} hrs`} />
          <Mini label="Travel Hours" value={`${claim.totals?.travelHours?.toFixed?.(2) || '0.00'} hrs`} />
          <Mini label="TIL Balance" value={`${claim.totals?.tilBalance?.toFixed?.(2) || '0.00'} hrs`} />
        </div>

        <div className="wide">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Project / Job</th>
                <th>Project / Workshop</th>
                <th>Travel</th>
                <th>Take back TIL</th>
                <th>Holiday</th>
                <th>Sickness</th>
              </tr>
            </thead>
            <tbody>
              {weekDays.map((day, index) => {
                const row = claim.timesheet?.[day] || {};
                return (
                  <tr key={day}>
                    <td><b>{day}</b></td>
                    <td>{getDateForWeekDay(claim.week, index)}</td>
                    <td>{row.projectName || '—'}</td>
                    <td>{Number(row.projectHours || 0).toFixed(2)}</td>
                    <td>{Number(row.travelHours || 0).toFixed(2)}</td>
                    <td>{Number(row.takeBackTimeInLieu || 0).toFixed(2)}</td>
                    <td>{row.holidayType === 'full' ? 'Full day' : row.holidayType === 'half' ? 'Half day' : '—'}</td>
                    <td>{row.sicknessType === 'half' ? 'Half sick' : row.sicknessType === 'full' || row.sickness ? 'Full sick' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-sm" style={{ background: 'rgba(248,250,252,.82)', padding: 16, borderRadius: 20 }}>
          <label className="label">Manager Note</label>
          <textarea className="textarea" value={note} onChange={event => setNote(event.target.value)} />
          <div className="flex gap" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => updateClaim(claim.id, { status: 'Approved', managerNote: note })}>
              <CheckCircle2 size={16} /> Approve
            </button>
            <button className="btn danger" type="button" onClick={() => updateClaim(claim.id, { status: 'Rejected', managerNote: note })}>
              <XCircle size={16} /> Reject
            </button>
          </div>
        </div>
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
      {claims.map(c => {
        const claimType = c.type || (c.expenses ? 'expense' : 'timesheet');
        const isExpense = claimType === 'expense';
        const expenseItems = c.expenses || [];
        const expenseDecisionAmount = (expense) =>
          expense.approvalStatus === 'rejected'
            ? Number(expense.approvedAmount || 0)
            : Number(expense.amount || 0);
        const approvedExpenseAmount = expenseItems.reduce((sum, expense) => sum + expenseDecisionAmount(expense), 0);
        const allExpenseItemsApproved = expenseItems.length > 0 && expenseItems.every(expense => expense.approvalStatus !== 'rejected');
        const updateExpenseItems = (mapper) => {
          const nextExpenses = expenseItems.map(mapper);
          const nextApprovedAmount = nextExpenses.reduce((sum, expense) => {
            return sum + (expense.approvalStatus === 'rejected'
              ? Number(expense.approvedAmount || 0)
              : Number(expense.amount || 0));
          }, 0);
          updateClaim(c.id, { expenses: nextExpenses, approvedAmount: nextApprovedAmount });
        };
        const setAllExpenseItemsApproved = (approved) => {
          updateExpenseItems(expense => ({
            ...expense,
            approvalStatus: approved ? 'approved' : 'rejected',
            approvedAmount: approved ? Number(expense.amount || 0) : (expense.approvedAmount || '')
          }));
        };

        return (
          <div className="card" key={c.id}>
            <div className="card-content">
              <div className="flex justify-between gap" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h3>
                    {c.employeeName} — {isExpense ? (c.periodLabel || monthLabel(getClaimExpenseMonth(c))) : (c.weekLabel || c.week)}
                    {' '}
                    <span className="badge">{isExpense ? 'Expense' : 'Timesheet'}</span>
                    {' '}
                    <span className={`badge ${c.status}`}>{c.status}</span>
                  </h3>
                  <p className="small muted">
                    {c.email} • {c.department} {c.submittedAt ? `• Submitted ${c.submittedAt}` : ''}
                  </p>
                </div>

                <div>
                  <p className="small muted">{isExpense ? 'Expense Total' : 'Working Hours'}</p>
                  <h2>{isExpense ? money(c.totals?.totalExpense) : `${c.totals?.totalWorkingHours?.toFixed?.(2) || '0.00'} hrs`}</h2>
                </div>
              </div>

              {isExpense ? (
                <>
                  <div className="grid grid-4">
                    <Mini label="Expense Total" value={money(c.totals?.totalExpense)} />
                    <Mini label="VAT Total" value={money(c.totals?.totalVAT)} />
                    <Mini label="Receipts" value={`${c.expenses?.filter(e => e.receiptName).length || 0}/${c.expenses?.length || 0}`} />
                    <Mini label="Items" value={String(c.expenses?.length || 0)} />
                    <Mini label="Status" value={c.status} />
                    <Mini label="Company Approved Amount" value={money(c.approvedAmount ?? approvedExpenseAmount)} />
                  </div>

                  {manager && (
                    <div className="flex gap items-center" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={allExpenseItemsApproved}
                          onChange={event => setAllExpenseItemsApproved(event.target.checked)}
                        />
                        Select all approved
                      </label>
                    </div>
                  )}

                  <div className="wide">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>PJ Name</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>VAT</th>
                          <th>Proof</th>
                          {manager && <th>Approve</th>}
                          {manager && <th>Approved Amount</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {expenseItems.map(e => {
                          const isItemApproved = e.approvalStatus !== 'rejected';
                          return (
                          <tr key={e.id}>
                            <td>{e.date || '—'}</td>
                            <td>{e.category}</td>
                            <td>{e.projectName || '—'}</td>
                            <td>{e.description || '—'}</td>
                            <td><b>{money(e.amount)}</b></td>
                            <td><b>{money(e.vat)}</b></td>
                            <td>
                              {e.receiptName
                                ? <button className="btn ghost" onClick={() => setReceipt(e)}><Eye size={16} /> View</button>
                                : 'Missing'}
                            </td>
                            {manager && (
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isItemApproved}
                                  onChange={event => updateExpenseItems(expense => expense.id === e.id
                                    ? {
                                        ...expense,
                                        approvalStatus: event.target.checked ? 'approved' : 'rejected',
                                        approvedAmount: event.target.checked ? Number(expense.amount || 0) : (expense.approvedAmount || '')
                                      }
                                    : expense)}
                                />
                              </td>
                            )}
                            {manager && (
                              <td>
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  disabled={isItemApproved}
                                  value={isItemApproved ? Number(e.amount || 0) : (e.approvedAmount || '')}
                                  onChange={event => updateExpenseItems(expense => expense.id === e.id
                                    ? { ...expense, approvalStatus: 'rejected', approvedAmount: event.target.value }
                                    : expense)}
                                />
                              </td>
                            )}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-4">
                    <Mini label="Working Hours" value={`${c.totals?.totalWorkingHours?.toFixed?.(2) || '0.00'} hrs`} />
                    <Mini label="Project / Workshop" value={`${c.totals?.projectHours?.toFixed?.(2) || '0.00'} hrs`} />
                    <Mini label="Travel Hours" value={`${c.totals?.travelHours?.toFixed?.(2) || '0.00'} hrs`} />
                    <Mini label="TIL Balance" value={`${c.totals?.tilBalance?.toFixed?.(2) || '0.00'} hrs`} />
                  </div>

                  <div className="wide">
                    <table>
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Project / Job</th>
                          <th>Project / Workshop</th>
                          <th>Travel</th>
                          <th>Take back TIL</th>
                          <th>Holiday</th>
                          <th>Sickness</th>
                        </tr>
                      </thead>

                      <tbody>
                        {weekDays.map(day => {
                          const row = c.timesheet?.[day] || {};
                          return (
                            <tr key={day}>
                              <td><b>{day}</b></td>
                              <td>{row.projectName || '—'}</td>
                              <td>{Number(row.projectHours || 0).toFixed(2)}</td>
                              <td>{Number(row.travelHours || 0).toFixed(2)}</td>
                              <td>{Number(row.takeBackTimeInLieu || 0).toFixed(2)}</td>
                              <td>{row.holidayType === 'full' ? 'Full day' : row.holidayType === 'half' ? 'Half day' : '—'}</td>
                              <td>{row.sicknessType === 'half' ? 'Half sick' : row.sicknessType === 'full' || row.sickness ? 'Full sick' : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!manager && startEditClaim && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn secondary" onClick={() => startEditClaim(c)}>Edit submitted data</button>
                </div>
              )}

              {manager && (
                <div className="space-y-sm" style={{ background: '#f8fafc', padding: 16, borderRadius: 20, marginTop: 16 }}>
                  <label className="label">Manager Note</label>
                  <textarea className="textarea" value={c.managerNote || ''} onChange={e => updateClaim(c.id, { managerNote: e.target.value })} />

                  <button
                    className="btn"
                    onClick={() => updateClaim(c.id, {
                      status: 'Approved',
                      approvedAmount: isExpense ? approvedExpenseAmount : c.approvedAmount
                    })}
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  {' '}
                  <button
                    className="btn danger"
                    onClick={() => updateClaim(c.id, {
                      status: 'Rejected',
                      approvedAmount: isExpense ? approvedExpenseAmount : c.approvedAmount
                    })}
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  {isExpense && (
                    <>
                      {' '}
                      <button
                        className="btn secondary"
                        onClick={() => updateClaim(c.id, {
                          status: 'Paid',
                          approvedAmount: approvedExpenseAmount
                        })}
                      >
                        Mark as Paid
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
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
