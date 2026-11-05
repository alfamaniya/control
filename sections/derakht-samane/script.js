(() => {
  "use strict";
  const board = document.querySelector(".tree-board");
  if (!board) return;
  board.setAttribute("tabindex", "0");
  board.setAttribute("aria-label", "نمودار درختی افقی؛ برای پیمایش از کلیدهای جهت‌دار استفاده کنید");
})();
