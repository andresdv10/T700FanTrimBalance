
// -------- Utilidades de entrada ----------
function toNumber(v){
  if(typeof v!=="string") return Number(v);
  v = v.trim().replace(/\s+/g,"").replace(",", ".").replace(/[^0-9\.\-\+eE]/g,"");
  return Number(v);
}
function getNum(id, name, min=-Infinity, max=Infinity){
  const el = document.getElementById(id);
  const n = toNumber(el.value);
  if(!isFinite(n) || isNaN(n)) throw new Error(`"${name}" no es un número válido.`);
  if(n<min || n>max) throw new Error(`"${name}" fuera de rango (${min}..${max}).`);
  return n;
}
function showError(msg){
  const box = document.getElementById("errorBox");
  box.style.display = "block"; box.textContent = msg;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearError(){ const box = document.getElementById("errorBox"); box.style.display="none"; box.textContent=""; }

// -------- Datos AMM ----------
const KBETA={
  flight:[
    {n1:88,K:60.0,B:125},{n1:87,K:60.1,B:129},{n1:86,K:61.1,B:134},{n1:85,K:62.1,B:139},
    {n1:84,K:65.1,B:145},{n1:83,K:68.1,B:151},{n1:82,K:71.6,B:157},{n1:81,K:75.6,B:164},
    {n1:80,K:79.5,B:170},{n1:79,K:83.5,B:175},{n1:78,K:87.4,B:180},{n1:77,K:91.2,B:183},
    {n1:76,K:94.8,B:185},
  ],
  ground:[
    {n1:88,K:131.0,B:125},{n1:87,K:131.1,B:124},{n1:86,K:127.6,B:122},{n1:85,K:124.1,B:121},
    {n1:84,K:123.3,B:121},{n1:83,K:122.5,B:122},{n1:82,K:122.2,B:122},{n1:81,K:122.4,B:124},
    {n1:80,K:122.6,B:126},{n1:79,K:126.8,B:133},{n1:78,K:131.0,B:140},{n1:77,K:137.4,B:145},
    {n1:76,K:145.7,B:147},
  ]
};
const TABLE_A=[
  {N:0,eff:5.76,cum:5.76,w:1},{N:1,eff:11.44,cum:17.20,w:3},{N:2,eff:11.21,cum:28.41,w:5},
  {N:3,eff:10.83,cum:39.24,w:7},{N:4,eff:10.29,cum:49.53,w:9},{N:5,eff:9.63,cum:59.16,w:11},
  {N:6,eff:8.83,cum:67.99,w:13},{N:7,eff:7.90,cum:75.89,w:15},{N:8,eff:6.88,cum:82.77,w:17},
  {N:9,eff:5.76,cum:88.53,w:19},{N:10,eff:4.56,cum:93.09,w:21},{N:11,eff:3.31,cum:96.40,w:23},
  {N:12,eff:2.00,cum:98.40,w:25},{N:13,eff:0.67,cum:99.07,w:27},
];
const TABLE_B=[
  {N:0.5,cum:11.50,w:2},{N:1.5,cum:22.85,w:4},{N:2.5,cum:33.89,w:6},{N:3.5,cum:44.47,w:8},
  {N:4.5,cum:54.45,w:10},{N:5.5,cum:63.69,w:12},{N:6.5,cum:72.07,w:14},{N:7.5,cum:79.48,w:16},
  {N:8.5,cum:85.81,w:18},{N:9.5,cum:90.98,w:20},{N:10.5,cum:94.92,w:22},{N:11.5,cum:97.58,w:24},
  {N:12.5,cum:98.92,w:26},
];

// -------- Utilidades numéricas ----------
const $=(id)=>document.getElementById(id);
function nearestKbeta(mode,n1){ const arr=KBETA[mode]; let best=arr[0], d=Math.abs(arr[0].n1-n1); for(const r of arr){ const dd=Math.abs(r.n1-n1); if(dd<d){d=dd; best=r;} } return best; }
function norm(a){ a%=360; if(a<0)a+=360; return a; }
function toVec(mag,deg){ const rad=deg*Math.PI/180; return {x:mag*Math.cos(rad), y:mag*Math.sin(rad)}; }
function fromVec(x,y){ const mag=Math.hypot(x,y); let deg=Math.atan2(y,x)*180/Math.PI; return {mag, deg:norm(deg)}; }
function chooseCombo(table,M){ let best=table[0]; for(const row of table){ if(row.cum<=M+1e-9) best=row; } return best; }
function wrap(i,m){ i%=m; if(i<0)i+=m; return i; }

// Registro y comparación; no altera el cálculo de corrección.
function parseExistingPositions(value){
  if(!value.trim()) throw new Error("Indica las posiciones de los pernos existentes.");
  const parts=value.trim().split(/[,;\s]+/);
  if(parts.some(v=>!/^\d+$/.test(v) || Number(v)<1 || Number(v)>54))
    throw new Error("Usa posiciones enteras de 1 a 54, separadas por comas, sin rangos.");
  const positions=parts.map(Number);
  if(new Set(positions).size!==positions.length) throw new Error("Hay posiciones repetidas. Registra cada posición una sola vez.");
  return positions.sort((a,b)=>a-b);
}
function resetResult(){
  for(const id of ["outChk","outCorr","outCombo"]) $(id).textContent="—";
  $("existingReport").textContent="Datos pendientes de cálculo. Revisa la configuración y pulsa Calcular.";
  $("existingReport").className="existing-report";
  const c=$("rotor"); c.getContext("2d").clearRect(0,0,c.width,c.height);
}
function readExisting(){
  if(!["yes","no"].includes($("hasExisting").value)) throw new Error("Selecciona si hay pernos de balance instalados.");
  if($("hasExisting").value==="no") return [];
  const positions=parseExistingPositions($("existingPositions").value);
  if(!$("configurationConfirmed").checked) throw new Error("Confirma que las lecturas corresponden a la configuración de pernos registrada.");
  return positions;
}

// -------- Cálculo ----------
function calcular(){
  try{
    clearError();
    resetResult();
    const existing=readExisting();
    const mode=$("mode").value;
    const mod=54;

    const r1={n:getNum("n1_1","N1‑1", 60,100), u:getNum("u_1","U‑1", 0, 9), a:getNum("a_1","A‑1", 0, 360)};
    const r2={n:getNum("n1_2","N1‑2", 60,100), u:getNum("u_2","U‑2", 0, 9), a:getNum("a_2","A‑2", 0, 360)};
    const r3={n:getNum("n1_3","N1‑3", 60,100), u:getNum("u_3","U‑3", 0, 9), a:getNum("a_3","A‑3", 0, 360)};

    let Mcorr, AngCorr, deltaM="—", deltaA="—";

    if(mode==="flight"){
      // In‑Flight (single shot)
      const kb=nearestKbeta("flight", r1.n);
      const M = r1.u * kb.K;
      const ang = norm(r1.a + kb.B);
      Mcorr = M; AngCorr = ang;
    }else{
      // Ground Run (3 datos): R/3
      const runs=[r1,r2,r3];
      const vecs=[], mags=[], angs=[];
      for(const r of runs){
        const kb=nearestKbeta("ground", r.n);
        const Mi=r.u*kb.K;
        const thetai=norm(r.a+kb.B);
        vecs.push(toVec(Mi,thetai)); mags.push(Mi); angs.push(thetai);
      }
      const Mmin=Math.min(...mags), Mmax=Math.max(...mags);
      const Amin=Math.min(...angs), Amax=Math.max(...angs);
      deltaM=(Mmax-Mmin).toFixed(2); deltaA=(Amax-Amin).toFixed(1);

      const sumX=vecs.reduce((s,v)=>s+v.x,0), sumY=vecs.reduce((s,v)=>s+v.y,0);
      const R=fromVec(sumX,sumY);
      Mcorr=R.mag/3; AngCorr=R.deg;
    }

    // Hole vs Space
    const step=360/mod;
    const tol=Math.min(0.2, step/20);
    const distToGrid=Math.min(
      Math.abs(AngCorr - Math.round(AngCorr/step)*step),
      Math.abs((AngCorr+360) - Math.round((AngCorr+360)/step)*step)
    );
    const isHole = distToGrid <= tol;

    const row=chooseCombo(isHole?TABLE_A:TABLE_B, Mcorr);
    const w=row.w;

    // Posiciones
    let idx=[];
    if(isHole){
      const base=Math.round(AngCorr/step)%mod;
      idx=[base]; const pairs=(w-1)/2;
      for(let i=1;i<=pairs;i++){ idx.push(wrap(base+i,mod)); idx.push(wrap(base-i,mod)); }
    }else{
      const left=Math.floor(AngCorr/step)%mod; const right=wrap(left+1,mod);
      const pairs=w/2; idx=[];
      for(let i=0;i<pairs;i++){ idx.push(wrap(left-i,mod)); idx.push(wrap(right+i,mod)); }
    }
    idx.sort((a,b)=>a-b);
    const labels = idx.map(i=>i+1);

    // Salida resumida
    document.getElementById("outChk").textContent = (mode==="ground")
      ? `ΔM=${deltaM} oz·in · Δθ=${deltaA}°`
      : `Single shot (In‑Flight)`;

    if(mode==="ground"){
      document.getElementById("outCorr").textContent = `R/3 = ${Mcorr.toFixed(2)} oz·in @ ${AngCorr.toFixed(1)}°`;
    }else{
      document.getElementById("outCorr").textContent = `M = ${Mcorr.toFixed(2)} oz·in @ ${AngCorr.toFixed(1)}°`;
    }

    const ranges=[];
    for(const label of labels){
      const last=ranges[ranges.length-1];
      if(last && label===last[1]+1) last[1]=label;
      else ranges.push([label,label]);
    }
    const location=ranges.map(([start,end])=>start===end ? `la posición ${start}` : `las posiciones ${start} y ${end}`).join(" y entre ");
    const installation=labels.length===1 ? `Instalar 1 perno en la posición ${labels[0]}.` : `Instalar ${w} pernos entre ${location}, incluidos los extremos.`;
    document.getElementById("outCombo").textContent = `${existing.length ? installation.replace("Instalar ","Corrección calculada: ") : installation}\nSentido antihorario · Vista frontal\n${isHole?"Hole‑centered":"Space‑centered"} · Momento total: ${row.cum.toFixed(2)} oz·in`;

    const overlaps=labels.filter(position=>existing.includes(position));
    const report=$("existingReport");
    if(existing.length){
      const state=`Registrados: ${existing.length} pernos existentes. Posiciones: ${existing.join(", ")}.`;
      report.textContent=overlaps.length
        ? `${state}\nCoincidencia en posiciones: ${overlaps.join(", ")}. La corrección calculada incluye posiciones ya ocupadas; requiere evaluar una combinación alternativa según el apartado 4.C del AMM (SUBTASK 71-00-00-420-088-A). No se ha determinado una configuración final de instalación.`
        : `${state}\nNo hay coincidencias de posición con la corrección calculada. Esta comprobación solo detecta posiciones ocupadas; no determina ni valida una configuración final.`;
      report.textContent+="\nNo se calculan retiradas ni redistribuciones de los pernos existentes.";
      report.className=overlaps.length ? "existing-report conflict" : "existing-report";
    }else report.textContent="Sin pernos de balance existentes registrados.";
    draw(AngCorr, idx, mod, existing.map(position=>position-1));
  }catch(err){
    showError(err.message || String(err));
  }
}

function draw(angleDeg, posIdxList, mod, existingIdx=[]){
  const c=document.getElementById("rotor"), ctx=c.getContext("2d");
  const cx=c.width/2, cy=c.height/2, r=Math.min(c.width,c.height)*0.38;
  ctx.clearRect(0,0,c.width,c.height);

  // Círculo externo
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle="#2a3d58"; ctx.lineWidth=2; ctx.stroke();

  const step=360/mod;

  // Referencia gráfica de posición 1; no representa la marca de correlación física
  ctx.beginPath(); ctx.moveTo(cx, cy-r-12); ctx.lineTo(cx, cy-r-2);
  ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-6, cy-r-6); ctx.lineTo(cx, cy-r-2); ctx.lineTo(cx+6, cy-r-6);
  ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=2; ctx.stroke();

  // Pernos (1..54)
  for(let i=0;i<mod;i++){
    const ang=(-i*step-90)*Math.PI/180;
    const x=cx+Math.cos(ang)*r, y=cy+Math.sin(ang)*r;
    const sel=posIdxList.includes(i);
    const installed=existingIdx.includes(i);
    ctx.beginPath(); ctx.arc(x,y, sel?10:4, 0, Math.PI*2);
    ctx.fillStyle=sel?"#ffdf5d":"#63758b"; ctx.fill();
    if(sel){ ctx.strokeStyle="#ffffff"; ctx.lineWidth=2; ctx.stroke(); }
    ctx.fillStyle=sel?"#ffdf5d":"#a6b7cc"; ctx.font=sel?"bold 24px ui-monospace":"22px ui-monospace";
    if(installed && !sel){ctx.fillStyle="#74e5db";ctx.fillRect(x-9,y-9,18,18);}
    if(installed && sel){ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.strokeStyle="#ff8d77";ctx.lineWidth=4;ctx.stroke();}
    ctx.fillStyle=installed && sel?"#ff8d77":sel?"#ffdf5d":installed?"#74e5db":"#a6b7cc";
    const label=String(i+1);
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(label, cx+Math.cos(ang)*(r+23), cy+Math.sin(ang)*(r+23));
  }

  // Vector de corrección
  const a=(-angleDeg-90)*Math.PI/180;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
  ctx.strokeStyle="#f8fafc"; ctx.lineWidth=3; ctx.stroke();
  ctx.fillStyle="#a7bdd9"; ctx.textAlign="center"; ctx.font="20px system-ui";
  ctx.fillText("VISTA FRONTAL",cx,cy-30);
}

// -------- UX: alternar 1 dato vs 3 datos + presets ----------
function updateRows(){
  const mode=document.getElementById("mode").value;
  const r2=document.getElementById("row2");
  const r3=document.getElementById("row3");
  const presetBar=document.getElementById("presetBar");
  if(mode==="flight"){
    r2.style.display="none"; r3.style.display="none";
    presetBar.style.visibility="hidden";
  }else{
    r2.style.display="table-row"; r3.style.display="table-row";
    presetBar.style.visibility="visible";
  }
}

document.getElementById("mode").addEventListener("change", ()=>{ updateRows(); });
document.getElementById("calcBtn").addEventListener("click", calcular);

// Presets N1 chips
document.querySelectorAll(".chip[data-preset]").forEach(ch=>{
  ch.addEventListener("click", ()=>{
    const csv = ch.getAttribute("data-preset");
    const parts = csv.split(",").map(s=>s.trim());
    if(parts.length===3){
      document.getElementById("n1_1").value = parts[0];
      document.getElementById("n1_2").value = parts[1];
      document.getElementById("n1_3").value = parts[2];
      resetResult();
    }
  });
});

// Personalizar las tres velocidades sin modificar amplitudes ni fases.
$("customN1").addEventListener("click",()=>{
  for(const id of ["n1_1","n1_2","n1_3"]){
    $(id).value="";
    $(id).placeholder="N1 (%)";
  }
  clearError();
  resetResult();
  $("n1_1").focus();
});

// Inicialización
updateRows();
resetResult();
$("hasExisting").addEventListener("change",()=>{
  $("existingFields").hidden=$("hasExisting").value!=="yes";
  $("configurationConfirmed").checked=false;
  clearError(); resetResult();
});
$("existingPositions").addEventListener("input",()=>{$("configurationConfirmed").checked=false;clearError();resetResult();});
$("configurationConfirmed").addEventListener("change",()=>{clearError();resetResult();});
for(const id of ["mode","n1_1","n1_2","n1_3","u_1","u_2","u_3","a_1","a_2","a_3"]){
  $(id).addEventListener(id==="mode"?"change":"input",()=>{clearError();resetResult();});
}
