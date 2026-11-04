(() => {
  "use strict";
  const KEY="control.inventory.v1", $=id=>document.getElementById(id);
  const input=$("pasteInput"), message=$("importMessage"), preview=$("previewPanel"), result=$("resultPanel");
  const rowsBody=$("previewRows"), confirm=$("confirmImportButton");
  let parsed=[], valid=[], issues=[];
  const digits=v=>String(v??"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const norm=v=>String(v??"").replace(/\u200c/g," ").trim();
  const codeOf=v=>/^\d{10}$/.test(v)?v.slice(0,8):"";
  function inventory(){try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
  function say(t,type=""){message.textContent=t;message.className="import-message"+(type?" "+type:"");message.hidden=false}
  function parse(text){
    const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
    if(!lines.length)throw Error("ابتدا اطلاعات جدول را در کادر پیست کنید.");
    const delimiter=lines[0].includes("\t")?"\t":(lines[0].includes(";")?";":",");
    let matrix=lines.map(line=>line.split(delimiter).map(norm));
    const first=matrix[0].map(x=>x.toLowerCase());
    const hasHeader=first.some(x=>x.includes("تدارکاتی")||x.includes("شرح")||x==="description"||x==="procurementcode");
    if(hasHeader)matrix=matrix.slice(1);
    return matrix.map((r,i)=>({rowNumber:i+(hasHeader?2:1),code:digits(r[0]||"").replace(/\s/g,""),description:norm(r[1]),quantityRaw:digits(r[2]||"").replace(/,/g,"").trim(),group:norm(r[3])})).filter(r=>r.code||r.description||r.quantityRaw||r.group);
  }
  function classify(){
    const existing=inventory(), known=new Set(existing.map(x=>String(x.procurementCode||""))), seen=new Set();
    valid=[];issues=[];
    parsed.forEach(r=>{
      const reasons=[];r.internalCode=codeOf(r.code);
      if(!r.internalCode)reasons.push("کد تدارکاتی باید دقیقاً ۱۰ رقم باشد");
      if(!r.description)reasons.push("شرح کالا وارد نشده است");
      if(!r.quantityRaw||!/^\d+(?:\.\d+)?$/.test(r.quantityRaw))reasons.push("تعداد موجودی خالی یا نامعتبر است");
      if(!r.group)reasons.push("گروه کالا وارد نشده است");
      if(r.internalCode&&seen.has(r.code))reasons.push("کد تدارکاتی در این فهرست تکراری است");
      if(r.internalCode)seen.add(r.code);
      if(r.internalCode&&known.has(r.code))reasons.push("این کد تدارکاتی از قبل در موجودی ثبت شده است");
      if(reasons.length)issues.push({...r,reasons});
      else valid.push({internalCode:r.internalCode,procurementCode:r.code,description:r.description,quantity:Number(r.quantityRaw),group:r.group});
    });
  }
  function cell(tr,value,cls=""){const td=document.createElement("td");td.textContent=value;if(cls)td.className=cls;tr.appendChild(td)}
  function render(){
    rowsBody.innerHTML="";const bad=new Map(issues.map(x=>[x.rowNumber,x]));
    parsed.forEach(r=>{const tr=document.createElement("tr");[r.rowNumber,r.internalCode||"—",r.code||"—",r.description||"—",r.quantityRaw||"—",r.group||"—"].forEach((v,i)=>cell(tr,v,i===1?"code-cell":""));const td=document.createElement("td"),tag=document.createElement("span"),issue=bad.get(r.rowNumber);tag.className="status-tag "+(issue?"invalid":"valid");tag.textContent=issue?"دارای مغایرت":"آماده ثبت";td.appendChild(tag);tr.appendChild(td);rowsBody.appendChild(tr)});
    $("previewCount").textContent=parsed.length+" ردیف";$("validSummary").textContent=valid.length+" کالا آماده ثبت · "+issues.length+" ردیف دارای مغایرت";confirm.disabled=!valid.length;preview.hidden=false;
  }
  $("analyzePaste").addEventListener("click",()=>{
    try{parsed=parse(input.value);if(!parsed.length)throw Error("هیچ ردیف کالایی شناسایی نشد.");classify();render();result.hidden=true;say("اطلاعات بررسی شد. کد اختصاصی از ۸ رقم اول کد تدارکاتی ساخته شده است.","success");preview.scrollIntoView({behavior:"smooth",block:"start"})}
    catch(e){say(e.message||"خواندن اطلاعات انجام نشد.","error")}
  });
  confirm.addEventListener("click",()=>{
    if(!valid.length)return;
    try{
      const current=inventory(),known=new Set(current.map(x=>String(x.procurementCode||"")));
      const fresh=valid.filter(x=>!known.has(x.procurementCode)),skipped=valid.filter(x=>known.has(x.procurementCode));
      localStorage.setItem(KEY,JSON.stringify(current.concat(fresh.map(x=>({...x,createdAt:new Date().toISOString(),source:"copy-paste"})))));
      const allIssues=issues.concat(skipped.map(x=>({rowNumber:"—",internalCode:x.internalCode,code:x.procurementCode,description:x.description,quantityRaw:String(x.quantity),group:x.group,reasons:["این کد هنگام تأیید در موجودی ثبت شده بود"]})));
      $("resultSummary").textContent=fresh.length+" کالا با موفقیت به موجودی اضافه شد.";
      $("resultStats").innerHTML="";
      [["ثبت‌شده",fresh.length],["ثبت‌نشده",allIssues.length],["بررسی‌شده",parsed.length]].forEach(([label,n])=>{const card=document.createElement("div");card.className="result-stat";const strong=document.createElement("strong");strong.textContent=n;const span=document.createElement("span");span.textContent=label;card.append(strong,span);$("resultStats").appendChild(card)});
      $("discrepancyRows").innerHTML="";$("discrepancyCount").textContent=allIssues.length+" ردیف";$("noDiscrepancies").hidden=allIssues.length!==0;document.querySelector("#resultPanel .table-wrap").hidden=allIssues.length===0;
      allIssues.forEach(x=>{const tr=document.createElement("tr");[x.rowNumber,x.internalCode||"—",x.code||"—",x.description||"—",x.quantityRaw||"—",x.group||"—",x.reasons.join("؛ ")].forEach(v=>cell(tr,v));$("discrepancyRows").appendChild(tr)});
      result.hidden=false;confirm.disabled=true;say("ثبت اطلاعات انجام شد.","success");result.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(e){say("ثبت اطلاعات انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.","error")}
  });
})();