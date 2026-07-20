
"use strict";
const $=id=>document.getElementById(id);
const get=(k,d=null)=>{try{return JSON.parse(localStorage.getItem(k)??JSON.stringify(d))}catch{return d}};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const KEYS={profile:"poolProfile44",measurements:"poolMeasurements44",logs:"poolLogs44",stock:"poolStock44",tasks:"poolTasks44",dark:"poolDark44",multitab:"poolMultitab44",diagnostics:"poolDiagnostics53"};

const products=[
{name:"Planet Pool pH Minus granulat",kind:"ph",direction:"down",unit:"g",base:150,perM3:10,delta:.2,source:"Planet Pool deklaracija: 150 g na 10 m³ zniža pH približno za 0,2.",instructions:"Najprej raztopi v vedru vode in počasi vlij ob robu. Pri trdi vodi je lahko potreben večji odmerek."},
{name:"Planet Pool pH Minus tekoči",kind:"ph",direction:"down",unit:"ml",base:100,perM3:10,delta:.2,source:"Planet Pool deklaracija: 100 ml na 10 m³ zniža pH približno za 0,2.",instructions:"Razredči po deklaraciji in počasi vlij ob robu, ne v bližini kovinskih delov."},
{name:"Planet Pool pH Plus",kind:"ph",direction:"up",unit:"g",base:100,perM3:10,delta:.2,source:"Planet Pool navodilo: 100 g na 10 m³ zviša pH približno za 0,2.",instructions:"Dodajaj postopoma in med odmerki ponovno izmeri pH."},
{name:"Planet Pool klor granulat",kind:"modes",unit:"g",modes:[
 {id:"first",label:"Prvo polnjenje",baseMin:80,baseMax:100,perM3:10},
 {id:"regular",label:"Redno – vsakih 3 dni",baseMin:50,baseMax:50,perM3:10},
 {id:"shock",label:"Sunkovito kloriranje",baseMin:80,baseMax:100,perM3:10}],source:"Planet Pool deklaracija za klor granulat.",instructions:"Praviloma dodaj zvečer. Granulat najprej raztopi v vedru vode. Pred kopanjem izmeri klor in pH."},
{name:"Planet Pool Algicid Standard",kind:"modes",unit:"ml",modes:[
 {id:"first",label:"Prvo doziranje",baseMin:100,baseMax:100,perM3:10},
 {id:"weekly",label:"Tedensko vzdrževanje",baseMin:50,baseMax:50,perM3:10},
 {id:"attack",label:"Napad alg",baseMin:250,baseMax:250,perM3:10}],source:"Planet Pool deklaracija za Algicid Standard.",instructions:"Najprej razredči v vedru vode in počasi vlij ob robu bazena."},
{name:"Planet Pool Algicid Special",kind:"modes",unit:"ml",modes:[
 {id:"first",label:"Prvo doziranje",baseMin:150,baseMax:200,perM3:10},
 {id:"weekly",label:"Tedensko vzdrževanje",baseMin:100,baseMax:150,perM3:10},
 {id:"attack",label:"Napad alg",baseMin:300,baseMax:400,perM3:10}],source:"Planet Pool deklaracija za nepeneči Algicid Special.",instructions:"Razredči v vedru vode. Primeren je tudi za bazene s protitokom oziroma masažne bazene."},
{name:"Planet Pool Flockstar tekoči",kind:"modes",unit:"ml",modes:[{id:"clear",label:"Bistrenje vode",baseMin:50,baseMax:100,perM3:10}],source:"Planet Pool deklaracija: 50–100 ml na 10 m³.",instructions:"Pri peščenem filtru vlij v skimer ob delujočem filtru in po 2–3 dneh povratno izperi. Pri kartušnem filtru upoštevaj posebna navodila deklaracije."},
{name:"Planet Pool Multitab 200 g",kind:"tablet",unit:"tableta",base:1,perM3:25,source:"Običajno odmerjanje za 200 g večnamenske tablete: 1 tableta na približno 25 m³; vedno preveri svojo deklaracijo.",instructions:"Tableto daj v plavajoči dozator ali skimer, nikoli neposredno na folijo."},
{name:"Arekina / Arkina izdelek – odmerek z embalaže",kind:"manual",unit:"g/ml",source:"Za izdelke Arekina/Arkina v javno dostopnih virih ni bilo mogoče zanesljivo potrditi enotne deklaracije.",instructions:"Vnesi odmerek, ki je naveden na tvoji embalaži, aplikacija pa ga bo natančno preračunala na prostornino bazena."}
];
const stockCatalog=[
"Planet Pool Multitab 200 g","Planet Pool Flockstar","Planet Pool pH Minus","Planet Pool pH Plus","Planet Pool klor granulat","Planet Pool hitro topne klor tablete","Planet Pool algecid","Planet Pool aktivni kisik",
"Arekina pH Minus","Arekina pH Plus","Arekina klor granulat","Arekina algecid","Arekina sredstvo za kosmičenje","Drugo"
];
const defaultTasks=[
{id:"test",title:"Preveri pH in klor",days:3,next:null},{id:"filter",title:"Očisti ali izperi filter",days:7,next:null},{id:"robot",title:"Zaženi robotski sesalnik",days:3,next:null},{id:"water",title:"Preveri nivo vode",days:2,next:null}
];
function profile(){return get(KEYS.profile,{name:"Domači bazen",l:"",w:"",h:""})}
function measurements(){return get(KEYS.measurements,[])}
function tasks(){return get(KEYS.tasks,defaultTasks.map(x=>({...x})))}
function volume(){const p=profile();return Number(p.l)*Number(p.w)*Number(p.h)||0}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function download(data,name,type){const b=new Blob([data],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function daysBetween(a,b){const x=new Date(a);x.setHours(0,0,0,0);const y=new Date(b);y.setHours(0,0,0,0);return Math.ceil((y-x)/86400000)}

function selectTab(id){document.querySelectorAll(".menu-grid button").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));document.querySelectorAll("section").forEach(s=>s.classList.toggle("active",s.id===id));if(id==="charts")drawMeasurementChart();if(id==="data")renderHistory();if(id==="logs")renderLogs();if(id==="stock")renderStock();location.hash=id}
document.querySelectorAll(".menu-grid button").forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));

function loadProfile(){const p=profile();$("sName").value=p.name;$("sL").value=p.l;$("sW").value=p.w;$("sH").value=p.h;previewVolume()}
function previewVolume(){const v=Number($("sL").value)*Number($("sW").value)*Number($("sH").value);$("volumePreview").textContent=`Izračunana prostornina: ${v?v.toFixed(1)+" m³":"–"}`}
function saveProfile(){set(KEYS.profile,{name:$("sName").value||"Domači bazen",l:$("sL").value,w:$("sW").value,h:$("sH").value});$("sMsg").innerHTML='<div class="status ok">Profil je shranjen.</div>';refresh()}
["sL","sW","sH"].forEach(id=>$(id).oninput=previewVolume);

function saveMeasurement(){const ph=Number($("mPh").value),cl=Number($("mCl").value);if(!ph||$("mCl").value===""){$("mMsg").innerHTML='<div class="status bad">Vnesi pH in prosti klor.</div>';return}const a=measurements();a.unshift({id:Date.now(),date:new Date().toISOString(),ph,cl,temp:$("mTemp").value,note:$("mNote").value});set(KEYS.measurements,a);$("mMsg").innerHTML='<div class="status ok">Meritev je shranjena.</div>';refresh()}
function analysis(m){if(!m)return["warn","Ni meritev.",[]];const text=[],plan=[];if(m.ph<7){text.push("pH je prenizek.");plan.push("Najprej dodaj pH plus.")}else if(m.ph>7.4){text.push("pH je previsok.");plan.push("Najprej dodaj pH minus.")}else text.push("pH je v ciljnem območju.");if(m.cl<.5){text.push("Klor je prenizek.");plan.push("Po uravnanju pH dodaj klor.")}else if(m.cl>1.5){text.push("Klor je visok.");plan.push("Ne dodajaj klora.")}else text.push("Klor je v običajnem območju.");return[(m.ph>=7&&m.ph<=7.4&&m.cl>=.5&&m.cl<=1.5)?"ok":"warn",text.join(" "),plan]}
function poolScore(m){
  if(!m)return {score:null,title:"Pripravljen na pregled",text:"Dodaj zadnjo meritev in aplikacija bo ocenila stanje vode.",tone:"neutral"};
  let score=100;
  const ph=Number(m.ph),cl=Number(m.cl);
  if(ph<7||ph>7.6)score-=30;else if(ph<7.2||ph>7.4)score-=10;
  if(cl<0.5||cl>3)score-=35;else if(cl<1||cl>2)score-=12;
  score=Math.max(0,Math.min(100,score));
  if(score>=90)return {score,title:"Bazen je odličen",text:"Vrednosti so v priporočenem območju. Nadaljuj z rednim vzdrževanjem.",tone:"good"};
  if(score>=65)return {score,title:"Potrebna je pozornost",text:"Ena od vrednosti je blizu meje. Preveri današnjo analizo spodaj.",tone:"warning"};
  return {score,title:"Potrebno je ukrepanje",text:"Izmerjene vrednosti odstopajo. Upoštevaj priporočene korake.",tone:"danger"};
}
function renderPoolStatus(m){
  const status=poolScore(m),card=$("poolStatusCard");
  if(!card)return;
  card.dataset.tone=status.tone;
  $("poolStatusTitle").textContent=status.title;
  $("poolStatusText").textContent=status.text;
  $("poolScoreValue").textContent=status.score===null?"–":status.score;
  $("poolScore").style.setProperty("--score",status.score??0);
  $("lastMeasurementText").textContent=m?`Zadnja meritev: ${new Date(m.date).toLocaleString("sl-SI")}`:"Ni shranjenih meritev";
}
function refresh(){const p=profile(),m=measurements()[0],a=analysis(m);$("dVol").textContent=volume()?volume().toFixed(1)+" m³":"–";$("helperVolume").textContent=volume()?volume().toFixed(1)+" m³":"–";if($("helperVolumeCalc"))$("helperVolumeCalc").textContent=volume()?volume().toFixed(1)+" m³":"–";$("dPh").textContent=m?.ph??"–";$("dCl").textContent=m?m.cl+" mg/l":"–";$("advice").className="status "+a[0];$("advice").textContent=a[1];$("todayPlan").innerHTML=a[2].length?"<ul>"+a[2].map(x=>"<li>"+x+"</li>").join("")+"</ul>":"";renderPoolStatus(m);renderHomeTasks();renderMultitab();checkMultitabNotifications()}

function selectedProduct(){return products[$("product").selectedIndex]}
function renderTreatmentOptions(){
 const p=selectedProduct(),sel=$("treatment"),values=$("valueInputs"),manual=$("manualDoseInputs");
 values.hidden=p.kind!=="ph";manual.hidden=p.kind!=="manual";
 if(p.kind==="modes")sel.innerHTML=p.modes.map(m=>`<option value="${m.id}">${m.label}</option>`).join("");
 else if(p.kind==="ph")sel.innerHTML='<option>Preračun po izmerjeni vrednosti</option>';
 else if(p.kind==="tablet")sel.innerHTML='<option>Vzdrževalni odmerek</option>';
 else sel.innerHTML='<option>Preračun odmerka z embalaže</option>';
 sel.disabled=p.kind!=="modes";
 $("currentLabel").textContent=p.direction==="down"?"Trenutni pH":"Trenutni pH";
 $("targetLabel").textContent="Ciljni pH";
 $("doseInfo").innerHTML=`<b>Podlaga:</b> ${p.source}<br>${p.instructions}`;
}
function formatDose(min,max,unit){if(Math.abs(min-max)<.01)return `<b>${min.toFixed(min<10?1:0)} ${unit}</b>`;return `<b>${min.toFixed(0)}–${max.toFixed(0)} ${unit}</b>`}
function calcChemical(){
 const p=selectedProduct(),v=volume();if(!v){$("chemResult").innerHTML='<div class="status bad">Najprej v Profilu nastavi mere bazena.</div>';return}
 let min=0,max=0,detail="";
 if(p.kind==="ph"){
  const cur=Number($("currentValue").value),tar=Number($("targetValue").value);
  if(!cur||!tar){$("chemResult").innerHTML='<div class="status bad">Vnesi trenutni in ciljni pH.</div>';return}
  const diff=p.direction==="down"?cur-tar:tar-cur;
  if(diff<=0){$("chemResult").innerHTML=`<div class="status warn">Ta izdelek ni potreben: ciljna vrednost ne zahteva ${p.direction==="down"?"znižanja":"zvišanja"} pH.</div>`;return}
  min=max=diff/p.delta*p.base*(v/p.perM3);detail=`Sprememba pH: ${diff.toFixed(1)}.`;
 }else if(p.kind==="modes"){
  const m=p.modes.find(x=>x.id===$("treatment").value)||p.modes[0];min=m.baseMin*(v/m.perM3);max=m.baseMax*(v/m.perM3);detail=m.label+".";
 }else if(p.kind==="tablet"){
  min=max=p.base*(v/p.perM3);detail="Za praktično uporabo zaokroži navzgor le, če to dovoljuje deklaracija in meritve klora.";
 }else{
  const dose=Number($("manualDose").value),per=Number($("manualPerM3").value);if(!dose||!per){$("chemResult").innerHTML='<div class="status bad">Prepiši odmerek in osnovno prostornino z embalaže.</div>';return}min=max=dose*(v/per);detail="Preračun po vneseni deklaraciji.";
 }
 $("chemResult").innerHTML=`<div class="status ok">Za <b>${v.toFixed(1)} m³</b> uporabi ${formatDose(min,max,p.unit)}.<br><span class="small">${detail}</span></div><div class="status warn">Odmerjaj postopoma, po tretmaju ponovno izmeri vodo in ne prekorači navodil na embalaži.</div>`;
}

function addLog(){const a=get(KEYS.logs,[]);a.unshift({id:Date.now(),date:new Date().toISOString(),type:$("logType").value,amount:$("logAmount").value,cost:Number($("logCost").value||0),note:$("logNote").value});set(KEYS.logs,a);renderLogs()}
function renderLogs(){const a=get(KEYS.logs,[]);$("logList").innerHTML=a.length?a.map(x=>`<div class="log"><b>${x.type}</b><div class="small">${new Date(x.date).toLocaleString("sl-SI")} · ${x.amount||"brez količine"} · ${x.cost.toFixed(2)} €</div><div>${x.note||""}</div></div>`).join(""):'<div class="small">Ni vnosov.</div>'}

function addStock(){const a=get(KEYS.stock,[]);a.push({id:Date.now(),name:$("stockName").value||"Izdelek",qty:Number($("stockQty").value||0),unit:$("stockUnit").value,min:Number($("stockMin").value||0)});set(KEYS.stock,a);renderStock()}
function renderStock(){const a=get(KEYS.stock,[]);$("stockList").innerHTML=a.length?a.map(x=>`<div class="stock"><b>${x.name}</b><div class="status ${x.qty<=x.min?"bad":"ok"}">${x.qty} ${x.unit}${x.qty<=x.min?" · nizka zaloga":""}</div><div class="actions"><button class="secondary" data-dec="${x.id}">−1</button><button data-inc="${x.id}">+1</button><button class="danger" data-del="${x.id}">Izbriši</button></div></div>`).join(""):'<div class="small">Ni izdelkov.</div>';document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeStock(Number(b.dataset.dec),-1));document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeStock(Number(b.dataset.inc),1));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{set(KEYS.stock,get(KEYS.stock,[]).filter(x=>x.id!==Number(b.dataset.del)));renderStock()})}
function changeStock(id,d){const a=get(KEYS.stock,[]),x=a.find(v=>v.id===id);if(x)x.qty=Math.max(0,x.qty+d);set(KEYS.stock,a);renderStock()}

function taskState(t){if(!t.next)return["warn","Datum ni določen"];const n=daysBetween(new Date(),new Date(t.next+"T12:00:00"));return n<0?["bad",`Zamuja ${-n} dni`]:n===0?["bad","Danes"]:n===1?["warn","Jutri"]:["ok",`Čez ${n} dni`]}
function renderTasks(){const a=tasks();$("taskList").innerHTML=a.map((t,i)=>{const s=taskState(t);return`<div class="task"><b>${t.title}</b><div class="grid"><div><label>Ponovi vsakih X dni</label><input data-task-days="${i}" type="number" min="1" value="${t.days}"></div><div><label>Prvi datum</label><input data-task-date="${i}" type="date" value="${t.next||""}"></div></div><div class="status ${s[0]}">${s[1]}</div><div class="actions"><button data-done="${i}">Opravljeno danes</button><button class="secondary" data-cal="${i}">Koledarski opomnik</button></div></div>`}).join("");document.querySelectorAll("[data-task-days]").forEach(el=>el.onchange=()=>{const x=tasks(),i=Number(el.dataset.taskDays);x[i].days=Math.max(1,Number(el.value)||1);set(KEYS.tasks,x);renderTasks()});document.querySelectorAll("[data-task-date]").forEach(el=>el.onchange=()=>{const x=tasks(),i=Number(el.dataset.taskDate);x[i].next=el.value||null;set(KEYS.tasks,x);renderTasks();renderHomeTasks()});document.querySelectorAll("[data-done]").forEach(el=>el.onclick=()=>doneTask(Number(el.dataset.done)));document.querySelectorAll("[data-cal]").forEach(el=>el.onclick=()=>calendarTask(Number(el.dataset.cal)))}
function renderHomeTasks(){$("homeTasks").innerHTML=tasks().map(t=>{const s=taskState(t);return`<span class="pill">${t.title}: ${s[1]}</span>`}).join("")}
function doneTask(i){const a=tasks(),d=new Date();d.setDate(d.getDate()+Number(a[i].days));a[i].next=isoDate(d);set(KEYS.tasks,a);renderTasks();renderHomeTasks()}
function calendarTask(i){const t=tasks()[i];if(!t.next){alert("Najprej določi datum.");return}const date=t.next.replaceAll("-","");const ics=["BEGIN:VCALENDAR","VERSION:2.0","CALSCALE:GREGORIAN","BEGIN:VEVENT",`UID:${Date.now()}-${t.id}@mojbazen`,`DTSTART:${date}T090000`,`DTEND:${date}T091500`,`RRULE:FREQ=DAILY;INTERVAL=${t.days}`,`SUMMARY:MojBazen: ${t.title}`,"BEGIN:VALARM","TRIGGER:PT0M","ACTION:DISPLAY",`DESCRIPTION:${t.title}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");download(ics,`MojBazen-${t.id}.ics`,"text/calendar")}

function setMultitab(){const days=Number(prompt("Čez koliko dni bo Multitab predvidoma porabljen?","6"));if(!days||days<1)return;const start=new Date(),end=new Date();end.setDate(end.getDate()+days);set(KEYS.multitab,{start:start.toISOString(),end:end.toISOString(),total:days,lastNotice:null});renderMultitab();checkMultitabNotifications()}
function multitabData(){return get(KEYS.multitab,null)}
function renderMultitab(){
  const m=multitabData();
  if(!m){
    $("multiDays").textContent="–";
    $("multiPercent").textContent="–";
    $("multiText").textContent="Ni nastavljen";
    $("multitabRing").style.setProperty("--p",0);
    return;
  }
  const left=Math.max(0,daysBetween(new Date(),new Date(m.end)));
  const remainingPercent=Math.max(0,Math.min(100,Math.round(left/Math.max(1,m.total)*100)));
  $("multiDays").textContent=left;
  $("multiPercent").textContent=remainingPercent;
  $("multiText").textContent=left===0?"Poteče danes":left===1?"Poteče jutri":`Še ${left} dni`;
  $("multitabRing").style.setProperty("--p",remainingPercent);
}
async function requestNotifications(){if(!("Notification" in window)){alert("Ta brskalnik ne podpira spletnih obvestil. Uporabi koledarski opomnik.");return}const r=await Notification.requestPermission();alert(r==="granted"?"Obvestila so dovoljena.":"Obvestila niso dovoljena.")}
function checkMultitabNotifications(){const m=multitabData();if(!m)return;const left=Math.max(0,daysBetween(new Date(),new Date(m.end))),today=isoDate(new Date());if((left===1||left===0)&&m.lastNotice!==`${today}-${left}`){if("Notification" in window&&Notification.permission==="granted")new Notification("MojBazen – Multitab",{body:left===1?"Multitab bo predvidoma porabljen jutri.":"Multitab je predvidoma porabljen danes.",icon:"icon-192.png"});m.lastNotice=`${today}-${left}`;set(KEYS.multitab,m)}}
function calendarMultitab(){const m=multitabData();if(!m){alert("Najprej nastavi odštevanje.");return}const date=isoDate(new Date(m.end)).replaceAll("-","");const ics=["BEGIN:VCALENDAR","VERSION:2.0","CALSCALE:GREGORIAN","BEGIN:VEVENT",`UID:${Date.now()}-multitab@mojbazen`,`DTSTART:${date}T090000`,`DTEND:${date}T091500`,"SUMMARY:MojBazen: preveri Multitab","BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:Multitab bo predvidoma porabljen jutri.","END:VALARM","BEGIN:VALARM","TRIGGER:PT0M","ACTION:DISPLAY","DESCRIPTION:Multitab je predvidoma porabljen danes.","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");download(ics,"MojBazen-Multitab-opozorili.ics","text/calendar")}

function drawLineChart(canvas,data,series){const ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height,p={l:48,r:24,t:22,b:38};ctx.clearRect(0,0,W,H);ctx.strokeStyle="#d8e7ef";for(let i=0;i<5;i++){const y=p.t+i*(H-p.t-p.b)/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(W-p.r,y);ctx.stroke()}if(data.length<2){ctx.fillStyle="#687f90";ctx.fillText("Za graf sta potrebni vsaj dve meritvi.",p.l+10,H/2);return}series.forEach((s,si)=>{ctx.strokeStyle=si===0?"#0878b8":"#e68a00";ctx.lineWidth=3;ctx.beginPath();data.forEach((row,i)=>{const x=p.l+i*(W-p.l-p.r)/(data.length-1),y=H-p.b-(Number(row[s.key])-s.min)/(s.max-s.min)*(H-p.t-p.b);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()})}
function drawMeasurementChart(){const key=$("chartMetric").value,ranges={ph:[6.5,8],cl:[0,3],temp:[5,40]},range=ranges[key],data=measurements().slice(0,30).reverse();drawLineChart($("mainChart"),data,[{key,min:range[0],max:range[1]}])}
function weatherInfo(code){
  if(code===0)return["☀️","Jasno"];
  if([1,2].includes(code))return["🌤️","Delno jasno"];
  if(code===3)return["☁️","Oblačno"];
  if([45,48].includes(code))return["🌫️","Megla"];
  if([51,53,55,56,57].includes(code))return["🌦️","Pršenje"];
  if([61,63,65,66,67,80,81,82].includes(code))return["🌧️","Dež"];
  if([71,73,75,77,85,86].includes(code))return["🌨️","Sneg"];
  if([95,96,99].includes(code))return["⛈️","Nevihta"];
  return["🌤️","Napoved"];
}
async function loadWeather(){const summary=$("weatherSummary");summary.innerHTML='<div class="status warn">Pridobivam napoved …</div>';navigator.geolocation.getCurrentPosition(async pos=>{try{const url=`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`;const r=await fetch(url);if(!r.ok)throw new Error("weather");const j=await r.json();const data=j.daily.time.map((date,i)=>({label:new Date(date+"T12:00:00").toLocaleDateString("sl-SI",{weekday:"short"}),max:j.daily.temperature_2m_max[i],min:j.daily.temperature_2m_min[i],rain:j.daily.precipitation_sum[i],code:j.daily.weather_code[i]}));set("poolWeather44",data);renderWeather(data)}catch{summary.innerHTML='<div class="status bad">Napovedi ni mogoče pridobiti.</div>'}},()=>summary.innerHTML='<div class="status bad">Lokacija ni dovoljena.</div>')}
function renderWeather(data=get("poolWeather44",[])){
 if(!data.length)return;
 $("weatherSummary").innerHTML=`<div class="weather-days">${data.map(x=>{const w=weatherInfo(Number(x.code));return`<div class="weather-day" title="${w[1]}"><div class="day">${x.label}</div><div class="weather-icon">${w[0]}</div><div class="temps">${Math.round(x.max)}° / ${Math.round(x.min)}°</div><div class="rain">💧 ${Number(x.rain).toFixed(1)} mm</div></div>`}).join("")}</div>`;
}

function renderHistory(){const a=measurements();$("historyBody").innerHTML=a.length?a.map(m=>`<tr><td>${new Date(m.date).toLocaleString("sl-SI")}</td><td>${m.ph}</td><td>${m.cl}</td><td>${m.temp||"–"}</td><td><button class="danger" data-m-del="${m.id}" style="padding:5px;margin:0">×</button></td></tr>`).join(""):'<tr><td colspan="5">Ni meritev.</td></tr>';document.querySelectorAll("[data-m-del]").forEach(b=>b.onclick=()=>{set(KEYS.measurements,measurements().filter(x=>x.id!==Number(b.dataset.mDel)));renderHistory();refresh()})}
function exportJSON(){download(JSON.stringify({version:"6.0.1",profile:profile(),measurements:measurements(),logs:get(KEYS.logs,[]),stock:get(KEYS.stock,[]),tasks:tasks(),multitab:multitabData(),diagnostics:get(KEYS.diagnostics,[])},null,2),"MojBazen-v6-0-1-backup.json","application/json")}
function exportCSV(){const rows=[["Datum","pH","Klor","Temperatura"],...measurements().map(m=>[m.date,m.ph,m.cl,m.temp])];download(rows.map(r=>r.join(";")).join("\n"),"MojBazen-meritve.csv","text/csv")}
function importJSON(file){const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(o.profile)set(KEYS.profile,o.profile);if(o.measurements)set(KEYS.measurements,o.measurements);if(o.logs)set(KEYS.logs,o.logs);if(o.stock)set(KEYS.stock,o.stock);if(o.tasks)set(KEYS.tasks,o.tasks);if(o.multitab)set(KEYS.multitab,o.multitab);if(o.diagnostics)set(KEYS.diagnostics,o.diagnostics);loadProfile();refresh();renderTreatmentOptions();renderTasks();renderLogs();renderStock();alert("Podatki so uvoženi.")}catch{alert("Datoteka ni veljavna.")}};r.readAsText(file)}

$("product").innerHTML=products.map(p=>`<option>${p.name}</option>`).join("");
$("product").onchange=renderTreatmentOptions;
$("stockCatalog").innerHTML=stockCatalog.map(x=>`<option>${x}</option>`).join("");
$("stockCatalog").onchange=()=>{$("stockName").value=$("stockCatalog").value==="Drugo"?"":$("stockCatalog").value};
$("saveMeasurementBtn").onclick=saveMeasurement;$("saveProfileBtn").onclick=saveProfile;$("calcChemicalBtn").onclick=calcChemical;$("addLogBtn").onclick=addLog;$("addStockBtn").onclick=addStock;$("clearStockBtn").onclick=()=>{if(confirm("Res izbrišem vso zalogo?")){set(KEYS.stock,[]);renderStock()}};$("requestNotificationsBtn").onclick=requestNotifications;$("chartMetric").onchange=drawMeasurementChart;$("loadWeatherBtn").onclick=loadWeather;$("exportJsonBtn").onclick=exportJSON;$("exportCsvBtn").onclick=exportCSV;$("printBtn").onclick=()=>window.print();$("importJsonBtn").onclick=()=>$("importFile").click();$("importFile").onchange=e=>{if(e.target.files[0])importJSON(e.target.files[0])};$("setMultitabBtn").onclick=setMultitab;$("multitabCard").onclick=e=>{if(e.target.tagName!=="BUTTON")setMultitab()};$("calendarMultitabBtn").onclick=calendarMultitab;
document.addEventListener("pointerdown",e=>{const b=e.target.closest("button");if(b)b.classList.add("is-pressed")});
document.addEventListener("pointerup",()=>document.querySelectorAll("button.is-pressed").forEach(b=>setTimeout(()=>b.classList.remove("is-pressed"),90)));
document.addEventListener("pointercancel",()=>document.querySelectorAll("button.is-pressed").forEach(b=>b.classList.remove("is-pressed")));
document.body.classList.add("dark");set(KEYS.dark,true);
loadProfile();refresh();renderTreatmentOptions();renderTasks();renderLogs();renderStock();renderHistory();renderWeather();
const initial=location.hash.replace("#","");if(document.getElementById(initial))selectTab(initial);
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").then(r=>r.update()).catch(()=>{});


// Zagonski zaslon v4.10
(function(){
  const splash=document.getElementById("splashScreen");
  if(!splash)return;
  const hide=()=>{setTimeout(()=>splash.classList.add("is-hidden"),650);setTimeout(()=>splash.remove(),1200)};
  if(document.readyState==="complete")hide();else window.addEventListener("load",hide,{once:true});
  setTimeout(hide,2600);
})();
