(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("destinationForm");
  const mainNameInput = $("destinationMainName");
  const subNameInput = $("destinationSubName");
  const list = $("destinationList");
  const message = $("destinationMessage");
  let destinations = [];
  let editingId = 0;

  const fa = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const showMessage = (text, error = false) => {
    if (!message) return;
    message.textContent = text;
    message.className = "management-message" + (error ? " error" : "");
    message.hidden = !text;
  };


  function actionButton(label, action, id, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "destination-action " + extraClass;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = String(id);
    return button;
  }

  function render() {
    list.innerHTML = "";
    const roots = destinations.filter(item => !Number(item.parentId || 0));
    const count = $("destinationCount");
    if (count) count.textContent = fa(destinations.length);
    if (!roots.length) {
      const empty = document.createElement("div");
      empty.className = "management-empty";
      const title = document.createElement("strong");
      title.textContent = "هنوز محلی ثبت نشده است";
      const hint = document.createElement("p");
      hint.textContent = "از فرم بالا اولین محل ارسال را اضافه کنید.";
      empty.append(title, hint);
      list.appendChild(empty);
      return;
    }
    roots.forEach(root => {
      const group = document.createElement("article");
      group.className = "destination-group";
      const main = document.createElement("div");
      main.className = "destination-main";
      const title = document.createElement("div");
      title.className = "destination-title";
      const pin = document.createElement("span");
      pin.className = "destination-pin";
      pin.textContent = "⌖";
      const name = document.createElement("strong");
      name.textContent = root.name;
      title.append(pin, name);
      const actions = document.createElement("div");
      actions.className = "destination-actions";
      actions.append(actionButton("ویرایش", "edit", root.id), actionButton("حذف", "delete", root.id, "delete"));
      main.append(title, actions);
      group.appendChild(main);
      const children = destinations.filter(item => Number(item.parentId) === Number(root.id));
      if (children.length) {
        const childWrap = document.createElement("div");
        childWrap.className = "destination-children";
        children.forEach(child => {
          const row = document.createElement("div");
          row.className = "destination-child";
          const childName = document.createElement("div");
          childName.className = "destination-child-name";
          const branch = document.createElement("span");
          branch.textContent = "↳";
          const label = document.createElement("strong");
          label.textContent = child.name;
          childName.append(branch, label);
          const childActions = document.createElement("div");
          childActions.className = "destination-actions";
          childActions.append(actionButton("ویرایش", "edit", child.id), actionButton("حذف", "delete", child.id, "delete"));
          row.append(childName, childActions);
          childWrap.appendChild(row);
        });
        group.appendChild(childWrap);
      } else {
        const empty = document.createElement("div");
        empty.className = "destination-empty-child";
        empty.textContent = "زیرمجموعه‌ای برای این محل تعریف نشده است.";
        group.appendChild(empty);
      }
      list.appendChild(group);
    });
  }

  async function load() {
    try {
      destinations = await window.ControlDB.getDestinations();
      render();
    } catch (error) {
      showMessage(error.message || "دریافت محل‌های ارسال ناموفق بود.", true);
    }
  }

  function resetForm() {
    editingId = 0;
    form.reset();
    $("destinationFormTitle").textContent = "افزودن محل جدید";
    $("saveDestination").textContent = "＋ افزودن محل";
    $("cancelDestinationEdit").hidden = true;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const mainName = mainNameInput.value.trim();
    const subName = subNameInput.value.trim();
    const button = $("saveDestination");
    if (!mainName && !subName) {
      showMessage("نام محل اصلی یا زیرمجموعه را وارد کنید.", true);
      return;
    }
    if (subName && !mainName && !editingId) {
      showMessage("برای ثبت زیرمجموعه، نام محل اصلی را هم وارد کنید.", true);
      return;
    }
    button.disabled = true;
    try {
      if (editingId) {
        const current = destinations.find(item => Number(item.id) === editingId);
        if (!current) throw new Error("محل موردنظر پیدا نشد.");
        if (Number(current.parentId || 0)) {
          const parent = destinations.find(item => Number(item.id) === Number(current.parentId));
          if (!parent) throw new Error("محل اصلی این زیرمجموعه پیدا نشد.");
          if (!subName) throw new Error("نام زیرمجموعه را وارد کنید.");
          await window.ControlDB.saveDestination({ id: editingId, name: subName, parentId: Number(parent.id) });
        } else {
          if (!mainName) throw new Error("نام محل اصلی را وارد کنید.");
          await window.ControlDB.saveDestination({ id: editingId, name: mainName, parentId: 0 });
          if (subName) {
            const refreshed = await window.ControlDB.getDestinations();
            let parent = refreshed.find(item => !Number(item.parentId || 0) && item.name === mainName);
            if (!parent) throw new Error("ذخیره محل اصلی انجام نشد.");
            await window.ControlDB.saveDestination({ name: subName, parentId: Number(parent.id) });
          }
        }
      } else if (mainName && subName) {
        let parent = destinations.find(item => !Number(item.parentId || 0) && item.name === mainName);
        if (!parent) parent = await window.ControlDB.saveDestination({ name: mainName, parentId: 0 });
        await window.ControlDB.saveDestination({ name: subName, parentId: Number(parent.id) });
      } else if (mainName) {
        await window.ControlDB.saveDestination({ name: mainName, parentId: 0 });
      } else {
        throw new Error("برای ثبت زیرمجموعه، نام محل اصلی را هم وارد کنید.");
      }
      showMessage("محل ارسال با موفقیت ذخیره شد.");
      resetForm();
      await load();
    } catch (error) {
      showMessage(error.message || "ذخیره محل ارسال ناموفق بود.", true);
    } finally {
      button.disabled = false;
    }
  });

  list.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    const item = destinations.find(entry => Number(entry.id) === id);
    if (!item) return;
    if (button.dataset.action === "edit") {
      editingId = id;
      mainNameInput.value = Number(item.parentId || 0) ? (destinations.find(entry => Number(entry.id) === Number(item.parentId)) || {}).name || "" : item.name;
      subNameInput.value = Number(item.parentId || 0) ? item.name : "";
      $("destinationFormTitle").textContent = "ویرایش محل ارسال";
      $("saveDestination").textContent = "ذخیره تغییرات";
      $("cancelDestinationEdit").hidden = false;
      (Number(item.parentId || 0) ? subNameInput : mainNameInput).focus();
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (button.dataset.action === "delete") {
      if (!window.confirm("محل «" + item.name + "» حذف شود؟")) return;
      button.disabled = true;
      try {
        await window.ControlDB.deleteDestination(id);
        if (editingId === id) resetForm();
        showMessage("محل ارسال حذف شد.");
        await load();
      } catch (error) {
        showMessage(error.message || "حذف محل ارسال انجام نشد.", true);
      } finally {
        button.disabled = false;
      }
    }
  });

  $("cancelDestinationEdit").addEventListener("click", resetForm);
  load();
})();