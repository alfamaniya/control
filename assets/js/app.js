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

  document.querySelectorAll(".nav-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest(".nav-group");
      const submenu = group && group.querySelector(".nav-submenu");
      if (!submenu) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      submenu.hidden = expanded;
      group.classList.toggle("is-open", !expanded);
    });
  });

  toggle.addEventListener("click", () => {
    setSidebarState(shell.classList.contains("sidebar-closed"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSidebarState(false);
  });
})();
