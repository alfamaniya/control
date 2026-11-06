(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const searchInput = $("voucherSearch");
  const suggestions = $("voucherSuggestions");
  const showButton = $("showVoucherReport");
  const results = $("voucherResults");
  const message = $("voucherMessage");
  const rows = $("voucherItemsRows");
  const fa = value => String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
  let dispatches = [];
  let voucherOptions = [];
  let selectedVoucher = "";
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
  function normalizeVoucher(value) { return digits(value).replace(/\s+/g, "").toLocaleLowerCase("fa"); }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  function renderSuggestions(query) {
    suggestions.innerHTML = "";
    const term = normalizeVoucher(query);
    if (!term) { suggestions.hidden = true; return; }
    const matches = voucherOptions.filter(item => normalizeVoucher(item.number).includes(term)).slice(0, 12);
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "voucher-suggestion-empty";
      empty.textContent = "حواله‌ای با این شماره پیدا نشد.";
      suggestions.appendChild(empty);
    } else {
      matches.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "voucher-suggestion";
        button.setAttribute("role", "option");
        const number = document.createElement("strong");
        number.textContent = item.number;
        const detail = document.createElement("small");
        detail.textContent = "شماره خروج: " + (item.exitNumber || "—") + " | محل ارسال: " + (item.destination || "—") + " | تاریخ: " + formatDate(item.createdAt);
        button.append(number, detail);
        button.addEventListener("click", () => {
          selectedVoucher = item.number;
          searchInput.value = item.number;
          suggestions.hidden = true;
          showButton.disabled = false;
          results.hidden = true;
          setMessage("شماره حواله انتخاب شد. برای مشاهده اطلاعات، دکمه نمایش گزارش را بزنید.");
        });
        suggestions.appendChild(button);
      });
    }
    suggestions.hidden = false;
  }
  function renderReport() {
    const key = normalizeVoucher(selectedVoucher);
    selectedDispatches = dispatches.filter(item => normalizeVoucher(item.voucherNumber) === key);
    if (!selectedDispatches.length) {
      results.hidden = true;
      setMessage("حواله انتخاب‌شده در اطلاعات ثبت‌شده پیدا نشد.", true);
      return false;
    }
    selectedMetadata = selectedDispatches[0];
    selectedItems = selectedDispatches.flatMap(dispatch => (Array.isArray(dispatch.items) ? dispatch.items : []).map(item => ({
      ...item,
      dispatchDate: dispatch.createdAt || dispatch.dispatchedAt || "",
      dispatchExitNumber: dispatch.exitNumber || "",
      dispatchDestination: dispatch.destination || dispatch.destinationSub || ""
    })));
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
    $("voucherItemsCount").textContent = fa(selectedItems.length) + " ردیف";
    $("voucherItemsSummary").textContent = "تمام اقلام ثبت‌شده برای شماره حواله انتخاب‌شده";
    $("voucherTotalQuantity").textContent = fa(total);
    $("voucherItemsEmpty").hidden = selectedItems.length > 0;
    $("exportVoucherReport").disabled = selectedItems.length === 0;
    results.hidden = false;
    setMessage(selectedItems.length ? "" : "برای این حواله اطلاعات مشترک ثبت شده، اما قلمی برای آن ذخیره نشده است.");
    return true;
  }
  function exportReport() {
    if (!selectedMetadata || !selectedItems.length) return;
    if (!window.XLSX) { setMessage("کتابخانه ساخت فایل اکسل بارگذاری نشده است.", true); return; }
    const headerData = [{
      "شماره حواله": selectedMetadata.voucherNumber || "",
      "شماره خروج": selectedMetadata.exitNumber || "",
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
    window.XLSX.utils.book_append_sheet(workbook, headerSheet, "اطلاعات حواله");
    window.XLSX.utils.book_append_sheet(workbook, itemsSheet, "اقلام ارسال");
    const safeNumber = String(selectedMetadata.voucherNumber || "حواله").replace(/[\\\\/:*?"<>|]/g, "-");
    window.XLSX.writeFile(workbook, "گزارش-حواله-مصرف-" + safeNumber + ".xlsx");
  }
  async function loadDispatches() {
    try {
      if (!window.ControlDB || typeof window.ControlDB.getAllDispatches !== "function") throw new Error("دسترسی به پایگاه داده محلی ممکن نیست. صفحه را دوباره بارگذاری کنید.");
      dispatches = await window.ControlDB.getAllDispatches();
      const seen = new Set();
      voucherOptions = dispatches.filter(item => {
        const number = String(item.voucherNumber || "").trim();
        const key = normalizeVoucher(number);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(item => ({
        number: String(item.voucherNumber).trim(),
        exitNumber: item.exitNumber || "",
        destination: item.destination || item.destinationSub || "",
        createdAt: item.createdAt || item.dispatchedAt || ""
      }));
      setMessage(voucherOptions.length ? "شماره حواله موردنظر را جست‌وجو و انتخاب کنید." : "هنوز هیچ حواله مصرفی در سامانه ثبت نشده است.");
    } catch (error) {
      setMessage(error.message || "دریافت فهرست حواله‌ها ناموفق بود.", true);
    }
  }
  searchInput.addEventListener("input", () => {
    selectedVoucher = "";
    showButton.disabled = true;
    results.hidden = true;
    renderSuggestions(searchInput.value);
  });
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) renderSuggestions(searchInput.value);
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".voucher-input-wrap")) suggestions.hidden = true;
  });
  showButton.addEventListener("click", renderReport);
  $("exportVoucherReport").addEventListener("click", exportReport);
  loadDispatches();
})();
