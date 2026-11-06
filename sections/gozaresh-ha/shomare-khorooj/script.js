(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fa = value => String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
  const listView = $("exitListView");
  const detailView = $("exitResults");
  const listRows = $("exitListRows");
  const message = $("exitMessage");
  const pageInput = $("exitPageInput");
  const pageLabel = $("exitPageLabel");
  const prevButton = $("exitPrevPage");
  const nextButton = $("exitNextPage");
  const PAGE_SIZE = 20;
  let dispatches = [];
  let exitRecords = [];
  let currentPage = 1;
  let currentPageRecords = [];
  let selectedMetadata = null;
  let selectedItems = [];

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
  function normalizeExit(value) {
    return digits(value).replace(/\s+/g, "").toLocaleLowerCase("fa");
  }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  function buildExitRecords(records) {
    const grouped = new Map();
    records.forEach(dispatch => {
      const number = String(dispatch.exitNumber || "").trim();
      const key = normalizeExit(number);
      if (!key) return;
      const existing = grouped.get(key);
      if (!existing || timestamp(dispatch.createdAt || dispatch.dispatchedAt) > timestamp(existing.createdAt || existing.dispatchedAt)) {
        grouped.set(key, dispatch);
      }
    });
    return Array.from(grouped.values()).sort((a, b) =>
      timestamp(b.createdAt || b.dispatchedAt) - timestamp(a.createdAt || a.dispatchedAt)
    );
  }
  function renderList() {
    const total = exitRecords.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    currentPageRecords = exitRecords.slice(start, start + PAGE_SIZE);
    listRows.innerHTML = "";

    currentPageRecords.forEach((record, index) => {
      const row = document.createElement("tr");
      row.className = "exit-list-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", "نمایش جزئیات خروج " + (record.exitNumber || ""));
      row.dataset.recordIndex = String(index);
      addCell(row, fa(start + index + 1), "exit-row-number");
      addCell(row, record.exitNumber || "—", "exit-row-code");
      addCell(row, record.voucherNumber || "—");
      addCell(row, formatDate(record.createdAt || record.dispatchedAt));
      addCell(row, record.destination || record.destinationSub || "—");
      listRows.appendChild(row);
    });

    $("exitListTotal").textContent = fa(total) + " خروج";
    pageLabel.textContent = "صفحه " + fa(currentPage) + " از " + fa(totalPages);
    pageInput.value = String(currentPage);
    pageInput.max = String(totalPages);
    prevButton.disabled = currentPage <= 1 || total === 0;
    nextButton.disabled = currentPage >= totalPages || total === 0;
    $("exitListEmpty").hidden = total > 0;
    $("exitPagination").hidden = total === 0;
    if (total) setMessage("برای مشاهده اقلام هر خروج، ردیف موردنظر را انتخاب کنید.");
    else setMessage("هنوز هیچ خروجی در سامانه ثبت نشده است.");
  }
  function openDetails(record) {
    if (!record) return;
    selectedMetadata = record;
    selectedItems = Array.isArray(record.items) ? record.items : [];
    $("metaExit").textContent = record.exitNumber || "—";
    $("metaVoucher").textContent = record.voucherNumber || "—";
    $("metaDestination").textContent = record.destination || record.destinationSub || "—";
    $("metaDate").textContent = formatDate(record.createdAt || record.dispatchedAt);
    const rows = $("exitItemsRows");
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
    $("exitItemsSummary").textContent = "تمام اقلام ثبت‌شده برای شماره خروج " + (record.exitNumber || "");
    $("exitTotalQuantity").textContent = fa(total);
    $("exitItemsEmpty").hidden = selectedItems.length > 0;
    $("exportExitReport").disabled = selectedItems.length === 0;
    listView.hidden = true;
    detailView.hidden = false;
    setMessage(selectedItems.length ? "" : "برای این خروج اطلاعات مشترک ثبت شده، اما قلمی برای آن ذخیره نشده است.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeDetails() {
    detailView.hidden = true;
    listView.hidden = false;
    renderList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goToPage(value) {
    const totalPages = Math.max(1, Math.ceil(exitRecords.length / PAGE_SIZE));
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
      if (!window.ControlDB || typeof window.ControlDB.getAllDispatches !== "function") {
        throw new Error("دسترسی به پایگاه داده محلی ممکن نیست. صفحه را دوباره بارگذاری کنید.");
      }
      dispatches = await window.ControlDB.getAllDispatches();
      exitRecords = buildExitRecords(dispatches);
      renderList();
    } catch (error) {
      setMessage(error.message || "دریافت فهرست خروج‌ها ناموفق بود.", true);
      $("exitListEmpty").hidden = false;
      $("exitPagination").hidden = true;
    }
  }

  listRows.addEventListener("click", event => {
    const row = event.target.closest("tr[data-record-index]");
    if (!row) return;
    openDetails(currentPageRecords[Number(row.dataset.recordIndex)]);
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
    const totalPages = Math.max(1, Math.ceil(exitRecords.length / PAGE_SIZE));
    if (currentPage < totalPages) { currentPage++; renderList(); }
  });
  $("exitGoPage").addEventListener("click", () => goToPage(pageInput.value));
  pageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") goToPage(pageInput.value);
  });
  $("backToExitList").addEventListener("click", closeDetails);
  $("exportExitReport").addEventListener("click", exportReport);
  loadDispatches();
})();