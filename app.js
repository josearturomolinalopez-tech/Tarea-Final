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
