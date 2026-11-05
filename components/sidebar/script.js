(() => {
  const script = document.currentScript;
  const root = new URL("../../", script.src);
  const shell = document.querySelector(".app-shell, .sidebar-demo-shell");
  const mount = document.querySelector("[data-control-sidebar]");
  if (!shell || !mount) return;
  const url = (path) => new URL(path, root).href;
  const items = [
    {number:"01",label:"داشبورد",path:"index.html"},
    {number:"02",label:"ورود کالا",path:"sections/vorood-kala/index.html",children:[
      ["ورود از فایل Excel / CSV","sections/vorood-kala/file-import/index.html"],
      ["کپی از جدول","sections/vorood-kala/copy-paste/index.html"],
      ["ثبت دستی کالا","sections/vorood-kala/manual/index.html"]
    ]},
    {number:"03",label:"مشاهده کالاها و موجودی",path:"sections/moshahede-kala/index.html"},
    {number:"04",label:"ارسال کالا",path:"sections/ersal-kala/index.html"},
    {number:"05",label:"کاردکس",path:"sections/kardex/index.html"},
    {number:"06",label:"گزارش‌ها",path:"sections/gozaresh-ha/index.html"},
    {number:"07",label:"تنظیمات و مدیریت",path:"sections/modiriat/index.html",children:[
      ["مدیریت حذف کالا","sections/modiriat/manage-products/index.html"],
      ["مدیریت موجودی کالاها","sections/modiriat/manage-stock/index.html"]
    ]},
    {number:"08",label:"درخت سامانه",path:"sections/derakht-samane/index.html"}
  ];
  const current = window.location.pathname.replace(/\/$/,"");
  const routePath = (path) => new URL(path, root).pathname.replace(/\/$/,"");
  const nav = document.createElement("aside");
  nav.className = "control-sidebar";
  nav.id = "sidebar";
  nav.setAttribute("aria-label","منوی اصلی");
  const navigation = document.createElement("nav");
  navigation.className = "sidebar-nav";
  items.forEach((item) => {
    const group = document.createElement(item.children ? "div" : "div");
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
      const chevron = document.createElement("span");
      chevron.className = "nav-chevron";
      chevron.setAttribute("aria-hidden","true");
      chevron.textContent = "⌄";
      link.append(chevron);
      group.append(link);
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
    } else {
      group.append(link);
    }
    navigation.append(group);
  });
  nav.append(navigation);
  mount.replaceWith(nav);

  const backdrop = document.createElement("div");
  backdrop.className = "control-sidebar-backdrop";
  backdrop.setAttribute("aria-hidden","true");
  shell.append(backdrop);
  const toggle = document.getElementById("sidebarToggle") || document.querySelector(".sidebar-menu-toggle");
  const setOpen = (open) => {
    shell.classList.toggle("sidebar-closed",!open);
    if (toggle) toggle.setAttribute("aria-expanded",String(open));
    nav.setAttribute("aria-hidden",String(!open));
  };
  if (toggle) toggle.addEventListener("click",() => setOpen(shell.classList.contains("sidebar-closed")));
  backdrop.addEventListener("click",() => setOpen(false));
  document.addEventListener("keydown",(event) => {if(event.key === "Escape") setOpen(false);});
})();
