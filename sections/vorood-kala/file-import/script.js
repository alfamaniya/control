(() => {
  "use strict";

  const STORAGE_KEY = "control.inventory.v1";
  const $ = (id) => document.getElementById(id);
  const fileInput = $("goodsFile");
  const chooseButton = $("chooseFileButton");
  const fileName = $("selectedFileName");
  const message = $("importMessage");
  const previewPanel = $("previewPanel");
  const previewRows = $("previewRows");
  const confirmButton = $("confirmImportButton");
  const resultPanel = $("resultPanel");

  let importedRows = [];
  let discrepancies = [];
  let validRows = [];

  const toEnglishDigits = (value) => String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const normalizeText = (value) => String(value ?? "").replace(/\u200c/g, " ").trim();
  const normalizeHeader = (value) => normalizeText(value).toLowerCase()
    .replace(/[\s_\-‌]+/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

  function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "import-message" + (type ? " " + type : "");
    message.hidden = false;
  }

  function readInventory() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveInventory(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function findColumn(headers, names, fallback) {
    const normalized = headers.map(normalizeHeader);
    for (const name of names) {
      const index = normalized.indexOf(normalizeHeader(name));
      if (index !== -1) return index;
    }
    return fallback;
  }

  function mapRows(matrix) {
    if (!Array.isArray(matrix) || matrix.length < 2) {
      throw new Error("فایل خالی است یا ردیف عنوان ستون‌ها و اطلاعات کالا را ندارد.");
    }
    const headers = matrix[0].map(normalizeText);
    const codeIndex = findColumn(headers, ["کد تدارکاتی", "کد تدارکاتی ۱۰ رقمی", "کد تدارکاتی 10 رقمی", "procurementcode"], 0);
    const descriptionIndex = findColumn(headers, ["شرح کالا", "شرح", "نام کالا", "description"], 1);
    const stockIndex = findColumn(headers, ["موجودی", "تعداد موجودی", "تعداد", "quantity", "stock"], 2);
    const groupIndex = findColumn(headers, ["گروه", "گروه کالا", "category", "group"], 3);
    const requiredIndexes = [codeIndex, descriptionIndex, stockIndex, groupIndex];
    if (new Set(requiredIndexes).size !== 4 || requiredIndexes.some((index) => index < 0 || index >= headers.length)) {
      throw new Error("ستون‌های لازم پیدا نشدند. ترتیب مورد انتظار: کد تدارکاتی، شرح کالا، موجودی، گروه.");
    }
    return matrix.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      code: toEnglishDigits(row[codeIndex] ?? "").replace(/\s+/g, ""),
      description: normalizeText(row[descriptionIndex]),
      quantityRaw: toEnglishDigits(row[stockIndex] ?? "").replace(/,/g, "").trim(),
      group: normalizeText(row[groupIndex])
    })).filter((row) => row.code || row.description || row.quantityRaw || row.group);
  }

  function classifyRows(rows) {
    const inventoryCodes = new Set(readInventory().map((item) => String(item.procurementCode || "")));
    const seenInFile = new Set();
    validRows = [];
    discrepancies = [];

    rows.forEach((row) => {
      const reasons = [];
      if (!/^\d{10}$/.test(row.code)) reasons.push("کد تدارکاتی ناقص یا نامعتبر است (باید ۱۰ رقم باشد)");
      if (!row.description) reasons.push("شرح کالا وارد نشده است");
      if (row.quantityRaw === "" || !/^\d+(?:\.\d+)?$/.test(row.quantityRaw)) reasons.push("موجودی خالی یا نامعتبر است");
      if (!row.group) reasons.push("گروه کالا وارد نشده است");

      if (row.code && /^\d{10}$/.test(row.code)) {
        if (seenInFile.has(row.code)) reasons.push("کد تدارکاتی در همین فایل تکراری است");
        else seenInFile.add(row.code);
        if (inventoryCodes.has(row.code)) reasons.push("این کد تدارکاتی از قبل در موجودی ثبت شده است");
      }

      if (reasons.length) {
        discrepancies.push({ ...row, reasons });
      } else {
        validRows.push({
          procurementCode: row.code,
          description: row.description,
          quantity: Number(row.quantityRaw),
          group: row.group
        });
      }
    });
  }

  function renderPreview() {
    previewRows.innerHTML = "";
    const invalidByLine = new Map(discrepancies.map((row) => [row.rowNumber, row]));
    importedRows.forEach((row) => {
      const issue = invalidByLine.get(row.rowNumber);
      const tr = document.createElement("tr");
      const values = [row.rowNumber, row.code || "—", row.description || "—", row.quantityRaw || "—", row.group || "—"];
      values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      const status = document.createElement("td");
      const tag = document.createElement("span");
      tag.className = "status-tag " + (issue ? (issue.reasons.some((reason) => reason.includes("تکراری")) ? "duplicate" : "invalid") : "valid");
      tag.textContent = issue ? "دارای مغایرت" : "آماده ثبت";
      status.appendChild(tag);
      tr.appendChild(status);
      previewRows.appendChild(tr);
    });
    $("previewCount").textContent = importedRows.length + " ردیف";
    $("validSummary").textContent = validRows.length + " کالا آماده ثبت · " + discrepancies.length + " ردیف دارای مغایرت";
    confirmButton.disabled = validRows.length === 0;
  }

  function renderResult(added, issues) {
    $("resultSummary").textContent = added + " کالا با موفقیت به موجودی اضافه شد.";
    $("resultStats").innerHTML = "";
    [
      ["ثبت‌شده", added, "کالا به موجودی اضافه شد"],
      ["ثبت‌نشده", issues.length, "ردیف دارای مغایرت"],
      ["بررسی‌شده", importedRows.length, "کل ردیف‌های فایل"]
    ].forEach(([label, value, note]) => {
      const card = document.createElement("div");
      card.className = "result-stat";
      const strong = document.createElement("strong"); strong.textContent = value;
      const title = document.createElement("span"); title.textContent = label + " · " + note;
      card.append(strong, title); $("resultStats").appendChild(card);
    });

    $("discrepancyRows").innerHTML = "";
    $("discrepancyCount").textContent = issues.length + " ردیف";
    $("noDiscrepancies").hidden = issues.length !== 0;
    document.querySelector("#resultPanel .table-wrap").hidden = issues.length === 0;

    issues.forEach((row) => {
      const tr = document.createElement("tr");
      [row.rowNumber, row.code || "—", row.description || "—", row.quantityRaw || "—", row.group || "—", row.reasons.join("؛ ")].forEach((value) => {
        const td = document.createElement("td"); td.textContent = value; tr.appendChild(td);
      });
      $("discrepancyRows").appendChild(tr);
    });
    resultPanel.hidden = false;
  }

  async function parseFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv", "json"].includes(extension)) {
      throw new Error("فرمت فایل پشتیبانی نمی‌شود. فقط Excel، CSV و JSON قابل انتخاب هستند.");
    }

    let matrix;
    if (extension === "json") {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : null);
      if (!records || !records.length) throw new Error("ساختار JSON باید آرایه‌ای از کالاها یا دارای آرایه items باشد.");
      const keys = Object.keys(records[0] || {});
      const findKey = (aliases, fallback) => keys.find((key) => aliases.includes(normalizeHeader(key))) || keys[fallback];
      const codeKey = findKey(["کد تدارکاتی", "کد تدارکاتی ۱۰ رقمی", "procurementcode"], 0);
      const descriptionKey = findKey(["شرح کالا", "شرح", "نام کالا", "description"], 1);
      const stockKey = findKey(["موجودی", "تعداد موجودی", "quantity", "stock"], 2);
      const groupKey = findKey(["گروه", "گروه کالا", "category", "group"], 3);
      if (![codeKey, descriptionKey, stockKey, groupKey].every(Boolean)) throw new Error("چهار فیلد کد تدارکاتی، شرح کالا، موجودی و گروه در JSON الزامی است.");
      importedRows = records.map((item, index) => ({
        rowNumber: index + 1,
        code: toEnglishDigits(item[codeKey] ?? "").replace(/\s+/g, ""),
        description: normalizeText(item[descriptionKey]),
        quantityRaw: toEnglishDigits(item[stockKey] ?? "").replace(/,/g, "").trim(),
        group: normalizeText(item[groupKey])
      })).filter((row) => row.code || row.description || row.quantityRaw || row.group);
      return;
    }

    if (extension === "csv") {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      matrix = parseCSV(text);
    } else {
      if (!window.XLSX) throw new Error("کتابخانه خواندن اکسل بارگذاری نشد. اتصال اینترنت را بررسی و صفحه را دوباره بارگذاری کنید.");
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array", raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    }
    importedRows = mapRows(matrix);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if ((char === "," || char === ";" || char === "\\t") && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\\n" || char === "\\r") && !quoted) {
        if (char === "\\r" && next === "\\n") i += 1;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += char;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((line) => line.some((value) => String(value).trim() !== ""));
  }

  chooseButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    fileName.textContent = file.name;
    resultPanel.hidden = true;
    previewPanel.hidden = true;
    showMessage("در حال خواندن و بررسی فایل…");
    confirmButton.disabled = true;
    try {
      await parseFile(file);
      if (!importedRows.length) throw new Error("هیچ ردیف کالایی در فایل پیدا نشد.");
      classifyRows(importedRows);
      renderPreview();
      previewPanel.hidden = false;
      showMessage("فایل با موفقیت خوانده شد. مغایرت‌ها را بررسی و سپس ثبت را تأیید کنید.", "success");
    } catch (error) {
      showMessage(error.message || "خواندن فایل با خطا مواجه شد.", "error");
    }
  });

  confirmButton.addEventListener("click", () => {
    if (!validRows.length) return;
    try {
      const current = readInventory();
      const known = new Set(current.map((item) => String(item.procurementCode || "")));
      const fresh = validRows.filter((item) => !known.has(item.procurementCode));
      const skippedAtConfirm = validRows.filter((item) => known.has(item.procurementCode));
      const updated = current.concat(fresh.map((item) => ({
        ...item,
        createdAt: new Date().toISOString(),
        source: "file-import"
      })));
      saveInventory(updated);
      const finalIssues = discrepancies.concat(skippedAtConfirm.map((item) => ({
        rowNumber: "—",
        code: item.procurementCode,
        description: item.description,
        quantityRaw: String(item.quantity),
        group: item.group,
        reasons: ["این کد هنگام تأیید، در موجودی ثبت شده بود"]
      })));
      renderResult(fresh.length, finalIssues);
      confirmButton.disabled = true;
      showMessage("عملیات ورود اطلاعات انجام شد.", "success");
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage("ثبت اطلاعات انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.", "error");
    }
  });
})();