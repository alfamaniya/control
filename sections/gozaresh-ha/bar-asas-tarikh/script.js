(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const startInput = $("reportStartDate");
  const endInput = $("reportEndDate");
  const showButton = $("showDateReport");
  const exportButton = $("exportDateReport");
  const resultsSection = $("dateReportResults");
  const rows = $("dateReportRows");
  const message = $("reportMessage");
  const fa = value => String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  let reportTransactions = [];

  function showMessage(text, error = false) {
    message.textContent = text;
    message.className = "report-message" + (error ? " error" : "");
    message.hidden = !text;
  }
  function selectedDate(input, endOfDay = false) {
    const parsed = window.JalaliCalendar && window.JalaliCalendar.parse(input.value);
    if (!parsed) return null;
    const date = window.JalaliCalendar.toGregorian(parsed.jy, parsed.jm, parsed.jd);
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return date;
  }
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
  }
  function renderRows() {
    rows.innerHTML = "";
    const visible = reportTransactions.slice(0, 30);
    visible.forEach((item, index) => {
      const row = document.createElement("tr");
      addCell(row, fa(index + 1));
      addCell(row, formatDate(item.occurredAt));
      const operationCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "report-operation " + (item.operation === "ورود" || item.operation === "تعدیل مثبت" ? "in" : item.operation === "خروج" || item.operation === "تعدیل منفی" ? "out" : "");
      badge.textContent = item.operation || "—";
      operationCell.appendChild(badge);
      row.appendChild(operationCell);
      addCell(row, item.procurementCode, "code-cell");
      addCell(row, item.description);
      addCell(row, fa(item.quantity));
      addCell(row, item.destination);
      addCell(row, item.voucherNumber, "code-cell");
      addCell(row, item.exitNumber, "code-cell");
      rows.appendChild(row);
    });
    $("dateReportEmpty").hidden = reportTransactions.length > 0;
    $("reportResultCount").textContent = fa(reportTransactions.length) + " تراکنش";
    $("reportResultSummary").textContent = reportTransactions.length > 30
      ? "۳۰ ردیف نخست نمایش داده شده؛ فایل اکسل شامل تمام " + fa(reportTransactions.length) + " ردیف است."
      : "تمام تراکنش‌های این بازه نمایش داده شده‌اند.";
    $("reportExportHint").textContent = reportTransactions.length > 30
      ? "برای مشاهده ردیف‌های بعد از ۳۰، فایل اکسل کامل را دریافت کنید."
      : "فایل اکسل شامل تمام تراکنش‌های همین بازه است.";
    exportButton.disabled = reportTransactions.length === 0;
  }
  async function showReport() {
    const start = selectedDate(startInput, false);
    const end = selectedDate(endInput, true);
    if (!start || !end) { showMessage("لطفاً هر دو تاریخ شروع و پایان را انتخاب کنید.", true); return; }
    if (start > end) { showMessage("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.", true); return; }
    if (!window.ControlDB || typeof window.ControlDB.getReportTransactions !== "function") {
      showMessage("دریافت اطلاعات گزارش از پایگاه داده ممکن نیست. صفحه را دوباره بارگذاری کنید.", true);
      return;
    }
    showButton.disabled = true;
    showButton.textContent = "در حال دریافت…";
    showMessage("");
    try {
      reportTransactions = await window.ControlDB.getReportTransactions(start.toISOString(), end.toISOString());
      resultsSection.hidden = false;
      renderRows();
      showMessage(reportTransactions.length ? "" : "در این بازه زمانی تراکنشی پیدا نشد.");
    } catch (error) {
      reportTransactions = [];
      resultsSection.hidden = true;
      showMessage(error.message || "دریافت گزارش ناموفق بود.", true);
    } finally {
      showButton.disabled = false;
      showButton.textContent = "نمایش گزارش";
    }
  }
  function exportReport() {
    if (!reportTransactions.length) return;
    if (!window.XLSX) { showMessage("کتابخانه ساخت فایل اکسل بارگذاری نشده است.", true); return; }
    const data = reportTransactions.map((item, index) => ({
      "ردیف": index + 1,
      "تاریخ": formatDate(item.occurredAt),
      "نوع عملیات": item.operation || "",
      "کد تدارکاتی": item.procurementCode || "",
      "شرح کالا": item.description || "",
      "تعداد": Number(item.quantity) || 0,
      "محل ارسال": item.destination || "",
      "شماره ورود": item.voucherNumber || "",
      "شماره خروج": item.exitNumber || ""
    }));
    const sheet = window.XLSX.utils.json_to_sheet(data);
    sheet["!cols"] = [{wch:8},{wch:14},{wch:16},{wch:18},{wch:34},{wch:12},{wch:24},{wch:20},{wch:20}];
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, sheet, "گزارش بر اساس تاریخ");
    window.XLSX.writeFile(workbook, "گزارش-تراکنشات-بر-اساس-تاریخ.xlsx");
  }
  showButton.addEventListener("click", showReport);
  exportButton.addEventListener("click", exportReport);
  [startInput, endInput].forEach(input => input.addEventListener("change", () => {
    resultsSection.hidden = true;
    reportTransactions = [];
    showMessage("");
  }));
})();