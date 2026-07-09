"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "financeTrackerData";
const THEME_KEY   = "financeTrackerTheme";
const BUDGET_KEY  = "financeTrackerBudgets";

const CATEGORIES = [
  "Salary","Business","Investments","Housing",
  "Food","Transport","Health","Entertainment","Education","Other"
];

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  transactions: [],
  budgets: {},        // { "YYYY-MM": BudgetConfig }
  budgetUI: {
    activePeriod: "",
    activeTab: "transactions",
    analyzerYear: "",   // year filter for budget vs actual chart
    surplusYear: "",    // year filter for surplus table
    monthlyBudgetsYear: "", // year filter for monthly budgets list
  },
  filters: { category: "all", type: "all", search: "", year: "all", month: "all" },
  editingId: null,
  pendingDeleteId: null,
  theme: "dark",
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const dom = {
  form:                  document.getElementById("transactionForm"),
  titleInput:            document.getElementById("titleInput"),
  amountInput:           document.getElementById("amountInput"),
  categoryInput:         document.getElementById("categoryInput"),
  dateInput:             document.getElementById("dateInput"),
  titleError:            document.getElementById("titleError"),
  amountError:           document.getElementById("amountError"),
  categoryError:         document.getElementById("categoryError"),
  dateError:             document.getElementById("dateError"),
  submitBtn:             document.getElementById("submitBtn"),
  cancelEditBtn:         document.getElementById("cancelEditBtn"),
  filterCategory:        document.getElementById("filterCategory"),
  filterType:            document.getElementById("filterType"),
  filterYear:            document.getElementById("filterYear"),
  filterMonth:           document.getElementById("filterMonth"),
  searchInput:           document.getElementById("searchInput"),
  resetFiltersBtn:       document.getElementById("resetFiltersBtn"),
  exportCsvBtn:          document.getElementById("exportCsvBtn"),
  exportMenu:            document.getElementById("exportMenu"),
  exportTransactionsBtn: document.getElementById("exportTransactionsBtn"),
  exportSurplusBtn:      document.getElementById("exportSurplusBtn"),
  exportMonthlyBudgetBtn:document.getElementById("exportMonthlyBudgetBtn"),
  themeToggleBtn:        document.getElementById("themeToggleBtn"),
  transactionsList:      document.getElementById("transactionsList"),
  resultsCount:          document.getElementById("resultsCount"),
  totalBalance:          document.getElementById("totalBalance"),
  totalIncome:           document.getElementById("totalIncome"),
  totalExpenses:         document.getElementById("totalExpenses"),
  financeChart:          document.getElementById("financeChart"),
  confirmModal:          document.getElementById("confirmModal"),
  confirmDeleteBtn:      document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn:       document.getElementById("cancelDeleteBtn"),
  toastContainer:        document.getElementById("toastContainer"),
  skeleton:              document.getElementById("skeleton"),
  transactionsTabBtn:    document.getElementById("transactionsTabBtn"),
  budgetTabBtn:          document.getElementById("budgetTabBtn"),
  appRoot:               document.querySelector(".app"),
  budgetPanel:           document.getElementById("budgetPanel"),
  budgetPeriodSelect:    document.getElementById("budgetPeriodSelect"),
  budgetYearSelect:      document.getElementById("budgetYearSelect"),
  budgetMonthSelect:     document.getElementById("budgetMonthSelect"),
  analyzerYearSelect:    document.getElementById("analyzerYearSelect"),
  analyzerCanvas:        document.getElementById("analyzerCanvas"),
  budgetForm:            document.getElementById("budgetForm"),
  budgetOverallLimit:    document.getElementById("budgetOverallLimit"),
  budgetCatGrid:         document.getElementById("budgetCatGrid"),
  surplusYearSelect:     document.getElementById("surplusYearSelect"),
  budgetSurplusContent:  document.getElementById("budgetSurplusContent"),
  monthlyBudgetsList:    document.getElementById("monthlyBudgetsList"),
  monthlyBudgetsYearSelect: document.getElementById("monthlyBudgetsYearSelect"),
  addAllocationBtn:      document.getElementById("addAllocationBtn"),
  deleteBudgetBtn:       document.getElementById("deleteBudgetBtn"),
  allocModal:            document.getElementById("allocModal"),
  allocLabelInput:       document.getElementById("allocLabelInput"),
  allocAmountInput:      document.getElementById("allocAmountInput"),
  allocModalSaveBtn:     document.getElementById("allocModalSaveBtn"),
  allocModalCancelBtn:   document.getElementById("allocModalCancelBtn"),
  logoutBtn:             document.getElementById("logoutBtn"),
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const generateID = () => `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const formatDate = (s) =>
  new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const getPeriod = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const prevPeriod = (period) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const periodLabel = (period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const getCSSVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ─── Persistence ──────────────────────────────────────────────────────────────
const saveToLocalStorage   = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
const loadFromLocalStorage = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    state.transactions = s ? JSON.parse(s) : [];
  } catch (e) {
    console.error("Failed to parse transactions from localStorage:", e);
    state.transactions = [];
  }
};
const saveBudgets  = () => localStorage.setItem(BUDGET_KEY, JSON.stringify(state.budgets));
const loadBudgets  = () => {
  try { const s = localStorage.getItem(BUDGET_KEY); state.budgets = s ? JSON.parse(s) : {}; }
  catch { state.budgets = {}; }
};
const getBudgetConfig = (p) => state.budgets[p] || null;
const setBudgetConfig = (p, cfg) => { state.budgets[p] = { ...cfg, period: p }; saveBudgets(); };

const saveTheme = () => localStorage.setItem(THEME_KEY, state.theme);
const loadTheme = () => { const s = localStorage.getItem(THEME_KEY); setTheme(s || "dark"); };

// ─── Theme ────────────────────────────────────────────────────────────────────
const setTheme = (theme) => {
  state.theme = theme;
  document.body.classList.toggle("theme-light", theme === "light");
  dom.themeToggleBtn.textContent = theme === "light" ? "Dark Mode" : "Light Mode";
  saveTheme();
  if (state.budgetUI.activeTab === "budget") renderBudget();
  else renderChart();
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const showToast = (msg, variant = "success") => {
  const t = document.createElement("div");
  t.className = `toast${variant === "error" ? " toast--error" : ""}`;
  t.textContent = msg;
  dom.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2400);
};

// ─── Form validation ──────────────────────────────────────────────────────────
const clearErrors = () => {
  [[dom.titleInput, dom.titleError],[dom.amountInput, dom.amountError],
   [dom.categoryInput, dom.categoryError],[dom.dateInput, dom.dateError]]
  .forEach(([i, e]) => { i.classList.remove("is-invalid"); e.textContent = ""; });
};
const setError = (input, el, msg) => { input.classList.add("is-invalid"); el.textContent = msg; };

const validateForm = () => {
  clearErrors();
  const title = dom.titleInput.value.trim();
  const av    = dom.amountInput.value.trim();
  const amt   = Number(av);
  const cat   = dom.categoryInput.value;
  const date  = dom.dateInput.value;
  let ok = true;
  if (!title)                                    { setError(dom.titleInput,    dom.titleError,    "Title is required.");  ok = false; }
  if (!av || Number.isNaN(amt) || amt === 0)     { setError(dom.amountInput,   dom.amountError,   "Enter a valid amount."); ok = false; }
  if (!cat)                                      { setError(dom.categoryInput, dom.categoryError, "Select a category."); ok = false; }
  if (!date)                                     { setError(dom.dateInput,     dom.dateError,     "Pick a date.");        ok = false; }
  return ok;
};

const resetFormState = () => {
  dom.form.reset(); state.editingId = null;
  dom.submitBtn.textContent = "Add Transaction";
  dom.submitBtn.removeAttribute("data-editing");
  dom.cancelEditBtn.hidden = true; clearErrors();
};

// ─── Transaction CRUD ─────────────────────────────────────────────────────────
const addTransaction = () => {
  // New transactions: farmer only. Editing existing: admin only.
  if (!state.editingId && !can.addTransaction()) {
    showToast("Only farmers can add new transactions.", "error"); return;
  }
  if (state.editingId && !can.editTransaction()) {
    showToast("Only admins can edit transactions.", "error"); return;
  }
  if (!validateForm()) { showToast("Please fix the highlighted fields.", "error"); return; }
  const title = dom.titleInput.value.trim(), amount = Number(dom.amountInput.value),
        category = dom.categoryInput.value, date = dom.dateInput.value;
  if (state.editingId) {
    state.transactions = state.transactions.map((tx) =>
      tx.id === state.editingId ? { ...tx, title, amount, category, date } : tx);
    showToast("Transaction updated.");
  } else {
    state.transactions = [{ id: generateID(), title, amount, category, date }, ...state.transactions];
    showToast("Transaction added.");
  }
  resetFormState(); saveToLocalStorage(); renderApp();
};

const startEditing = (id) => {
  if (!can.editTransaction()) { showToast("Only admins can edit transactions.", "error"); return; }
  const tx = state.transactions.find((t) => t.id === id); if (!tx) return;
  dom.titleInput.value = tx.title; dom.amountInput.value = tx.amount;
  dom.categoryInput.value = tx.category; dom.dateInput.value = tx.date;
  state.editingId = id; dom.submitBtn.textContent = "Save Changes";
  dom.submitBtn.dataset.editing = "true";
  dom.cancelEditBtn.hidden = false; dom.titleInput.focus(); showToast("Editing mode enabled.");
};

const deleteTransaction = (id) => {
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  saveToLocalStorage(); renderApp(); showToast("Transaction deleted.");
};

const openConfirmModal  = (id) => {
  if (!can.deleteTransaction()) { showToast("Only admins can delete transactions.", "error"); return; }
  state.pendingDeleteId = id; dom.confirmModal.classList.add("is-open"); dom.confirmModal.setAttribute("aria-hidden","false");
};
const closeConfirmModal = ()   => { state.pendingDeleteId = null; dom.confirmModal.classList.remove("is-open"); dom.confirmModal.setAttribute("aria-hidden","true"); };

// ─── Computation helpers ──────────────────────────────────────────────────────
const computePeriodTotals = (transactions) => {
  const map = new Map();
  transactions.forEach((tx) => {
    const p = getPeriod(tx.date);
    if (!map.has(p)) map.set(p, { income: 0, expenses: 0, net: 0 });
    const e = map.get(p);
    if (tx.amount > 0) e.income += tx.amount; else e.expenses += Math.abs(tx.amount);
    e.net = e.income - e.expenses;
  });
  return map;
};

const computeSurplus = (limit, expenses, income = 0) => Math.max(0, limit - expenses + income);

const getAllPeriods = () => {
  const set = new Set(state.transactions.map((tx) => getPeriod(tx.date)));
  Object.keys(state.budgets).forEach((p) => set.add(p));
  // Always include all 12 months of the current year so the selector is never empty
  const currentYear = String(new Date().getFullYear());
  getMonthsForYear(currentYear).forEach((p) => set.add(p));
  return [...set].sort((a, b) => (a > b ? -1 : 1));
};

// All unique years across periods
const getAllYears = () => {
  const years = new Set(getAllPeriods().map((p) => p.split("-")[0]));
  return [...years].sort((a, b) => b - a); // newest first
};

// All 12 months for a given year (as YYYY-MM strings)
const getMonthsForYear = (year) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

// Month label short (Jan, Feb …)
const monthShort = (period) => {
  const [, m] = period.split("-").map(Number);
  return new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
};

// ─── Transactions tab rendering ───────────────────────────────────────────────
const renderSummary = () => {
  const amounts = state.transactions.map((tx) => tx.amount);
  const inc = amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0);
  const exp = amounts.filter((a) => a < 0).reduce((s, a) => s + a, 0);
  dom.totalIncome.textContent   = formatCurrency(inc);
  dom.totalExpenses.textContent = formatCurrency(Math.abs(exp));
  dom.totalBalance.textContent  = formatCurrency(inc + exp);
};

const renderTransactions = () => {
  populateYearFilter();
  const filtered = filterTransactions();
  dom.resultsCount.textContent = `${filtered.length} results`;
  if (filtered.length === 0) {
    dom.transactionsList.innerHTML = `
      <div class="transactions__empty">
        <div class="empty__icon">+</div>
        <p>No transactions yet. Add your first one to get started.</p>
        <button class="btn btn--accent empty-add-btn" type="button">Add First Transaction</button>
      </div>`; return;
  }
  const groups = groupByMonth(filtered);
  dom.transactionsList.innerHTML = groups.map((g) => `
    <div class="month-group">
      <p class="month-title">${g.label}</p>
      ${g.items.map(renderTransactionItem).join("")}
    </div>`).join("");
};

const renderTransactionItem = (tx) => `
  <div class="transaction">
    <div>
      <p class="transaction__title">${tx.title}</p>
      <div class="transaction__meta">
        <span class="badge">${tx.category}</span>
        <span>${formatDate(tx.date)}</span>
      </div>
    </div>
    <div>
      <p class="amount ${tx.amount >= 0 ? "amount--income" : "amount--expense"}">${formatCurrency(tx.amount)}</p>
      ${can.editTransaction()   ? `<button class="edit-btn"   data-id="${tx.id}">Edit</button>`   : ""}
      ${can.deleteTransaction() ? `<button class="delete-btn" data-id="${tx.id}">Delete</button>` : ""}
    </div>
  </div>`;

const filterTransactions = () => {
  const { category, type, search, year, month } = state.filters;
  return state.transactions.filter((tx) => {
    const mc = category === "all" || tx.category === category;
    const mt = type === "all" || (type === "income" && tx.amount > 0) || (type === "expense" && tx.amount < 0);
    const ms = tx.title.toLowerCase().includes(search.toLowerCase());
    const p  = getPeriod(tx.date);
    const my = year  === "all" || p.split("-")[0] === year;
    const mm = month === "all" || p.split("-")[1] === month;
    return mc && mt && ms && my && mm;
  });
};

// Populate year filter from transaction data
const populateYearFilter = () => {
  const years = [...new Set(state.transactions.map((tx) => getPeriod(tx.date).split("-")[0]))]
    .sort((a, b) => b - a);
  const current = dom.filterYear.value;
  dom.filterYear.innerHTML = `<option value="all">All years</option>` +
    years.map((y) => `<option value="${y}" ${y === current ? "selected" : ""}>${y}</option>`).join("");
};

const groupByMonth = (transactions) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const groups = [], lookup = new Map();
  sorted.forEach((tx) => {
    const label = new Date(tx.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!lookup.has(label)) { lookup.set(label, { label, items: [] }); groups.push(lookup.get(label)); }
    lookup.get(label).items.push(tx);
  });
  return groups;
};

// ─── Overview chart (Budget label instead of Income) ─────────────────────────
const renderChart = () => {
  const canvas = dom.financeChart; if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const dw = canvas.clientWidth, dh = 260;
  canvas.width = dw * dpr; canvas.height = dh * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dw, dh);

  const amounts  = state.transactions.map((tx) => tx.amount);
  const income   = amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0);
  const expenses = Math.abs(amounts.filter((a) => a < 0).reduce((s, a) => s + a, 0));
  const maxVal   = Math.max(income, expenses, 1);
  const bw = 120, gap = 80, baseY = dh - 40;
  const ih = (income   / maxVal) * (dh - 80);
  const eh = (expenses / maxVal) * (dh - 80);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.moveTo(40, baseY); ctx.lineTo(dw - 40, baseY); ctx.stroke();

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(160, baseY - ih, bw, ih);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(160 + bw + gap, baseY - eh, bw, eh);

  ctx.fillStyle = state.theme === "light" ? "#1c1917" : "#f8f4e9";
  ctx.font = "14px sans-serif";
  ctx.fillText("Income",  170, baseY + 20);
  ctx.fillText("Expense", 160 + bw + gap, baseY + 20);
  ctx.fillText(formatCurrency(income),   150, baseY - ih - 10);
  ctx.fillText(formatCurrency(expenses), 150 + bw + gap, baseY - eh - 10);
};

// ─── Monthly Budgets section (with year filter) ───────────────────────────────
const renderMonthlyBudgets = () => {
  const years = getAllYears();
  if (!state.budgetUI.monthlyBudgetsYear || !years.includes(state.budgetUI.monthlyBudgetsYear)) {
    state.budgetUI.monthlyBudgetsYear = years[0] || String(new Date().getFullYear());
  }
  dom.monthlyBudgetsYearSelect.innerHTML = years.map((y) =>
    `<option value="${y}" ${y === state.budgetUI.monthlyBudgetsYear ? "selected" : ""}>${y}</option>`
  ).join("");

  const year   = state.budgetUI.monthlyBudgetsYear;
  const months = getMonthsForYear(year);
  const totals = computePeriodTotals(state.transactions);

  const rows = months.map((p) => {
    const cfg     = getBudgetConfig(p) || {};
    const cur     = totals.get(p) || { income: 0, expenses: 0 };
    const limit   = cfg.overallLimit || 0;
    const surplus = computeSurplus(limit, cur.expenses, cur.income);
    const pct     = limit > 0 ? Math.min((cur.expenses / limit) * 100, 100) : 0;
    const over    = limit > 0 && cur.expenses >= limit;
    return { p, limit, actual: cur.expenses, surplus, pct, over };
  });

  // Only show months that have data or a budget set
  const visible = rows.filter((r) => r.limit > 0 || r.actual > 0);

  if (visible.length === 0) {
    dom.monthlyBudgetsList.innerHTML = `<p class="color--muted" style="font-size:14px;padding:8px 0">No budgets or transactions for ${year}.</p>`;
    return;
  }

  dom.monthlyBudgetsList.innerHTML = visible.map((r) => `
    <div class="monthly-budget-row">
      <div class="monthly-budget-row__info">
        <span class="monthly-budget-row__period">${monthShort(r.p)} ${year}</span>
        <span class="monthly-budget-row__amounts">
          Spent: <strong>${formatCurrency(r.actual)}</strong>
          &nbsp;/&nbsp; Budget: <strong>${r.limit > 0 ? formatCurrency(r.limit) : "—"}</strong>
          &nbsp;·&nbsp; Surplus: <strong class="${r.surplus > 0 ? "color--income" : "color--muted"}">${formatCurrency(r.surplus)}</strong>
        </span>
      </div>
      ${r.limit > 0 ? `
      <div class="budget-progress-track" style="margin-top:6px">
        <div class="budget-progress-fill ${r.over ? "budget-progress-fill--over" : ""}" style="width:${r.pct}%"></div>
      </div>` : ""}
    </div>`).join("");
};

// ─── Budget config: allocation CRUD ──────────────────────────────────────────
// Each allocation = { id, label, amount }

// Render the allocation list (read mode) + overall limit field
const renderBudgetConfigForm = () => {
  const period = state.budgetUI.activePeriod;
  const cfg    = getBudgetConfig(period) || {};
  dom.budgetOverallLimit.value = cfg.overallLimit || "";

  const allocs = cfg.allocations || [];

  if (allocs.length === 0) {
    dom.budgetCatGrid.innerHTML = `<p class="color--muted alloc-empty-msg" style="font-size:14px;padding:8px 0">No allocations yet. Click "+ Add Allocation" to create one.</p>`;
    return;
  }

  // Compute total allocated
  const total = allocs.reduce((s, a) => s + (a.amount || 0), 0);
  const limit = cfg.overallLimit || 0;
  const remaining = limit - total;

  dom.budgetCatGrid.innerHTML = `
    <div class="alloc-list">
      ${allocs.map((a) => `
        <div class="alloc-item" data-alloc-id="${a.id}">
          <div class="alloc-item__info">
            <span class="alloc-item__label">${a.label || "Unnamed"}</span>
            <span class="alloc-item__amount">${formatCurrency(a.amount || 0)}</span>
          </div>
          <div class="alloc-item__actions">
            <button class="alloc-edit-btn btn btn--ghost" type="button" data-alloc-id="${a.id}" style="padding:5px 12px;font-size:12px">Edit</button>
            <button class="alloc-delete-btn btn btn--ghost" type="button" data-alloc-id="${a.id}" style="padding:5px 12px;font-size:12px;color:var(--expense);border-color:var(--expense)">Delete</button>
          </div>
        </div>`).join("")}
    </div>
    <div class="alloc-summary">
      <span>Total Allocated: <strong>${formatCurrency(total)}</strong></span>
      ${limit > 0 ? `<span class="${remaining >= 0 ? "color--income" : "color--expense"}">Remaining: <strong>${formatCurrency(remaining)}</strong></span>` : ""}
    </div>`;
};

// Open the allocation modal for add or edit
const openAllocModal = (allocId = null) => {
  const period = state.budgetUI.activePeriod;
  const cfg    = getBudgetConfig(period) || {};
  const allocs = cfg.allocations || [];
  const existing = allocId ? allocs.find((a) => a.id === allocId) : null;

  dom.allocModal.querySelector("#allocModalTitle").textContent = existing ? "Edit Allocation" : "Add Allocation";
  dom.allocLabelInput.value  = existing ? existing.label  : "";
  dom.allocAmountInput.value = existing ? existing.amount : "";
  dom.allocModalSaveBtn.dataset.allocId = allocId || "";
  dom.allocModal.classList.add("is-open");
  dom.allocModal.setAttribute("aria-hidden", "false");
  dom.allocLabelInput.focus();
};

const closeAllocModal = () => {
  dom.allocModal.classList.remove("is-open");
  dom.allocModal.setAttribute("aria-hidden", "true");
};

const saveAllocModal = () => {
  const label  = dom.allocLabelInput.value.trim();
  const amount = parseFloat(dom.allocAmountInput.value) || 0;
  if (!label) { dom.allocLabelInput.focus(); showToast("Label is required.", "error"); return; }

  const period  = state.budgetUI.activePeriod;
  const cfg     = getBudgetConfig(period) || {};
  const allocs  = [...(cfg.allocations || [])];
  const editId  = dom.allocModalSaveBtn.dataset.allocId;

  if (editId) {
    const idx = allocs.findIndex((a) => a.id === editId);
    if (idx !== -1) allocs[idx] = { ...allocs[idx], label, amount };
  } else {
    allocs.push({ id: generateID(), label, amount });
  }

  setBudgetConfig(period, { ...cfg, allocations: allocs });
  closeAllocModal();
  renderBudgetConfigForm();
  showToast(editId ? "Allocation updated." : "Allocation added.");
};

const deleteAllocation = (allocId) => {
  const period = state.budgetUI.activePeriod;
  const cfg    = getBudgetConfig(period) || {};
  const allocs = (cfg.allocations || []).filter((a) => a.id !== allocId);
  setBudgetConfig(period, { ...cfg, allocations: allocs });
  renderBudgetConfigForm();
  showToast("Allocation removed.");
};

// Save just the overall limit (allocations are saved immediately on add/edit/delete)
const saveBudgetConfig = () => {
  if (!can.setBudget()) { showToast("You don't have permission to save budgets.", "error"); return; }
  const period = state.budgetUI.activePeriod;
  const cfg    = getBudgetConfig(period) || {};
  setBudgetConfig(period, {
    ...cfg,
    overallLimit: parseFloat(dom.budgetOverallLimit.value) || 0,
  });
  showToast("Budget limit saved.");
  renderBudget();
};

// ─── Canvas chart helper ──────────────────────────────────────────────────────
const drawGroupedBarChart = (canvas, labels, datasets, yLabel) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const dw  = canvas.clientWidth || 600;
  const dh  = 260;
  canvas.width  = dw * dpr;
  canvas.height = dh * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dw, dh);

  const textColor   = state.theme === "light" ? "#1c1917" : "#f5f5f4";
  const mutedColor  = state.theme === "light" ? "#57534e" : "#a8a29e";
  const gridColor   = state.theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  const padL = 60, padR = 20, padT = 30, padB = 50;
  const chartW = dw - padL - padR;
  const chartH = dh - padT - padB;

  const allVals = datasets.flatMap((d) => d.values);
  const maxVal  = Math.max(...allVals, 1);

  const n       = labels.length;
  const groupW  = chartW / Math.max(n, 1);
  const barW    = Math.min((groupW / datasets.length) * 0.7, 40);
  const groupGap= (groupW - barW * datasets.length) / 2;

  // grid lines
  const steps = 4;
  ctx.font = "11px sans-serif";
  ctx.fillStyle = mutedColor;
  ctx.textAlign = "right";
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y   = padT + chartH - (val / maxVal) * chartH;
    ctx.strokeStyle = gridColor;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillText(formatCurrency(val).replace(".00",""), padL - 6, y + 4);
  }

  // bars
  labels.forEach((label, gi) => {
    const groupX = padL + gi * groupW + groupGap;
    datasets.forEach((ds, di) => {
      const val  = ds.values[gi] || 0;
      const barH = (val / maxVal) * chartH;
      const x    = groupX + di * barW;
      const y    = padT + chartH - barH;
      ctx.fillStyle = ds.color;
      ctx.fillRect(x, y, barW - 2, barH);
    });
    // x label
    ctx.fillStyle = mutedColor;
    ctx.textAlign = "center";
    ctx.font = "11px sans-serif";
    ctx.fillText(label, padL + gi * groupW + groupW / 2, dh - padB + 16);
  });

  // legend
  let lx = padL;
  datasets.forEach((ds) => {
    ctx.fillStyle = ds.color;
    ctx.fillRect(lx, dh - 14, 12, 10);
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.font = "11px sans-serif";
    ctx.fillText(ds.label, lx + 16, dh - 5);
    lx += ctx.measureText(ds.label).width + 36;
  });
};

// ─── Budget vs Actual chart (merged — budget vs expense per month) ────────────
const renderAnalyzerChart = () => {
  const years = getAllYears();
  if (!state.budgetUI.analyzerYear || !years.includes(state.budgetUI.analyzerYear)) {
    state.budgetUI.analyzerYear = years[0] || String(new Date().getFullYear());
  }
  dom.analyzerYearSelect.innerHTML = years.map((y) =>
    `<option value="${y}" ${y === state.budgetUI.analyzerYear ? "selected" : ""}>${y}</option>`
  ).join("");

  const totals   = computePeriodTotals(state.transactions);
  const months   = getMonthsForYear(state.budgetUI.analyzerYear);
  const labels   = months.map(monthShort);
  const budgets  = months.map((p) => (getBudgetConfig(p) || {}).overallLimit || 0);
  const expenses = months.map((p) => (totals.get(p) || {}).expenses || 0);

  drawGroupedBarChart(dom.analyzerCanvas, labels,
    [{ label: "Budget", color: "#22c55e", values: budgets },
     { label: "Actual Spend", color: "#f43f5e", values: expenses }]);
};

// ─── Surplus & Reinvestment (year filter, cross-year carry-forward) ───────────
const renderSurplus = () => {
  const years = getAllYears();
  if (!state.budgetUI.surplusYear || !years.includes(state.budgetUI.surplusYear)) {
    state.budgetUI.surplusYear = years[0] || String(new Date().getFullYear());
  }
  // Populate year selector
  dom.surplusYearSelect.innerHTML = years.map((y) =>
    `<option value="${y}" ${y === state.budgetUI.surplusYear ? "selected" : ""}>${y}</option>`
  ).join("");

  const totals = computePeriodTotals(state.transactions);

  // Compute carry-forward from ALL periods before the selected year (oldest→newest)
  const allPeriods = getAllPeriods().slice().reverse(); // oldest first
  const selectedYear = state.budgetUI.surplusYear;
  let carried = 0;

  // First pass: accumulate surplus from all prior years
  allPeriods.forEach((p) => {
    if (p.split("-")[0] >= selectedYear) return;
    const cfg    = getBudgetConfig(p) || {};
    const limit  = cfg.overallLimit || 0;
    const actual = (totals.get(p) || {}).expenses || 0;
    const income = (totals.get(p) || {}).income || 0;
    carried += computeSurplus(limit, actual, income);
  });

  // Second pass: render the selected year's 12 months
  const months = getMonthsForYear(selectedYear);
  const rows = months.map((p) => {
    const cfg     = getBudgetConfig(p) || {};
    const limit   = cfg.overallLimit || 0;
    const actual  = (totals.get(p) || {}).expenses || 0;
    const income  = (totals.get(p) || {}).income || 0;
    const surplus = computeSurplus(limit, actual, income);
    const reinvest= carried;
    const available = limit + reinvest;
    if (limit > 0) setBudgetConfig(p, { ...cfg, surplus, reinvestmentPool: reinvest, _actualSpending: actual });
    carried = surplus; // carry this month's surplus into next
    return { p, limit, actual, surplus, reinvest, available };
  });

  dom.budgetSurplusContent.innerHTML = `
    <div class="surplus-table-wrap">
      <table class="surplus-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Budget</th>
            <th>Spent</th>
            <th>Surplus</th>
            <th>Carried In</th>
            <th>Total Available</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${monthShort(r.p)}</td>
              <td>${r.limit > 0 ? formatCurrency(r.limit) : "—"}</td>
              <td>${formatCurrency(r.actual)}</td>
              <td class="${r.surplus > 0 ? "color--income" : "color--muted"}">${formatCurrency(r.surplus)}</td>
              <td class="${r.reinvest > 0 ? "color--income" : "color--muted"}">${formatCurrency(r.reinvest)}</td>
              <td class="color--income">${r.limit > 0 ? formatCurrency(r.available) : "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
};

// ─── Budget period selector — split Year + Month controls ────────────────────
const renderBudgetPeriodSelect = () => {
  // Years: auto-derived from transactions + any saved budgets + current year
  const allYears = [...new Set(getAllPeriods().map((p) => p.split("-")[0]))]
    .sort((a, b) => b - a);

  const currentYear  = String(new Date().getFullYear());
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  // Default active period to current month if not set or invalid
  if (!state.budgetUI.activePeriod) {
    state.budgetUI.activePeriod = `${currentYear}-${currentMonth}`;
  }

  const [selYear, selMonth] = state.budgetUI.activePeriod.split("-");

  // Populate year dropdown (auto from transactions)
  dom.budgetYearSelect.innerHTML = allYears.map((y) =>
    `<option value="${y}" ${y === selYear ? "selected" : ""}>${y}</option>`
  ).join("");

  // Populate month dropdown (always all 12)
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  dom.budgetMonthSelect.innerHTML = MONTHS.map((name, i) => {
    const val = String(i + 1).padStart(2, "0");
    return `<option value="${val}" ${val === selMonth ? "selected" : ""}>${name}</option>`;
  }).join("");
};

// ─── Delete budget for active period ─────────────────────────────────────────
const deleteBudget = () => {
  if (!can.deleteBudget()) { showToast("Only admins can delete budgets.", "error"); return; }
  const period = state.budgetUI.activePeriod;
  if (!state.budgets[period]) { showToast("No budget set for this period.", "error"); return; }
  delete state.budgets[period];
  saveBudgets();
  showToast("Budget deleted.");
  renderBudget();
};

// ─── Full budget render ───────────────────────────────────────────────────────
const renderBudget = () => {
  renderBudgetPeriodSelect();
  renderMonthlyBudgets();
  renderAnalyzerChart();
  renderBudgetConfigForm();
  renderSurplus();
};

// ─── Tab switching ────────────────────────────────────────────────────────────
const switchTab = (tab) => {
  state.budgetUI.activeTab = tab;
  dom.appRoot.setAttribute("data-tab", tab);
  dom.budgetPanel.hidden = tab !== "budget";
  dom.transactionsTabBtn.classList.toggle("tab-btn--active", tab === "transactions");
  dom.budgetTabBtn.classList.toggle("tab-btn--active",       tab === "budget");
  if (tab === "budget") renderBudget();
};

// ─── CSV export helpers ───────────────────────────────────────────────────────
const downloadCSV = (filename, headers, rows) => {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  // BOM ensures Excel reads UTF-8 correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

const exportToCSV = () => {
  if (!state.transactions.length) { showToast("No data to export.", "error"); return; }
  downloadCSV("transactions.csv",
    ["Title", "Amount", "Category", "Date"],
    state.transactions.map((tx) => [tx.title, tx.amount, tx.category, tx.date])
  );
  showToast("Transactions exported.");
};

const exportSurplusCSV = () => {
  const allPeriods = getAllPeriods().slice().reverse(); // oldest first
  const totals     = computePeriodTotals(state.transactions);
  let carried = 0;
  const rows = allPeriods.map((p) => {
    const cfg     = getBudgetConfig(p) || {};
    const limit   = cfg.overallLimit || 0;
    const actual  = (totals.get(p) || {}).expenses || 0;
    const income  = (totals.get(p) || {}).income || 0;
    const surplus = computeSurplus(limit, actual, income);
    const reinvest= carried;
    const available = limit + reinvest;
    carried = surplus;
    return [periodLabel(p), limit > 0 ? limit : "N/A", actual, surplus, reinvest, limit > 0 ? available : "N/A"];
  });
  downloadCSV("surplus-reinvestment.csv",
    ["Period", "Budget", "Spent", "Surplus", "Carried In", "Total Available"],
    rows
  );
  showToast("Surplus & Reinvestment exported.");
};

const exportMonthlyBudgetCSV = () => {
  const allPeriods = getAllPeriods().slice().reverse();
  const totals     = computePeriodTotals(state.transactions);
  const rows = allPeriods.map((p) => {
    const cfg   = getBudgetConfig(p) || {};
    const limit = cfg.overallLimit || 0;
    const allocs= (cfg.allocations || []).map((a) => `${a.label}: ${formatCurrency(a.amount)}`).join("; ");
    return [periodLabel(p), limit > 0 ? limit : "N/A", allocs || "N/A"];
  }).filter((r) => r[1] !== "—"); // only periods with a budget set
  if (!rows.length) { showToast("No budgets to export.", "error"); return; }
  downloadCSV("monthly-budgets.csv",
    ["Period", "Overall Limit", "Allocations"],
    rows
  );
  showToast("Monthly Budgets exported.");
};

// ─── Auth (session guard) ────────────────────────────────────────────────────
// All auth logic lives in login.js / login.html.
// main.js only reads the session — if none exists, redirect back to login.
const AUTH_SESSION_KEY = "financeTrackerAuth";

const auth = {
  get session() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY)) || null; }
    catch { return null; }
  },
  clear() { sessionStorage.removeItem(AUTH_SESSION_KEY); },
  isLoggedIn() { return this.session !== null; },
  role()       { return (this.session || {}).role || null; },
  username()   { return (this.session || {}).username || ""; },
};

// Redirect immediately if no valid session
if (!auth.isLoggedIn()) {
  window.location.replace("login.html");
}

// Apply role attribute + update badge now that we're authenticated
const applyRole = (role) => {
  document.body.setAttribute("data-role", role);
  const badge = document.getElementById("userBadge");
  if (badge) {
    badge.textContent = `${auth.username()} (${role})`;
    badge.className   = `user-badge user-badge--${role}`;
  }
};

// ─── Permission helpers ────────────────────────────────────────────────────────
const can = {
  addTransaction:    () => auth.role() === "farmer",
  editTransaction:   () => auth.role() === "admin",
  deleteTransaction: () => auth.role() === "admin",
  setBudget:         () => true,   // both roles can set budgets
  deleteBudget:      () => auth.role() === "admin",
  viewSurplus:       () => auth.role() === "admin",
};

// ─── Main render ──────────────────────────────────────────────────────────────
const renderApp = () => {
  renderSummary(); renderTransactions(); renderChart();
  if (state.budgetUI.activeTab === "budget") renderBudget();
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const initializeApp = () => {
  // Apply role-based UI immediately
  applyRole(auth.role());

  // Update form heading based on role
  const formTitle = document.querySelector(".card.form .section-title");
  if (formTitle) {
    formTitle.textContent = auth.role() === "admin" ? "Edit Transaction" : "Add Transaction";
  }

  // ── Clear any test data (runs once, then removes the flag)
  if (!localStorage.getItem("_dataClearedV1")) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BUDGET_KEY);
    localStorage.setItem("_dataClearedV1", "1");
  }

  loadFromLocalStorage(); loadBudgets(); loadTheme();
  dom.appRoot.setAttribute("data-tab", "transactions");
  dom.budgetPanel.hidden = true;
  renderApp();
  setTimeout(() => dom.skeleton.classList.add("is-hidden"), 300);

  dom.form.addEventListener("submit", (e) => { e.preventDefault(); addTransaction(); });
  dom.cancelEditBtn.addEventListener("click", resetFormState);

  dom.transactionsList.addEventListener("click", (e) => {
    const del   = e.target.closest(".delete-btn");
    const edit  = e.target.closest(".edit-btn");
    const empty = e.target.closest(".empty-add-btn");
    if (del?.dataset?.id)  openConfirmModal(del.dataset.id);
    if (edit?.dataset?.id) startEditing(edit.dataset.id);
    if (empty)             dom.titleInput.focus();
  });

  dom.filterCategory.addEventListener("change", (e) => { state.filters.category = e.target.value; renderTransactions(); });
  dom.filterType.addEventListener("change",     (e) => { state.filters.type     = e.target.value; renderTransactions(); });
  dom.searchInput.addEventListener("input",     (e) => { state.filters.search   = e.target.value; renderTransactions(); });
  dom.filterYear.addEventListener("change",     (e) => { state.filters.year     = e.target.value; renderTransactions(); });
  dom.filterMonth.addEventListener("change",    (e) => { state.filters.month    = e.target.value; renderTransactions(); });
  dom.resetFiltersBtn.addEventListener("click", () => {
    state.filters = { category: "all", type: "all", search: "", year: "all", month: "all" };
    dom.filterCategory.value = "all"; dom.filterType.value = "all"; dom.searchInput.value = "";
    dom.filterYear.value = "all"; dom.filterMonth.value = "all";
    renderTransactions();
  });

  // Export dropdown
  dom.exportCsvBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.exportMenu.hidden = !dom.exportMenu.hidden;
  });
  document.addEventListener("click", () => { dom.exportMenu.hidden = true; });
  dom.exportTransactionsBtn.addEventListener("click",  exportToCSV);
  dom.exportSurplusBtn.addEventListener("click",       exportSurplusCSV);
  dom.exportMonthlyBudgetBtn.addEventListener("click", exportMonthlyBudgetCSV);
  dom.themeToggleBtn.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

  dom.confirmDeleteBtn.addEventListener("click", () => {
    if (state.pendingDeleteId) deleteTransaction(state.pendingDeleteId);
    closeConfirmModal();
  });
  dom.cancelDeleteBtn.addEventListener("click", closeConfirmModal);
  dom.confirmModal.addEventListener("click", (e) => { if (e.target.dataset.close) closeConfirmModal(); });

  dom.transactionsTabBtn.addEventListener("click", () => switchTab("transactions"));
  dom.budgetTabBtn.addEventListener("click",       () => switchTab("budget"));

  // Budget period — split year + month selectors
  dom.budgetYearSelect.addEventListener("change", (e) => {
    const [, month] = state.budgetUI.activePeriod.split("-");
    state.budgetUI.activePeriod = `${e.target.value}-${month}`;
    renderBudget();
  });
  dom.budgetMonthSelect.addEventListener("change", (e) => {
    const [year] = state.budgetUI.activePeriod.split("-");
    state.budgetUI.activePeriod = `${year}-${e.target.value}`;
    renderBudgetConfigForm();
  });

  // Delete budget
  dom.deleteBudgetBtn.addEventListener("click", deleteBudget);

  // Year selectors
  dom.analyzerYearSelect.addEventListener("change", (e) => {
    state.budgetUI.analyzerYear = e.target.value;
    renderAnalyzerChart();
  });
  dom.monthlyBudgetsYearSelect.addEventListener("change", (e) => {
    state.budgetUI.monthlyBudgetsYear = e.target.value;
    renderMonthlyBudgets();
  });
  dom.surplusYearSelect.addEventListener("change", (e) => {
    state.budgetUI.surplusYear = e.target.value;
    renderSurplus();
  });

  // Budget form save
  dom.budgetForm.addEventListener("submit", (e) => { e.preventDefault(); saveBudgetConfig(); });

  // Add allocation button
  dom.addAllocationBtn.addEventListener("click", () => openAllocModal());

  // Edit / Delete allocation (delegated from list)
  dom.budgetCatGrid.addEventListener("click", (e) => {
    const editBtn   = e.target.closest(".alloc-edit-btn");
    const deleteBtn = e.target.closest(".alloc-delete-btn");
    if (editBtn)   openAllocModal(editBtn.dataset.allocId);
    if (deleteBtn) deleteAllocation(deleteBtn.dataset.allocId);
  });

  // Allocation modal
  dom.allocModalSaveBtn.addEventListener("click", saveAllocModal);
  dom.allocModalCancelBtn.addEventListener("click", closeAllocModal);
  dom.allocModal.addEventListener("click", (e) => { if (e.target.dataset.close) closeAllocModal(); });
  dom.allocLabelInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveAllocModal(); } });
  dom.allocAmountInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveAllocModal(); } });

  // Logout — clear session and go back to login page
  if (dom.logoutBtn) {
    dom.logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      auth.clear();
      window.location.href = "login.html";
    });
  }
};

initializeApp();

