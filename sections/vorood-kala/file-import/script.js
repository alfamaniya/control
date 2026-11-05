(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fileInput = $("goodsFile"), dropzone = $("dropzone");
  const selectedFileRow = $("selectedFileRow"), fileName = $("selectedFileName");
  const confirmFileButton = $("confirmFileButton"), message = $("importMessage");
  const previewPanel = $("previewPanel"), previewRows = $("previewRows");
  const confirmButton = $("confirmImportButton"), resultPanel = $("resultPanel");
  let selectedFile = null, importedRows = [], discrepancies = [], validRows = [];

  const toEnglishDigits = (value) => String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const normalizeText = value => String(value ?? "").replace(/\u200c/g, " ").trim();
  const normalizeHeader = value => normalizeText(value).toLowerCase()
    .replace(/[\s_\-‌]+/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

  function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "import-message" + (type ? " " + type : "");
    message.hidden = false;
  }

  // The internal identifier is exactly the first eight digits of the procurement code.
  function makeInternalCode(procurementCode) {
    return /^\\d{10}$/.test(procurementCode) ? procurementCode.slice(0, 8) : "";
  }
  function findColumn(headers, aliases, fallback) {
    const normalized = headers.map(normalizeHeader);
    for (const alias of aliases) {
      const index = normalized.indexOf(normalizeHeader(alias));
      if (index !== -1) return index;
    }
    return fallback;
  }
  function mapRows(matrix) {
    if (!Array.isArray(matrix) || matrix.length < 2) throw new Error("فایل خالی است یا ردیف عنوان ستون‌ها و اطلاعات کالا را ندارد.");
    const headers = matrix[0].map(normalizeText);
    const indexes = [
      findColumn(headers, ["کد تدارکاتی", "کد تدارکاتی ۱۰ رقمی", "کد تدارکاتی 10 رقمی", "procurementcode"], 0),
      findColumn(headers, ["شرح کالا", "شرح", "نام کالا", "description"], 1),
      findColumn(headers, ["موجودی", "تعداد موجودی", "تعداد", "quantity", "stock"], 2),
      findColumn(headers, ["گروه", "گروه کالا", "category", "group"], 3)
    ];
    if (new Set(indexes).size !== 4 || indexes.some(index => index < 0 || index >= headers.length)) {
      throw new Error("ستون‌های لازم پیدا نشدند. ترتیب مورد انتظار: کد تدارکاتی، شرح کالا، موجودی، گروه.");
    }
    return matrix.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      code: toEnglishDigits(row[indexes[0]] ?? "").replace(/\s+/g, ""),
      description: normalizeText(row[indexes[1]]),
      quantityRaw: toEnglishDigits(row[indexes[2]] ?? "").replace(/,/g, "").trim(),
      group: normalizeText(row[indexes[3]])
    })).filter(row => row.code || row.description || row.quantityRaw || row.group);
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if ((char === "," || char === ";" || char === "\t") && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += char;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(line => line.some(value => String(value).trim() !== ""));
  }
  function mapJsonRecords(records) {
    const keys = Object.keys(records[0] || {});
    const findKey = (aliases, fallback) => keys.find(key => aliases.map(normalizeHeader).includes(normalizeHeader(key))) || keys[fallback];
    const codeKey = findKey(["کد تدارکاتی", "کد تدارکاتی ۱۰ رقمی", "procurementcode"], 0);
    const descriptionKey = findKey(["شرح کالا", "شرح", "نام کالا", "description"], 1);
    const stockKey = findKey(["موجودی", "تعداد موجودی", "quantity", "stock"], 2);
    const groupKey = findKey(["گروه", "گروه کالا", "category", "group"], 3);
    if (![codeKey, descriptionKey, stockKey, groupKey].every(Boolean)) throw new Error("چهار فیلد کد تدارکاتی، شرح کالا، موجودی و گروه در JSON الزامی است.");
    return records.map((item, index) => ({
      rowNumber: index + 1,
      code: toEnglishDigits(item[codeKey] ?? "").replace(/\s+/g, ""),
      description: normalizeText(item[descriptionKey]),
      quantityRaw: toEnglishDigits(item[stockKey] ?? "").replace(/,/g, "").trim(),
      group: normalizeText(item[groupKey])
    })).filter(row => row.code || row.description || row.quantityRaw || row.group);
  }
  async function parseFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv", "json"].includes(extension)) throw new Error("فرمت فایل پشتیبانی نمی‌شود. فقط Excel، CSV و JSON مجاز است.");
    if (extension === "json") {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : null);
      if (!records || !records.length) throw new Error("ساختار JSON باید آرایه‌ای از کالاها یا دارای آرایه items باشد.");
      importedRows = mapJsonRecords(records); return;
    }
    if (extension === "csv") importedRows = mapRows(parseCSV((await file.text()).replace(/^\uFEFF/, "")));
    else {
      if (!window.XLSX) throw new Error("کتابخانه اکسل محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      importedRows = mapRows(window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }));
    }
  }

  async function classifyRows(rows) {
    const inventory = await window.ControlDB.getAll();
    const procurementCodes = new Set(inventory.map(item => String(item.procurementCode || "")));
    const seenProcurement = new Set();
    validRows = []; discrepancies = [];
    rows.forEach(row => {
      const reasons = [];
      row.internalCode = /^\d{10}$/.test(row.code) ? makeInternalCode(row.code) : "";
      if (!/^\d{10}$/.test(row.code)) reasons.push("کد تدارکاتی ناقص یا نامعتبر است (باید ۱۰ رقم باشد)");
      if (!row.description) reasons.push("شرح کالا وارد نشده است");
      if (row.quantityRaw === "" || !/^\d+(?:\.\d+)?$/.test(row.quantityRaw)) reasons.push("تعداد موجودی خالی یا نامعتبر است");
      if (!row.group) reasons.push("گروه کالا وارد نشده است");
      if (row.code && /^\d{10}$/.test(row.code)) {
        if (seenProcurement.has(row.code)) reasons.push("کد تدارکاتی در همین فایل تکراری است");
        else seenProcurement.add(row.code);
        if (procurementCodes.has(row.code)) reasons.push("این کد تدارکاتی از قبل در موجودی ثبت شده است");
      }
      if (reasons.length) discrepancies.push({ ...row, reasons });
      else validRows.push({
        internalCode: row.internalCode, procurementCode: row.code,
        description: row.description, quantity: Number(row.quantityRaw), group: row.group
      });
    });
  }
  function renderPreview() {
    previewRows.innerHTML = "";
    const invalidByLine = new Map(discrepancies.map(row => [row.rowNumber, row]));
    importedRows.forEach(row => {
      const issue = invalidByLine.get(row.rowNumber), tr = document.createElement("tr");
      [row.rowNumber, row.internalCode || "—", row.code || "—", row.description || "—", row.quantityRaw || "—", row.group || "—"].forEach((value, index) => {
        const td = document.createElement("td"); td.textContent = value;
        if (index === 1) td.className = "code-cell";
        tr.appendChild(td);
      });
      const status = document.createElement("td"), tag = document.createElement("span");
      tag.className = "status-tag " + (issue ? (issue.reasons.some(reason => reason.includes("تکراری") || reason.includes("تداخل")) ? "duplicate" : "invalid") : "valid");
      tag.textContent = issue ? "دارای مغایرت" : "آماده ثبت";
      status.appendChild(tag); tr.appendChild(status); previewRows.appendChild(tr);
    });
    $("previewCount").textContent = importedRows.length + " ردیف";
    $("validSummary").textContent = validRows.length + " کالا آماده ثبت · " + discrepancies.length + " ردیف دارای مغایرت";
    confirmButton.disabled = validRows.length === 0;
  }
  function renderResult(added, issues) {
    $("resultSummary").textContent = added + " کالا با موفقیت به موجودی اضافه شد.";
    $("resultStats").innerHTML = "";
    [["ثبت‌شده", added, "کالا به موجودی اضافه شد"], ["ثبت‌نشده", issues.length, "ردیف دارای مغایرت"], ["بررسی‌شده", importedRows.length, "کل ردیف‌های فایل"]].forEach(([label, value, note]) => {
      const card = document.createElement("div"); card.className = "result-stat";
      const strong = document.createElement("strong"); strong.textContent = value;
      const title = document.createElement("span"); title.textContent = label + " · " + note;
      card.append(strong, title); $("resultStats").appendChild(card);
    });
    $("discrepancyRows").innerHTML = "";
    $("discrepancyCount").textContent = issues.length + " ردیف";
    $("noDiscrepancies").hidden = issues.length !== 0;
    document.querySelector("#resultPanel .table-wrap").hidden = issues.length === 0;
    issues.forEach(row => {
      const tr = document.createElement("tr");
      [row.rowNumber, row.internalCode || "—", row.code || "—", row.description || "—", row.quantityRaw || "—", row.group || "—", row.reasons.join("؛ ")].forEach(value => {
        const td = document.createElement("td"); td.textContent = value; tr.appendChild(td);
      });
      $("discrepancyRows").appendChild(tr);
    });
    resultPanel.hidden = false;
  }
  function setSelectedFile(file) {
    if (!file) return;
    selectedFile = file; fileName.textContent = file.name;
    selectedFileRow.hidden = false; previewPanel.hidden = true; resultPanel.hidden = true;
    confirmButton.disabled = true; message.hidden = true;
  }
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => setSelectedFile(fileInput.files && fileInput.files[0]));
  ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault(); event.stopPropagation(); dropzone.classList.add("drag-over");
  }));
  ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault(); event.stopPropagation(); dropzone.classList.remove("drag-over");
  }));
  dropzone.addEventListener("drop", event => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) { setSelectedFile(file); fileInput.value = ""; }
  });
  confirmFileButton.addEventListener("click", async () => {
    if (!selectedFile) return;
    showMessage("در حال خواندن و بررسی فایل…");
    confirmFileButton.disabled = true;
    try {
      await parseFile(selectedFile);
      if (!importedRows.length) throw new Error("هیچ ردیف کالایی در فایل پیدا نشد.");
      await classifyRows(importedRows); renderPreview(); previewPanel.hidden = false;
      showMessage("فایل با موفقیت خوانده شد. کدهای اختصاصی تولید شده‌اند؛ مغایرت‌ها را بررسی و ثبت را تأیید کنید.", "success");
      previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(error.message || "خواندن فایل با خطا مواجه شد.", "error");
    } finally { confirmFileButton.disabled = false; }
  });
  confirmButton.addEventListener("click", async () => {
    if (!validRows.length) return;
    confirmButton.disabled = true;
    try {
      const outcome = await window.ControlDB.addMany(validRows.map(item => ({ ...item, source: "file-import" })));
      const finalIssues = discrepancies.concat(outcome.skipped.map(item => ({
        rowNumber: "—", internalCode: item.internalCode, description: item.description,
        quantityRaw: String(item.quantity), group: item.group, reasons: ["این کد هنگام تأیید، در موجودی ثبت شده بود"]
      })));
      renderResult(outcome.added.length, finalIssues);
      showMessage("اطلاعات با موفقیت در پایگاه داده محلی ذخیره شد.", "success");
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      confirmButton.disabled = false;
      showMessage(error.message || "ثبت اطلاعات در پایگاه داده محلی انجام نشد.", "error");
    }
  });
})();