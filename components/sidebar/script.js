(() => {
  const script = document.currentScript;
  const root = new URL("../../", script.src);
  const shell = document.querySelector(".app-shell, .sidebar-demo-shell");
  const mount = document.querySelector("[data-control-sidebar]");
  if (!shell || !mount) return;
  const url = (path) => new URL(path, root).href;
  const items = [
    {number:"01",label:"داشبورد",icon:"▦",path:"index.html"},
    {number:"02",label:"ورود کالا",icon:"⇧",path:"sections/vorood-kala/index.html",children:[
      ["ورود از فایل Excel / CSV","sections/vorood-kala/file-import/index.html"],
      ["کپی از جدول","sections/vorood-kala/copy-paste/index.html"],
      ["ثبت دستی کالا","sections/vorood-kala/manual/index.html"]
    ]},
    {number:"03",label:"ارسال کالا و موجودی",icon:"⇢",path:"sections/ersal-kala/index.html"},
    {number:"04",label:"کاردکس",icon:"≋",path:"sections/kardex/index.html"},
    {number:"05",label:"گزارش‌ها",icon:"▥",path:"sections/gozaresh-ha/index.html",children:[
      ["گزارش کلی","sections/gozaresh-ha/bar-asas-tarikh/index.html"],
      ["گزارش بر اساس شماره حواله مصرف","sections/gozaresh-ha/shomare-havale-masraf/index.html"],
      ["گزارش بر اساس شماره خروج","sections/gozaresh-ha/shomare-khorooj/index.html"],
    ]},
    {number:"06",label:"تنظیمات و مدیریت",icon:"⚙",path:"sections/modiriat/index.html",children:[
      ["مدیریت حذف کالا","sections/modiriat/manage-products/index.html"],
      ["مدیریت موجودی کالاها","sections/modiriat/manage-stock/index.html"],
      ["مدیریت محل ارسال","sections/modiriat/manage-destinations/index.html"]
    ]}
  ];
  const current = window.location.pathname.endsWith("/") ? window.location.pathname.slice(0,-1) : window.location.pathname;
  const routePath = (path) => { const pathname = new URL(path, root).pathname; return pathname.endsWith("/") ? pathname.slice(0,-1) : pathname; };
  const currentItem = items.find((item) => routePath(item.path) === current || (item.children || []).some((child) => routePath(child[1]) === current));
  const currentChild = currentItem && (currentItem.children || []).find((child) => routePath(child[1]) === current);
  const pageTitle = currentChild ? currentChild[0] : (currentItem ? currentItem.label : (document.title.split("|")[0] || "داشبورد").trim());
  const sectionTitle = currentItem ? currentItem.label : "داشبورد";

  // عنوان صفحه و سکشن فعال را در همان هدر سراسری نمایش بده.
  const brand = document.querySelector(".topbar .brand");
  if (brand) {
    brand.textContent = "";
    brand.classList.add("brand-breadcrumb");
    const section = document.createElement("span");
    section.className = "topbar-section-title";
    section.textContent = sectionTitle;
    const separator = document.createElement("span");
    separator.className = "topbar-title-separator";
    separator.setAttribute("aria-hidden", "true");
    separator.textContent = " / ";
    const page = document.createElement("strong");
    page.className = "topbar-page-title";
    page.textContent = pageTitle;
    brand.append(section, separator, page);
    brand.setAttribute("aria-label", sectionTitle + "، " + pageTitle);
  }

  // سربرگ مستقل ابتدای صفحات تکراری است؛ عنوان آن به هدر اصلی منتقل شده است.
  const pageContent = document.querySelector(".page-content");
  if (pageContent) {
    const heading = pageContent.querySelector("h1");
    const headingSection = heading && heading.closest("section");
    if (headingSection && !headingSection.classList.contains("guide-box") && !headingSection.classList.contains("command-hero")) {
      const directSection = Array.from(pageContent.children).find((node) => node === headingSection || node.contains(headingSection));
      if (directSection && directSection.tagName === "SECTION") {
        if (directSection.classList.contains("inventory-heading")) directSection.remove();
        else directSection.remove();
      }
    }
  }
  const nav = document.createElement("aside");
  nav.className = "control-sidebar";
  nav.id = "sidebar";
  nav.setAttribute("aria-label","منوی اصلی سامانه");
  const submenuLayer = document.createElement("div");
  submenuLayer.className = "sidebar-submenu-layer";
  const submenuGroups = [];
  const isMobileViewport = () => window.matchMedia("(max-width: 768px)").matches;

  const panel = document.createElement("section");
  panel.className = "sidebar-panel";
  panel.setAttribute("aria-label","فهرست بخش‌ها");
  const panelHead = document.createElement("div");
  panelHead.className = "sidebar-panel-head";
  const panelLogo = document.createElement("span");
  panelLogo.className = "sidebar-panel-logo";
  panelLogo.textContent = "ک";
  const panelTitle = document.createElement("div");
  panelTitle.className = "sidebar-panel-title";
  const panelName = document.createElement("strong");
  panelName.textContent = "سامانه کنترل مصرف و ارسال کالا";
  const panelCaption = document.createElement("small");
  panelCaption.textContent = "مدیریت و گردش کالا";
  panelTitle.append(panelName,panelCaption);
  panelHead.append(panelLogo,panelTitle);
  panel.append(panelHead);

  const panelNav = document.createElement("nav");
  panelNav.className = "sidebar-panel-nav";
  panelNav.setAttribute("aria-label","ناوبری اصلی");
  items.forEach((item) => {
    const group = document.createElement("div");
    const link = document.createElement("a");
    link.className = "nav-link" + (item.children ? " nav-group-link" : "");
    link.href = url(item.path);
    const number = document.createElement("span");
    number.className = "nav-number";
    number.textContent = item.number;
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(number,label);
    const childPaths = (item.children || []).map((child) => routePath(child[1]));
    const isParent = routePath(item.path) === current;
    const activeChild = childPaths.includes(current);
    if (isParent || activeChild) {
      link.classList.add("active");
      if (isParent) link.setAttribute("aria-current","page");
    }


    if (item.children) {
      group.className = "nav-group" + (isParent || activeChild ? " is-open" : "");
      const heading = document.createElement("div");
      heading.className = "nav-group-heading";
      group.append(heading);
      const submenu = document.createElement("div");
      submenu.className = "nav-submenu";
      submenu.id = "sidebar-submenu-" + item.number;
      submenu.hidden = !(isParent || activeChild);
      submenu.setAttribute("aria-label","زیرمجموعه‌های " + item.label);
      link.setAttribute("aria-controls",submenu.id);
      link.setAttribute("aria-expanded",String(isParent || activeChild));
      item.children.forEach(([text,path]) => {
        const child = document.createElement("a");
        child.className = "nav-sublink";
        child.href = url(path);
        child.textContent = text;
        if (routePath(path) === current) child.setAttribute("aria-current","page");
        submenu.append(child);
      });
      heading.append(link);
      group.append(submenu);
      const initiallyOpen = isParent || activeChild;
      let closeTimer;
      const positionSubmenu = () => {
        const groupRect = group.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        submenu.style.top = Math.max(8, Math.min(groupRect.top - navRect.top, navRect.height - submenu.offsetHeight - 8)) + "px";
      };
      const setGroupOpen = (open) => {
        group.classList.toggle("is-open",open);
        const targetParent = isMobileViewport() ? group : submenuLayer;
        if (submenu.parentElement !== targetParent) targetParent.append(submenu);
        submenu.hidden = !open;
        link.setAttribute("aria-expanded",String(open));
        if (open && !isMobileViewport()) positionSubmenu();
      };
      const scheduleClose = () => {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          if (group.matches(":hover") || submenu.matches(":hover") || group.contains(document.activeElement) || submenu.contains(document.activeElement)) return;
          setGroupOpen(initiallyOpen);
        },180);
      };
      group.addEventListener("pointerenter",(event) => {
        if (event.pointerType === "mouse") {
          window.clearTimeout(closeTimer);
          setGroupOpen(true);
        }
      });
      group.addEventListener("pointerleave",(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      });
      submenu.addEventListener("pointerenter",(event) => {
        if (event.pointerType === "mouse") window.clearTimeout(closeTimer);
      });
      submenu.addEventListener("pointerleave",(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      });
      group.addEventListener("focusin",() => setGroupOpen(true));
      group.addEventListener("focusout",(event) => {
        if (!group.contains(event.relatedTarget) && !submenu.contains(event.relatedTarget)) setGroupOpen(initiallyOpen);
      });
      submenu.addEventListener("focusin",() => setGroupOpen(true));
      submenu.addEventListener("focusout",(event) => {
        if (!group.contains(event.relatedTarget) && !submenu.contains(event.relatedTarget)) setGroupOpen(initiallyOpen);
      });
      submenuGroups.push({group,submenu,initiallyOpen,setGroupOpen});
      if (initiallyOpen) setGroupOpen(true);
    } else {
      group.append(link);
    }
    panelNav.append(group);
  });
  panel.append(panelNav);
  const foot = document.createElement("div");
  foot.className = "sidebar-panel-foot";
  foot.textContent = "سامانه کنترل مصرف و ارسال کالا";
  panel.append(foot);
  nav.append(panel);
  nav.append(submenuLayer);
  submenuGroups.forEach(({submenu}) => {
    if (!isMobileViewport()) submenuLayer.append(submenu);
  });
  mount.replaceWith(nav);

  const backdrop = document.createElement("div");
  backdrop.className = "control-sidebar-backdrop";
  backdrop.setAttribute("aria-hidden","true");
  shell.append(backdrop);
  const toggle = document.getElementById("sidebarToggle") || document.querySelector(".sidebar-menu-toggle");
  const mobile = () => window.matchMedia("(max-width: 768px)").matches;
  const setOpen = (open) => {
    nav.classList.toggle("is-open",open);
    if (toggle) toggle.setAttribute("aria-expanded",String(open));
  };
  if (toggle) toggle.addEventListener("click",() => {
    const open = nav.classList.contains("is-open");
    setOpen(!open);
  });
  backdrop.addEventListener("click",() => setOpen(false));
  document.addEventListener("keydown",(event) => {if(event.key === "Escape") setOpen(false);});
  window.addEventListener("resize",() => {
    if (toggle) toggle.setAttribute("aria-expanded",String(nav.classList.contains("is-open")));
    submenuGroups.forEach(({group,submenu,initiallyOpen,setGroupOpen}) => {
      if (isMobileViewport()) {
        if (submenu.parentElement !== group) group.append(submenu);
        if (submenu.hidden) setGroupOpen(initiallyOpen);
      } else {
        if (submenu.parentElement !== submenuLayer) submenuLayer.append(submenu);
        if (!submenu.hidden) setGroupOpen(true);
      }
    });
  });
  if (toggle) toggle.setAttribute("aria-expanded","false");
})();