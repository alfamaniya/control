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
    const existingKeys = await new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(new Set(request.result.map(String)));
      request.onerror = () => reject(request.error || new Error("بررسی کالاهای تکراری انجام نشد."));
    });
    const added = [];
    const skipped = [];
    for (const item of items) {
      const code = String(item && item.procurementCode || "");
      if (!/^\d{10}$/.test(code) || existingKeys.has(code)) { skipped.push(item); continue; }
      const record = { ...item, procurementCode: code, internalCode: code.slice(0, 8), createdAt: item.createdAt || new Date().toISOString() };
      store.add(record);
      kardexStore.add({
        procurementCode: code,
        operation: "ورود",
        quantityIn: Math.max(0, Number(record.quantity) || 0),
        quantityOut: 0,
        stockAfter: Math.max(0, Number(record.quantity) || 0),
        occurredAt: new Date().toISOString(),
        source: record.source || "initial-import"
      });
      existingKeys.add(code);
      added.push(record);
    }
    await done;
    return { added, skipped };
  }

  async function createDispatch(items, metadata) {
    const db = await ready();
    const tx = db.transaction([STORE, DISPATCHES, KARDEX], "readwrite");
    const done = transactionDone(tx);
    const productStore = tx.objectStore(STORE);
    const dispatchStore = tx.objectStore(DISPATCHES);
    const kardexStore = tx.objectStore(KARDEX);
    const products = await new Promise((resolve, reject) => {
      const request = productStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("بررسی موجودی کالاها ناموفق بود."));
    });
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
    const createdAt = new Date().toISOString();
    const dispatch = { ...metadata, items: actualItems, createdAt };
    const dispatchId = await new Promise((resolve, reject) => {
      const request = dispatchStore.add(dispatch);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("ثبت سابقه ارسال ناموفق بود."));
    });
    actualItems.forEach(item => {
      kardexStore.add({
        dispatchId,
        procurementCode: item.procurementCode,
        operation: "خروج",
        quantityIn: 0,
        quantityOut: item.quantity,
        stockAfter: item.stockAfter,
        occurredAt: createdAt,
        source: "dispatch"
      });
    });
    await done;
    return { id: dispatchId, items: actualItems };
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
          source: "legacy-dispatch"
        });
      });
    });
    return movements.filter(item => String(item.procurementCode) === code)
      .concat(legacyDispatchMovements)
      .sort((a, b) => {
        const timeA = Date.parse(a.occurredAt || "");
        const timeB = Date.parse(b.occurredAt || "");
        if (!Number.isFinite(timeA)) return Number.isFinite(timeB) ? 1 : 0;
        if (!Number.isFinite(timeB)) return -1;
        return timeA - timeB;
      });
  }


  async function deleteProduct(procurementCode) {
    const code = String(procurementCode || "");
    if (!/^\\d{10}$/.test(code)) throw new Error("کد تدارکاتی کالا معتبر نیست.");
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

  async function deleteAllProducts() {
    const db = await ready();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const count = await new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error("شمارش کالاها ناموفق بود."));
    });
    store.clear();
    await done;
    return count;
  }

  window.ControlDB = Object.freeze({ getAll, addMany, createDispatch, getKardex, deleteProduct, deleteAllProducts });
})();
