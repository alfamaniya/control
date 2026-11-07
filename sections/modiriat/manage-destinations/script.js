(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("destinationForm");
  const nameInput = $("destinationName");
  const parentSelect = $("destinationParent");
  const list = $("destinationList");
  const message = $("destinationMessage");
  let destinations = [];
  let editingId = 0;

  const fa = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const showMessage = (text, error = false) => {
    message.textContent = text;
    message.className = "management-message" + (error ? " error" : "");
    message.hidden = !text;
  };

  function refreshParentOptions(selected = 0) {
    parentSelect.innerHTML = "";
    const rootOption = document.createElement("option");
    rootOption.value = "0";
    rootOption.textContent = "بدون محل اصلی (محل اصلی)";
    parentSelect.appendChild(rootOption);
    destinations.filter(item => !Number(item.parentId || 0)).forEach(item => {
      if (Number(item.id) === editingId) return;
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.name;
      parentSelect.appendChild(option);
    });
    parentSelect.value = String(selected || 0);
  }

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
    $("destinationCount").textContent = fa(destinations.length);
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
      refreshParentOptions();
      render();
    } catch (error) {
      showMessage(error.message || "دریافت محل‌های ارسال ناموفق بود.", true);
    }
  }

  function resetForm() {
    editingId = 0;
    form.reset();
    refreshParentOptions();
    $("destinationFormTitle").textContent = "افزودن محل جدید";
    $("saveDestination").textContent = "＋ افزودن محل";
    $("cancelDestinationEdit").hidden = true;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("saveDestination");
    button.disabled = true;
    try {
      await window.ControlDB.saveDestination({
        id: editingId,
        name: nameInput.value,
        parentId: Number(parentSelect.value || 0)
      });
      showMessage(editingId ? "اطلاعات محل ارسال ویرایش شد." : "محل ارسال با موفقیت ذخیره شد.");
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
      nameInput.value = item.name;
      refreshParentOptions(Number(item.parentId || 0));
      $("destinationFormTitle").textContent = "ویرایش محل ارسال";
      $("saveDestination").textContent = "ذخیره تغییرات";
      $("cancelDestinationEdit").hidden = false;
      nameInput.focus();
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