'use strict';
const $=id=>document.getElementById(id);
const presets=[['2*x*y+3','x^2+4*y',0,1],['2*x','2*y',0,2],['y','1',0,1],['2*x*exp(-y)','2*y*exp(-y)',0,2],['2*y','x',1,1],['x*y+1','x^2+y',0,1]];
let result=null,functions={},worker=null,timer=null,generation=0,C=0,point=null,grid=null,bounds={xmin:-4,xmax:4,ymin:-4,ymax:4};
const plot=$('plot'),ctx=plot.getContext('2d');
const tex=s=>nerdamer(s).toTeX();
function math(id,s){katex.render(s,$(id),{throwOnError:false,strict:false});}
document.querySelectorAll('[data-tex]').forEach(el=>katex.render(el.dataset.tex,el,{throwOnError:false}));
const fmt=v=>Number.isFinite(v)?Number(v.toPrecision(5)).toString():'—';
function evaluate(fn,x,y){try{const v=fn(x,y);return typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e12?v:NaN}catch(e){return NaN}}
function compile(s){const f=nerdamer(s).buildFunction(['x','y']);return (x,y)=>evaluate(f,x,y)}
function error(msg){$('error').textContent=msg;$('error').hidden=!msg;}
function showStatus(msg,warn=false){$('status').textContent=msg;$('status').classList.toggle('warn',warn);}
function resetGraph(){result=null;functions={};point=null;grid=null;$('constant').disabled=true;$('initial-form').querySelector('button').disabled=true;$('potential').textContent='';['equation','partials','factor','transformed'].forEach(id=>$(id).textContent='');$('factor-step').hidden=true;$('verify-step').hidden=true;$('reconstruction').hidden=true;$('solution-note').textContent='';$('selected').textContent='';$('initial-note').textContent='';$('c-value').textContent='—';draw();}
function analyze(){
 error('');worker?.terminate();clearTimeout(timer);const current=++generation;resetGraph();
 $('solve').disabled=true;$('solve').textContent='Analizando…';showStatus('Calculando derivadas y comprobando el resultado…');
 worker=new Worker('worker.js');
 const done=()=>{clearTimeout(timer);worker?.terminate();worker=null;$('solve').disabled=false;$('solve').textContent='Analizar y graficar →';};
 timer=setTimeout(()=>{if(current!==generation)return;done();showStatus('El cálculo no se completó.',true);error('Se alcanzó el tiempo de cálculo. Prueba una expresión más sencilla.');},9000);
 worker.onerror=()=>{done();showStatus('No se pudo iniciar el cálculo.',true);error('El cálculo necesita abrir esta página desde un servidor web. En GitHub Pages funcionará desde el enlace publicado.');};
 worker.onmessage=event=>{if(current!==generation)return;done();if(!event.data.ok){showStatus('Revisa la ecuación.',true);error(event.data.error);return}try{present(event.data.result)}catch(e){resetGraph();showStatus('No se pudo representar esta expresión.',true);error('La representación numérica no está disponible para esta expresión. Prueba uno de los ejemplos.');}};
 worker.postMessage({M:$('m').value,N:$('n').value});
}
function present(r){
 result=r;functions.M=compile(r.M);functions.N=compile(r.N);functions.mu=compile(r.mu||'1');
 math('equation','\\left('+tex(r.M)+'\\right)dx+\\left('+tex(r.N)+'\\right)dy=0');
 math('partials','M_y='+tex(r.My)+',\\quad N_x='+tex(r.Nx));
 $('factor-step').hidden=r.exact||!r.variable;$('verify-step').hidden=r.exact||!r.variable;
 if(r.variable){
  const quotient=r.variable==='x'?'\\frac{M_y-N_x}{N}':'\\frac{N_x-M_y}{M}';
  math('factor',quotient+'='+tex(r.ratio)+'\\quad\\Rightarrow\\quad\\mu('+r.variable+')='+tex(r.mu));
  $('ratio-note').textContent='El cociente depende solo de '+r.variable+'. Se usa μ = exp(∫ cociente d'+r.variable+'), hasta un factor constante no nulo.';
  math('transformed','\\left('+tex(r.A)+'\\right)dx+\\left('+tex(r.B)+'\\right)dy=0');
 }
 if(r.F){
  functions.F=compile(r.F);showStatus(r.exact?'Exacta · Mᵧ = Nₓ. Función potencial verificada.':'Convertida en exacta · factor integrante y función potencial verificados.');
  math('potential',tex(r.F)+'=C');$('reconstruction').hidden=false;
  $('solution-note').textContent='Se verificó Fₓ = '+(r.exact?'M':'μM')+' y Fᵧ = '+(r.exact?'N':'μN')+'. Las curvas se muestran solo donde las expresiones son reales y finitas y μ ≠ 0.';
  $('constant').disabled=false;$('initial-form').querySelector('button').disabled=false;
  grid=null;buildGrid();applyInitial();
 }else{
  showStatus(r.status==='unsupported'?'No es exacta · no se encontró μ(x) ni μ(y) con los métodos implementados.':'Exactitud verificada · no se obtuvo una función potencial explícita.',true);
  $('potential').textContent='No se obtuvo una solución simbólica con estos métodos.';
  $('solution-note').textContent=r.status==='unsupported'?'Puede existir otro factor integrante. Este resultado no demuestra que no exista.':'El motor simbólico no completó una primitiva verificable.';
  $('graph-note').textContent='Se muestra únicamente el campo de direcciones de la ecuación original; no hay curvas solución calculadas.';draw();
 }
}
function valid(x,y){
 if(!result)return false;
 const m=functions.M(x,y),n=functions.N(x,y),mu=functions.mu(x,y);
 return Number.isFinite(m)&&Number.isFinite(n)&&Number.isFinite(mu)&&mu!==0;
}
function applyInitial(){
 if(!result?.F)return;
 const x=Number($('x0').value),y=Number($('y0').value);
 if(!Number.isFinite(x)||!Number.isFinite(y)||!valid(x,y)||!Number.isFinite(functions.F(x,y))){point=null;$('initial-note').textContent='El punto queda fuera del dominio real válido de estas expresiones. No se ha aplicado.';draw();return;}
 const m=functions.M(x,y),n=functions.N(x,y);
 if(Math.abs(m)+Math.abs(n)<1e-10){point=null;$('initial-note').textContent='Punto singular: M y N se anulan. No se selecciona una solución particular sin un análisis adicional.';draw();return;}
 C=functions.F(x,y);point={x,y};setSlider();
 $('initial-note').textContent='C = F('+fmt(x)+', '+fmt(y)+') = '+fmt(C)+'.'+(Math.abs(n)<1e-9?' La tangente es vertical; no se representa localmente como y(x).':'')+(x<bounds.xmin||x>bounds.xmax||y<bounds.ymin||y>bounds.ymax?' El punto queda fuera de la ventana visible.':'');
 draw();
}
function setSlider(){
 const vals=grid?.values.filter(Number.isFinite).sort((a,b)=>a-b)||[-10,10];
 const a=vals[Math.floor(vals.length*.1)]??-10,b=vals[Math.floor(vals.length*.9)]??10;
 const d=Math.max(b-a,Math.abs(C)*.5,2);
 $('constant').min=Math.min(a,C-d*.2);$('constant').max=Math.max(b,C+d*.2);$('constant').step=d/1000;$('constant').value=C;$('c-value').textContent=fmt(C);
}
function buildGrid(){
 if(!result?.F)return;
 const nx=144,ny=112,values=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const x=bounds.xmin+(bounds.xmax-bounds.xmin)*i/nx,y=bounds.ymin+(bounds.ymax-bounds.ymin)*j/ny;
  values.push(valid(x,y)?functions.F(x,y):NaN);
 }
 grid={nx,ny,values};
}
let geometry;
function draw(){
 const ratio=window.devicePixelRatio||1,w=plot.clientWidth||700,h=plot.clientHeight||440;
 plot.width=w*ratio;plot.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
 const pad={l:48,r:24,t:20,b:35},availableW=w-pad.l-pad.r,availableH=h-pad.t-pad.b,scale=Math.min(availableW/(bounds.xmax-bounds.xmin),availableH/(bounds.ymax-bounds.ymin)),W=scale*(bounds.xmax-bounds.xmin),H=scale*(bounds.ymax-bounds.ymin);pad.l+=(availableW-W)/2;pad.t+=(availableH-H)/2;
 const sx=x=>pad.l+(x-bounds.xmin)/(bounds.xmax-bounds.xmin)*W,sy=y=>pad.t+H-(y-bounds.ymin)/(bounds.ymax-bounds.ymin)*H;
 geometry={pad,W,H,sx,sy};
 ctx.save();ctx.beginPath();ctx.rect(pad.l,pad.t,W,H);ctx.clip();
 const tick=span=>{const q=span/8,e=10**Math.floor(Math.log10(q)),f=q/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e};
 const tx=tick(bounds.xmax-bounds.xmin),ty=tick(bounds.ymax-bounds.ymin);
 ctx.lineWidth=1;ctx.strokeStyle='#e9eef4';ctx.beginPath();
 for(let x=Math.ceil(bounds.xmin/tx)*tx;x<=bounds.xmax;x+=tx){ctx.moveTo(sx(x),pad.t);ctx.lineTo(sx(x),pad.t+H)}
 for(let y=Math.ceil(bounds.ymin/ty)*ty;y<=bounds.ymax;y+=ty){ctx.moveTo(pad.l,sy(y));ctx.lineTo(pad.l+W,sy(y))}ctx.stroke();
 ctx.strokeStyle='#a3b3c4';ctx.beginPath();if(bounds.xmin<=0&&bounds.xmax>=0){ctx.moveTo(sx(0),pad.t);ctx.lineTo(sx(0),pad.t+H)}if(bounds.ymin<=0&&bounds.ymax>=0){ctx.moveTo(pad.l,sy(0));ctx.lineTo(pad.l+W,sy(0))}ctx.stroke();
 if(result&&$('field').checked){
  ctx.strokeStyle='#bbc9d8';ctx.lineWidth=1;
  for(let i=0;i<22;i++)for(let j=0;j<17;j++){
   const x=bounds.xmin+(i+.5)/22*(bounds.xmax-bounds.xmin),y=bounds.ymin+(j+.5)/17*(bounds.ymax-bounds.ymin);
   if(!valid(x,y))continue;
   const m=functions.M(x,y),n=functions.N(x,y),dx=n*W/(bounds.xmax-bounds.xmin),dy=m*H/(bounds.ymax-bounds.ymin),len=Math.hypot(dx,dy);if(!Number.isFinite(len)||len<1e-9)continue;
   const k=Math.min(W/22,H/17)*.32/len;ctx.beginPath();ctx.moveTo(sx(x)-dx*k,sy(y)-dy*k);ctx.lineTo(sx(x)+dx*k,sy(y)+dy*k);ctx.stroke();
  }
 }
 if(grid&&result?.F){
  const vals=grid.values.filter(Number.isFinite).sort((a,b)=>a-b);
  if($('family').checked&&vals.length){const lo=vals[Math.floor(vals.length*.08)],hi=vals[Math.floor(vals.length*.86)];if(hi>lo)for(let i=0;i<9;i++)contour(lo+(hi-lo)*i/8,'#5f8fbd',1.25);}
  contour(C,'#c38100',2.8);
  if(point){ctx.fillStyle='#c38100';ctx.beginPath();ctx.arc(sx(point.x),sy(point.y),5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();}
 }
 ctx.restore();ctx.fillStyle='#607184';ctx.font='11px system-ui';ctx.textAlign='center';
 for(let x=Math.ceil(bounds.xmin/tx)*tx;x<=bounds.xmax;x+=tx)ctx.fillText(fmt(x),sx(x),pad.t+H+22);
 ctx.textAlign='right';for(let y=Math.ceil(bounds.ymin/ty)*ty;y<=bounds.ymax;y+=ty)ctx.fillText(fmt(y),pad.l-9,sy(y)+4);
 ctx.fillStyle='#18324c';ctx.font='italic 14px Georgia';ctx.fillText('x',pad.l+W+16,pad.t+H+22);ctx.fillText('y',pad.l-8,pad.t-5);
 if(result?.F){$('c-value').textContent=fmt(C);math('selected',tex(result.F)+'='+fmt(C));$('graph-note').textContent=point?'El punto marcado pertenece al nivel seleccionado. El nivel puede contener otras ramas; las curvas son aproximaciones numéricas.':'Mueve C para recorrer la familia. Haz clic en la gráfica para seleccionar una condición inicial.';}
}
function contour(level,color,width){
 const {nx,ny,values}=grid,{pad,W,H}=geometry;ctx.beginPath();ctx.lineWidth=width;ctx.strokeStyle=color;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const ids=[j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i];const vs=ids.map(k=>values[k]-level);if(vs.some(v=>!Number.isFinite(v)))continue;
  const xy=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],cross=[];
  for(let a=0;a<4;a++){const b=(a+1)%4;if((vs[a]>=0)===(vs[b]>=0))continue;const t=vs[a]/(vs[a]-vs[b]);cross.push([xy[a][0]+t*(xy[b][0]-xy[a][0]),xy[a][1]+t*(xy[b][1]-xy[a][1])]);}
  // Ambiguous saddle cells are omitted to avoid connecting unrelated branches.
  if(cross.length!==2)continue;
  const p=cross[0],q=cross[1];const mx=bounds.xmin+((p[0]+q[0])/2)/nx*(bounds.xmax-bounds.xmin),my=bounds.ymin+((p[1]+q[1])/2)/ny*(bounds.ymax-bounds.ymin);
  if(!valid(mx,my))continue;
  const fv=functions.F(mx,my);const variation=Math.max(...vs)-Math.min(...vs);if(!Number.isFinite(fv)||Math.abs(fv-level)>Math.max(variation*.6,1e-7))continue;
  ctx.moveTo(pad.l+p[0]/nx*W,pad.t+H-p[1]/ny*H);ctx.lineTo(pad.l+q[0]/nx*W,pad.t+H-q[1]/ny*H);
 }ctx.stroke();
}
$('equation-form').addEventListener('submit',e=>{e.preventDefault();analyze()});
$('example').addEventListener('change',()=>{const [m,n,x,y]=presets[Number($('example').value)];$('m').value=m;$('n').value=n;$('x0').value=x;$('y0').value=y;analyze()});
for(const id of ['m','n'])$(id).addEventListener('input',()=>{worker?.terminate();clearTimeout(timer);generation++;$('solve').disabled=false;$('solve').textContent='Analizar y graficar →';resetGraph();showStatus('Ecuación modificada · pulsa Analizar y graficar.',true)});
$('initial-form').addEventListener('submit',e=>{e.preventDefault();applyInitial()});
$('constant').addEventListener('input',()=>{C=Number($('constant').value);point=null;$('initial-note').textContent='Nivel elegido con el deslizador. Aplica de nuevo el punto si quieres una condición inicial.';draw()});
for(const id of ['family','field'])$(id).addEventListener('change',draw);
$('view-form').addEventListener('submit',e=>{e.preventDefault();const b=Object.fromEntries(['xmin','xmax','ymin','ymax'].map(k=>[k,Number($(k).value)]));if(Object.values(b).some(v=>!Number.isFinite(v)||Math.abs(v)>1e4)||b.xmax-b.xmin<.05||b.ymax-b.ymin<.05){error('La ventana debe tener límites crecientes, amplitud mínima de 0,05 y valores entre −10000 y 10000.');return}error('');bounds=b;buildGrid();if(result?.F)setSlider();draw()});
plot.addEventListener('click',e=>{if(!result?.F||!geometry)return;const r=plot.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,{pad,W,H}=geometry;if(px<pad.l||px>pad.l+W||py<pad.t||py>pad.t+H)return;$('x0').value=fmt(bounds.xmin+(px-pad.l)/W*(bounds.xmax-bounds.xmin));$('y0').value=fmt(bounds.ymax-(py-pad.t)/H*(bounds.ymax-bounds.ymin));applyInitial()});
$('download').addEventListener('click',()=>{const a=document.createElement('a');a.download='curvas-ecuacion-diferencial.png';a.href=plot.toDataURL('image/png');a.click()});
new ResizeObserver(()=>draw()).observe(plot);analyze();
