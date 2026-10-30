/* Symbolic calculation is isolated in a timed Web Worker by the UI. */
(function(root){
const n=typeof nerdamer!=='undefined'?nerdamer:require('./vendor/nerdamer.min.js');
const simp=s=>n('simplify('+s+')').toString();
const diff=(s,v)=>n.diff(s,v).toString();
const zero=s=>simp(s)==='0';
function parse(s){
 if(typeof s!=='string'||s.length>160||!s.trim())throw Error('Escribe una expresión de hasta 160 caracteres.');
 s=s.replace(/π/g,'pi').replace(/−/g,'-').replace(/\bln\b/g,'log');
 if(!/^[0-9a-zA-Z_+*\/^().,\s-]+$/.test(s))throw Error('Usa números, x, y y operaciones; introduce los coeficientes sin dx, dy ni el signo igual.');
 const allowed=['x','y','e','pi','sin','cos','tan','exp','log','sqrt','abs','sinh','cosh'];
 for(const token of s.match(/[A-Za-z_]+/g)||[])if(!allowed.includes(token))throw Error('Símbolo no admitido: '+token+'. Usa solo x e y como variables.');
 if((s.match(/\^/g)||[]).length>6)throw Error('Reduce la cantidad de potencias de la expresión.');
 const e=n(s);if(e.variables().some(v=>!['x','y'].includes(v)))throw Error('Solo se admiten las variables x e y.');
 return e.toString();
}
function solve(m,nn){
 const M=parse(m),N=parse(nn);if(zero(M)&&zero(N))throw Error('0 dx + 0 dy = 0 no determina curvas solución.');
 const My=diff(M,'y'),Nx=diff(N,'x');const exact=zero('('+My+')-('+Nx+')');
 let A=M,B=N,mu='1',variable=null,ratio=null,primitive=null;
 if(!exact){
  const cases=[['x',N,'('+My+')-('+Nx+')'],['y',M,'('+Nx+')-('+My+')']];
  for(const [v,den,num] of cases){
   if(zero(den))continue;
   try{
    const r=simp('('+num+')/('+den+')');
    if(n(r).variables().some(w=>w!==v))continue;
    const p=n.integrate(r,v).toString();if(/integrate|defint/.test(p))continue;
    const u=simp('exp('+p+')');const aa=simp('('+u+')*('+M+')'),bb=simp('('+u+')*('+N+')');
    if(!zero('('+diff(aa,'y')+')-('+diff(bb,'x')+')'))continue;
    variable=v;ratio=r;primitive=p;mu=u;A=aa;B=bb;break;
   }catch(e){}
  }
  if(!variable)return {M,N,My,Nx,exact:false,status:'unsupported'};
 }
 let F=null;
 for(const [a,b,v,w] of [[A,B,'x','y'],[B,A,'y','x']]){
  try{
   const base=n.integrate(a,v).toString();if(/integrate|defint/.test(base))continue;
   const rem=simp('('+b+')-('+diff(base,w)+')');if(n(rem).variables().includes(v))continue;
   const extra=n.integrate(rem,w).toString();if(/integrate|defint/.test(extra))continue;
   const f=simp('('+base+')+('+extra+')');
   if(zero('('+diff(f,'x')+')-('+A+')')&&zero('('+diff(f,'y')+')-('+B+')')){F=f;break;}
  }catch(e){}
 }
 return {M,N,My,Nx,exact,mu,variable,ratio,primitive,A,B,F,status:F?'solved':'no-primitive'};
}
root.ExactSolver={solve,parse};
if(typeof module!=='undefined')module.exports=root.ExactSolver;
})(typeof self!=='undefined'?self:globalThis);
