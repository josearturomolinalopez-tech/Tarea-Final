// /app.js
const COSTO_ENVIO = 2.0;


const IMAGENES = {
  pep: '2.png',
  '4q': '3.png',
  mar: '4.png',
};


const MENU = [
  { id:'pep', nombre:'Pepperoni', descripcion:'Pepperoni y queso extra', imagen: IMAGENES.pep, precios:{ personal:4, mediana:7, familiar:9 } },
  { id:'mar', nombre:'Margarita', descripcion:'Tomate, mozzarella, albahaca', imagen: IMAGENES.mar, precios:{ personal:5, mediana:8, familiar:10 } },
  { id:'4q',  nombre:'4 Quesos', descripcion:'Mozzarella, gorgonzola, parmesano, ricotta', imagen: IMAGENES['4q'], precios:{ personal:6, mediana:9, familiar:11 } },
];

const estado = { carrito: cargar('pg_carrito', []), ultimoPedido: cargar('pg_pedido', null), selecciones:{} };
const $ = s=>document.querySelector(s), $$ = s=>Array.from(document.querySelectorAll(s));
const formatoDinero = n=>`$${n.toFixed(2)}`;

/* Ayudantes de Almacenamiento */
function cargar(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}}
function guardar(k,v){localStorage.setItem(k,JSON.stringify(v));}
function eliminar(k){localStorage.removeItem(k);}
function etiquetarTamano(s){return s==='personal'?'Personal':s==='mediana'?'Mediana':'Familiar';}
function imagenPara(id){ const item = MENU.find(x=>x.id===id); return item? item.imagen : IMAGENES.pep; }


function configurarMenuMovil(){
  const btn = $('#alternar-menu'), panel = $('#menu-movil'), telon = $('#menu-telon');
  if(!btn || !panel || !telon) return;
  const abrirMenu = ()=>{ panel.removeAttribute('hidden'); telon.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); document.body.classList.add('sin-scroll'); };
  const cerrarMenu = ()=>{ panel.setAttribute('hidden',''); telon.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); document.body.classList.remove('sin-scroll'); };
  btn.addEventListener('click', ()=> (panel.hasAttribute('hidden') ? abrirMenu() : cerrarMenu()));
  telon.addEventListener('click', cerrarMenu);
  panel.querySelectorAll('a').forEach(a=>a.addEventListener('click', cerrarMenu));
  window.addEventListener('scroll', ()=>{ if(!panel.hasAttribute('hidden')) cerrarMenu(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') cerrarMenu(); });
}


// Teléfono: ####-#### (8 dígitos)
function enmascararTelefono(el){
  const digitos = el.value.replace(/\D/g,'').slice(0,8);
  const salida = digitos.length > 4 ? digitos.slice(0,4)+'-'+digitos.slice(4) : digitos;
  el.value = salida;
}
// Tarjeta: #### #### #### #### (16 dígitos)
function enmascararNumeroTarjeta(el){
  const digitos = el.value.replace(/\D/g,'').slice(0,16);
  el.value = digitos.replace(/(\d{4})(?=\d)/g,'$1 ').trim();
}
// Vencimiento: MM/AA con validación de fecha no pasada
function enmascararVencimiento(el){
  let digitos = el.value.replace(/\D/g,'').slice(0,4);
  if(digitos.length>=3){
    const mm = Math.min(Math.max(parseInt(digitos.slice(0,2)||'0',10),1),12).toString().padStart(2,'0');
    const yy = digitos.slice(2);
    el.value = `${mm}/${yy}`;
  }else{
    el.value = digitos;
  }
  validarVencimientoNoPasado(el);
}
function validarVencimientoNoPasado(el){
  el.setCustomValidity('');
  const m = /^(\d{2})\/(\d{2})$/.exec(el.value);
  if(!m){ return; }
  const mm = parseInt(m[1],10);
  const yy = 2000 + parseInt(m[2],10);
  const ahora = new Date();
  const finDeMes = new Date(yy, mm, 0);

  if(yy < ahora.getFullYear() || (yy === ahora.getFullYear() && mm < (ahora.getMonth()+1))){
    el.setCustomValidity('La tarjeta está vencida.');
  }else{
    el.setCustomValidity('');
  }
}

/* ===== Menú ===== */
function renderizarMenu(){
  const rejilla = $('#rejilla-menu'); rejilla.innerHTML = '';
  MENU.forEach(item=>{
    const tamano = estado.selecciones[item.id] || 'mediana';
    const precio = item.precios[tamano];
    const tarjeta = document.createElement('article'); tarjeta.className='tarjeta';
    tarjeta.innerHTML = `
      <img src="${item.imagen}" alt="Pizza ${item.nombre}">
      <h3>${item.nombre}</h3>
      <p>${item.descripcion}</p>
      <div class="fila-tamano" role="group" aria-label="Tamaño">
        ${['personal','mediana','familiar'].map(s=>`<button class="${s===tamano?'activo':''}" data-size="${s}">${etiquetarTamano(s)}</button>`).join('')}
      </div>
      <div class="tarjeta-pie">
        <div class="precio" aria-live="polite">${formatoDinero(precio)}</div>
        <button class="btn-agregar" data-id="${item.id}">Añadir</button>
      </div>`;
    tarjeta.querySelectorAll('.fila-tamano button').forEach(btn=>{
      btn.addEventListener('click', ()=>{ estado.selecciones[item.id]=btn.dataset.size; renderizarMenu(); });
    });
    tarjeta.querySelector('.btn-agregar').addEventListener('click', ()=>{
      const s = estado.selecciones[item.id] || 'mediana'; agregarAlCarrito(item.id, s, 1);
    });
    rejilla.appendChild(tarjeta);
  });
}

/* ===== Carrito con PROMO ===== */
function agregarAlCarrito(id,tamano,cantidad){
  const linea=estado.carrito.find(l=>l.id===id&&l.size===tamano);
  if(linea) linea.qty+=cantidad; else estado.carrito.push({id,size:tamano,qty:cantidad});
  guardar('pg_carrito',estado.carrito); renderizarCarrito();
}
function actualizarCantidad(id,tamano,delta){
  const linea=estado.carrito.find(l=>l.id===id&&l.size===tamano);
  if(!linea) return;
  linea.qty+=delta;
  if(linea.qty<=0) estado.carrito=estado.carrito.filter(l=>!(l.id===id&&l.size===tamano));
  guardar('pg_carrito',estado.carrito); renderizarCarrito();
}
function vaciarCarrito(){ estado.carrito=[]; guardar('pg_carrito',estado.carrito); renderizarCarrito(); }

function calcular(){
  let subtotal=0, contadorFamiliar=0;
  const items=estado.carrito.map(l=>{
    const p=MENU.find(x=>x.id===l.id);
    const unidad=p.precios[l.size]; const linea=unidad*l.qty; subtotal+=linea;
    if(l.size==='familiar') contadorFamiliar += l.qty;
    return {...l,nombre:p.nombre,unidad,linea,imagen:p.imagen};
  });

  // Por cada 2 familiares => 1 pepperoni personal gratis
  const regalos = Math.floor(contadorFamiliar/2);
  if(regalos>0){
    items.push({id:'pep',nombre:'Pepperoni (Promo)',size:'personal',qty:regalos,unidad:0,linea:0,promo:true,imagen:IMAGENES.pep});
  }

  const envio=items.filter(i=>!i.promo).length?COSTO_ENVIO:0;
  const descuento=$('#pago')?.value==='online' ? (subtotal*0.10) : 0;
  const total=subtotal-descuento+envio;
  return {items, subtotal, descuento, envio, total};
}

function renderizarCarrito(){
  const lista=$('#lista-carrito'), vacio=$('#carrito-vacio'); lista.innerHTML='';
  const {items, subtotal, descuento, envio, total}=calcular();
  if(!items.length){ vacio.classList.remove('ocultar'); lista.classList.add('ocultar'); }
  else{
    vacio.classList.add('ocultar'); lista.classList.remove('ocultar');
    items.forEach(l=>{
      const fila=document.createElement('div'); fila.className='linea';
      fila.innerHTML=`<img src="${imagenPara(l.id)}" alt="">
        <div><div style="font-weight:700">${l.nombre} <span class="pedido-id">${etiquetarTamano(l.size)}</span> ${l.promo?'<span class="pedido-id" style="background:#2e4920;border-color:#2e4920">Gratis</span>':''}</div>
        <div class="apagado">${formatoDinero(l.unidad)} c/u</div></div>
        <div class="cantidad"></div>`;
      const q=fila.querySelector('.cantidad');
      if(l.promo){ q.textContent=`× ${l.qty}`; }
      else{
        q.innerHTML=`<button aria-label="Menos">–</button><div aria-live="polite" style="min-width:24px;text-align:center">${l.qty}</div><button aria-label="Más">+</button><button class="btn-texto" title="Eliminar">✕</button>`;
        const [disminuir,aumentar,btnEliminar]=q.querySelectorAll('button');
        aumentar.addEventListener('click',()=>actualizarCantidad(l.id,l.size,+1));
        disminuir.addEventListener('click',()=>actualizarCantidad(l.id,l.size,-1));
        btnEliminar.addEventListener('click',()=>actualizarCantidad(l.id,l.size,-l.qty));
      }
      lista.appendChild(fila);
    });
  }
  $('#subtotal').textContent=formatoDinero(subtotal);
  $('#descuento').textContent=`-${formatoDinero(descuento)}`;
  $('#envio').textContent=formatoDinero(envio);
  $('#total').textContent=formatoDinero(total);
}
/* ===== Pagar pedido + Pago en línea ===== */
function validarFormulario(){
  for(const id of ['nombre','telefono','direccion']){
    const el = document.getElementById(id);
    if(!el.checkValidity()) return false;
  }
  return estado.carrito.length>0;
}
function enviarPedido(e){
  e.preventDefault();
  const estadoFormulario=$('#estado-formulario');
  if(!validarFormulario()){
    estadoFormulario.textContent='Completa los campos y agrega productos.'; estadoFormulario.style.color='#ffb4b4'; return;
  }
  if($('#pago').value==='online'){ abrirHojaPago(); }
  else{ realizarPedido(); }
}
function realizarPedido(){
  const totales=calcular();
  const pedido={
    id:`PG-${Date.now().toString().slice(-6)}`,
    at:new Date().toISOString(),
    cliente:{nombre:$('#nombre').value.trim(), telefono:$('#telefono').value.trim(), direccion:$('#direccion').value.trim()},
    pago:$('#pago').value,
    ...totales, paso:0
  };
  if(pedido.pago==='online'){
    const dlg=document.getElementById('modal-pago'), texto=document.getElementById('texto-pago');
    dlg.showModal(); texto.textContent='Procesando pago…';
    setTimeout(()=>{ texto.textContent='Pago aprobado ✔'; setTimeout(()=>{ dlg.close(); finalizarPedido(pedido,$('#estado-formulario')); },700); },1200);
  }else{
    finalizarPedido(pedido,$('#estado-formulario'));
  }
}
function finalizarPedido(pedido,elEstado){
  estado.ultimoPedido=pedido; guardar('pg_pedido',estado.ultimoPedido);
  vaciarCarrito();
  elEstado.textContent='Pedido confirmado. Revisa el estado abajo.'; elEstado.style.color='#9CC645';
  location.hash='#estado'; renderizarEstado();
}

/* ===== Pantalla de pago ===== */
function abrirHojaPago(){
  const hoja = document.getElementById('hoja-pago');
  const btnCerrar = document.getElementById('cerrar-pago');
  const btnCancelar = document.getElementById('cancelar-pago');
  const formulario = document.getElementById('formulario-pago');
  const num = document.getElementById('numeroTarjeta');
  const vencimiento = document.getElementById('vencimiento');

  hoja.showModal();
  const cerrar = ()=>hoja.close();
  btnCerrar.onclick = btnCancelar.onclick = cerrar;

  // Validación adicional de vencimiento
  vencimiento.addEventListener('input', ()=>enmascararVencimiento(vencimiento));
  vencimiento.addEventListener('blur', ()=>validarVencimientoNoPasado(vencimiento));

  formulario.onsubmit = (ev)=>{
    ev.preventDefault();

    enmascararNumeroTarjeta(num); enmascararVencimiento(vencimiento);
    const camposOk = ['nombreTarjeta','numeroTarjeta','vencimiento','cvv'].every(id => document.getElementById(id).checkValidity());
    if(!camposOk || vencimiento.validationMessage){
      formulario.reportValidity(); return;
    }
    cerrar();
    realizarPedido();
  };
}

/* ===== Estado + Mapa */
let mapa,repartidor,marcadorDestino;
const SUCURSAL=[13.6929,-89.2182]; // Sucursal
const DESTINO={lat:13.7042, lng:-89.1081, label:'Bosques de la Paz, Ilopango · Calle 19 Poniente'};
const POSICION_REPARTIDOR='pg_pos_repartidor';

function asegurarMapa(){
  if(mapa) return;
  mapa=L.map('mapa',{zoomControl:true}).setView(SUCURSAL,13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mapa);
  L.marker(SUCURSAL).addTo(mapa).bindPopup('Pizza Gorditos (Sucursal)');
  marcadorDestino = L.marker([DESTINO.lat, DESTINO.lng]).addTo(mapa).bindPopup(DESTINO.label);
}
function obtenerPosicionRepartidor(){ return cargar(POSICION_REPARTIDOR, null); }
function establecerPosicionRepartidor(latlng){ guardar(POSICION_REPARTIDOR, latlng); }
function eliminarPosicionRepartidor(){ eliminar(POSICION_REPARTIDOR); }

function renderizarEstado(){
  const sin=$('#sin-pedido'), info=$('#info-pedido');
  if(!estado.ultimoPedido){ sin.classList.remove('ocultar'); info.classList.add('ocultar'); return; }
  sin.classList.add('ocultar'); info.classList.remove('ocultar');

  const o=estado.ultimoPedido;
  $('#id-pedido').textContent=o.id;
  const dir=o.cliente?.direccion ? ` · Envío a: ${o.cliente.direccion}` : '';
  $('#resumen-pedido').textContent=o.items.map(i=>`${i.qty}× ${i.nombre} ${etiquetarTamano(i.size)}`).join(', ') + ` — Total ${formatoDinero(o.total)}${dir}`;

  $$('.linea-tiempo .paso').forEach(el=>{ const s=Number(el.dataset.step); el.classList.toggle('activo', s<=o.paso); });

  asegurarMapa();
  const guardada = obtenerPosicionRepartidor();

  if(!repartidor){
    const latlngInicio = (o.paso<3 && guardada) ? guardada : SUCURSAL;
    repartidor=L.marker(latlngInicio).addTo(mapa).bindPopup('Repartidor');
  }else if(o.paso<3 && guardada){
    repartidor.setLatLng(guardada);
  }

  mapa.fitBounds([SUCURSAL, [DESTINO.lat, DESTINO.lng]], { padding:[30,30] });

  const eta=new Date(Date.now()+(40-o.paso*10)*60000);
  $('#texto-eta').textContent=o.paso<3?`Estimado de entrega: ${eta.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'¡Entregado!';

  if(o.paso>=2 && o.paso<3 && !guardada){
    animarRepartidor(SUCURSAL, [DESTINO.lat, DESTINO.lng], 4000);
  }
}
function animarRepartidor(de,a,ms){
  const inicio=performance.now();
  (function bucle(ahora){
    const t=Math.min(1,(ahora-inicio)/ms);
    const lat=de[0]+(a[0]-de[0])*t, lng=de[1]+(a[1]-de[1])*t;
    const pos=[lat,lng];
    repartidor.setLatLng(pos);
    establecerPosicionRepartidor(pos);
    if(t<1) requestAnimationFrame(bucle);
  })(inicio);
}
function avanzarPaso(){
  if(!estado.ultimoPedido) return;
  if(estado.ultimoPedido.paso<3){
    estado.ultimoPedido.paso += 1;
    if(estado.ultimoPedido.paso===3){ eliminarPosicionRepartidor(); }
    guardar('pg_pedido', estado.ultimoPedido);
    renderizarEstado();
  }
}


document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('anio').textContent=new Date().getFullYear();
  configurarMenuMovil();

  if(estado.ultimoPedido && estado.ultimoPedido.paso===3){ eliminar('pg_pedido'); eliminarPosicionRepartidor(); estado.ultimoPedido=null; }

  
  const telefono = document.getElementById('telefono');
  telefono.addEventListener('input', ()=>enmascararTelefono(telefono));
  telefono.addEventListener('paste', e=>{ e.preventDefault(); telefono.value = (e.clipboardData.getData('text')||''); enmascararTelefono(telefono); });

  const tarjeta = document.getElementById('numeroTarjeta');
  const vencimiento  = document.getElementById('vencimiento');
  const cvv  = document.getElementById('cvv');
  if(tarjeta){
    tarjeta.addEventListener('input', ()=>enmascararNumeroTarjeta(tarjeta));
    tarjeta.addEventListener('paste', e=>{ e.preventDefault(); tarjeta.value=(e.clipboardData.getData('text')||''); enmascararNumeroTarjeta(tarjeta); });
  }
  if(vencimiento){
    vencimiento.addEventListener('input', ()=>enmascararVencimiento(vencimiento));
    vencimiento.addEventListener('paste', e=>{ e.preventDefault(); vencimiento.value=(e.clipboardData.getData('text')||''); enmascararVencimiento(vencimiento); });
  }
  if(cvv){
    cvv.addEventListener('input', ()=>{ cvv.value = cvv.value.replace(/\D/g,'').slice(0,4); });
  }

  renderizarMenu(); renderizarCarrito(); renderizarEstado();
  $('#pago').addEventListener('change', renderizarCarrito);
  $('#abrir-carrito').addEventListener('click', ()=>{ location.hash='#pago-pedido'; });
  $('#vaciar-carrito').addEventListener('click', vaciarCarrito);
  $('#formulario-pedido').addEventListener('submit', enviarPedido);
  $('#avanzar').addEventListener('click', avanzarPaso);
});
