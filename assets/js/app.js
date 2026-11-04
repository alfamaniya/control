(() => {
  const shell = document.querySelector(".app-shell");
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (!shell || !toggle || !sidebar) return;

  const setSidebarState = (isOpen) => {
    shell.classList.toggle("sidebar-closed", !isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    sidebar.setAttribute("aria-hidden", String(!isOpen));
  };

  toggle.addEventListener("click", () => {
    setSidebarState(shell.classList.contains("sidebar-closed"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSidebarState(false);
  });
})();
