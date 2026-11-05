(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const searchInput = $("productSearch");
  const results = $("searchResults");
  const message = $("managementMessage");
  const empty = $("managementEmpty");
  const count = $("productCount");
  const clearButton = $("clearProductSearch");
  let products = [];

  function faNumber(value) {
    return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function normalizeDigits(value) {
    return String(value || "")
      .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .toLocaleLowerCase("fa");
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.className = isError ? "management-message error" : "management-message";
    message.hidden = !text;
  }

  function renderResults() {
    const term = normalizeDigits(searchInput.value.trim());
    clearButton.hidden = !searchInput.value;
    results.innerHTML = "";
    empty.hidden = true;

    if (!term) {
      setMessage(products.length ? "برای مشاهده نتیجه، کد یا شرح کالا را جست‌وجو کنید." : "هیچ کالایی در موجودی ثبت نشده است.", false);
      return;
    }

    const matches = products.filter(product => {
      const searchable = [
        product.procurementCode,
        product.internalCode || String(product.procurementCode || "").slice(0, 8),
        product.description,
        product.group
      ].map(normalizeDigits).join(" ");
      return searchable.includes(term);
    }).slice(0, 100);

    setMessage(matches.length ? `${faNumber(matches.length)} نتیجه از ${faNumber(products.length)} کالا` : "", false);
    if (!matches.length) {
      empty.hidden = false;
      return;
    }

    matches.forEach(product => {
      const card = document.createElement("article");
      card.className = "product-result-card";

      const details = document.createElement("div");
      details.className = "product-result-details";
      const title = document.createElement("strong");
      title.className = "product-result-title";
      title.textContent = product.description || "بدون شرح";
      const meta = document.createElement("div");
      meta.className = "product-result-meta";
      const code = document.createElement("span");
      code.textContent = "کد تدارکاتی: " + (product.procurementCode || "—");
      const internal = document.createElement("span");
      internal.textContent = "کد اختصاصی: " + (product.internalCode || String(product.procurementCode || "").slice(0, 8) || "—");
      const stock = document.createElement("span");
      stock.textContent = "موجودی: " + faNumber(product.quantity ?? 0);
      meta.append(code, internal, stock);
      details.append(title, meta);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger-button danger-button-item";
      remove.textContent = "حذف کالا";
      remove.addEventListener("click", () => removeProduct(product));

      card.append(details, remove);
      results.appendChild(card);
    });
  }

  async function loadProducts() {
    setMessage("در حال دریافت فهرست کالاها…", false);
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      products = await window.ControlDB.getAll();
      count.textContent = faNumber(products.length);
      renderResults();
    } catch (error) {
      products = [];
      count.textContent = "۰";
      setMessage(error.message || "دریافت فهرست کالاها ناموفق بود.", true);
    }
  }

  async function removeProduct(product) {
    const description = product.description || product.procurementCode;
    if (!window.confirm(`آیا از حذف کالای «${description}» با کد تدارکاتی ${product.procurementCode} اطمینان دارید؟`)) return;
    try {
      const deleted = await window.ControlDB.deleteProduct(product.procurementCode);
      if (!deleted) throw new Error("این کالا در موجودی پیدا نشد؛ فهرست را تازه‌سازی کنید.");
      await loadProducts();
      renderResults();
      setMessage("کالای انتخاب‌شده با موفقیت از موجودی حذف شد.", false);
    } catch (error) {
      setMessage(error.message || "حذف کالا انجام نشد.", true);
    }
  }

  async function removeAllProducts() {
    if (!products.length) {
      setMessage("کالایی برای حذف وجود ندارد.", false);
      return;
    }
    const approved = window.confirm(`توجه: این عملیات تمام ${faNumber(products.length)} کالا را از موجودی حذف می‌کند و قابل بازگشت نیست. سوابق کاردکس و ارسال‌ها حفظ می‌شوند. آیا ادامه می‌دهید؟`);
    if (!approved) return;
    try {
      const deletedCount = await window.ControlDB.deleteAllProducts();
      await loadProducts();
      searchInput.value = "";
      renderResults();
      setMessage(`${faNumber(deletedCount)} کالا از موجودی حذف شد. سوابق کاردکس و ارسال‌ها حفظ شده‌اند.`, false);
    } catch (error) {
      setMessage(error.message || "حذف کلی کالاها انجام نشد.", true);
    }
  }

  searchInput.addEventListener("input", renderResults);
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    renderResults();
    searchInput.focus();
  });
  $("deleteAllProducts").addEventListener("click", removeAllProducts);

  const stockSearch = $("stockProductSearch");
  const stockResults = $("stockSearchResults");
  const stockCard = $("stockSelectedCard");
  const stockForm = $("stockAdjustmentForm");
  const stockMessage = $("stockAdjustmentMessage");
  let stockSelectedProduct = null;

  function renderStockMatches() {
    const term = normalizeDigits(stockSearch.value.trim());
    stockResults.innerHTML = "";
    stockCard.hidden = true;
    stockSelectedProduct = null;
    if (!term) return;

    const matches = products.filter(product => [
      product.procurementCode,
      product.internalCode || String(product.procurementCode || "").slice(0, 8),
      product.description,
      product.group
    ].map(normalizeDigits).join(" ").includes(term)).slice(0, 30);

    matches.forEach(product => {
      const card = document.createElement("article");
      card.className = "product-result-card";
      const details = document.createElement("div");
      details.className = "product-result-details";
      const title = document.createElement("strong");
      title.className = "product-result-title";
      title.textContent = product.description || "بدون شرح";
      const meta = document.createElement("div");
      meta.className = "product-result-meta";
      const code = document.createElement("span");
      code.textContent = "کد تدارکاتی: " + product.procurementCode;
      const stock = document.createElement("span");
      stock.textContent = "موجودی فعلی: " + faNumber(product.quantity ?? 0);
      meta.append(code, stock);
      details.append(title, meta);
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "stock-choose-button";
      choose.textContent = "انتخاب کالا";
      choose.addEventListener("click", () => selectStockProduct(product));
      card.append(details, choose);
      stockResults.appendChild(card);
    });

    if (!matches.length) {
      const noResult = document.createElement("div");
      noResult.className = "management-empty";
      noResult.textContent = "کالایی با این مشخصات پیدا نشد.";
      stockResults.appendChild(noResult);
    }
  }

  function selectStockProduct(product) {
    stockSelectedProduct = product;
    stockResults.innerHTML = "";
    stockCard.hidden = false;
    $("stockSelectedDescription").textContent = product.description || "بدون شرح";
    $("stockSelectedCodes").textContent = "کد اختصاصی: " + (product.internalCode || String(product.procurementCode).slice(0, 8)) + " | کد تدارکاتی: " + product.procurementCode;
    $("stockCurrentQuantity").textContent = faNumber(product.quantity ?? 0);
    $("newStockQuantity").value = String(Math.max(0, Number(product.quantity) || 0));
    stockMessage.hidden = true;
    stockMessage.textContent = "";
  }

  stockSearch.addEventListener("input", renderStockMatches);
  stockForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!stockSelectedProduct) {
      stockMessage.textContent = "ابتدا یک کالا را از نتایج جست‌وجو انتخاب کنید.";
      stockMessage.className = "management-message error";
      stockMessage.hidden = false;
      return;
    }
    const raw = $("newStockQuantity").value.trim();
    const normalizedQuantity = normalizeDigits(raw);
    if (!/^\d+$/.test(normalizedQuantity)) {
      stockMessage.textContent = "موجودی جدید باید یک عدد صحیح و صفر یا بیشتر باشد.";
      stockMessage.className = "management-message error";
      stockMessage.hidden = false;
      return;
    }
    const newQuantity = Number(normalizedQuantity);
    if (!Number.isSafeInteger(newQuantity)) {
      stockMessage.textContent = "عدد واردشده بیش از حد بزرگ است.";
      stockMessage.className = "management-message error";
      stockMessage.hidden = false;
      return;
    }
    try {
      const result = await window.ControlDB.adjustStock(stockSelectedProduct.procurementCode, newQuantity);
      products = await window.ControlDB.getAll();
      const updated = products.find(item => item.procurementCode === stockSelectedProduct.procurementCode);
      if (updated) selectStockProduct(updated);
      count.textContent = faNumber(products.length);
      renderResults();
      if (!result.changed) {
        stockMessage.textContent = "موجودی تغییری نکرد؛ مقدار واردشده با موجودی فعلی برابر است.";
      } else {
        stockMessage.textContent = result.operation + " با موفقیت ثبت شد. مقدار تغییر: " + faNumber(result.difference) + " | موجودی جدید: " + faNumber(result.quantity);
      }
      stockMessage.className = "management-message";
      stockMessage.hidden = false;
    } catch (error) {
      stockMessage.textContent = error.message || "ثبت تعدیل موجودی ناموفق بود.";
      stockMessage.className = "management-message error";
      stockMessage.hidden = false;
    }
  });

  loadProducts();
})();