(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fields = [
    { input: $("searchInternalCode"), list: $("internalSuggestions"), key: "internalCode" },
    { input: $("searchProcurementCode"), list: $("procurementSuggestions"), key: "procurementCode" },
    { input: $("searchDescription"), list: $("descriptionSuggestions"), key: "description" }
  ];
  const selectedCard = $("selectedProductCard");
  const historyCard = $("kardexHistoryCard");
  const startEmpty = $("kardexStartEmpty");
  const details = $("selectedProductDetails");
  const rows = $("kardexRows");
  const empty = $("kardexEmpty");
  const message = $("kardexMessage");
  let inventory = [];
  let selectedProduct = null;

  const digits = value => String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const fa = value => String(value ?? "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const normalized = value => digits(value).trim().toLocaleLowerCase("fa");
  const showMessage = (text, error = false) => {
    message.textContent = text;
    message.className = "kardex-message" + (error ? " error" : "");
    message.hidden = !text;
  };
  const cell = (row, value, className = "") => {
    const td = document.createElement("td");
    td.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    if (className) td.className = className;
    row.appendChild(td);
  };
  function renderSuggestions(field, query) {
    field.list.innerHTML = "";
    const term = normalized(query);
    if (!term) { field.list.hidden = true; return; }
    const matches = inventory.filter(product => normalized(product[field.key] || (field.key === "internalCode" ? String(product.procurementCode || "").slice(0, 8) : "")).includes(term)).slice(0, 15);
    if (!matches.length) {
      const noResult = document.createElement("div");
      noResult.className = "kardex-suggestion-empty";
      noResult.textContent = "کالایی با این مشخصات پیدا نشد.";
      field.list.appendChild(noResult);
    } else {
      matches.forEach(product => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "kardex-suggestion";
        const title = document.createElement("strong");
        title.textContent = product.description || "بدون شرح";
        const meta = document.createElement("small");
        meta.textContent = "کد اختصاصی: " + (product.internalCode || String(product.procurementCode).slice(0, 8)) + " | کد تدارکاتی: " + product.procurementCode;
        option.append(title, meta);
        option.addEventListener("click", () => selectProduct(product));
        field.list.appendChild(option);
      });
    }
    field.list.hidden = false;
  }
  function renderProduct(product) {
    details.innerHTML = "";
    const row = document.createElement("tr");
    cell(row, product.internalCode || String(product.procurementCode || "").slice(0, 8), "kardex-code");
    cell(row, product.procurementCode, "kardex-code");
    cell(row, product.description);
    cell(row, product.group);
    cell(row, fa(product.quantity), "kardex-stock");
    details.appendChild(row);
  }
  function formatDateTime(value) {
    if (!value) return { date: "—", time: "—" };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: String(value), time: "—" };
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
    const time = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(date);
    return { date: parts, time };
  }
  async function renderHistory(product) {
    rows.innerHTML = "";
    const movements = await window.ControlDB.getKardex(product.procurementCode);
    $("kardexCount").textContent = fa(movements.length) + " عملیات";
    empty.hidden = movements.length > 0;
    movements.forEach((movement, index) => {
      const tr = document.createElement("tr");
      const dateTime = formatDateTime(movement.occurredAt);
      cell(tr, fa(index + 1));
      const operation = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "operation-badge " + (movement.operation === "ورود" || movement.operation === "تعدیل مثبت" ? "in" : "out");
      badge.textContent = movement.operation || "—";
      operation.appendChild(badge);
      tr.appendChild(operation);
      cell(tr, dateTime.date);
      cell(tr, dateTime.time, "kardex-time");
      cell(tr, movement.quantityIn ? fa(movement.quantityIn) : "—", "quantity-in");
      cell(tr, movement.quantityOut ? fa(movement.quantityOut) : "—", "quantity-out");
      cell(tr, movement.stockAfter === null || movement.stockAfter === undefined ? "—" : fa(movement.stockAfter), "kardex-stock");
      rows.appendChild(tr);
    });
  }
  async function selectProduct(product) {
    selectedProduct = product;
    fields.forEach(field => {
      field.input.value = "";
      field.list.innerHTML = "";
      field.list.hidden = true;
    });
    renderProduct(product);
    selectedCard.hidden = false;
    historyCard.hidden = false;
    startEmpty.hidden = true;
    showMessage("در حال دریافت سوابق گردش این کالا…");
    try {
      await renderHistory(product);
      showMessage("");
    } catch (error) {
      showMessage(error.message || "دریافت سوابق کاردکس ناموفق بود.", true);
    }
  }
  fields.forEach(field => {
    field.input.addEventListener("input", () => {
      selectedProduct = null;
      selectedCard.hidden = true;
      historyCard.hidden = true;
      startEmpty.hidden = true;
      showMessage("");
      renderSuggestions(field, field.input.value);
    });
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".autocomplete-wrap")) fields.forEach(field => { field.list.hidden = true; });
  });
  async function loadInventory() {
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      inventory = await window.ControlDB.getAll();
      startEmpty.hidden = false;
      if (!inventory.length) showMessage("هنوز کالایی در موجودی ثبت نشده است.", true);
    } catch (error) {
      showMessage(error.message || "دریافت موجودی کالاها ناموفق بود.", true);
    }
  }
  loadInventory();
})();