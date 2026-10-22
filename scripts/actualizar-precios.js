// Actualiza los precios sugeridos de negocios-hacienda.html (bloque PRECIOS) y comprueba que la página siga andando.
// Uso: node scripts/actualizar-precios.js nuevos.json
// nuevos.json: {"semana":"23 al 29/10/2026","urlCG":"...","magFecha":"28/10/2026","urlMAG":"...","cg":{...},"mag":{...}}
const fs=require('fs'), path=require('path'), vm=require('vm');
const HTML=path.join(__dirname,'..','negocios-hacienda.html');
const CGK=['ternero','ternera','terneroDest','terneraDest','novillito','novilloInv','vaquillona','vaqPren','vacaNuevaPren','vacaMedioPren','vacaNuevaCria'];
const MGK=['novillito','vaquillona','novillo','vaca','toro','mej','vacaConserva'];
const MAXCAMBIO=0.35; // si un precio cambia más de 35 % contra la semana anterior, se frena (probable error de lectura)
const fail=m=>{ console.error('NO SE ACTUALIZÓ: '+m); process.exit(1); };
const nuevo=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let html=fs.readFileSync(HTML,'utf8');
const A='/*PRECIOS:INICIO*/', B='/*PRECIOS:FIN*/', i=html.indexOf(A), j=html.indexOf(B);
if(i<0||j<0) fail('no encuentro el bloque PRECIOS en la página');
const viejoTxt=html.slice(i,j+B.length), ctx={}; vm.runInNewContext(viejoTxt.replace('const PRECIOS=','PRECIOS='),ctx); const viejo=ctx.PRECIOS;
for(const k of ['semana','urlCG','magFecha','urlMAG']) if(typeof nuevo[k]!=='string'||!nuevo[k].trim()) fail('falta '+k);
const problemas=[];
const chk=(grupo,keys)=>keys.forEach(k=>{ const v=nuevo[grupo]&&nuevo[grupo][k], o=viejo[grupo][k];
  if(typeof v!=='number'||!isFinite(v)||v<=0) problemas.push(grupo+'.'+k+' falta o no es un número');
  else if(Math.abs(v/o-1)>MAXCAMBIO) problemas.push(grupo+'.'+k+': '+o+' → '+v+' (cambia '+Math.round((v/o-1)*100)+' %)'); });
chk('cg',CGK); chk('mag',MGK);
if(problemas.length) fail(problemas.join('; '));
if(nuevo.semana===viejo.semana&&nuevo.magFecha===viejo.magFecha){ console.log('Sin cambios: ya están los precios de la semana '+viejo.semana); process.exit(0); }
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const obj=(o,keys)=>'{'+keys.map(k=>k+':'+Math.round(o[k])).join(', ')+'}';
const bloque=A+`
// Precios de referencia para los negocios NUEVOS. Se actualizan solos cada semana (tarea programada).
// Los negocios ya guardados no cambian: guardan sus propios precios.
const PRECIOS={
  semana:${q(nuevo.semana)}, urlCG:${q(nuevo.urlCG)},
  magFecha:${q(nuevo.magFecha)}, urlMAG:${q(nuevo.urlMAG)},
  cg:${obj(nuevo.cg,CGK)},
  mag:${obj(nuevo.mag,MGK)}
};
`+B;
html=html.slice(0,i)+bloque+html.slice(j+B.length);
// que los scripts de la página sigan compilando
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
try{ scripts.forEach(c=>new vm.Script(c)); }catch(e){ fail('la página quedaría con un error: '+e.message); }
fs.writeFileSync(HTML,html);
console.log('Precios actualizados: semana '+nuevo.semana+' (Círculo Ganadero) y MAG '+nuevo.magFecha);
CGK.forEach(k=>{ if(nuevo.cg[k]!==viejo.cg[k]) console.log('  cg.'+k+': '+viejo.cg[k]+' → '+nuevo.cg[k]); });
MGK.forEach(k=>{ if(nuevo.mag[k]!==viejo.mag[k]) console.log('  mag.'+k+': '+viejo.mag[k]+' → '+nuevo.mag[k]); });
