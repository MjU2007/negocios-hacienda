// Actualiza los precios sugeridos de negocios-hacienda.html (bloque PRECIOS) y comprueba que la página siga andando.
// Uso: node scripts/actualizar-precios.js nuevos.json
// nuevos.json: {"semana":"23 al 29/10/2026","urlCG":"...","magFecha":"28/10/2026","urlMAG":"...",
//   "rangos":{"terneros":{"160-180":6500,...},"terneras":{...},"novillitos":{...},"vaquillonas":{...}},
//   "cg":{"vaqPren":..,"vacaNuevaPren":..,"vacaMedioPren":..,"vacaNuevaCria":..},
//   "mag":{"novillito":..,"vaquillona":..,"novillo":..,"vaca":..,"toro":..,"mej":..,"vacaConserva":..}}
// Los rangos que esta semana no tengan operaciones conservan el precio anterior.
const fs=require('fs'), path=require('path'), vm=require('vm');
const HTML=path.join(__dirname,'..','negocios-hacienda.html');
const RCATS=['terneros','terneras','novillitos','vaquillonas'];
const CGK=['vaqPren','vacaNuevaPren','vacaMedioPren','vacaNuevaCria'];
const MGK=['novillito','vaquillona','novillo','vaca','toro','mej','vacaConserva'];
const MAXCAMBIO=0.35; // si un precio cambia más de 35 % contra la semana anterior, se frena (probable error de lectura)
const fail=m=>{ console.error('NO SE ACTUALIZÓ: '+m); process.exit(1); };
const nuevo=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let html=fs.readFileSync(HTML,'utf8');
const A='/*PRECIOS:INICIO*/', B='/*PRECIOS:FIN*/', i=html.indexOf(A), j=html.indexOf(B);
if(i<0||j<0) fail('no encuentro el bloque PRECIOS en la página');
const ctx={}; vm.runInNewContext(html.slice(i,j+B.length).replace('const PRECIOS=','PRECIOS='),ctx); const viejo=ctx.PRECIOS;
for(const k of ['semana','urlCG','magFecha','urlMAG']) if(typeof nuevo[k]!=='string'||!nuevo[k].trim()) fail('falta '+k);
const problemas=[], num=v=>typeof v==='number'&&isFinite(v)&&v>0;
const comparar=(nombre,v,o)=>{ if(!num(v)) problemas.push(nombre+' falta o no es un número'); else if(num(o)&&Math.abs(v/o-1)>MAXCAMBIO) problemas.push(nombre+': '+o+' → '+v+' (cambia '+Math.round((v/o-1)*100)+' %)'); };
CGK.forEach(k=>comparar('cg.'+k,nuevo.cg&&nuevo.cg[k],viejo.cg[k]));
MGK.forEach(k=>comparar('mag.'+k,nuevo.mag&&nuevo.mag[k],viejo.mag[k]));
const rangos={};
RCATS.forEach(c=>{ const nv=(nuevo.rangos&&nuevo.rangos[c])||{}; rangos[c]={...viejo.rangos[c]};
  Object.entries(nv).forEach(([r,v])=>{ if(!/^\d+-\d+$/.test(r)){ problemas.push(c+': rango inválido '+r); return; } comparar(c+' '+r,v,viejo.rangos[c][r]); rangos[c][r]=v; }); });
if(problemas.length) fail(problemas.join('; '));
if(nuevo.semana===viejo.semana&&nuevo.magFecha===viejo.magFecha){ console.log('Sin cambios: ya están los precios de la semana '+viejo.semana); process.exit(0); }
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const obj=(o,keys)=>'{'+keys.map(k=>k+':'+Math.round(o[k])).join(', ')+'}';
const robj=o=>'{'+Object.keys(o).sort((a,b)=>parseInt(a)-parseInt(b)).map(r=>"'"+r+"':"+Math.round(o[r])).join(', ')+'}';
const bloque=A+`
// Precios de referencia para los negocios NUEVOS. Se actualizan solos cada semana (tarea programada).
// Los negocios ya guardados no cambian: guardan sus propios precios.
const PRECIOS={
  semana:${q(nuevo.semana)}, urlCG:${q(nuevo.urlCG)},
  magFecha:${q(nuevo.magFecha)}, urlMAG:${q(nuevo.urlMAG)},
  rangos:{
${RCATS.map(c=>'    '+c+':'+robj(rangos[c])).join(',\n')}
  },
  cg:${obj(nuevo.cg,CGK)},
  mag:${obj(nuevo.mag,MGK)}
};
`+B;
html=html.slice(0,i)+bloque+html.slice(j+B.length);
// historial semanal (pestaña Precios): se agrega la semana nueva (o se reemplaza si ya estaba)
{ const HA='/*HISTORIAL:INICIO*/', HB='/*HISTORIAL:FIN*/', hi=html.indexOf(HA), hj=html.indexOf(HB);
  if(hi<0||hj<0) fail('no encuentro el bloque HISTORIAL en la página');
  const hc={}; vm.runInNewContext(html.slice(hi,hj).replace(HA,'').replace('const HIST=','HIST='),hc); let hist=hc.HIST||[];
  const m=nuevo.semana.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/); if(!m) fail('no entiendo la fecha de la semana: '+nuevo.semana);
  const fin=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  hist=hist.filter(e=>e.semana!==nuevo.semana&&e.fin!==fin);
  hist.push({semana:nuevo.semana,fin,magFecha:nuevo.magFecha,rangos,cg:nuevo.cg,mag:nuevo.mag});
  hist.sort((a,b)=>a.fin<b.fin?-1:1); hist=hist.slice(-104);
  const ent=e=>"  {semana:"+q(e.semana)+", fin:"+q(e.fin)+", magFecha:"+q(e.magFecha)+(e.est?", est:1":"")+",\n   rangos:{"+RCATS.map(c=>c+':'+robj(e.rangos[c]||{})).join(', ')+"},\n   cg:"+obj(e.cg,CGK)+", mag:"+obj(e.mag,MGK)+"}";
  const hb=HA+"\n// Historial semanal de precios (lo completa la tarea de los viernes). est:1 = semana calculada con la variación publicada.\nconst HIST=[\n"+hist.map(ent).join(',\n')+"\n];\n"+HB;
  html=html.slice(0,hi)+hb+html.slice(hj+HB.length); }
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
try{ scripts.forEach(c=>new vm.Script(c)); }catch(e){ fail('la página quedaría con un error: '+e.message); }
fs.writeFileSync(HTML,html);
console.log('Precios actualizados: semana '+nuevo.semana+' (Círculo Ganadero) y MAG '+nuevo.magFecha);
RCATS.forEach(c=>Object.keys(rangos[c]).forEach(r=>{ const o=viejo.rangos[c][r], v=rangos[c][r]; if(o!==v) console.log('  '+c+' '+r+': '+(o||'—')+' → '+v); }));
CGK.forEach(k=>{ if(nuevo.cg[k]!==viejo.cg[k]) console.log('  cg.'+k+': '+viejo.cg[k]+' → '+nuevo.cg[k]); });
MGK.forEach(k=>{ if(nuevo.mag[k]!==viejo.mag[k]) console.log('  mag.'+k+': '+viejo.mag[k]+' → '+nuevo.mag[k]); });
