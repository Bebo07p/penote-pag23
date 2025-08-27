// public/js/app.js
// Elementos
const textInput = document.getElementById('textInput');
const fontSizeRange = document.getElementById('fontSize');
const densityRange = document.getElementById('density');
const dotSizeRange = document.getElementById('dotSize');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const outCanvas = document.getElementById('outCanvas');
const enterBtn = document.getElementById('enterBtn');
const downloadPNG = document.getElementById('downloadPNG');

const nameField = document.getElementById('nameField');
const imgInput = document.getElementById('imgInput');
const imgPreview = document.getElementById('imgPreview');
const saveInfo = document.getElementById('saveInfo');
const resetAll = document.getElementById('resetAll');
const infoShow = document.getElementById('infoShow');
const infoName = document.getElementById('infoName');
const infoImg = document.getElementById('infoImg');
const infoDesc = document.getElementById('infoDesc');

const uploaderPanel = document.getElementById('uploaderPanel');
const publicList = document.getElementById('publicList');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const sendLogin = document.getElementById('sendLogin');
const closeLogin = document.getElementById('closeLogin');
const loginMsg = document.getElementById('loginMsg');

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

function generateASCII(){
  const text = textInput.value || 'INFO COMP';
  const fontSize = Number(fontSizeRange.value);
  const density = Number(densityRange.value);
  const dotSize = Number(dotSizeRange.value);

  measureCtx.font = `bold ${fontSize}px serif`;
  const txtWidth = Math.ceil(measureCtx.measureText(text).width);
  const txtHeight = Math.ceil(fontSize * 1.2);
  measureCanvas.width = txtWidth;
  measureCanvas.height = txtHeight;

  measureCtx.fillStyle = '#000';
  measureCtx.fillRect(0,0,measureCanvas.width,measureCanvas.height);
  measureCtx.fillStyle = '#fff';
  measureCtx.font = `bold ${fontSize}px serif`;
  measureCtx.fillText(text,0, fontSize*0.9);

  outCanvas.width = txtWidth;
  outCanvas.height = txtHeight;
  const ctx = outCanvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,outCanvas.width,outCanvas.height);

  const img = measureCtx.getImageData(0,0,measureCanvas.width,measureCanvas.height).data;
  const scale = Math.max(1, Math.floor(460 / outCanvas.width));
  const outWidth = outCanvas.width * scale;
  const outHeight = outCanvas.height * scale;
  outCanvas.style.width = outWidth + 'px';
  outCanvas.style.height = outHeight + 'px';
  ctx.setTransform(scale,0,0,scale,0,0);

  for(let y=0;y<measureCanvas.height;y+=density){
    for(let x=0;x<measureCanvas.width;x+=density){
      const idx = (y*measureCanvas.width + x) * 4;
      const r = img[idx], g = img[idx+1], b = img[idx+2];
      const bright = (r+g+b)/3;
      if(bright > 10){
        const jitterX = (Math.random()-0.5) * (density*0.3);
        const jitterY = (Math.random()-0.5) * (density*0.3);
        ctx.beginPath();
        ctx.fillStyle = '#ff1b1b';
        ctx.arc(x + jitterX, y + jitterY, dotSize/2, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }
}

generateBtn.addEventListener('click', ()=> generateASCII());
clearBtn.addEventListener('click', ()=>{
  const ctx = outCanvas.getContext('2d');
  ctx.clearRect(0,0,outCanvas.width,outCanvas.height);
  outCanvas.style.width = '0px';
  outCanvas.style.height = '0px';
});

downloadPNG.addEventListener('click', ()=>{
  if(!outCanvas.width) return alert('Genera primero el ASCII');
  const displayW = outCanvas.clientWidth;
  const displayH = outCanvas.clientHeight;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = displayW;
  exportCanvas.height = displayH;
  const ectx = exportCanvas.getContext('2d');
  ectx.drawImage(outCanvas, 0, 0, displayW, displayH);
  const url = exportCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = 'ascii-info-comp.png';
  a.click();
});

enterBtn.addEventListener('click', ()=>{
  const uploader = document.querySelector('.uploader');
  uploader.scrollIntoView({behavior:'smooth',block:'center'});
});

// Image preview
imgInput.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  imgPreview.src = url; imgPreview.style.display = 'block';
  infoImg.src = url;
});

// Save: submit to server (admin only)
saveInfo.addEventListener('click', async ()=>{
  const name = nameField.value || 'INFO COMP';
  const desc = document.getElementById('desc').value || '';
  const file = imgInput.files[0] || null;

  const form = new FormData();
  form.append('name', name);
  form.append('description', desc);
  if(file) form.append('image', file);

  try {
    const res = await fetch('/api/info', { method: 'POST', body: form });
    if(!res.ok){
      const err = await res.json();
      alert('Error: ' + (err.error || JSON.stringify(err)));
      return;
    }
    const data = await res.json();
    alert('Información subida correctamente.');
    document.getElementById('desc').value = '';
    imgInput.value = '';
    imgPreview.style.display = 'none';
    infoShow.style.display = 'none';
    loadPublicInfo();
  } catch(e){
    alert('Error en subida: ' + e);
  }
});

resetAll.addEventListener('click', ()=>{
  nameField.value = 'INFO COMP';
  document.getElementById('desc').value = '';
  imgPreview.src = ''; imgPreview.style.display='none';
  infoShow.style.display = 'none';
  textInput.value = 'INFO COMP';
  clearBtn.click();
});

// Live updates
[textInput,fontSizeRange,densityRange,dotSizeRange].forEach(el=>el.addEventListener('input', ()=>{
  if(window._asciiTimeout) clearTimeout(window._asciiTimeout);
  window._asciiTimeout = setTimeout(()=>generateASCII(),150);
}));

// --- Auth & UI ---
function showLoginModal(show){
  loginModal.classList.toggle('hidden', !show);
}

loginBtn.addEventListener('click', ()=> showLoginModal(true));
closeLogin.addEventListener('click', ()=> showLoginModal(false));

sendLogin.addEventListener('click', async ()=>{
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if(!email || !password){ loginMsg.textContent = 'Llena ambos campos'; return; }
  loginMsg.textContent = 'Entrando...';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok){ loginMsg.textContent = data.error || 'Error'; return; }
    loginMsg.textContent = 'Autenticado';
    showLoginModal(false);
    loginEmail.value = ''; loginPassword.value = '';
    await refreshSessionUI();
    loadPublicInfo();
  } catch(e){
    loginMsg.textContent = 'Error de red';
  }
});

logoutBtn.addEventListener('click', async ()=>{
  await fetch('/api/logout', { method: 'POST' });
  await refreshSessionUI();
  loadPublicInfo();
});

async function refreshSessionUI(){
  try {
    const res = await fetch('/api/session');
    const s = await res.json();
    if(s.authenticated && s.isAdmin){
      uploaderPanel.style.display = 'flex';
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      uploaderPanel.style.display = 'none';
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  } catch(e){
    console.error(e);
  }
}

// Load public info
async function loadPublicInfo(){
  publicList.innerHTML = 'Cargando...';
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    publicList.innerHTML = '';
    if(!Array.isArray(data) || data.length === 0){
      publicList.innerHTML = '<div class="small">No hay información publicada.</div>';
      return;
    }
    data.forEach(item => {
      const card = document.createElement('div');
      card.style = 'background:#080808;border-radius:8px;padding:10px;border:1px solid rgba(255,0,0,0.04);display:flex;gap:10px;align-items:flex-start';
      const left = document.createElement('div');
      left.style = 'width:120px;height:80px;flex-shrink:0;overflow:hidden;border-radius:6px;background:#000';
      if(item.image_url){
        const img = document.createElement('img');
        img.src = item.image_url;
        img.style = 'width:100%;height:100%;object-fit:cover';
        left.appendChild(img);
      } else {
        left.textContent = 'Sin imagen';
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.justifyContent = 'center';
        left.style.color = '#ff9b9b';
      }
      const right = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = item.name;
      title.style = 'font-weight:800;color:var(--red);margin-bottom:6px';
      const desc = document.createElement('div');
      desc.textContent = item.description || '';
      desc.style = 'white-space:pre-wrap;color:#ffcdcd';
      right.appendChild(title);
      right.appendChild(desc);
      card.appendChild(left);
      card.appendChild(right);
      publicList.appendChild(card);
    });
  } catch(e){
    publicList.innerHTML = '<div class="small">Error cargando contenido.</div>';
  }
}

// Init
window.addEventListener('load', async ()=>{
  generateASCII();
  await refreshSessionUI();
  await loadPublicInfo();
});
