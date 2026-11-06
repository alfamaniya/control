(() => {
  "use strict";
  const root = document.getElementById("dashboard");
  if (!root) return;
  const $ = (selector) => root.querySelector(selector);
  const faNumber = (value) => new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
  const faDate = (date, options = {}) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", options).format(date);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
  const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const setText = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };

  function updateClock() {
    const now = new Date();
    setText("[data-clock]", now.toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }));
    setText("[data-today]", faDate(now, { weekday:"long", year:"numeric", month:"long", day:"numeric" }));
  }

  function renderChart(records) {
    const days = Array.from({ length:7 }, (_, index) => {
      const date = dayStart(new Date());
      date.setDate(date.getDate() - (6 - index));
      return { date, key: date.toDateString(), incoming:0, outgoing:0 };
    });
    const map = new Map(days.map(day => [day.key, day]));
    records.forEach(record => {
      const date = new Date(record.occurredAt);
      const bucket = map.get(dayStart(date).toDateString());
      if (!bucket) return;
      const quantity = Math.max(0, Number(record.quantity) || 0);
      if (record.operation === "ورود" || record.operation === "تعدیل مثبت") bucket.incoming += quantity;
      else if (record.operation === "خروج" || record.operation === "تعدیل منفی") bucket.outgoing += quantity;
    });
    const max = Math.max(1, ...days.flatMap(day => [day.incoming, day.outgoing]));
    const chart = $("[data-flow-chart]");
    chart.innerHTML = days.map(day => {
      const inHeight = Math.max(3, Math.round(day.incoming / max * 128));
      const outHeight = Math.max(3, Math.round(day.outgoing / max * 128));
      return '<div class="flow-day"><div class="flow-bars" title="ورود: ' + faNumber(day.incoming) + '، خروج: ' + faNumber(day.outgoing) + '"><span class="flow-bar in" style="height:' + (day.incoming ? inHeight : 3) + 'px"></span><span class="flow-bar out" style="height:' + (day.outgoing ? outHeight : 3) + 'px"></span></div><span class="flow-day-label">' + faDate(day.date,{day:"numeric",month:"short"}) + '</span></div>';
    }).join("");
    setText("[data-in-week]", faNumber(days.reduce((sum, day) => sum + day.incoming, 0)));
    setText("[data-out-week]", faNumber(days.reduce((sum, day) => sum + day.outgoing, 0)));
  }

  function renderActivity(records, products) {
    const productMap = new Map(products.map(item => [String(item.procurementCode), item]));
    const list = $("[data-activity-list]");
    const recent = [...records].sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0,6);
    if (!recent.length) {
      list.innerHTML = '<div class="activity-empty">در بازه هفت روز اخیر تراکنشی ثبت نشده است.</div>';
      return;
    }
    list.innerHTML = recent.map(record => {
      const product = productMap.get(String(record.procurementCode));
      const isIn = record.operation === "ورود" || record.operation === "تعدیل مثبت";
      const isOut = record.operation === "خروج" || record.operation === "تعدیل منفی";
      const type = isIn ? "in" : isOut ? "out" : "other";
      const symbol = isIn ? "↓" : isOut ? "↑" : "•";
      const qty = isIn ? record.quantity : record.quantity;
      const date = new Date(record.occurredAt);
      return '<div class="activity-row"><span class="activity-symbol ' + type + '">' + symbol + '</span><div><div class="activity-name">' + escapeHtml(record.description || (product && product.description) || "کالای بدون شرح") + '</div><div class="activity-meta">' + escapeHtml(record.operation || "عملیات") + ' · ' + faDate(date,{day:"numeric",month:"short"}) + '، ' + date.toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"}) + '</div></div><b class="activity-qty">' + faNumber(qty) + '</b></div>';
    }).join("");
  }

  function renderStock(products) {
    const total = products.length;
    const empty = products.filter(item => Number(item.quantity) <= 0).length;
    const low = products.filter(item => Number(item.quantity) > 0 && Number(item.quantity) <= 5).length;
    const healthy = Math.max(0, total - empty - low);
    const pct = (value) => total ? value / total * 100 : 0;
    setText("[data-product-count]", faNumber(total));
    setText("[data-stock-total]", faNumber(products.reduce((sum,item) => sum + Math.max(0,Number(item.quantity)||0),0)));
    setText("[data-stock-healthy]", faNumber(healthy));
    setText("[data-stock-low]", faNumber(low));
    setText("[data-stock-empty]", faNumber(empty));
    $("[data-stock-healthy-bar]").style.width = pct(healthy) + "%";
    $("[data-stock-low-bar]").style.width = pct(low) + "%";
    $("[data-stock-empty-bar]").style.width = pct(empty) + "%";

    const alerts = products.filter(item => Number(item.quantity) <= 5).sort((a,b) => Number(a.quantity)-Number(b.quantity)).slice(0,5);
    const alertList = $("[data-alert-list]");
    if (!alerts.length) {
      alertList.innerHTML = '<div class="alert-empty"><span>✓</span> در حال حاضر کالایی با موجودی ۵ عدد یا کمتر وجود ندارد.</div>';
    } else {
      alertList.innerHTML = alerts.map(item => '<div class="alert-row"><i class="alert-mark"></i><div><strong>' + escapeHtml(item.description || "کالای بدون شرح") + '</strong><small>کد ' + escapeHtml(item.procurementCode) + ' · موجودی: ' + faNumber(item.quantity) + '</small></div></div>').join("");
    }
  }

  async function loadDashboard() {
    const refresh = $("[data-refresh]");
    refresh.disabled = true;
    refresh.textContent = "در حال به‌روزرسانی…";
    setText("[data-db-state]", "در حال خواندن داده‌های محلی");
    try {
      if (!window.ControlDB) throw new Error("لایه پایگاه داده محلی بارگذاری نشده است.");
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
      const [products, transactions, dispatches] = await Promise.all([
        window.ControlDB.getAll(),
        window.ControlDB.getReportTransactions(start.toISOString(), now.toISOString()),
        window.ControlDB.getAllDispatches()
      ]);
      const inbound = transactions.filter(item => item.operation === "ورود" || item.operation === "تعدیل مثبت").reduce((sum,item)=>sum+Number(item.quantity||0),0);
      const outbound = transactions.filter(item => item.operation === "خروج" || item.operation === "تعدیل منفی").reduce((sum,item)=>sum+Number(item.quantity||0),0);
      setText("[data-in-count]", faNumber(inbound));
      setText("[data-out-count]", faNumber(outbound));
      setText("[data-dispatch-count]", faNumber(dispatches.length));
      renderStock(products);
      renderChart(transactions);
      renderActivity(transactions, products);
      setText("[data-last-update]", "آخرین به‌روزرسانی: " + new Date().toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"}));
      setText("[data-db-state]", "اتصال محلی برقرار · داده‌ها از IndexedDB");
      $("[data-dashboard-error]").hidden = true;
    } catch (error) {
      const box = $("[data-dashboard-error]");
      box.hidden = false;
      box.textContent = error && error.message ? error.message : "خواندن اطلاعات داشبورد ناموفق بود.";
      setText("[data-db-state]", "خواندن داده‌ها ناموفق بود");
    } finally {
      refresh.disabled = false;
      refresh.textContent = "↻ به‌روزرسانی";
    }
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  $("[data-refresh]").addEventListener("click", loadDashboard);
  loadDashboard();
})();