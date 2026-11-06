/**
 * تقویم خورشیدی مشترک پروژه کنترل
 *
 * نحوه استفاده در هر صفحه:
 * 1) فایل را با مسیر صحیح بارگذاری کنید:
 *    <script src="../../assets/js/jalali-calendar.js" defer></script>
 * 2) به ورودی تاریخ ویژگی data-jalali-calendar بدهید:
 *    <input type="text" data-jalali-calendar placeholder="انتخاب تاریخ" readonly>
 *
 * مقدار ورودی با قالب YYYY/MM/DD و ارقام فارسی تنظیم می‌شود.
 * API عمومی: window.JalaliCalendar.init(), .toJalaali(), .toGregorian()
 */
(() => {
  "use strict";

  const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const MONTHS = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
  ];
  const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const pad = (value) => String(value).padStart(2, "0");
  const toFa = (value) => String(value).replace(/\d/g, (d) => DIGITS[Number(d)]);
  const toEn = (value) => String(value).replace(/[۰-۹]/g, (d) => String(DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  const div = (a, b) => Math.floor(a / b);
  const mod = (a, b) => a - Math.floor(a / b) * b;

  function jalCal(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jm, jump, leap, n, i;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error("سال خارج از محدوده تقویم است");
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const g = d2g(jdn);
    let jy = g.gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(g.gy, 3, r.march);
    let k = jdn - jdn1f;
    let jm, jd;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  function toJalaali(date) {
    const gy = date.getFullYear();
    const gm = date.getMonth() + 1;
    const gd = date.getDate();
    return d2j(g2d(gy, gm, gd));
  }

  function toGregorian(jy, jm, jd) {
    const g = d2g(j2d(jy, jm, jd));
    return new Date(g.gy, g.gm - 1, g.gd);
  }

  function monthLength(year, month) {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    const next = j2d(year + 1, 1, 1);
    return next - j2d(year, 12, 1);
  }

  function parseValue(value) {
    const match = toEn(value || "").trim().match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (!match) return null;
    const jy = Number(match[1]), jm = Number(match[2]), jd = Number(match[3]);
    if (jm < 1 || jm > 12 || jd < 1 || jd > monthLength(jy, jm)) return null;
    return { jy, jm, jd };
  }

  function formatDate(date) {
    const j = toJalaali(date);
    return toFa(j.jy + "/" + pad(j.jm) + "/" + pad(j.jd));
  }

  function addStyles() {
    if (document.getElementById("jalali-calendar-styles")) return;
    const style = document.createElement("style");
    style.id = "jalali-calendar-styles";
    style.textContent = `
      .jalali-calendar-popover{position:absolute;z-index:9999;width: min(320px, calc(100vw - 24px));padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 45px rgba(15,35,65,.18);color:#172b4d;font-family:inherit;direction:rtl}
      .jalali-calendar-popover[hidden]{display:none}
      .jalali-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
      .jalali-calendar-title{font-size:14px;font-weight:800;text-align:center;flex:1}
      .jalali-calendar-nav,.jalali-calendar-today,.jalali-calendar-clear{border:0;cursor:pointer;font:inherit}
      .jalali-calendar-nav{width:32px;height:32px;border-radius:9px;background:#f1f5f9;color:#263d5c;font-size:20px}
      .jalali-calendar-nav:hover,.jalali-calendar-today:hover{background:#e2e8f0}
      .jalali-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}
      .jalali-calendar-weekday{padding:5px 0;color:#8492a6;font-size:11px;font-weight:700}
      .jalali-calendar-day{height:34px;border:0;border-radius:9px;background:transparent;color:#263d5c;font:inherit;font-size:12px;cursor:pointer}
      .jalali-calendar-day:hover{background:#e8f7f7;color:#087f83}
      .jalali-calendar-day.is-today{box-shadow:inset 0 0 0 1px #0d9b9b;color:#087f83;font-weight:800}
      .jalali-calendar-day.is-selected{background:#087f83;color:#fff;font-weight:800}
      .jalali-calendar-day:disabled{cursor:default;opacity:.25}
      .jalali-calendar-actions{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f5}
      .jalali-calendar-today,.jalali-calendar-clear{padding:6px 10px;border-radius:8px;background:#f1f5f9;color:#42536b;font-size:11px}
      [data-jalali-calendar]{cursor:pointer}
      [data-jalali-calendar]:focus{outline:2px solid rgba(8,127,131,.28);outline-offset:2px}
    `;
    document.head.appendChild(style);
  }

  function init(root = document) {
    addStyles();
    root.querySelectorAll("[data-jalali-calendar]").forEach((input) => {
      if (input.dataset.jalaliReady === "true") return;
      input.dataset.jalaliReady = "true";
      if (input.tagName === "INPUT") {
        input.readOnly = true;
        input.setAttribute("autocomplete", "off");
        input.setAttribute("aria-haspopup", "dialog");
      }

      const pop = document.createElement("div");
      pop.className = "jalali-calendar-popover";
      pop.hidden = true;
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "انتخاب تاریخ خورشیدی");
      document.body.appendChild(pop);

      let view = parseValue(input.value) || toJalaali(new Date());
      let selected = parseValue(input.value);

      function close() {
        pop.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }

      function position() {
        const rect = input.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - width - 12));
        pop.style.left = left + "px";
        pop.style.top = (rect.bottom + window.scrollY + 8) + "px";
      }

      function render() {
        const firstDay = toGregorian(view.jy, view.jm, 1).getDay();
        const offset = (firstDay + 1) % 7;
        const count = monthLength(view.jy, view.jm);
        const today = toJalaali(new Date());
        pop.innerHTML = "";

        const head = document.createElement("div");
        head.className = "jalali-calendar-head";
        const prev = document.createElement("button");
        prev.type = "button"; prev.className = "jalali-calendar-nav"; prev.textContent = "‹";
        prev.setAttribute("aria-label", "ماه قبل");
        prev.addEventListener("click", () => { view.jm--; if (view.jm < 1) { view.jm = 12; view.jy--; } render(); });
        const title = document.createElement("div");
        title.className = "jalali-calendar-title";
        title.textContent = MONTHS[view.jm - 1] + " " + toFa(view.jy);
        const next = document.createElement("button");
        next.type = "button"; next.className = "jalali-calendar-nav"; next.textContent = "›";
        next.setAttribute("aria-label", "ماه بعد");
        next.addEventListener("click", () => { view.jm++; if (view.jm > 12) { view.jm = 1; view.jy++; } render(); });
        head.append(prev, title, next);
        pop.appendChild(head);

        const grid = document.createElement("div");
        grid.className = "jalali-calendar-grid";
        WEEKDAYS.forEach((day) => {
          const el = document.createElement("div");
          el.className = "jalali-calendar-weekday"; el.textContent = day; grid.appendChild(el);
        });
        for (let i = 0; i < offset; i++) {
          const blank = document.createElement("span"); grid.appendChild(blank);
        }
        for (let day = 1; day <= count; day++) {
          const button = document.createElement("button");
          button.type = "button"; button.className = "jalali-calendar-day";
          button.textContent = toFa(day);
          if (today.jy === view.jy && today.jm === view.jm && today.jd === day) button.classList.add("is-today");
          if (selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day) button.classList.add("is-selected");
          button.addEventListener("click", () => {
            selected = { jy: view.jy, jm: view.jm, jd: day };
            input.value = toFa(view.jy + "/" + pad(view.jm) + "/" + pad(day));
            input.dataset.jalaliDate = view.jy + "/" + pad(view.jm) + "/" + pad(day);
            const gregorian = toGregorian(view.jy, view.jm, day);
            input.dataset.gregorianDate = gregorian.getFullYear() + "-" + pad(gregorian.getMonth() + 1) + "-" + pad(gregorian.getDate());
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new CustomEvent("jalali-date-change", { bubbles: true, detail: { jalali: { ...selected }, gregorian } }));
            close();
          });
          grid.appendChild(button);
        }
        pop.appendChild(grid);

        const actions = document.createElement("div");
        actions.className = "jalali-calendar-actions";
        const todayButton = document.createElement("button");
        todayButton.type = "button"; todayButton.className = "jalali-calendar-today"; todayButton.textContent = "امروز";
        todayButton.addEventListener("click", () => {
          const now = new Date(); view = toJalaali(now);
          selected = { ...view }; selected.jd = view.jd;
          input.value = formatDate(now);
          input.dataset.jalaliDate = view.jy + "/" + pad(view.jm) + "/" + pad(view.jd);
          input.dataset.gregorianDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new CustomEvent("jalali-date-change", { bubbles: true, detail: { jalali: { ...view }, gregorian: now } }));
          close();
        });
        const clear = document.createElement("button");
        clear.type = "button"; clear.className = "jalali-calendar-clear"; clear.textContent = "پاک کردن";
        clear.addEventListener("click", () => {
          input.value = ""; delete input.dataset.jalaliDate; delete input.dataset.gregorianDate;
          selected = null; input.dispatchEvent(new Event("change", { bubbles: true })); close();
        });
        actions.append(todayButton, clear);
        pop.appendChild(actions);
      }

      function open() {
        const parsed = parseValue(input.value);
        if (parsed) view = { jy: parsed.jy, jm: parsed.jm, jd: 1 };
        render(); pop.hidden = false; input.setAttribute("aria-expanded", "true"); position();
      }

      input.addEventListener("click", () => pop.hidden ? open() : close());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault(); open();
        } else if (event.key === "Escape") close();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!pop.hidden && !pop.contains(event.target) && event.target !== input) close();
      });
      window.addEventListener("resize", () => { if (!pop.hidden) position(); });
      window.addEventListener("scroll", () => { if (!pop.hidden) position(); }, true);
    });
  }

  window.JalaliCalendar = {
    init,
    toJalaali,
    toGregorian,
    format: formatDate,
    parse: parseValue,
    months: MONTHS.slice()
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();