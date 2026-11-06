(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const rows = $("inventoryRows");
  const message = $("inventoryMessage");
  const tableWrap = $("inventoryTableWrap");
  const empty = $("inventoryEmpty");
  const count = $("inventoryCount");
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

  async function loadInventory() {
    message.hidden = false;
    message.className = "inventory-message";
    message.textContent = "در حال دریافت اطلاعات موجودی…";
    tableWrap.hidden = true;
    empty.hidden = true;
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      const products = await window.ControlDB.getAll();
      const signature = JSON.stringify(products.map(product => [product.procurementCode, product.quantity, product.description, product.group]));
      lastInventorySignature = signature;
      count.textContent = faNumber(products.length);
      rows.innerHTML = "";
      if (!products.length) {
        message.hidden = true;
        empty.hidden = false;
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
      message.hidden = true;
      tableWrap.hidden = false;
    } catch (error) {
      message.textContent = error.message || "دریافت فهرست موجودی با خطا مواجه شد.";
      message.className = "inventory-message error";
      count.textContent = "۰";
    }
  }

  $("refreshInventory").addEventListener("click", loadInventory);

  // موجودی ممکن است از صفحه یا زبانه دیگری تغییر کند؛ در بازگشت کاربر و به‌صورت دوره‌ای تازه‌خوانی شود.
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
    } catch (_) { /* خطا در تازه‌سازی دوره‌ای در نوبت بعد دوباره بررسی می‌شود */ }
  }, 5000);

  loadInventory();
})();