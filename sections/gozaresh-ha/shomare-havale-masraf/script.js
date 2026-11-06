(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fa = value => String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
  const listView = $("voucherListView");
  const detailView = $("voucherResults");
  const listRows = $("voucherListRows");
  const message = $("voucherMessage");
  const pageInput = $("voucherPageInput");
  const pageLabel = $("voucherPageLabel");
  const prevButton = $("voucherPrevPage");
  const nextButton = $("voucherNextPage");
  const searchInput = $("voucherNumberSearch");
  const PAGE_SIZE = 20;
  let dispatches = [], voucherRecords = [], filteredVoucherRecords = [], currentPage = 1, currentPageRecords = [], selectedMetadata = null, selectedItems = [];

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
  function timestamp(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }
  function normalizeVoucher(value) {
    return digits(value).replace(/\s+/g, "").toLocaleLowerCase("fa");
  }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  function buildVoucherRecords(records) {
    const grouped = new Map();
    records.forEach(dispatch => {
      const number = String(dispatch.voucherNumber || "").trim();
      const key = normalizeVoucher(number);
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(dispatch);
    });
    return Array.from(grouped.values()).map(group => {
      const latest = group.reduce((current, item) =>
        timestamp(item.createdAt || item.dispatchedAt) > timestamp(current.createdAt || current.dispatchedAt) ? item : current
      );
      return { ...latest, voucherNumber: String(latest.voucherNumber || group[0].voucherNumber || "").trim(), dispatches: group };
    }).sort((a, b) => timestamp(b.createdAt || b.dispatchedAt) - timestamp(a.createdAt || a.dispatchedAt));
  }
  function renderList() {
    const total = filteredVoucherRecords.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    currentPageRecords = filteredVoucherRecords.slice(start, start + PAGE_SIZE);
    listRows.innerHTML = "";
    currentPageRecords.forEach((record, index) => {
      const row = document.createElement("tr");
      row.className = "exit-list-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", "نمایش جزئیات حواله " + (record.voucherNumber || ""));
      row.dataset.recordIndex = String(index);
      addCell(row, fa(start + index + 1), "exit-row-number");
      addCell(row, record.voucherNumber || "—", "exit-row-code");
      addCell(row, record.exitNumber || "—");
      addCell(row, formatDate(record.createdAt || record.dispatchedAt));
      addCell(row, record.destination || record.destinationSub || "—");
      listRows.appendChild(row);
    });
    $("voucherListTotal").textContent = fa(total) + (searchInput.value.trim() ? " نتیجه از " + fa(voucherRecords.length) + " حواله" : " حواله");
    pageLabel.textContent = "صفحه " + fa(currentPage) + " از " + fa(totalPages);
    pageInput.value = String(currentPage);
    pageInput.max = String(totalPages);
    prevButton.disabled = currentPage <= 1 || total === 0;
    nextButton.disabled = currentPage >= totalPages || total === 0;
    $("voucherListEmpty").hidden = total > 0;
    $("voucherPagination").hidden = total === 0;
    setMessage(total ? "برای مشاهده اقلام هر حواله، ردیف موردنظر را انتخاب کنید." : (voucherRecords.length ? "حواله‌ای با شماره واردشده پیدا نشد." : "هنوز هیچ حواله مصرفی در سامانه ثبت نشده است."));
  }
  function openDetails(record) {
    if (!record) return;
    selectedMetadata = record;
    selectedItems = record.dispatches.flatMap(dispatch => Array.isArray(dispatch.items) ? dispatch.items : []);
    $("metaVoucher").textContent = record.voucherNumber || "—";
    $("metaExit").textContent = record.exitNumber || "—";
    $("metaDestination").textContent = record.destination || record.destinationSub || "—";
    $("metaDate").textContent = formatDate(record.createdAt || record.dispatchedAt);
    const rows = $("voucherItemsRows");
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
    $("voucherItemsSummary").textContent = "تمام اقلام ثبت‌شده برای شماره حواله " + (record.voucherNumber || "");
    $("voucherTotalQuantity").textContent = fa(total);
    $("voucherItemsEmpty").hidden = selectedItems.length > 0;
    $("exportVoucherReport").disabled = selectedItems.length === 0;
    listView.hidden = true;
    detailView.hidden = false;
    setMessage(selectedItems.length ? "" : "برای این حواله اطلاعات مشترک ثبت شده، اما قلمی برای آن ذخیره نشده است.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeDetails() {
    detailView.hidden = true;
    listView.hidden = false;
    renderList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goToPage(value) {
    const totalPages = Math.max(1, Math.ceil(filteredVoucherRecords.length / PAGE_SIZE));
    const page = Number(digits(value));
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      pageInput.value = String(currentPage);
      setMessage("شماره صفحه باید بین ۱ تا " + fa(totalPages) + " باشد.", true);
      return;
    }
    currentPage = page;
    renderList();
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
    const safeNumber = String(selectedMetadata.voucherNumber || "حواله").replace(/[^۰-۹0-9a-zA-Z_-]/g, "-");
    window.XLSX.writeFile(workbook, "گزارش-بر-اساس-شماره-حواله-" + safeNumber + ".xlsx");
  }
  async function loadDispatches() {
    try {
      if (!window.ControlDB || typeof window.ControlDB.getAllDispatches !== "function") throw new Error("دسترسی به پایگاه داده محلی ممکن نیست. صفحه را دوباره بارگذاری کنید.");
      dispatches = await window.ControlDB.getAllDispatches();
      voucherRecords = buildVoucherRecords(dispatches);
      filteredVoucherRecords = voucherRecords.slice();
      renderList();
    } catch (error) {
      setMessage(error.message || "دریافت فهرست حواله‌ها ناموفق بود.", true);
      $("voucherListEmpty").hidden = false;
      $("voucherPagination").hidden = true;
    }
  }
  listRows.addEventListener("click", event => {
    const row = event.target.closest("tr[data-record-index]");
    if (row) openDetails(currentPageRecords[Number(row.dataset.recordIndex)]);
  });
  listRows.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr[data-record-index]");
    if (!row) return;
    event.preventDefault();
    openDetails(currentPageRecords[Number(row.dataset.recordIndex)]);
  });
  prevButton.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderList(); } });
  nextButton.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredVoucherRecords.length / PAGE_SIZE));
    if (currentPage < totalPages) { currentPage++; renderList(); }
  });
  searchInput.addEventListener("input", () => {
    const term = normalizeVoucher(searchInput.value);
    filteredVoucherRecords = voucherRecords.filter(record =>
      normalizeVoucher(record.voucherNumber).includes(term) || normalizeVoucher(record.exitNumber).includes(term)
    );
    currentPage = 1;
    renderList();
  });
  $("voucherGoPage").addEventListener("click", () => goToPage(pageInput.value));
  pageInput.addEventListener("keydown", event => { if (event.key === "Enter") goToPage(pageInput.value); });
  $("backToVoucherList").addEventListener("click", closeDetails);
  $("exportVoucherReport").addEventListener("click", exportReport);
  loadDispatches();
})();