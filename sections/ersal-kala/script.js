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
  const inventoryRows = $("inventoryRows");
  const inventoryMessage = $("inventoryListMessage");
  const inventoryTableWrap = $("inventoryTableWrap");
  const inventoryCount = $("inventoryCount");
  let inventory = [];
  let lastInventorySignature = "";
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
      const values = [fa(index + 1), item.procurementCode.slice(0, 8), item.procurementCode, item.description || "—"];
      values.forEach((value, cellIndex) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (cellIndex === 1 || cellIndex === 2) cell.className = "code-cell";
        row.appendChild(cell);
      });

      const quantityCell = document.createElement("td");
      const quantityEditor = document.createElement("input");
      const product = inventory.find(entry => entry.procurementCode === item.procurementCode);
      quantityEditor.type = "number";
      quantityEditor.inputMode = "numeric";
      quantityEditor.min = "1";
      quantityEditor.step = "1";
      quantityEditor.max = String(product ? stockOf(product) : item.quantity);
      quantityEditor.value = String(item.quantity);
      quantityEditor.className = "summary-quantity-input";
      quantityEditor.setAttribute("aria-label", "ویرایش تعداد ارسالی " + (item.description || item.procurementCode));
      quantityEditor.addEventListener("change", () => {
        const nextQuantity = Math.floor(numberOf(quantityEditor.value));
        const maximum = product ? stockOf(product) : item.quantity;
        if (nextQuantity < 1 || nextQuantity > maximum) {
          showMessage("تعداد باید حداقل یک و حداکثر برابر موجودی کالا باشد.", true);
          quantityEditor.value = String(item.quantity);
          return;
        }
        item.quantity = nextQuantity;
        renderItems();
        showMessage("تعداد کالای «" + (item.description || item.procurementCode) + "» به " + fa(nextQuantity) + " تغییر کرد.");
      });
      quantityCell.appendChild(quantityEditor);
      row.appendChild(quantityCell);

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
    renderInventory();
  }

  function renderInventory() {
    if (!inventoryRows) return;
    const codeTerm = digits(procurementSearch.value).trim();
    const descriptionTerm = descriptionSearch.value.trim().toLocaleLowerCase("fa");
    const filtered = inventory.filter(product => {
      const codeMatch = codeTerm && digits(product.procurementCode).includes(codeTerm);
      const descriptionMatch = descriptionTerm && String(product.description || "").toLocaleLowerCase("fa").includes(descriptionTerm);
      return (!codeTerm && !descriptionTerm) || codeMatch || descriptionMatch;
    });
    inventoryRows.innerHTML = "";
    filtered.forEach((product, index) => {
      const row = document.createElement("tr");
      const reserved = dispatchItems.find(item => item.procurementCode === product.procurementCode)?.quantity || 0;
      if (reserved > 0) {
        row.classList.add("inventory-row-selected");
        row.setAttribute("aria-label", "این کالا به فهرست ارسال اضافه شده است");
      }
      const values = [fa(index + 1), String(product.procurementCode || "").slice(0, 8), product.procurementCode, product.description || "—", product.group || "—"];
      values.forEach((value, cellIndex) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (cellIndex === 1 || cellIndex === 2) cell.className = "code-cell";
        row.appendChild(cell);
      });
      const stockCell = document.createElement("td");
      stockCell.textContent = fa(stockOf(product)) + (reserved ? " (قابل ارسال: " + fa(Math.max(0, stockOf(product) - reserved)) + ")" : "");
      stockCell.className = "inventory-stock-cell";
      row.appendChild(stockCell);
      const actionCell = document.createElement("td");
      const actionGroup = document.createElement("div");
      actionGroup.className = "inventory-inline-actions";
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.inputMode = "numeric";
      quantity.min = "1";
      quantity.step = "1";
      quantity.max = String(Math.max(0, stockOf(product) - reserved));
      quantity.value = stockOf(product) - reserved > 0 ? "1" : "0";
      quantity.className = "inventory-quantity-input";
      quantity.setAttribute("aria-label", "تعداد ارسالی " + (product.description || product.procurementCode));
      quantity.disabled = stockOf(product) - reserved < 1;
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "inventory-choose-button";
      choose.textContent = "انتخاب برای ارسال";
      choose.disabled = stockOf(product) - reserved < 1;
      choose.addEventListener("click", () => addProductToDispatch(product, quantity));
      actionGroup.append(quantity, choose);
      actionCell.appendChild(actionGroup);
      row.appendChild(actionCell);
      inventoryRows.appendChild(row);
    });
    inventoryCount.textContent = fa(inventory.length) + " قلم کالا";
    inventoryMessage.hidden = inventory.length > 0;
    inventoryMessage.textContent = inventory.length ? "" : "هنوز کالایی در موجودی ثبت نشده است.";
    inventoryTableWrap.hidden = inventory.length === 0;
    if (inventory.length && filtered.length === 0) {
      inventoryMessage.hidden = false;
      inventoryMessage.textContent = "با عبارت جست‌وجوشده کالایی پیدا نشد.";
    }
  }

  procurementSearch.addEventListener("input", () => {
    selectedProduct = null;
    selectedBox.hidden = true;
    renderSuggestions(procurementSearch.value, "procurementSuggestions", "code");
    renderInventory();
  });
  descriptionSearch.addEventListener("input", () => {
    selectedProduct = null;
    selectedBox.hidden = true;
    renderSuggestions(descriptionSearch.value, "descriptionSuggestions", "description");
    renderInventory();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".autocomplete-wrap")) {
      $("procurementSuggestions").hidden = true;
      $("descriptionSuggestions").hidden = true;
    }
  });

  function addProductToDispatch(product, input) {
    const alreadyAdded = dispatchItems.find(item => item.procurementCode === product.procurementCode)?.quantity || 0;
    const available = Math.max(0, stockOf(product) - alreadyAdded);
    const quantity = Math.floor(numberOf(input.value));
    if (quantity < 1 || quantity > available) {
      showMessage("تعداد ارسالی باید حداقل یک عدد باشد و از موجودی قابل ارسال بیشتر نشود.", true);
      input.max = String(available);
      input.value = available > 0 ? String(Math.min(Math.max(quantity, 1), available)) : "0";
      return false;
    }
    const existing = dispatchItems.find(item => item.procurementCode === product.procurementCode);
    if (existing) existing.quantity += quantity;
    else dispatchItems.push({
      procurementCode: product.procurementCode,
      internalCode: String(product.procurementCode).slice(0, 8),
      description: product.description || "",
      group: product.group || "",
      quantity
    });
    renderItems();
    showMessage("کالا با تعداد " + fa(quantity) + " به فهرست ارسال اضافه شد.");
    return true;
  }

  function addCurrentProduct() {
    if (!selectedProduct) return;
    if (!addProductToDispatch(selectedProduct, quantityInput)) return;
    selectedProduct = null;
    selectedBox.hidden = true;
    procurementSearch.value = "";
    descriptionSearch.value = "";
    quantityInput.value = "";
    procurementSearch.focus();
  }
  dispatchItemForm.addEventListener("submit", event => {
    event.preventDefault();
    addCurrentProduct();
  });

  let savedDestinations = [];

  function fillDestinationSelects() {
    const destinationSelect = $("destination");
    const subSelect = $("destinationSub");
    const currentMain = Number(destinationSelect.value || 0);
    destinationSelect.innerHTML = '<option value="">انتخاب محل ارسال…</option>';
    savedDestinations.filter(item => !Number(item.parentId || 0)).forEach(item => {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.name;
      destinationSelect.appendChild(option);
    });
    if (savedDestinations.some(item => item.id === currentMain)) destinationSelect.value = String(currentMain);
    fillSubDestinationSelect();
  }

  function fillSubDestinationSelect() {
    const destinationId = Number($("destination").value || 0);
    const subSelect = $("destinationSub");
    const currentSub = Number(subSelect.value || 0);
    subSelect.innerHTML = '<option value="">بدون زیرمجموعه</option>';
    const children = savedDestinations.filter(item => Number(item.parentId || 0) === destinationId);
    children.forEach(item => {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.name;
      subSelect.appendChild(option);
    });
    subSelect.disabled = !destinationId || !children.length;
    if (children.some(item => item.id === currentSub)) subSelect.value = String(currentSub);
  }

  async function loadDestinations() {
    try {
      savedDestinations = await window.ControlDB.getDestinations();
      fillDestinationSelects();
    } catch (error) {
      showMessage(error.message || "دریافت فهرست محل‌های ارسال ناموفق بود.", true);
    }
  }

  function openModal() {
    if (!dispatchItems.length) return;
    fillDestinationSelects();
    modal.hidden = false;
    $("destination").focus();
  }
  function closeModal() { modal.hidden = true; }
  $("destination").addEventListener("change", fillSubDestinationSelect);
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
        destinationId: Number($("destination").value || 0),
        destinationSubId: Number($("destinationSub").value || 0),
        dispatchedAt: new Date().toISOString()
      };
      if (!metadata.destinationId) throw new Error("محل ارسال را از فهرست محل‌های ذخیره‌شده انتخاب کنید.");
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
      lastInventorySignature = JSON.stringify(inventory.map(product => [product.procurementCode, product.quantity, product.description, product.group]));
      renderInventory();
    } catch (error) {
      showMessage(error.message || "دریافت موجودی ناموفق بود.", true);
      if (inventoryMessage) {
        inventoryMessage.hidden = false;
        inventoryMessage.className = "inventory-list-message error";
        inventoryMessage.textContent = error.message || "دریافت فهرست موجودی ناموفق بود.";
      }
    }
  }

  $("refreshInventory").addEventListener("click", loadInventory);
  window.addEventListener("focus", loadInventory);
  window.addEventListener("pageshow", loadInventory);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadInventory();
  });
  window.setInterval(async () => {
    if (document.hidden || !window.ControlDB) return;
    try {
      const latest = await window.ControlDB.getAll();
      const signature = JSON.stringify(latest.map(product => [product.procurementCode, product.quantity, product.description, product.group]));
      if (signature !== lastInventorySignature) {
        inventory = latest;
        lastInventorySignature = signature;
        renderInventory();
      }
    } catch (_) { /* در نوبت بعد دوباره بررسی می‌شود */ }
  }, 5000);
  loadInventory();
  loadDestinations();
})();
