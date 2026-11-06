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
    {number:"03",label:"مشاهده کالاها و موجودی",icon:"▤",path:"sections/moshahede-kala/index.html"},
    {number:"04",label:"ارسال کالا",icon:"⇢",path:"sections/ersal-kala/index.html"},
    {number:"05",label:"کاردکس",icon:"≋",path:"sections/kardex/index.html"},
    {number:"06",label:"گزارش‌ها",icon:"▥",path:"sections/gozaresh-ha/index.html",children:[
      ["گزارش بر اساس تاریخ","sections/gozaresh-ha/bar-asas-tarikh/index.html"],
      ["گزارش بر اساس شماره حواله مصرف","sections/gozaresh-ha/shomare-havale-masraf/index.html"],
      ["گزارش بر اساس شماره خروج","sections/gozaresh-ha/shomare-khorooj/index.html"],
    ]},
    {number:"07",label:"تنظیمات و مدیریت",icon:"⚙",path:"sections/modiriat/index.html",children:[
      ["مدیریت حذف کالا","sections/modiriat/manage-products/index.html"],
      ["مدیریت موجودی کالاها","sections/modiriat/manage-stock/index.html"]
    ]},
    {number:"08",label:"درخت سامانه",icon:"⌘",path:"sections/derakht-samane/index.html"}
  ];
  const current = window.location.pathname.replace(/\/$/,"");
  const routePath = (path) => new URL(path, root).pathname.replace(/\/$/,"");
  const nav = document.createElement("aside");
  nav.className = "control-sidebar";
  nav.id = "sidebar";
  nav.setAttribute("aria-label","منوی اصلی سامانه");

  const rail = document.createElement("div");
  rail.className = "sidebar-rail";
  const logo = document.createElement("a");
  logo.className = "sidebar-rail-brand";
  logo.href = url("index.html");
  logo.textContent = "ک";
  logo.setAttribute("aria-label","داشبورد سامانه کنترل");
  rail.append(logo);
  const railNav = document.createElement("nav");
  railNav.className = "sidebar-rail-nav";
  railNav.setAttribute("aria-label","دسترسی سریع");
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
    const railLink = document.createElement("a");
    railLink.className = "sidebar-rail-link" + (isParent || activeChild ? " active" : "");
    railLink.href = url(item.path);
    railLink.title = item.label;
    railLink.setAttribute("aria-label",item.label);
    if (isParent) railLink.setAttribute("aria-current","page");
    const icon = document.createElement("span");
    icon.className = "sidebar-rail-icon";
    icon.setAttribute("aria-hidden","true");
    icon.textContent = item.icon;
    railLink.append(icon);
    railNav.append(railLink);

    if (item.children) {
      group.className = "nav-group" + (isParent || activeChild ? " is-open" : "");
      const heading = document.createElement("div");
      heading.className = "nav-group-heading";
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "nav-chevron-toggle";
      expand.setAttribute("aria-label","باز و بسته کردن زیرمجموعه‌های " + item.label);
      expand.setAttribute("aria-expanded",String(isParent || activeChild));
      const chevron = document.createElement("span");
      chevron.className = "nav-chevron";
      chevron.setAttribute("aria-hidden","true");
      chevron.textContent = "⌄";
      expand.append(chevron);
      heading.append(link,expand);
      group.append(heading);
      const submenu = document.createElement("div");
      submenu.className = "nav-submenu";
      submenu.hidden = !(isParent || activeChild);
      submenu.setAttribute("aria-label","زیرمجموعه‌های " + item.label);
      item.children.forEach(([text,path]) => {
        const child = document.createElement("a");
        child.className = "nav-sublink";
        child.href = url(path);
        child.textContent = text;
        if (routePath(path) === current) child.setAttribute("aria-current","page");
        submenu.append(child);
      });
      group.append(submenu);
      expand.addEventListener("click",() => {
        const open = !group.classList.contains("is-open");
        group.classList.toggle("is-open",open);
        submenu.hidden = !open;
        expand.setAttribute("aria-expanded",String(open));
      });
    } else {
      group.append(link);
    }
    panelNav.append(group);
  });
  rail.append(railNav);
  panel.append(panelNav);
  const foot = document.createElement("div");
  foot.className = "sidebar-panel-foot";
  foot.textContent = "سامانه کنترل مصرف و ارسال کالا";
  panel.append(foot);
  nav.append(rail,panel);
  mount.replaceWith(nav);

  const backdrop = document.createElement("div");
  backdrop.className = "control-sidebar-backdrop";
  backdrop.setAttribute("aria-hidden","true");
  shell.append(backdrop);
  const toggle = document.getElementById("sidebarToggle") || document.querySelector(".sidebar-menu-toggle");
  const mobile = () => window.matchMedia("(max-width: 768px)").matches;
  const setOpen = (open) => {
    if (mobile()) nav.classList.toggle("mobile-open",open);
    else nav.classList.toggle("panel-pinned",open);
    if (toggle) toggle.setAttribute("aria-expanded",String(open));
  };
  if (toggle) toggle.addEventListener("click",() => {
    const open = mobile() ? nav.classList.contains("mobile-open") : nav.classList.contains("panel-pinned");
    setOpen(!open);
  });
  backdrop.addEventListener("click",() => setOpen(false));
  document.addEventListener("keydown",(event) => {if(event.key === "Escape") setOpen(false);});
  window.addEventListener("resize",() => {
    if (!mobile()) nav.classList.remove("mobile-open");
    else nav.classList.remove("panel-pinned");
    if (toggle) toggle.setAttribute("aria-expanded",String(mobile() ? nav.classList.contains("mobile-open") : nav.classList.contains("panel-pinned")));
  });
  if (toggle) toggle.setAttribute("aria-expanded","false");
})();