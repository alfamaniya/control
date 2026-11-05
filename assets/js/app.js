(() => {
  const shell = document.querySelector(".app-shell");
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (!shell || !toggle || !sidebar) return;

  const normalizePath = (path) => path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll(".nav-group").forEach((group) => {
    const link = group.querySelector(".nav-group-link");
    const submenu = group.querySelector(".nav-submenu");
    if (!link || !submenu) return;

    const resolvePath = (href) => normalizePath(new URL(href, window.location.href).pathname);
    const parentMatch = resolvePath(link.getAttribute("href")) === currentPath;
    const childLinks = Array.from(submenu.querySelectorAll("a"));
    const childMatch = childLinks.some((child) => resolvePath(child.getAttribute("href")) === currentPath);
    const isCurrentGroup = parentMatch || childMatch;

    link.classList.toggle("active", isCurrentGroup);
    if (parentMatch) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");

    childLinks.forEach((child) => {
      if (resolvePath(child.getAttribute("href")) === currentPath) child.setAttribute("aria-current", "page");
      else child.removeAttribute("aria-current");
    });

    group.classList.toggle("is-open", isCurrentGroup);
    submenu.hidden = !isCurrentGroup;
  });

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
