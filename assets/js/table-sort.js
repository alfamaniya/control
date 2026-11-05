(() => {
  "use strict";
  const digitMap = "۰۱۲۳۴۵۶۷۸۹";
  function normalized(value) {
    return String(value ?? "")
      .replace(/[۰-۹]/g, d => String(digitMap.indexOf(d)))
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[٬،]/g, "")
      .replace(/\u066B/g, ".")
      .trim();
  }
  function compareValues(a, b) {
    const left = normalized(a), right = normalized(b);
    const leftNumber = left !== "" && /^[-+]?\d+(?:\.\d+)?$/.test(left);
    const rightNumber = right !== "" && /^[-+]?\d+(?:\.\d+)?$/.test(right);
    if (leftNumber && rightNumber) return Number(left) - Number(right);
    return left.localeCompare(right, "fa", { numeric: true, sensitivity: "base" });
  }
  function sortTable(table, column, direction) {
    const body = table.tBodies[0];
    if (!body) return;
    const rows = Array.from(body.rows).map((row, index) => ({ row, index }));
    rows.sort((a, b) => {
      const result = compareValues(a.row.cells[column]?.textContent ?? "", b.row.cells[column]?.textContent ?? "");
      return result === 0 ? a.index - b.index : result * direction;
    });
    const fragment = document.createDocumentFragment();
    rows.forEach(item => fragment.appendChild(item.row));
    body.appendChild(fragment);
    Array.from(table.tHead?.rows[0]?.cells ?? []).forEach((th, index) => {
      th.setAttribute("aria-sort", index === column ? (direction === 1 ? "ascending" : "descending") : "none");
      th.classList.toggle("sort-active", index === column);
      th.dataset.sortDirection = index === column ? (direction === 1 ? "asc" : "desc") : "";
    });
  }
  document.addEventListener("click", event => {
    const header = event.target.closest("table thead th");
    if (!header) return;
    const table = header.closest("table");
    const headers = Array.from(table.tHead?.rows[0]?.cells ?? []);
    const column = headers.indexOf(header);
    if (column < 0 || !table.tBodies.length) return;
    sortTable(table, column, header.dataset.sortDirection === "asc" ? -1 : 1);
  });
  document.addEventListener("keydown", event => {
    if ((event.key !== "Enter" && event.key !== " ") || !event.target.matches("table thead th[tabindex]")) return;
    event.preventDefault();
    event.target.click();
  });
  document.querySelectorAll("table thead th").forEach(header => {
    header.tabIndex = 0;
    header.setAttribute("role", "button");
    header.setAttribute("aria-label", header.textContent.trim() + "؛ مرتب‌سازی");
    header.setAttribute("aria-sort", "none");
    header.title = "برای مرتب‌سازی کلیک کنید";
  });
})();