(() => {
  "use strict";

  const DB_NAME = "control-offline-db";
  const DB_VERSION = 2;
  const STORE = "products";
  const META = "meta";
  const DISPATCHES = "dispatches";
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
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
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
      existingKeys.add(code);
      added.push(record);
    }
    await done;
    return { added, skipped };
  }

  async function createDispatch(items, metadata) {
    const db = await ready();
    const tx = db.transaction([STORE, DISPATCHES], "readwrite");
    const done = transactionDone(tx);
    const productStore = tx.objectStore(STORE);
    const dispatchStore = tx.objectStore(DISPATCHES);
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
        quantity
      });
    }
    if (!actualItems.length) {
      tx.abort();
      throw new Error("هیچ‌یک از کالاهای انتخاب‌شده موجودی قابل ارسال ندارند. فهرست را بررسی کنید.");
    }
    const dispatch = { ...metadata, items: actualItems, createdAt: new Date().toISOString() };
    const dispatchId = await new Promise((resolve, reject) => {
      const request = dispatchStore.add(dispatch);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("ثبت سابقه ارسال ناموفق بود."));
    });
    await done;
    return { id: dispatchId, items: actualItems };
  }

  window.ControlDB = Object.freeze({ getAll, addMany, createDispatch });
})();
