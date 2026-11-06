(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const searchInput = $("exitSearch");
  const suggestions = $("exitSuggestions");
  const showButton = $("showExitReport");
  const results = $("exitResults");
  const message = $("exitMessage");
  const rows = $("exitItemsRows");
  const fa = value => String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
  let dispatches = [];
  let exitOptions = [];
  let selectedExit = "";
  let selectedDispatches = [];
  let selectedItems = [];
  let selectedMetadata = null;

  function setMessage(text, error = false) {
    message.textContent = text;
    message.className = "report-message" + (error ? " error" : "");
    message.hidden = !text;
  }
  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  function normalizeExit(value) { return digits(value).replace(/\s+/g, "").toLocaleLowerCase("fa"); }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  function renderSuggestions(query) {
    suggestions.innerHTML = "";
    const term = normalizeExit(query);
    if (!term) { suggestions.hidden = true; return; }
    const matches = exitOptions.filter(item => normalizeExit(item.number).includes(term)).slice(0, 12);
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "exit-suggestion-empty";
      empty.textContent = "خروج‌ای با این شماره پیدا نشد.";
      suggestions.appendChild(empty);
    } else {
      matches.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "exit-suggestion";
        button.setAttribute("role", "option");
        const number = document.createElement("strong");
        number.textContent = item.number;
        const detail = document.createElement("small");
        detail.textContent = "شماره حواله: " + (item.voucherNumber || "—") + " | محل ارسال: " + (item.destination || "—") + " | تاریخ: " + formatDate(item.createdAt);
        button.append(number, detail);
        button.addEventListener("click", () => {
          selectedExit = item.number;
          searchInput.value = item.number;
          suggestions.hidden = true;
          showButton.disabled = false;
          results.hidden = true;
          setMessage("شماره خروج انتخاب شد. برای مشاهده اطلاعات، دکمه نمایش گزارش را بزنید.");
        });
        suggestions.appendChild(button);
      });
    }
    suggestions.hidden = false;
  }
  function renderReport() {
    const key = normalizeExit(selectedExit);
    selectedDispatches = dispatches.filter(item => normalizeExit(item.exitNumber) === key);
    if (!selectedDispatches.length) {
      results.hidden = true;
      setMessage("خروج انتخاب‌شده در اطلاعات ثبت‌شده پیدا نشد.", true);
      return false;
    }
    selectedMetadata = selectedDispatches[0];
    selectedItems = selectedDispatches.flatMap(dispatch => (Array.isArray(dispatch.items) ? dispatch.items : []).map(item => ({
      ...item,
      dispatchDate: dispatch.createdAt || dispatch.dispatchedAt || "",
      dispatchExitNumber: dispatch.exitNumber || "",
      dispatchDestination: dispatch.destination || dispatch.destinationSub || ""
    })));
    $("metaExit").textContent = selectedMetadata.exitNumber || "—";
    $("metaVoucher").textContent = selectedMetadata.voucherNumber || "—";
    $("metaExit").textContent = selectedMetadata.exitNumber || "—";
    $("metaDestination").textContent = selectedMetadata.destination || selectedMetadata.destinationSub || "—";
    $("metaDate").textContent = formatDate(selectedMetadata.createdAt || selectedMetadata.dispatchedAt);
    rows.innerHTML = "";
    selectedItems.forEach((item, index) => {
      const row = document.createElement("tr");
      addCell(row, fa(index + 1));
      addCell(row, item.internalCode || String(item.procurementCode || "").slice(0, 8), "code-cell");
      addCell(row, item.procurementCode || "", "code-cell");
      addCell(row, item.description || "");
      addCell(row, item.group || "");
      addCell(row, fa(Number(item.quantity) || 0), "quantity-cell");
      rows.appendChild(row);
    });
    const total = selectedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    $("exitItemsCount").textContent = fa(selectedItems.length) + " ردیف";
    $("exitItemsSummary").textContent = "تمام اقلام ثبت‌شده برای شماره خروج انتخاب‌شده";
    $("exitTotalQuantity").textContent = fa(total);
    $("exitItemsEmpty").hidden = selectedItems.length > 0;
    $("exportExitReport").disabled = selectedItems.length === 0;
    results.hidden = false;
    setMessage(selectedItems.length ? "" : "برای این خروج اطلاعات مشترک ثبت شده، اما قلمی برای آن ذخیره نشده است.");
    return true;
  }
  function exportReport() {
    if (!selectedMetadata || !selectedItems.length) return;
    if (!window.XLSX) { setMessage("کتابخانه ساخت فایل اکسل بارگذاری نشده است.", true); return; }
    const headerData = [{
      "شماره خروج": selectedMetadata.exitNumber || "",
      "شماره حواله": selectedMetadata.voucherNumber || "",
      "محل ارسال": selectedMetadata.destination || selectedMetadata.destinationSub || "",
      "تاریخ": formatDate(selectedMetadata.createdAt || selectedMetadata.dispatchedAt)
    }];
    const itemData = selectedItems.map((item, index) => ({
      "ردیف": index + 1,
      "کد اختصاصی": item.internalCode || String(item.procurementCode || "").slice(0, 8),
      "کد تدارکاتی": item.procurementCode || "",
      "شرح کالا": item.description || "",
      "گروه کالا": item.group || "",
      "تعداد ارسالی": Number(item.quantity) || 0
    }));
    const workbook = window.XLSX.utils.book_new();
    const headerSheet = window.XLSX.utils.json_to_sheet(headerData);
    headerSheet["!cols"] = [{wch:20},{wch:20},{wch:30},{wch:16}];
    const itemsSheet = window.XLSX.utils.json_to_sheet(itemData);
    itemsSheet["!cols"] = [{wch:8},{wch:16},{wch:18},{wch:36},{wch:22},{wch:14}];
    window.XLSX.utils.book_append_sheet(workbook, headerSheet, "اطلاعات خروج");
    window.XLSX.utils.book_append_sheet(workbook, itemsSheet, "اقلام ارسال");
    const safeNumber = String(selectedMetadata.exitNumber || "خروج").replace(/[^۰-۹0-9a-zA-Z_-]/g, "-");
    window.XLSX.writeFile(workbook, "گزارش-بر-اساس-شماره-خروج-" + safeNumber + ".xlsx");
  }
  async function loadDispatches() {
    try {
      if (!window.ControlDB || typeof window.ControlDB.getAllDispatches !== "function") throw new Error("دسترسی به پایگاه داده محلی ممکن نیست. صفحه را دوباره بارگذاری کنید.");
      dispatches = await window.ControlDB.getAllDispatches();
      const seen = new Set();
      exitOptions = dispatches.filter(item => {
        const number = String(item.exitNumber || "").trim();
        const key = normalizeExit(number);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(item => ({
        number: String(item.exitNumber).trim(),
        exitNumber: item.exitNumber || "",
        destination: item.destination || item.destinationSub || "",
        createdAt: item.createdAt || item.dispatchedAt || ""
      }));
      setMessage(exitOptions.length ? "شماره خروج موردنظر را جست‌وجو و انتخاب کنید." : "هنوز هیچ خروجی در سامانه ثبت نشده است.");
    } catch (error) {
      setMessage(error.message || "دریافت فهرست خروج‌ها ناموفق بود.", true);
    }
  }
  searchInput.addEventListener("input", () => {
    selectedExit = "";
    showButton.disabled = true;
    results.hidden = true;
    renderSuggestions(searchInput.value);
  });
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) renderSuggestions(searchInput.value);
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".exit-input-wrap")) suggestions.hidden = true;
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".exit-items-table thead th")) return;
    Array.from(rows.rows).forEach((row, index) => {
      if (row.cells[0]) row.cells[0].textContent = fa(index + 1);
    });
  });
  showButton.addEventListener("click", renderReport);
  $("exportExitReport").addEventListener("click", exportReport);
  loadDispatches();
})();
