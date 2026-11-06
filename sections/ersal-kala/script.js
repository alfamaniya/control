(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const procurementSearch = $("procurementSearch");
  const descriptionSearch = $("descriptionSearch");
  const selectedBox = $("selectedProduct");
  const quantityInput = $("dispatchQuantity");
  const dispatchItemForm = $("dispatchItemForm");
  const rows = $("dispatchRows");
  const empty = $("dispatchEmpty");
  const count = $("dispatchItemCount");
  const confirmButton = $("openDispatchConfirm");
  const modal = $("dispatchModal");
  const form = $("dispatchForm");
  let inventory = [];
  let selectedProduct = null;
  let dispatchItems = [];

  const digits = value => String(value ?? "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const fa = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const numberOf = value => {
    const n = Number(digits(value));
    return Number.isFinite(n) ? n : 0;
  };
  const stockOf = product => Math.max(0, numberOf(product.quantity));
  const showMessage = (message, error = false) => {
    const box = $("dispatchMessage");
    box.textContent = message;
    box.className = "dispatch-message" + (error ? " error" : "");
    box.hidden = !message;
  };

  function renderSuggestions(query, target, mode) {
    const list = $(target);
    list.innerHTML = "";
    const term = digits(query).trim().toLocaleLowerCase("fa");
    if (!term) { list.hidden = true; return; }
    const matches = inventory.filter(product => {
      const value = mode === "code" ? digits(product.procurementCode) : String(product.description || "");
      return value.toLocaleLowerCase("fa").includes(term);
    }).slice(0, 12);
    if (!matches.length) {
      const noResult = document.createElement("div");
      noResult.className = "suggestion-item";
      noResult.textContent = "کالایی با این مشخصات پیدا نشد.";
      list.appendChild(noResult);
    } else {
      matches.forEach(product => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion-item";
        button.setAttribute("role", "option");
        const title = document.createElement("strong");
        title.textContent = product.description || "بدون شرح";
        const detail = document.createElement("small");
        detail.textContent = "کد تدارکاتی: " + product.procurementCode + "  |  موجودی: " + fa(stockOf(product));
        button.append(title, detail);
        button.addEventListener("click", () => chooseProduct(product));
        list.appendChild(button);
      });
    }
    list.hidden = false;
  }

  function chooseProduct(product) {
    selectedProduct = product;
    procurementSearch.value = product.procurementCode;
    descriptionSearch.value = product.description || "";
    $("procurementSuggestions").hidden = true;
    $("descriptionSuggestions").hidden = true;
    $("selectedDescription").textContent = product.description || "بدون شرح";
    $("selectedCode").textContent = "کد تدارکاتی: " + product.procurementCode + " | کد اختصاصی: " + String(product.procurementCode).slice(0, 8);
    const alreadyAdded = dispatchItems.find(item => item.procurementCode === product.procurementCode)?.quantity || 0;
    const remaining = Math.max(0, stockOf(product) - alreadyAdded);
    $("selectedStock").textContent = "موجودی قابل ارسال: " + fa(remaining) + " از " + fa(stockOf(product));
    quantityInput.max = String(remaining);
    quantityInput.value = "";
    quantityInput.disabled = remaining < 1;
    $("addDispatchItem").disabled = remaining < 1;
    selectedBox.hidden = false;
    if (remaining > 0) quantityInput.focus();
    showMessage(remaining < 1 ? "تمام موجودی این کالا در فهرست جمع‌بندی قرار گرفته است." : "");
  }

  function renderItems() {
    rows.innerHTML = "";
    dispatchItems.forEach((item, index) => {
      const row = document.createElement("tr");
      const values = [fa(index + 1), item.procurementCode.slice(0, 8), item.procurementCode, item.description || "—", fa(item.quantity)];
      values.forEach((value, cellIndex) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (cellIndex === 1 || cellIndex === 2) cell.className = "code-cell";
        row.appendChild(cell);
      });
      const actionCell = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-item";
      remove.textContent = "حذف";
      remove.addEventListener("click", () => {
        dispatchItems = dispatchItems.filter(entry => entry.procurementCode !== item.procurementCode);
        renderItems();
      });
      actionCell.appendChild(remove);
      row.appendChild(actionCell);
      rows.appendChild(row);
    });
    empty.hidden = dispatchItems.length > 0;
    count.textContent = fa(dispatchItems.length) + " کالا";
    confirmButton.disabled = dispatchItems.length === 0;
  }

  procurementSearch.addEventListener("input", () => {
    selectedProduct = null;
    selectedBox.hidden = true;
    renderSuggestions(procurementSearch.value, "procurementSuggestions", "code");
  });
  descriptionSearch.addEventListener("input", () => {
    selectedProduct = null;
    selectedBox.hidden = true;
    renderSuggestions(descriptionSearch.value, "descriptionSuggestions", "description");
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".autocomplete-wrap")) {
      $("procurementSuggestions").hidden = true;
      $("descriptionSuggestions").hidden = true;
    }
  });

  function addCurrentProduct() {
    if (!selectedProduct) return;
    const alreadyAdded = dispatchItems.find(item => item.procurementCode === selectedProduct.procurementCode)?.quantity || 0;
    const available = Math.max(0, stockOf(selectedProduct) - alreadyAdded);
    let quantity = Math.floor(numberOf(quantityInput.value));
    if (quantity > available) quantity = available;
    if (quantity < 1) {
      showMessage("تعداد ارسالی باید حداقل یک عدد باشد و از موجودی باقی‌مانده بیشتر نشود.", true);
      quantityInput.value = available > 0 ? String(available) : "0";
      return;
    }
    const existing = dispatchItems.find(item => item.procurementCode === selectedProduct.procurementCode);
    if (existing) existing.quantity += quantity;
    else dispatchItems.push({
      procurementCode: selectedProduct.procurementCode,
      internalCode: String(selectedProduct.procurementCode).slice(0, 8),
      description: selectedProduct.description || "",
      group: selectedProduct.group || "",
      quantity
    });
    renderItems();
    selectedProduct = null;
    selectedBox.hidden = true;
    procurementSearch.value = "";
    descriptionSearch.value = "";
    quantityInput.value = "";
    showMessage("کالا به باکس جمع‌بندی منتقل شد. کالای بعدی را جست‌وجو کنید.");
    procurementSearch.focus();
  }
  dispatchItemForm.addEventListener("submit", event => {
    event.preventDefault();
    addCurrentProduct();
  });

  function openModal() {
    if (!dispatchItems.length) return;
    modal.hidden = false;
    $("destination").focus();
  }
  function closeModal() { modal.hidden = true; }
  confirmButton.addEventListener("click", openModal);
  $("closeDispatchModal").addEventListener("click", closeModal);
  $("cancelDispatch").addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = $("submitDispatch");
    submit.disabled = true;
    submit.textContent = "در حال ثبت…";
    try {
      const metadata = {
        destination: $("destination").value.trim(),
        destinationSub: $("destinationSub").value.trim(),
        dispatchedAt: new Date().toISOString()
      };
      const result = await window.ControlDB.createDispatch(dispatchItems, metadata);
      dispatchItems = [];
      renderItems();
      closeModal();
      form.reset();
      showMessage("ارسال با موفقیت ثبت شد. شماره خروج: " + result.exitNumber + " | شماره حواله مصرف: " + result.voucherNumber + " | تعداد " + fa(result.items.length) + " ردیف کالا از موجودی کسر شد.");
      await loadInventory();
    } catch (error) {
      showMessage(error.message || "ثبت ارسال انجام نشد.", true);
    } finally {
      submit.disabled = false;
      submit.textContent = "ثبت ارسال";
    }
  });

  async function loadInventory() {
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است.");
      inventory = await window.ControlDB.getAll();
    } catch (error) {
      showMessage(error.message || "دریافت موجودی ناموفق بود.", true);
    }
  }

  loadInventory();
})();
