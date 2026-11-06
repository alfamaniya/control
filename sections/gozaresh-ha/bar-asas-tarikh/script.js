(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const rows = $("generalReportRows");
  const empty = $("reportEmpty");
  const message = $("reportMessage");
  const summary = $("reportSummary");
  const pagination = $("reportPagination");
  const previous = $("previousPage");
  const next = $("nextPage");
  const pageSelect = $("pageSelect");
  const pageCountLabel = $("pageCountLabel");
  const filterProduct = $("filterProduct");
  const filterDocument = $("filterDocument");
  const filterGroup = $("filterGroup");
  const filterDateFrom = $("filterDateFrom");
  const filterDateTo = $("filterDateTo");
  const resetFilters = $("resetFilters");
  const PAGE_SIZE = 50;
  let transactions = [];
  let currentPage = 1;
  let filteredTransactions = [];

  const fa = value => String(value ?? "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const shown = value => value === null || value === undefined || value === "" ? "—" : String(value);
  const number = value => value === null || value === undefined || value === "" ? "—" : fa(value);
  function dateParts(value) {
    if (!value) return { date: "—", time: "—" };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: shown(value), time: "—" };
    return {
      date: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year:"numeric", month:"2-digit", day:"2-digit" }).format(date),
      time: new Intl.DateTimeFormat("fa-IR", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(date)
    };
  }
  function addCell(row, value, className) {
    const cell = document.createElement("td");
    cell.textContent = shown(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  function normalizeText(value) {
    return String(value ?? "").toLocaleLowerCase("fa")
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim();
  }
  function dateBoundary(value, endOfDay) {
    if (!value || !window.JalaliCalendar) return null;
    const parts = window.JalaliCalendar.parse(value);
    if (!parts) return NaN;
    const date = window.JalaliCalendar.toGregorian(parts.jy, parts.jm, parts.jd);
    return endOfDay ? date.setHours(23, 59, 59, 999) : date.setHours(0, 0, 0, 0);
  }
  function applyFilters() {
    const productTerm = normalizeText(filterProduct.value);
    const documentTerm = normalizeText(filterDocument.value);
    const groupTerm = filterGroup.value;
    const from = dateBoundary(filterDateFrom.value, false);
    const to = dateBoundary(filterDateTo.value, true);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      showMessage("تاریخ انتخاب‌شده معتبر نیست؛ لطفاً تاریخ را از تقویم انتخاب کنید.", true);
      return;
    }
    if (from !== null && to !== null && from > to) {
      showMessage("تاریخ شروع بازه نباید بعد از تاریخ پایان باشد.", true);
      return;
    }
    filteredTransactions = transactions.filter(item => {
      const productMatch = !productTerm ||
        normalizeText(item.procurementCode).includes(productTerm) ||
        normalizeText(item.description).includes(productTerm);
      const documentMatch = !documentTerm ||
        normalizeText(item.entryNumber).includes(documentTerm) ||
        normalizeText(item.exitNumber).includes(documentTerm);
      const groupMatch = !groupTerm || String(item.group || "") === groupTerm;
      const timestamp = Date.parse(item.occurredAt);
      const dateMatch = (from === null || timestamp >= from) && (to === null || timestamp <= to);
      return productMatch && documentMatch && groupMatch && dateMatch;
    });
    currentPage = 1;
    showMessage("");
    renderPage();
  }
  function populateGroups() {
    const groups = [...new Set(transactions.map(item => String(item.group || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fa"));
    filterGroup.innerHTML = '<option value="">همه گروه‌ها</option>';
    groups.forEach(group => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group;
      filterGroup.appendChild(option);
    });
  }
  function renderPage() {
    const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), pageCount);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredTransactions.slice(start, start + PAGE_SIZE);
    rows.innerHTML = "";
    pageRows.forEach((item, index) => {
      const tr = document.createElement("tr");
      const dt = dateParts(item.occurredAt);
      const quantityIn = Number(item.quantityIn) || 0;
      const quantityOut = Number(item.quantityOut) || 0;
      const quantity = Number(item.quantity) || quantityIn || quantityOut;
      const previousStock = item.previousStock !== undefined && item.previousStock !== "" ? item.previousStock :
        (item.stockAfter !== undefined && item.stockAfter !== "" ? Number(item.stockAfter) - quantityIn + quantityOut : "");
      [
        [fa(start + index + 1), ""], [item.id, "report-code"], [dt.date, ""], [dt.time, "report-time"],
        [item.internalCode, "report-code"], [item.procurementCode, "report-code"], [item.description, "report-description"], [item.group, ""],
        [item.operation, "report-operation"], [item.entryNumber, "report-code"], [item.exitNumber, "report-code"],
        [quantityIn ? number(quantityIn) : "—", "report-in"], [quantityOut ? number(quantityOut) : "—", "report-out"],
        [quantity ? number(quantity) : "—", ""], [previousStock === "" ? "—" : number(previousStock), ""],
        [item.stockAfter === "" ? "—" : number(item.stockAfter), ""], [item.destination, ""], [item.destinationSub, ""],
        [item.voucherNumber, "report-code"], [item.dispatchId, "report-code"], [item.dispatchedAt ? dateParts(item.dispatchedAt).date + " " + dateParts(item.dispatchedAt).time : "—", "report-time"],
        [item.source, "report-source"]
      ].forEach(([value, className]) => addCell(tr, value, className));
      rows.appendChild(tr);
    });
    empty.hidden = filteredTransactions.length > 0;
    empty.textContent = transactions.length ? "تراکنشی با فیلترهای انتخاب‌شده پیدا نشد." : "هیچ تراکنشی در سامانه ثبت نشده است.";
    pagination.hidden = filteredTransactions.length === 0;
    previous.disabled = currentPage <= 1;
    next.disabled = currentPage >= pageCount;
    pageCountLabel.textContent = "از " + fa(pageCount) + " صفحه";
    pageSelect.innerHTML = "";
    for (let page = 1; page <= pageCount; page += 1) {
      const option = document.createElement("option");
      option.value = String(page);
      option.textContent = fa(page);
      option.selected = page === currentPage;
      pageSelect.appendChild(option);
    }
    summary.textContent = fa(filteredTransactions.length) + " نتیجه از " + fa(transactions.length) + " تراکنش · نمایش " +
      (filteredTransactions.length ? fa(start + 1) + " تا " + fa(start + pageRows.length) : "۰") + " از " + fa(filteredTransactions.length);
  }
  function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = "general-report-message" + (isError ? " error" : "");
    message.hidden = !text;
  }
  previous.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; renderPage(); } });
  next.addEventListener("click", () => {
    if (currentPage < Math.ceil(filteredTransactions.length / PAGE_SIZE)) { currentPage += 1; renderPage(); }
  });
  pageSelect.addEventListener("change", () => {
    currentPage = Number(pageSelect.value) || 1;
    renderPage();
  });
  [filterProduct, filterDocument].forEach(input => input.addEventListener("input", applyFilters));
  filterGroup.addEventListener("change", applyFilters);
  [filterDateFrom, filterDateTo].forEach(input => input.addEventListener("change", applyFilters));
  resetFilters.addEventListener("click", () => {
    filterProduct.value = "";
    filterDocument.value = "";
    filterGroup.value = "";
    filterDateFrom.value = "";
    filterDateTo.value = "";
    applyFilters();
  });
  async function initialize() {
    try {
      if (!window.ControlDB || typeof window.ControlDB.getAllTransactions !== "function") {
        throw new Error("بخش دریافت اطلاعات گزارش بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      }
      transactions = await window.ControlDB.getAllTransactions();
      filteredTransactions = transactions.slice();
      populateGroups();
      if (window.JalaliCalendar) window.JalaliCalendar.init();
      renderPage();
      showMessage("");
    } catch (error) {
      summary.textContent = "دریافت اطلاعات ناموفق بود";
      showMessage(error.message || "خواندن تراکنش‌ها با خطا مواجه شد.", true);
    }
  }
  initialize();
})();