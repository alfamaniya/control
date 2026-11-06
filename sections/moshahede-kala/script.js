(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const rows = $("inventoryRows");
  const message = $("inventoryMessage");
  const tableWrap = $("inventoryTableWrap");
  const count = $("inventoryCount");
  const pagination = $("inventoryPagination");
  const pageSelect = $("inventoryPageSelect");
  const pageSummary = $("inventoryPageSummary");
  const prevButton = $("inventoryPrev");
  const nextButton = $("inventoryNext");
  const pageSize = 30;
  let currentPage = 1;
  let lastInventorySignature = "";

  function faNumber(value) {
    return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function addCell(row, value, className) {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
  }

  function renderPagination() {
    const allRows = Array.from(rows.rows);
    const total = allRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * pageSize;
    allRows.forEach((row, index) => {
      row.hidden = index < start || index >= start + pageSize;
      row.cells[0].textContent = faNumber(index + 1);
    });
    pagination.hidden = total <= pageSize;
    pageSelect.innerHTML = "";
    for (let page = 1; page <= totalPages; page += 1) {
      const option = document.createElement("option");
      option.value = String(page);
      option.textContent = faNumber(page);
      pageSelect.appendChild(option);
    }
    pageSelect.value = String(currentPage);
    pageSummary.textContent = `از ${faNumber(totalPages)} · ${faNumber(total)} کالا`;
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
  }

  async function loadInventory() {
    message.hidden = false;
    message.className = "inventory-message";
    message.textContent = "در حال دریافت اطلاعات موجودی…";
    tableWrap.hidden = true;
    pagination.hidden = true;
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      const products = await window.ControlDB.getAll();
      const signature = JSON.stringify(products.map(product => [product.procurementCode, product.quantity, product.description, product.group]));
      lastInventorySignature = signature;
      count.textContent = faNumber(products.length);
      rows.innerHTML = "";
      if (!products.length) {
        currentPage = 1;
        message.hidden = true;
        return;
      }
      products.forEach((product, index) => {
        const row = document.createElement("tr");
        addCell(row, faNumber(index + 1));
        addCell(row, product.internalCode || String(product.procurementCode || "").slice(0, 8), "inventory-code");
        addCell(row, product.procurementCode, "inventory-code");
        addCell(row, product.description);
        addCell(row, product.group);
        addCell(row, faNumber(product.quantity), "inventory-quantity");
        rows.appendChild(row);
      });
      currentPage = 1;
      renderPagination();
      message.hidden = true;
      tableWrap.hidden = false;
    } catch (error) {
      message.textContent = error.message || "دریافت فهرست موجودی با خطا مواجه شد.";
      message.className = "inventory-message error";
      count.textContent = "۰";
    }
  }

  $("refreshInventory").addEventListener("click", loadInventory);
  prevButton.addEventListener("click", () => { currentPage -= 1; renderPagination(); });
  nextButton.addEventListener("click", () => { currentPage += 1; renderPagination(); });
  pageSelect.addEventListener("change", () => { currentPage = Number(pageSelect.value) || 1; renderPagination(); });

  // پس از مرتب‌سازی، ترتیب جدید تمام ردیف‌ها در صفحه‌بندی لحاظ می‌شود.
  document.addEventListener("click", event => {
    if (event.target.closest(".inventory-table thead th")) renderPagination();
  });

  window.addEventListener("focus", loadInventory);
  window.addEventListener("pageshow", loadInventory);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadInventory();
  });
  window.setInterval(async () => {
    if (document.hidden || !window.ControlDB) return;
    try {
      const products = await window.ControlDB.getAll();
      const signature = JSON.stringify(products.map(product => [product.procurementCode, product.quantity, product.description, product.group]));
      if (signature !== lastInventorySignature) loadInventory();
    } catch (_) { /* در نوبت بعد دوباره بررسی می‌شود */ }
  }, 5000);

  loadInventory();
})();