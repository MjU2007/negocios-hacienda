# negocios-hacienda
## Precios sugeridos (actualización semanal)

Los precios sugeridos para negocios nuevos están en el bloque `/*PRECIOS:INICIO*/ … /*PRECIOS:FIN*/` de `negocios-hacienda.html`.
Una tarea programada los actualiza cada viernes con Círculo Ganadero (invernada y vientres por rango de peso, semana completa) y el
Mercado Agroganadero (hacienda gorda), usando `node scripts/actualizar-precios.js nuevos.json`. El script frena si algún
precio cambia más de 35 % contra la semana anterior y comprueba que la página siga compilando.
Los negocios ya guardados no cambian: guardan sus propios precios.
