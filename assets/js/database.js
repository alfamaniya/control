(() => {
  "use strict";

  // نسخه جدید پایگاه داده؛ دیتابیس قبلی عمداً دست‌نخورده باقی می‌ماند.
  const DB_NAME = "control-offline-db-v2";
  const DB_VERSION = 2;
  const STORES = Object.freeze({
    products: "products",
    documents: "documents",
    ledger: "ledger",
    destinations: "destinations",
    meta: "meta"
  });
  let databasePromise;

  const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("عملیات پایگاه داده ناموفق بود."));
  });
  const transactionDone = tx => new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error("تراکنش پایگاه داده لغو شد."));
    tx.onerror = () => reject(tx.error || new Error("ذخیره اطلاعات ناموفق بود."));
  });
  const digits = value => String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim();
  const normalizeCode = value => digits(value).replace(/\s/g, "");
  const validSupplyCode = value => /^\d{10}$/.test(normalizeCode(value));
  const toJalaliNumber = date => {
    const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return Number(String(p.year).padStart(4, "0") + p.month + p.day);
  };
  const now = () => new Date();
  const uid = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "op-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  };
  const typeNames = Object.freeze({
    opening: "ورود اولیه", receipt: "ورود", issue: "خروج",
    adjust: "تعدیل", reversal: "برگشت"
  });

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("مرورگر از IndexedDB پشتیبانی نمی‌کند."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        let store;
        if (!db.objectStoreNames.contains(STORES.products)) {
          store = db.createObjectStore(STORES.products, { keyPath: "supplyCode" });
          store.createIndex("procurementCode", "procurementCode", { unique: false });
          store.createIndex("group", "group", { unique: false });
          store.createIndex("active", "active", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.documents)) {
          store = db.createObjectStore(STORES.documents, { keyPath: "id", autoIncrement: true });
          store.createIndex("type_docNo", ["type", "docNo"], { unique: true });
          store.createIndex("opId", "opId", { unique: true });
          store.createIndex("docDate", "docDate", { unique: false });
          store.createIndex("dispatchRef", "dispatchRef", { unique: false });
          store.createIndex("voucherNo", "voucherNo", { unique: true });
          store.createIndex("destinationId", "destinationId", { unique: false });
          store.createIndex("reversalOf", "reversalOf", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.ledger)) {
          store = db.createObjectStore(STORES.ledger, { keyPath: "id", autoIncrement: true });
          store.createIndex("supplyCode_docDate_id", ["supplyCode", "docDate", "id"], { unique: false });
          store.createIndex("docId", "docId", { unique: false });
          store.createIndex("docDate", "docDate", { unique: false });
          store.createIndex("type", "type", { unique: false });
        }
        if (db.objectStoreNames.contains(STORES.documents)) {
          store = request.transaction.objectStore(STORES.documents);
          if (!store.indexNames.contains("voucherNo")) store.createIndex("voucherNo", "voucherNo", { unique: true });
        }
        if (!db.objectStoreNames.contains(STORES.destinations)) {
          store = db.createObjectStore(STORES.destinations, { keyPath: "id", autoIncrement: true });
          store.createIndex("parentId", "parentId", { unique: false });
          store.createIndex("parent_name", ["parentId", "name"], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta, { keyPath: "key" });
        request.transaction.objectStore(STORES.meta).put({ key: "schemaVersion", value: DB_VERSION });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("باز کردن پایگاه داده محلی ناموفق بود."));
      request.onblocked = () => reject(new Error("پایگاه داده جدید توسط زبانه دیگری مسدود شده است. سایر زبانه‌های سامانه را ببندید."));
    });
    return databasePromise;
  }

  async function ready() { return openDatabase(); }

  function nextDocumentNumber(metaStore, type) {
    return requestResult(metaStore.get("counter:" + type)).then(record => {
      const next = (Number(record && record.value) || 0) + 1;
      metaStore.put({ key: "counter:" + type, value: next });
      return String(next).padStart(8, "0");
    });
  }

  function productForUI(product) {
    if (!product) return null;
    return {
      ...product,
      procurementCode: product.supplyCode,
      internalCode: product.procurementCode,
      quantity: Number(product.qty) || 0
    };
  }

  function movementForUI(line, document, product) {
    const amount = Math.abs(Number(line.delta) || 0);
    const issue = line.delta < 0;
    const operation = line.type === "adjust" ? (line.delta > 0 ? "تعدیل مثبت" : "تعدیل منفی") :
      (line.type === "opening" || line.type === "receipt" || (line.type === "reversal" && line.delta > 0) ? "ورود" :
        line.type === "issue" || (line.type === "reversal" && line.delta < 0) ? "خروج" : typeNames[line.type] || line.type || "");
    return {
      id: line.id,
      transactionNumber: "TR" + String(line.id).padStart(8, "0"),
      adjustmentNumber: line.type === "adjust" ? document.docNo : "",
      procurementCode: line.supplyCode,
      internalCode: product ? product.procurementCode : line.supplyCode.slice(0, 8),
      description: product && product.description || line.description || "",
      group: product && product.group || line.group || "",
      operation,
      quantityIn: issue ? 0 : amount,
      quantityOut: issue ? amount : 0,
      quantity: amount,
      stockAfter: line.balanceAfter ?? "",
      previousStock: line.balanceBefore ?? "",
      occurredAt: document.createdAt,
      docDate: document.docDate,
      entryNumber: (["opening", "receipt"].includes(line.type) || (line.type === "reversal" && line.delta > 0)) ? document.docNo : "",
      exitNumber: (line.type === "issue" || (line.type === "reversal" && line.delta < 0)) ? document.docNo : "",
      reversalNumber: line.type === "reversal" ? document.docNo : "",
      voucherNumber: document.voucherNo || document.dispatchRef || "",
      dispatchedAt: line.type === "issue" ? new Date(document.createdAt).toISOString() : "",
      destination: document.destinationName || "",
      destinationSub: document.destinationSub || "",
      dispatchId: line.type === "issue" ? document.id : "",
      source: line.source || document.note || ""
    };
  }

  async function ensureDestination(tx, name, parentName) {
    const store = tx.objectStore(STORES.destinations);
    const clean = String(name || "").trim();
    if (!clean) return null;
    let parentId = 0;
    if (parentName) {
      const parent = await findOrCreate(parentName, 0);
      parentId = parent.id;
    }
    return findOrCreate(clean, parentId);

    async function findOrCreate(label, parent) {
      const index = store.index("parent_name");
      const existing = await requestResult(index.get([parent, label]));
      if (existing) return existing;
      const record = { name: label, parentId: parent, active: 1 };
      record.id = await requestResult(store.add(record));
      return record;
    }
  }

  async function createDocument(tx, type, options = {}) {
    const meta = tx.objectStore(STORES.meta);
    const docNo = await nextDocumentNumber(meta, type);
    const created = now();
    const doc = {
      type, docNo, docDate: toJalaliNumber(created), createdAt: created.getTime(),
      destinationId: options.destinationId ?? null,
      destinationName: options.destinationName || "",
      destinationSub: options.destinationSub || "",
      dispatchRef: options.dispatchRef || "",
      ...(options.voucherNo ? { voucherNo: options.voucherNo } : {}),
      reversalOf: options.reversalOf ?? null,
      replaces: options.replaces ?? null,
      note: options.note || "",
      opId: options.opId || uid(),
      status: "active"
    };
    doc.id = await requestResult(tx.objectStore(STORES.documents).add(doc));
    return doc;
  }

  async function getAll() {
    const db = await ready();
    const tx = db.transaction(STORES.products, "readonly");
    const done = transactionDone(tx);
    const rows = await requestResult(tx.objectStore(STORES.products).getAll());
    await done;
    return rows.filter(p => p.active !== 0).map(productForUI)
      .sort((a, b) => String(a.procurementCode).localeCompare(String(b.procurementCode)));
  }

  async function addMany(items) {
    if (!Array.isArray(items)) throw new Error("فهرست کالاهای ورودی معتبر نیست.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const ledger = tx.objectStore(STORES.ledger);
    const storedProducts = await requestResult(products.getAll());
    const stored = new Map(storedProducts.map(product => [product.supplyCode, product]));
    const accepted = [];
    const skipped = [];
    for (const item of items) {
      const code = normalizeCode(item && item.procurementCode);
      const qty = Number(item && item.quantity);
      const description = String(item && item.description || "").trim();
      const group = String(item && item.group || "").trim();
      const previous = stored.get(code);
      if (!validSupplyCode(code) || !description || !group || !Number.isFinite(qty) || qty < 0 || (previous && previous.active !== 0)) {
        skipped.push(item);
        continue;
      }
      const product = {
        supplyCode: code, procurementCode: code.slice(0, 8), description, group,
        qty, active: 1, createdAt: previous ? previous.createdAt : Date.now(),
        source: item.source || "initial-import"
      };
      accepted.push({ product, reactivated: Boolean(previous) });
      stored.set(code, product);
    }
    const newProducts = accepted.filter(item => !item.reactivated);
    const restoredProducts = accepted.filter(item => item.reactivated);
    const openingItems = newProducts.filter(item => item.product.qty > 0);
    const receiptItems = restoredProducts.filter(item => item.product.qty > 0);
    const openingDoc = openingItems.length ? await createDocument(tx, "opening", { note: "ثبت اولیه کالا" }) : null;
    const receiptDoc = receiptItems.length ? await createDocument(tx, "receipt", { note: "فعال‌سازی مجدد کالا" }) : null;

    for (const item of accepted) {
      const product = item.product;
      products.put(product);
      if (product.qty <= 0) continue;
      const document = item.reactivated ? receiptDoc : openingDoc;
      ledger.add({
        docId: document.id, supplyCode: product.supplyCode, delta: product.qty,
        type: item.reactivated ? "receipt" : "opening", docDate: document.docDate,
        balanceBefore: 0, balanceAfter: product.qty,
        description: product.description, group: product.group,
        source: product.source
      });
    }
    await done;
    return {
      added: accepted.map(item => productForUI(item.product)), skipped,
      entryNumber: openingDoc ? openingDoc.docNo : receiptDoc ? receiptDoc.docNo : ""
    };
  }

  async function createDispatch(items, metadata = {}) {
    if (!Array.isArray(items) || !items.length) throw new Error("حداقل یک قلم برای خروج انتخاب کنید.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.destinations, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const ledger = tx.objectStore(STORES.ledger);
    const allProducts = await requestResult(products.getAll());
    const map = new Map(allProducts.map(p => [p.supplyCode, p]));
    const combined = new Map();
    for (const item of items) {
      const code = normalizeCode(item && item.procurementCode);
      const amount = Number(item && item.quantity);
      if (!validSupplyCode(code) || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("کد یا تعداد یکی از اقلام خروج معتبر نیست.");
      combined.set(code, (combined.get(code) || 0) + amount);
    }
    const prepared = [];
    for (const [code, amount] of combined) {
      const product = map.get(code);
      if (!product || product.active === 0) throw new Error("یکی از کالاها وجود ندارد یا غیرفعال است: " + code);
      if (amount > Number(product.qty || 0)) throw new Error("موجودی کالا برای خروج کافی نیست: " + code);
      prepared.push({ product, amount });
    }
    const destinationName = String(metadata.destination || metadata.destinationName || "").trim();
    const destinationSub = String(metadata.destinationSub || "").trim();
    if (!destinationName) throw new Error("محل ارسال الزامی است.");
    const destination = await ensureDestination(tx, destinationName, "");
    const subDestination = destinationSub ? await ensureDestination(tx, destinationSub, destinationName) : null;
    const voucherNo = await nextDocumentNumber(tx.objectStore(STORES.meta), "voucher");
    const doc = await createDocument(tx, "issue", {
      destinationId: subDestination ? subDestination.id : destination.id,
      destinationName, destinationSub, voucherNo,
      dispatchRef: metadata.dispatchRef || "",
      note: metadata.note || ""
    });
    const actualItems = [];
    for (const { product, amount } of prepared) {
      const before = Number(product.qty) || 0;
      product.qty = before - amount;
      products.put(product);
      ledger.add({
        docId: doc.id, supplyCode: product.supplyCode, delta: -amount,
        type: "issue", docDate: doc.docDate, balanceBefore: before,
        balanceAfter: product.qty, description: product.description, group: product.group
      });
      actualItems.push({
        procurementCode: product.supplyCode, internalCode: product.procurementCode,
        description: product.description, group: product.group,
        quantity: amount, stockAfter: product.qty
      });
    }
    await done;
    return {
      id: doc.id, items: actualItems, exitNumber: doc.docNo,
      voucherNumber: doc.voucherNo || doc.dispatchRef, createdAt: new Date(doc.createdAt).toISOString(),
      destination: destinationName, destinationSub
    };
  }

  async function createReceipt(items, metadata = {}) {
    if (!Array.isArray(items) || !items.length) throw new Error("حداقل یک قلم برای ورود انتخاب کنید.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const allProducts = await requestResult(products.getAll());
    const map = new Map(allProducts.map(p => [p.supplyCode, p]));
    const combined = new Map();
    for (const item of items) {
      const code = normalizeCode(item && item.procurementCode);
      const amount = Number(item && item.quantity);
      if (!validSupplyCode(code) || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("کد یا تعداد یکی از اقلام ورود معتبر نیست.");
      combined.set(code, (combined.get(code) || 0) + amount);
    }
    const prepared = [];
    for (const [code, amount] of combined) {
      const product = map.get(code);
      if (!product || product.active === 0) throw new Error("یکی از کالاها وجود ندارد یا غیرفعال است: " + code);
      prepared.push({ product, amount });
    }
    const doc = await createDocument(tx, "receipt", { note: metadata.note || "ورود کالا", opId: metadata.opId });
    const actualItems = [];
    for (const { product, amount } of prepared) {
      const before = Number(product.qty) || 0;
      product.qty = before + amount;
      products.put(product);
      tx.objectStore(STORES.ledger).add({
        docId: doc.id, supplyCode: product.supplyCode, delta: amount,
        type: "receipt", docDate: doc.docDate, balanceBefore: before,
        balanceAfter: product.qty, description: product.description, group: product.group,
        source: metadata.source || "receipt"
      });
      actualItems.push({ procurementCode: product.supplyCode, internalCode: product.procurementCode,
        description: product.description, group: product.group, quantity: amount, stockAfter: product.qty });
    }
    await done;
    return { id: doc.id, entryNumber: doc.docNo, items: actualItems, createdAt: new Date(doc.createdAt).toISOString() };
  }

  async function reverseDocument(documentId, options = {}) {
    const id = Number(documentId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("شناسه سند معتبر نیست.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const documents = tx.objectStore(STORES.documents);
    const original = await requestResult(documents.get(id));
    if (!original) throw new Error("سند موردنظر پیدا نشد.");
    if (original.status !== "active") throw new Error("این سند قبلاً معکوس یا غیرفعال شده است.");
    const originalLines = await requestResult(tx.objectStore(STORES.ledger).index("docId").getAll(id));
    if (!originalLines.length) throw new Error("برای این سند گردش قابل معکوس‌سازی وجود ندارد.");
    const products = tx.objectStore(STORES.products);
    const prepared = [];
    for (const line of originalLines) {
      const product = await requestResult(products.get(line.supplyCode));
      if (!product) throw new Error("کالای متناظر با یکی از اقلام سند پیدا نشد: " + line.supplyCode);
      const before = Number(product.qty) || 0;
      const delta = -Number(line.delta || 0);
      if (before + delta < 0) throw new Error("معکوس‌سازی باعث موجودی منفی می‌شود؛ ابتدا خروج‌های وابسته را معکوس کنید.");
      prepared.push({ line, product, before, delta });
    }
    const reversal = await createDocument(tx, "reversal", {
      note: options.note || "معکوس‌سازی سند " + original.docNo,
      reversalOf: original.id,
      opId: options.opId
    });
    for (const item of prepared) {
      item.product.qty = item.before + item.delta;
      products.put(item.product);
      tx.objectStore(STORES.ledger).add({
        docId: reversal.id, supplyCode: item.line.supplyCode, delta: item.delta,
        type: "reversal", docDate: reversal.docDate,
        balanceBefore: item.before, balanceAfter: item.product.qty,
        description: item.line.description || item.product.description,
        group: item.line.group || item.product.group,
        source: "reversal"
      });
    }
    original.status = "reversed";
    documents.put(original);
    await done;
    return { id: reversal.id, reversalNumber: reversal.docNo, reversalOf: original.id };
  }

  async function readLedgerAndDocuments() {
    const db = await ready();
    const tx = db.transaction([STORES.ledger, STORES.documents, STORES.products], "readonly");
    const done = transactionDone(tx);
    const [lines, documents, products] = await Promise.all([
      requestResult(tx.objectStore(STORES.ledger).getAll()),
      requestResult(tx.objectStore(STORES.documents).getAll()),
      requestResult(tx.objectStore(STORES.products).getAll())
    ]);
    await done;
    const docs = new Map(documents.map(d => [d.id, d]));
    const productMap = new Map(products.map(p => [p.supplyCode, p]));
    return { lines, documents, docs, products, productMap };
  }

  async function getAllTransactions() {
    const data = await readLedgerAndDocuments();
    return data.lines.map(line => movementForUI(line, data.docs.get(line.docId) || {}, data.productMap.get(line.supplyCode)))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
  }

  async function getKardex(procurementCode) {
    const code = normalizeCode(procurementCode);
    const records = await getAllTransactions();
    return records.filter(row => row.procurementCode === code)
      .sort((a, b) => Number(a.docDate) - Number(b.docDate) || a.id - b.id);
  }

  async function getReportTransactions(startDate, endDate) {
    const start = Date.parse(startDate);
    const end = Date.parse(endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error("بازه زمانی گزارش معتبر نیست.");
    return (await getAllTransactions()).filter(row => {
      const time = Date.parse(row.occurredAt);
      return Number.isFinite(time) && time >= start && time <= end;
    }).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  }

  async function getAllDispatches() {
    const data = await readLedgerAndDocuments();
    return data.documents.filter(d => d.type === "issue").map(doc => ({
      ...doc,
      exitNumber: doc.docNo,
      voucherNumber: doc.voucherNo || doc.dispatchRef || "",
      createdAt: new Date(doc.createdAt).toISOString(),
      destination: doc.destinationName || "",
      destinationSub: doc.destinationSub || "",
      items: data.lines.filter(line => line.docId === doc.id).map(line => ({
        procurementCode: line.supplyCode,
        internalCode: line.supplyCode.slice(0, 8),
        description: line.description || "",
        group: line.group || "",
        quantity: Math.abs(line.delta),
        stockAfter: line.balanceAfter
      }))
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function adjustStock(procurementCode, newQuantity) {
    const code = normalizeCode(procurementCode);
    const quantity = Number(newQuantity);
    if (!validSupplyCode(code)) throw new Error("کد تدارکاتی کالا معتبر نیست.");
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("موجودی جدید باید عدد صحیح و صفر یا بیشتر باشد.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const product = await requestResult(products.get(code));
    if (!product || product.active === 0) throw new Error("کالای انتخاب‌شده در موجودی پیدا نشد.");
    const previous = Number(product.qty) || 0;
    const difference = quantity - previous;
    if (!difference) {
      tx.abort();
      try { await done; } catch (_) {}
      return { changed: false, product: productForUI(product), previous, quantity };
    }
    const doc = await createDocument(tx, "adjust", { note: "تعدیل موجودی" });
    product.qty = quantity;
    products.put(product);
    tx.objectStore(STORES.ledger).add({
      docId: doc.id, supplyCode: code, delta: difference,
      type: "adjust", docDate: doc.docDate,
      balanceBefore: previous, balanceAfter: quantity,
      description: product.description, group: product.group
    });
    await done;
    return {
      changed: true, operation: difference > 0 ? "تعدیل مثبت" : "تعدیل منفی",
      difference: Math.abs(difference), adjustmentNumber: doc.docNo,
      previous, quantity, product: productForUI(product)
    };
  }

  async function deleteProduct(procurementCode) {
    const code = normalizeCode(procurementCode);
    if (!validSupplyCode(code)) throw new Error("کد تدارکاتی کالا معتبر نیست.");
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.ledger, STORES.documents, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const product = await requestResult(products.get(code));
    if (!product) {
      tx.abort();
      try { await done; } catch (_) {}
      return false;
    }
    const history = await requestResult(tx.objectStore(STORES.ledger).index("supplyCode_docDate_id")
      .getAll(IDBKeyRange.bound([code, 0, 0], [code, 99999999, Number.MAX_SAFE_INTEGER])));
    if (history.length) {
      const previous = Number(product.qty) || 0;
      if (previous > 0) {
        const doc = await createDocument(tx, "adjust", { note: "تخلیه موجودی پیش از غیرفعال‌سازی کالا" });
        tx.objectStore(STORES.ledger).add({
          docId: doc.id, supplyCode: code, delta: -previous,
          type: "adjust", docDate: doc.docDate, balanceBefore: previous,
          balanceAfter: 0, description: product.description, group: product.group,
          source: "product-deactivation"
        });
      }
      product.qty = 0;
      product.active = 0;
      products.put(product);
    } else products.delete(code);
    await done;
    return true;
  }

  async function deleteAllProducts() {
    const db = await ready();
    const tx = db.transaction([STORES.products, STORES.documents, STORES.ledger, STORES.meta], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORES.products);
    const rows = await requestResult(products.getAll());
    for (const product of rows) {
      const previous = Number(product.qty) || 0;
      if (previous > 0) {
        const doc = await createDocument(tx, "adjust", { note: "غیرفعال‌سازی گروهی کالا" });
        tx.objectStore(STORES.ledger).add({
          docId: doc.id, supplyCode: product.supplyCode, delta: -previous,
          type: "adjust", docDate: doc.docDate, balanceBefore: previous,
          balanceAfter: 0, description: product.description, group: product.group
        });
      }
      product.qty = 0;
      product.active = 0;
      products.put(product);
    }
    await done;
    return rows.length;
  }

  window.ControlDB = Object.freeze({
    getAll, addMany, createReceipt, createDispatch, reverseDocument, getKardex, getReportTransactions,
    getAllTransactions, getAllDispatches, deleteProduct, deleteAllProducts, adjustStock
  });
})();