(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const normalizeDigits = value => String(value || "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).toLocaleLowerCase("fa");
  const faNumber = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const stockSearch=$("stockProductSearch"), stockResults=$("stockSearchResults"), stockCard=$("stockSelectedCard"), stockForm=$("stockAdjustmentForm"), stockMessage=$("stockAdjustmentMessage");
  let products=[], stockSelectedProduct=null;
  function showMessage(text,error=false){stockMessage.textContent=text;stockMessage.className=error?"management-message error":"management-message";stockMessage.hidden=false;}
  function selectStockProduct(product){
    stockSelectedProduct=product;stockResults.innerHTML="";stockCard.hidden=false;
    $("stockSelectedDescription").textContent=product.description||"بدون شرح";
    $("stockSelectedCodes").textContent="کد اختصاصی: "+(product.internalCode||String(product.procurementCode).slice(0,8))+" | کد تدارکاتی: "+product.procurementCode;
    $("stockCurrentQuantity").textContent=faNumber(product.quantity??0);
    $("newStockQuantity").value=String(Math.max(0,Number(product.quantity)||0));stockMessage.hidden=true;
  }
  function renderMatches(){
    const term=normalizeDigits(stockSearch.value.trim());stockResults.innerHTML="";stockCard.hidden=true;stockSelectedProduct=null;if(!term)return;
    const matches=products.filter(p=>[p.procurementCode,p.internalCode||String(p.procurementCode||"").slice(0,8),p.description,p.group].map(normalizeDigits).join(" ").includes(term)).slice(0,30);
    matches.forEach(product=>{
      const card=document.createElement("article");card.className="product-result-card";
      const details=document.createElement("div");details.className="product-result-details";
      const title=document.createElement("strong");title.className="product-result-title";title.textContent=product.description||"بدون شرح";
      const meta=document.createElement("div");meta.className="product-result-meta";
      const code=document.createElement("span");code.textContent="کد تدارکاتی: "+product.procurementCode;
      const qty=document.createElement("span");qty.textContent="موجودی فعلی: "+faNumber(product.quantity??0);
      meta.append(code,qty);details.append(title,meta);
      const choose=document.createElement("button");choose.type="button";choose.className="stock-choose-button";choose.textContent="انتخاب کالا";choose.addEventListener("click",()=>selectStockProduct(product));
      card.append(details,choose);stockResults.appendChild(card);
    });
    if(!matches.length){const no=document.createElement("div");no.className="management-empty";no.textContent="کالایی با این مشخصات پیدا نشد.";stockResults.appendChild(no);}
  }
  stockSearch.addEventListener("input",renderMatches);
  stockForm.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!stockSelectedProduct){showMessage("ابتدا یک کالا را از نتایج جست‌وجو انتخاب کنید.",true);return;}
    const raw=normalizeDigits($("newStockQuantity").value.trim());
    if(!/^\d+$/.test(raw)){showMessage("موجودی جدید باید یک عدد صحیح و صفر یا بیشتر باشد.",true);return;}
    const quantity=Number(raw);if(!Number.isSafeInteger(quantity)){showMessage("عدد واردشده بیش از حد بزرگ است.",true);return;}
    try{
      const code=stockSelectedProduct.procurementCode;
      const result=await window.ControlDB.adjustStock(code,quantity);products=await window.ControlDB.getAll();
      const updated=products.find(item=>item.procurementCode===code);if(updated)selectStockProduct(updated);
      if(!result.changed)showMessage("موجودی تغییری نکرد؛ مقدار واردشده با موجودی فعلی برابر است.");
      else showMessage(result.operation+" با موفقیت ثبت شد. مقدار تغییر: "+faNumber(result.difference)+" | موجودی جدید: "+faNumber(result.quantity));
    }catch(error){showMessage(error.message||"ثبت تعدیل موجودی ناموفق بود.",true);}
  });
  (async()=>{try{if(!window.ControlDB)throw new Error("پایگاه داده محلی بارگذاری نشده است.");products=await window.ControlDB.getAll();}catch(error){showMessage(error.message||"دریافت فهرست کالاها ناموفق بود.",true);}})();
})();