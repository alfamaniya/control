(() => {
  "use strict";

  const DB_NAME = "control-offline-db";
  const DB_VERSION = 3;
  const STORE = "products";
  const META = "meta";
  const DISPATCHES = "dispatches";
  const KARDEX = "kardex";
  const LEGACY_KEY = "control.inventory.v1";
  let databasePromise;

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
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "procurementCode" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
        if (!db.objectStoreNames.contains(DISPATCHES)) db.createObjectStore(DISPATCHES, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(KARDEX)) db.createObjectStore(KARDEX, { keyPath: "id", autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("باز کردن پایگاه داده محلی ناموفق بود."));
      request.onblocked = () => reject(new Error("پایگاه داده توسط زبانه دیگری در حال به‌روزرسانی است. سایر زبانه‌های سامانه را ببندید."));
    });
    return databasePromise;
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("ذخیره اطلاعات انجام نشد."));
      transaction.onabort = () => reject(transaction.error || new Error("عملیات ذخیره‌سازی لغو شد."));
    });
  }

  function createDocumentNumber(prefix, usedNumbers, baseDate = new Date()) {
    let candidateDate = new Date(baseDate.getTime());
    const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    });
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(candidateDate).map(part => [part.type, part.value]));
      const pad = value => String(value).padStart(2, "0");
      const number = prefix + String(parts.year).padStart(4, "0") +
        pad(parts.month) + pad(parts.day) + pad(parts.hour) + pad(parts.minute) + pad(parts.second);
      if (!usedNumbers.has(number)) return number;
      candidateDate = new Date(candidateDate.getTime() + 1000);
    }
    throw new Error("ساخت شماره سند یکتا انجام نشد؛ دوباره تلاش کنید.");
  }

  function createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, operation, baseDate = new Date()) {
    const transactionNumber = createDocumentNumber("tr", usedTransactionNumbers, baseDate);
    usedTransactionNumbers.add(transactionNumber);
    let adjustmentNumber = "";
    if (operation === "تعدیل مثبت" || operation === "تعدیل منفی") {
      const prefix = operation === "تعدیل مثبت" ? "adjp" : "adjn";
      adjustmentNumber = createDocumentNumber(prefix, usedAdjustmentNumbers, baseDate);
      usedAdjustmentNumbers.add(adjustmentNumber);
    }
    return { transactionNumber, adjustmentNumber };
  }

  async function backfillMovementNumbers(db) {
    const tx = db.transaction([KARDEX, META], "readwrite");
    const done = transactionDone(tx);
    const history = tx.objectStore(KARDEX);
    const meta = tx.objectStore(META);
    const [marker, movements] = await Promise.all([
      new Promise((resolve, reject) => {
        const request = meta.get("movement-numbers-backfilled-v1");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("بررسی وضعیت شماره‌گذاری سوابق ناموفق بود."));
      }),
      new Promise((resolve, reject) => {
        const request = history.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error("خواندن سوابق برای شماره‌گذاری ناموفق بود."));
      })
    ]);
    if (!marker) {
      const usedTransactionNumbers = new Set(movements.map(item => String(item.transactionNumber || "")).filter(Boolean));
      const usedAdjustmentNumbers = new Set(movements.map(item => String(item.adjustmentNumber || "")).filter(Boolean));
      movements.forEach(movement => {
        if (movement.transactionNumber && (movement.operation !== "تعدیل مثبت" && movement.operation !== "تعدیل منفی" || movement.adjustmentNumber)) return;
        const numbers = createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, movement.operation || "");
        history.put({ ...movement, ...numbers });
      });
      meta.put({ key: "movement-numbers-backfilled-v1", value: true, migratedAt: new Date().toISOString() });
    }
    await done;
  }

  async function migrateLegacyData(db) {
    let legacy = [];
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      legacy = raw ? JSON.parse(raw) : [];
    } catch (_) { legacy = []; }
    if (!Array.isArray(legacy)) legacy = [];

    const tx = db.transaction([STORE, META], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORE);
    const marker = tx.objectStore(META);
    const migration = await new Promise((resolve, reject) => {
      const request = marker.get("legacy-local-storage-migrated");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!migration) {
      legacy.forEach(item => {
        if (item && /^\d{10}$/.test(String(item.procurementCode || ""))) {
          products.put({ ...item, internalCode: String(item.procurementCode).slice(0, 8), migratedAt: new Date().toISOString() });
        }
      });
      marker.put({ key: "legacy-local-storage-migrated", value: true, migratedAt: new Date().toISOString() });
    }
    await done;
  }

  async function ready() {
    const db = await openDatabase();
    await migrateLegacyData(db);
    await backfillMovementNumbers(db);
    return db;
  }

  async function getAll() {
    const db = await ready();
    const tx = db.transaction(STORE, "readonly");
    const done = transactionDone(tx);
    const request = tx.objectStore(STORE).getAll();
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("خواندن موجودی انجام نشد."));
    });
    await done;
    return result.sort((a, b) => String(a.procurementCode).localeCompare(String(b.procurementCode)));
  }

  async function addMany(items) {
    const db = await ready();
    const tx = db.transaction([STORE, KARDEX], "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const kardexStore = tx.objectStore(KARDEX);
    const keysRequest = store.getAllKeys();
    const movementsRequest = kardexStore.getAll();
    const [keys, existingMovements] = await Promise.all([
      new Promise((resolve, reject) => {
        keysRequest.onsuccess = () => resolve(keysRequest.result || []);
        keysRequest.onerror = () => reject(keysRequest.error || new Error("بررسی کالاهای تکراری انجام نشد."));
      }),
      new Promise((resolve, reject) => {
        movementsRequest.onsuccess = () => resolve(movementsRequest.result || []);
        movementsRequest.onerror = () => reject(movementsRequest.error || new Error("بررسی شماره‌های ورود قبلی انجام نشد."));
      })
    ]);
    const existingKeys = new Set(keys.map(String));
    const usedEntryNumbers = new Set(existingMovements.map(item =>
      String(item.entryNumber || item.incomingNumber || item.receiptNumber || "")
    ).filter(Boolean));
    const usedTransactionNumbers = new Set(existingMovements.map(item => String(item.transactionNumber || "")).filter(Boolean));
    const usedAdjustmentNumbers = new Set(existingMovements.map(item => String(item.adjustmentNumber || "")).filter(Boolean));
    const registeredAt = new Date();
    const entryNumber = createDocumentNumber("in", usedEntryNumbers, registeredAt);
    const occurredAt = registeredAt.toISOString();
    const added = [];
    const skipped = [];
    for (const item of items) {
      const code = String(item && item.procurementCode || "");
      if (!/^\d{10}$/.test(code) || existingKeys.has(code)) { skipped.push(item); continue; }
      const record = { ...item, procurementCode: code, internalCode: code.slice(0, 8), createdAt: item.createdAt || new Date().toISOString() };
      store.add(record);
      const movementNumbers = createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, "ورود", registeredAt);
      kardexStore.add({
        ...movementNumbers,
        procurementCode: code,
        operation: "ورود",
        description: record.description || "",
        quantityIn: Math.max(0, Number(record.quantity) || 0),
        quantityOut: 0,
        stockAfter: Math.max(0, Number(record.quantity) || 0),
        entryNumber,
        occurredAt,
        source: record.source || "initial-import"
      });
      existingKeys.add(code);
      added.push(record);
    }
    await done;
    return { added, skipped, entryNumber: added.length ? entryNumber : "" };
  }

  async function createDispatch(items, metadata) {
    const db = await ready();
    const tx = db.transaction([STORE, DISPATCHES, KARDEX], "readwrite");
    const done = transactionDone(tx);
    const productStore = tx.objectStore(STORE);
    const dispatchStore = tx.objectStore(DISPATCHES);
    const kardexStore = tx.objectStore(KARDEX);
    const productsRequest = productStore.getAll();
    const dispatchesRequest = dispatchStore.getAll();
    const movementsRequest = kardexStore.getAll();
    const [products, existingDispatches, existingMovements] = await Promise.all([
      new Promise((resolve, reject) => {
        productsRequest.onsuccess = () => resolve(productsRequest.result || []);
        productsRequest.onerror = () => reject(productsRequest.error || new Error("بررسی موجودی کالاها ناموفق بود."));
      }),
      new Promise((resolve, reject) => {
        dispatchesRequest.onsuccess = () => resolve(dispatchesRequest.result || []);
        dispatchesRequest.onerror = () => reject(dispatchesRequest.error || new Error("بررسی شماره خروج و حواله‌های قبلی ناموفق بود."));
      }),
      new Promise((resolve, reject) => {
        movementsRequest.onsuccess = () => resolve(movementsRequest.result || []);
        movementsRequest.onerror = () => reject(movementsRequest.error || new Error("بررسی سوابق شماره اسناد ناموفق بود."));
      })
    ]);
    const productMap = new Map(products.map(product => [String(product.procurementCode), product]));
    const actualItems = [];
    for (const requested of items) {
      const code = String(requested.procurementCode || "");
      const product = productMap.get(code);
      if (!product) continue;
      const stock = Math.max(0, Number(product.quantity) || 0);
      const quantity = Math.min(stock, Math.max(0, Math.floor(Number(requested.quantity) || 0)));
      if (!quantity) continue;
      product.quantity = stock - quantity;
      productStore.put(product);
      actualItems.push({
        internalCode: code.slice(0, 8),
        procurementCode: code,
        description: product.description || requested.description || "",
        group: product.group || requested.group || "",
        quantity,
        stockAfter: product.quantity
      });
    }
    if (!actualItems.length) {
      tx.abort();
      try { await done; } catch (_) { /* لغو عمدی تراکنش */ }
      throw new Error("هیچ‌یک از کالاهای انتخاب‌شده موجودی قابل ارسال ندارند. فهرست را بررسی کنید.");
    }
    const registeredAt = new Date();
    const createdAt = registeredAt.toISOString();
    const usedExitNumbers = new Set([
      ...existingDispatches.map(item => String(item.exitNumber || "")),
      ...existingMovements.map(item => String(item.exitNumber || ""))
    ].filter(Boolean));
    const usedVoucherNumbers = new Set([
      ...existingDispatches.map(item => String(item.voucherNumber || "")),
      ...existingMovements.map(item => String(item.voucherNumber || ""))
    ].filter(Boolean));
    const exitNumber = createDocumentNumber("out", usedExitNumbers, registeredAt);
    const voucherNumber = createDocumentNumber("vh", usedVoucherNumbers, registeredAt);
    const dispatch = { ...metadata, exitNumber, voucherNumber, items: actualItems, createdAt };
    const usedTransactionNumbers = new Set(existingMovements.map(item => String(item.transactionNumber || "")).filter(Boolean));
    const usedAdjustmentNumbers = new Set(existingMovements.map(item => String(item.adjustmentNumber || "")).filter(Boolean));
    const dispatchId = await new Promise((resolve, reject) => {
      const request = dispatchStore.add(dispatch);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("ثبت سابقه ارسال ناموفق بود."));
    });
    actualItems.forEach(item => {
      const movementNumbers = createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, "خروج", registeredAt);
      kardexStore.add({
        ...movementNumbers,
        dispatchId,
        procurementCode: item.procurementCode,
        operation: "خروج",
        quantityIn: 0,
        quantityOut: item.quantity,
        stockAfter: item.stockAfter,
        exitNumber,
        voucherNumber,
        occurredAt: createdAt,
        source: "dispatch"
      });
    });
    await done;
    return { id: dispatchId, items: actualItems, exitNumber, voucherNumber };
  }

  async function getKardex(procurementCode) {
    const db = await ready();
    const tx = db.transaction([KARDEX, DISPATCHES], "readonly");
    const done = transactionDone(tx);
    const kardexRequest = tx.objectStore(KARDEX).getAll();
    const dispatchRequest = tx.objectStore(DISPATCHES).getAll();
    const [movements, dispatches] = await Promise.all([
      new Promise((resolve, reject) => {
        kardexRequest.onsuccess = () => resolve(kardexRequest.result || []);
        kardexRequest.onerror = () => reject(kardexRequest.error || new Error("خواندن سوابق کاردکس ناموفق بود."));
      }),
      new Promise((resolve, reject) => {
        dispatchRequest.onsuccess = () => resolve(dispatchRequest.result || []);
        dispatchRequest.onerror = () => reject(dispatchRequest.error || new Error("خواندن سوابق ارسال ناموفق بود."));
      })
    ]);
    await done;
    const code = String(procurementCode);
    const dispatchMap = new Map(dispatches.map(dispatch => [String(dispatch.id), dispatch]));
    const enrichedMovements = movements.map(item => {
      const dispatch = item.dispatchId === undefined ? null : dispatchMap.get(String(item.dispatchId));
      return {
        ...item,
        entryNumber: item.entryNumber || item.incomingNumber || item.receiptNumber || "",
        exitNumber: item.exitNumber || (dispatch && dispatch.exitNumber) || "",
        voucherNumber: item.voucherNumber || (dispatch && dispatch.voucherNumber) || ""
      };
    });
    const knownDispatchIds = new Set(movements.map(item => item.dispatchId).filter(value => value !== undefined));
    const legacyDispatchMovements = [];
    dispatches.forEach(dispatch => {
      if (knownDispatchIds.has(dispatch.id)) return;
      (dispatch.items || []).forEach(item => {
        if (String(item.procurementCode) !== code) return;
        legacyDispatchMovements.push({
          procurementCode: code,
          operation: "خروج",
          quantityIn: 0,
          quantityOut: Math.max(0, Number(item.quantity) || 0),
          stockAfter: null,
          occurredAt: dispatch.createdAt || dispatch.dispatchedAt || "",
          source: "legacy-dispatch",
          exitNumber: dispatch.exitNumber || "",
          voucherNumber: dispatch.voucherNumber || ""
        });
      });
    });
    return enrichedMovements.filter(item => String(item.procurementCode) === code)
      .concat(legacyDispatchMovements)
      .sort((a, b) => {
        const timeA = Date.parse(a.occurredAt || "");
        const timeB = Date.parse(b.occurredAt || "");
        if (!Number.isFinite(timeA)) return Number.isFinite(timeB) ? 1 : 0;
        if (!Number.isFinite(timeB)) return -1;
        return timeA - timeB;
      });
  }

  async function getReportTransactions(startDate, endDate) {
    const start = Date.parse(startDate);
    const end = Date.parse(endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      throw new Error("بازه زمانی گزارش معتبر نیست.");
    }
    const db = await ready();
    const tx = db.transaction([KARDEX, DISPATCHES, STORE], "readonly");
    const done = transactionDone(tx);
    const requests = [
      tx.objectStore(KARDEX).getAll(),
      tx.objectStore(DISPATCHES).getAll(),
      tx.objectStore(STORE).getAll()
    ];
    const [movements, dispatches, products] = await Promise.all(requests.map(request => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("خواندن اطلاعات گزارش ناموفق بود."));
    })));
    await done;

    const productMap = new Map(products.map(product => [String(product.procurementCode), product]));
    const dispatchMap = new Map(dispatches.map(dispatch => [String(dispatch.id), dispatch]));
    const knownDispatchIds = new Set(movements.map(item => item.dispatchId).filter(value => value !== undefined));
    const records = movements.map(movement => {
      const dispatch = movement.dispatchId === undefined ? null : dispatchMap.get(String(movement.dispatchId));
      const dispatchItem = dispatch && (dispatch.items || []).find(item => String(item.procurementCode) === String(movement.procurementCode));
      const product = productMap.get(String(movement.procurementCode));
      const occurredAt = movement.occurredAt || (dispatch && (dispatch.createdAt || dispatch.dispatchedAt)) || "";
      return {
        occurredAt,
        transactionNumber: movement.transactionNumber || "",
        adjustmentNumber: movement.adjustmentNumber || "",
        operation: movement.operation || "",
        procurementCode: String(movement.procurementCode || ""),
        description: movement.description || (dispatchItem && dispatchItem.description) || (product && product.description) || "",
        quantity: Math.max(0, Number(movement.quantityIn) || 0) || Math.max(0, Number(movement.quantityOut) || 0),
        destination: dispatch && (dispatch.destination || dispatch.destinationSub) || "",
        entryNumber: movement.entryNumber || movement.incomingNumber || movement.receiptNumber || "",
        voucherNumber: movement.voucherNumber || (dispatch && dispatch.voucherNumber) || "",
        exitNumber: movement.exitNumber || (dispatch && dispatch.exitNumber) || ""
      };
    });

    dispatches.forEach(dispatch => {
      if (knownDispatchIds.has(dispatch.id)) return;
      (dispatch.items || []).forEach(item => records.push({
        occurredAt: dispatch.createdAt || dispatch.dispatchedAt || "",
        operation: "خروج",
        procurementCode: String(item.procurementCode || ""),
        description: item.description || "",
        quantity: Math.max(0, Number(item.quantity) || 0),
        destination: dispatch.destination || dispatch.destinationSub || "",
        entryNumber: "",
        voucherNumber: dispatch.voucherNumber || "",
        exitNumber: dispatch.exitNumber || ""
      }));
    });

    return records.filter(record => {
      const timestamp = Date.parse(record.occurredAt);
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
    }).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  }

  async function getAllTransactions() {
    const db = await ready();
    const tx = db.transaction([KARDEX, DISPATCHES, STORE], "readonly");
    const done = transactionDone(tx);
    const requests = [
      tx.objectStore(KARDEX).getAll(),
      tx.objectStore(DISPATCHES).getAll(),
      tx.objectStore(STORE).getAll()
    ];
    const [movements, dispatches, products] = await Promise.all(requests.map(request => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("خواندن تراکنش‌های گزارش کلی ناموفق بود."));
    })));
    await done;

    const productMap = new Map(products.map(product => [String(product.procurementCode), product]));
    const dispatchMap = new Map(dispatches.map(dispatch => [String(dispatch.id), dispatch]));
    const knownDispatchIds = new Set(movements.map(item => item.dispatchId).filter(value => value !== undefined));
    const records = movements.map(movement => {
      const dispatch = movement.dispatchId === undefined ? null : dispatchMap.get(String(movement.dispatchId));
      const dispatchItem = dispatch && (dispatch.items || []).find(item => String(item.procurementCode) === String(movement.procurementCode));
      const product = productMap.get(String(movement.procurementCode));
      return {
        ...movement,
        occurredAt: movement.occurredAt || (dispatch && (dispatch.createdAt || dispatch.dispatchedAt)) || "",
        operation: movement.operation || "",
        internalCode: movement.internalCode || (dispatchItem && dispatchItem.internalCode) || (product && product.internalCode) || String(movement.procurementCode || "").slice(0, 8),
        procurementCode: String(movement.procurementCode || ""),
        description: movement.description || (dispatchItem && dispatchItem.description) || (product && product.description) || "",
        group: movement.group || (dispatchItem && dispatchItem.group) || (product && product.group) || "",
        quantity: Math.max(0, Number(movement.quantityIn) || 0) || Math.max(0, Number(movement.quantityOut) || 0),
        destination: movement.destination || (dispatch && dispatch.destination) || "",
        destinationSub: movement.destinationSub || (dispatch && dispatch.destinationSub) || "",
        voucherNumber: movement.voucherNumber || (dispatch && dispatch.voucherNumber) || "",
        exitNumber: movement.exitNumber || (dispatch && dispatch.exitNumber) || "",
        entryNumber: movement.entryNumber || movement.incomingNumber || movement.receiptNumber || "",
        dispatchedAt: movement.dispatchedAt || (dispatch && dispatch.dispatchedAt) || "",
        dispatchId: movement.dispatchId ?? (dispatch && dispatch.id) ?? "",
        source: movement.source || "",
        previousStock: movement.previousStock ?? "",
        stockAfter: movement.stockAfter ?? (dispatchItem && dispatchItem.stockAfter) ?? ""
      };
    });

    dispatches.forEach(dispatch => {
      if (knownDispatchIds.has(dispatch.id)) return;
      (dispatch.items || []).forEach(item => records.push({
        occurredAt: dispatch.createdAt || dispatch.dispatchedAt || "",
        operation: "خروج",
        internalCode: item.internalCode || String(item.procurementCode || "").slice(0, 8),
        procurementCode: String(item.procurementCode || ""),
        description: item.description || "",
        group: item.group || "",
        quantity: Math.max(0, Number(item.quantity) || 0),
        quantityIn: 0,
        quantityOut: Math.max(0, Number(item.quantity) || 0),
        stockAfter: item.stockAfter ?? "",
        destination: dispatch.destination || "",
        destinationSub: dispatch.destinationSub || "",
        voucherNumber: dispatch.voucherNumber || "",
        exitNumber: dispatch.exitNumber || "",
        entryNumber: "",
        dispatchedAt: dispatch.dispatchedAt || "",
        dispatchId: dispatch.id,
        source: "legacy-dispatch",
        previousStock: ""
      }));
    });

    return records.filter(record => Number.isFinite(Date.parse(record.occurredAt)))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        String(a.procurementCode).localeCompare(String(b.procurementCode), "en"));
  }

  async function getAllDispatches() {
    const db = await ready();
    const tx = db.transaction(DISPATCHES, "readonly");
    const done = transactionDone(tx);
    const request = tx.objectStore(DISPATCHES).getAll();
    const records = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("خواندن حواله‌های ثبت‌شده ناموفق بود."));
    });
    await done;
    return records.sort((a, b) => Date.parse(b.createdAt || b.dispatchedAt || 0) - Date.parse(a.createdAt || a.dispatchedAt || 0));
  }

  async function deleteProduct(procurementCode) {
    const code = String(procurementCode || "");
    if (!/^\d{10}$/.test(code)) throw new Error("کد تدارکاتی کالا معتبر نیست.");
    const db = await ready();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const existing = await new Promise((resolve, reject) => {
      const request = store.get(code);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("بررسی کالای انتخاب‌شده ناموفق بود."));
    });
    if (!existing) {
      tx.abort();
      try { await done; } catch (_) {}
      return false;
    }
    store.delete(code);
    await done;
    return true;
  }

  async function adjustStock(procurementCode, newQuantity) {
    const code = String(procurementCode || "");
    const quantity = Number(newQuantity);
    if (!/^\d{10}$/.test(code)) throw new Error("کد تدارکاتی کالا معتبر نیست.");
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("موجودی جدید باید عدد صحیح و صفر یا بیشتر باشد.");

    const db = await ready();
    const tx = db.transaction([STORE, KARDEX], "readwrite");
    const done = transactionDone(tx);
    const products = tx.objectStore(STORE);
    const history = tx.objectStore(KARDEX);
    const existingMovements = await new Promise((resolve, reject) => {
      const request = history.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("بررسی شماره تراکنش‌ها ناموفق بود."));
    });
    const usedTransactionNumbers = new Set(existingMovements.map(item => String(item.transactionNumber || "")).filter(Boolean));
    const usedAdjustmentNumbers = new Set(existingMovements.map(item => String(item.adjustmentNumber || "")).filter(Boolean));
    const product = await new Promise((resolve, reject) => {
      const request = products.get(code);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("خواندن کالای انتخاب‌شده ناموفق بود."));
    });
    if (!product) {
      tx.abort();
      try { await done; } catch (_) {}
      throw new Error("کالای انتخاب‌شده در موجودی پیدا نشد.");
    }

    const previous = Math.max(0, Number(product.quantity) || 0);
    const difference = quantity - previous;
    if (difference === 0) {
      tx.abort();
      try { await done; } catch (_) {}
      return { changed: false, product, previous, quantity };
    }

    const operation = difference > 0 ? "تعدیل مثبت" : "تعدیل منفی";
    product.quantity = quantity;
    products.put(product);
    const movementNumbers = createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, operation);
    history.add({
      ...movementNumbers,
      procurementCode: code,
      operation,
      description: product.description || "",
      quantityIn: difference > 0 ? difference : 0,
      quantityOut: difference < 0 ? Math.abs(difference) : 0,
      stockAfter: quantity,
      occurredAt: new Date().toISOString(),
      source: "stock-adjustment",
      previousStock: previous
    });
    await done;
    return { changed: true, operation, difference: Math.abs(difference), previous, quantity, product };
  }

  async function deleteAllProducts() {
    const db = await ready();
    const tx = db.transaction([STORE, KARDEX], "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const history = tx.objectStore(KARDEX);
    const products = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("خواندن کالاها برای حذف کلی ناموفق بود."));
    });
    const occurredAt = new Date().toISOString();
    const existingMovements = await new Promise((resolve, reject) => {
      const request = history.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("بررسی شماره تراکنش‌ها ناموفق بود."));
    });
    const usedTransactionNumbers = new Set(existingMovements.map(item => String(item.transactionNumber || "")).filter(Boolean));
    const usedAdjustmentNumbers = new Set(existingMovements.map(item => String(item.adjustmentNumber || "")).filter(Boolean));

    products.forEach(product => {
      const stock = Math.max(0, Number(product.quantity) || 0);
      if (!stock) return;
      const code = String(product.procurementCode || "");
      const movementNumbers = createMovementNumbers(usedTransactionNumbers, usedAdjustmentNumbers, "تعدیل منفی", new Date(occurredAt));
      history.add({
        ...movementNumbers,
        procurementCode: code,
        operation: "تعدیل منفی",
        description: product.description || "",
        quantityIn: 0,
        quantityOut: stock,
        stockAfter: 0,
        occurredAt,
        source: "bulk-product-deletion",
        previousStock: stock
      });
    });

    store.clear();
    await done;
    return products.length;
  }

  window.ControlDB = Object.freeze({ getAll, addMany, createDispatch, getKardex, getReportTransactions, getAllTransactions, getAllDispatches, deleteProduct, deleteAllProducts, adjustStock });
})();
