(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("manualEntryForm");
  const submit = $("submitManualEntry");
  const message = $("manualEntryMessage");
  const digits = value => String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const fa = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  function showMessage(text, error = false) {
    message.textContent = text;
    message.className = "manual-entry-message" + (error ? " error" : " success");
    message.hidden = !text;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const procurementCode = digits($("procurementCode").value).replace(/\s+/g, "");
    const description = $("productDescription").value.trim();
    const group = $("productGroup").value.trim();
    const quantityText = digits($("productQuantity").value).trim();
    const quantity = Number(quantityText);

    if (!/^\d{10}$/.test(procurementCode)) {
      showMessage("کد تدارکاتی باید دقیقاً ۱۰ رقم باشد.", true);
      $("procurementCode").focus();
      return;
    }
    if (!description) {
      showMessage("شرح کالا را وارد کنید.", true);
      $("productDescription").focus();
      return;
    }
    if (!group) {
      showMessage("گروه کالا را وارد کنید.", true);
      $("productGroup").focus();
      return;
    }
    if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity) || quantity < 0) {
      showMessage("تعداد موجودی باید یک عدد صحیح و صفر یا بیشتر باشد.", true);
      $("productQuantity").focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "در حال ثبت…";
    try {
      if (!window.ControlDB) throw new Error("پایگاه داده محلی بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.");
      const result = await window.ControlDB.addMany([{
        internalCode: procurementCode.slice(0, 8),
        procurementCode,
        description,
        group,
        quantity,
        source: "manual"
      }]);
      if (!result.added.length) {
        showMessage("این کد تدارکاتی قبلاً در موجودی ثبت شده است؛ کالای تکراری اضافه نشد.", true);
        return;
      }
      form.reset();
      showMessage("کالا با موفقیت ثبت شد. شماره ورود: " + result.entryNumber + " | کد اختصاصی: " + fa(procurementCode.slice(0, 8)));
      $("procurementCode").focus();
    } catch (error) {
      showMessage(error.message || "ثبت کالا انجام نشد.", true);
    } finally {
      submit.disabled = false;
      submit.textContent = "تأیید و ورود کالا";
    }
  });
})();