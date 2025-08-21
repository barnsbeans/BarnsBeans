const LS_KEY = 'barns-demo-state';
const USER_NAME_KEY = 'barns-user-name';
const SESSION_INIT_KEY = 'barns-session-initialized';
const COFFEE_COUNTER_KEY = 'barns-coffee-counter';
const initialState = { green: 0, gold: 0, streak: 12, leaves: 0, friends: 11, coffeeCounter: 0 };
const LEAVES_COUNT = 44;
const LEAVES_MAP_KEY = 'barns-leaves-map';
const SKIPPED_LEAF_INDICES = new Set([38, 39, 42, 43]);
const LEAF_POSITIONS = [
  {x:33, y:48}, {x:38, y:39}, {x:67, y:57}, {x:54, y:41}, {x:75, y:40},
  {x:28, y:39}, {x:32, y:58}, {x:22, y:46}, {x:84, y:40}, {x:53, y:50},
  {x:55, y:32}, {x:24, y:55}, {x:15, y:52}, {x:13, y:43}, {x:76, y:31},
  {x:40, y:60}, {x:45, y:32}, {x:33, y:31}, {x:67, y:32}, {x:57, y:39},
  {x:79, y:23}, {x:20, y:17}, {x:42, y:23}, {x:52, y:23}, {x:84, y:49},
  {x:85, y:31}, {x:25, y:26}, {x:32, y:21}, {x:15, y:26}, {x:18, y:34},
  {x:56, y:15}, {x:63, y:10, variant: 1}, {x:30, y:12}, {x:46, y:15},
  {x:64, y:23, variant: 10}, {x:72, y:16}, {x:39, y:10},
   {x:50, y:6, variant: 10},
  {x:90, y:20}, {x:90, y:20}, {x:76, y:53}, {x:45, y:44},
];
const GOLD_TTL_MS = 5 * 60 * 1000;
const GOLD_EXP_KEY = 'barns-gold-expiries';
const LAST_LEAF_MS_KEY = 'barns-last-leaf-added-ms';
const INACTIVITY_THRESHOLD_MS = 0.5 * 60 * 1000;

function scopedKey(base) {
  const name = (userName || '').trim().toLowerCase();
  return name ? `${base}:${encodeURIComponent(name)}` : base;
}
function scopedKeyFor(base, name) {
  const n = (name || '').trim().toLowerCase();
  return n ? `${base}:${encodeURIComponent(n)}` : base;
}
function stateKey(){ return scopedKey(LS_KEY); }
function leavesMapKey(){ return scopedKey(LEAVES_MAP_KEY); }
function goldExpKey(){ return scopedKey(GOLD_EXP_KEY); }

let qrStream = null;
let leafLossInProgress = false;
let userName = loadUserName();
let state = loadState();

function setImageFromCandidates(imgEl, candidates) {
  if (!imgEl || !Array.isArray(candidates) || candidates.length === 0) return;
  let idx = 0;
  const tryNext = () => {
    if (idx >= candidates.length) return;
    const src = candidates[idx++]; 0
    imgEl.onerror = tryNext;
    imgEl.src = src;
  };
  tryNext();
}

function buildPeopleImageCandidates(firstName) {
  const base = (firstName || '').trim();
  if (!base) {
    return [
      'imgs/people/person.png',
      'imgs/people/person.jpg',
      'imgs/people/person.jpeg',
      'imgs/people/person.webp',
    ];
  }
  const cap = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  const variants = [base, base.toLowerCase(), base.toUpperCase(), cap];
  const exts = ['.jpeg', '.jpg', '.png', '.webp'];
  const out = [];
  variants.forEach(v => exts.forEach(ext => out.push(`imgs/people/${v}${ext}`)));
  out.push('imgs/people/person.png', 'imgs/people/person.jpg', 'imgs/people/person.jpeg', 'imgs/people/person.webp');
  return out;
}

function animateCountUp(elementId, targetValue, duration = 900) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const to = Math.max(0, Number(targetValue) || 0);
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function frame(now){
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(progress);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = String(current);
    if (progress < 1) requestAnimationFrame(frame);
  }
  el.textContent = '0';
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'login') {
    mountLoginPage();
  } else {
    if (!userName) {
      window.location.href = 'login.html';
      return;
    }
    fillCounters();
    mountPageSpecific();
  }
});

function loadState() {
  try { 
    const savedState = JSON.parse(localStorage.getItem(stateKey())) || {};
    const coffeeCounter = loadCoffeeCounter();
    return { ...initialState, ...savedState, coffeeCounter }; 
  }
  catch { 
    const coffeeCounter = loadCoffeeCounter();
    return { ...initialState, coffeeCounter }; 
  }
}
function saveState() { localStorage.setItem(stateKey(), JSON.stringify(state)); }

function loadCoffeeCounter() {
  try { return Number(localStorage.getItem(scopedKey(COFFEE_COUNTER_KEY))) || 0; }
  catch { return 0; }
}

function saveCoffeeCounter(counter) { 
  try { localStorage.setItem(scopedKey(COFFEE_COUNTER_KEY), String(counter)); } 
  catch {} 
}

function resetCoffeeCounter() {
  state.coffeeCounter = 0;
  saveCoffeeCounter(0);
  saveState();
  fillCounters();
  console.log('تم إعادة تعيين عداد Beans إلى 0');
}

function ensureCoffeeCounterReset() {
  // التأكد من أن العداد يعرض القيمة الصحيحة
  if (state.coffeeCounter >= 10) {
    resetCoffeeCounter();
  }
}

function incrementCoffeeCounter() {
  state.coffeeCounter += 5;
  
  if (state.coffeeCounter >= 10) {
    // عند الوصول إلى 10، نضع العداد على 10 أولاً
    state.coffeeCounter = 10;
    saveCoffeeCounter(state.coffeeCounter);
    saveState();
    fillCounters();
    
    // إضافة ورقة خضراء عند الوصول إلى 10 Beans
    state.leaves = Math.min(LEAVES_COUNT, state.leaves + 1);
    const res = addOneLeafToMap(false);
    if (res && res.status === 'gold') { 
      state.gold += 1; 
    } else { 
      state.green += 1; 
    }
    saveState();
    
    // عرض رسالة المكافأة
    showCoffeeRewardPopup();
    
    // إعادة تعيين العداد إلى 0 فوراً بعد الرسالة
    setTimeout(() => {
      resetCoffeeCounter();
      
      // تحديث الشجرة لتعرض الورقة الجديدة
      const canvas = document.getElementById('treeCanvas');
      if (canvas) {
        drawTreeImages(canvas, state.green, state.gold);
      }
    }, 1500); // تقليل الوقت إلى 1.5 ثانية
    
  } else {
    // إذا لم نصل إلى 10، نحفظ القيمة الحالية
    saveCoffeeCounter(state.coffeeCounter);
    saveState();
    fillCounters();
  }
}

function showCoffeeRewardPopup() {
  const popup = document.createElement('div');
  popup.className = 'coffee-reward-popup';
  popup.innerHTML = `
    <div class="coffee-reward-content">
      <div class="coffee-reward-icon">🎉</div>
      <h3 class="coffee-reward-title">مبروك! 🎊</h3>
      <p class="coffee-reward-text">لقد وصلت إلى 10 Beans!</p>
      <p class="coffee-reward-text">تم إضافة ورقة جديدة لشجرتك! 🌿</p>
      <div class="coffee-reward-progress">10 of 10 مكتمل! ✨</div>
      <div class="coffee-reward-hint">سيتم إعادة تعيين العداد إلى 0</div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // إضافة تأثيرات إضافية
  setTimeout(() => {
    const icon = popup.querySelector('.coffee-reward-icon');
    if (icon) {
      icon.style.animation = 'iconBounce 0.8s ease-in-out infinite';
    }
  }, 1000);
  
  // إزالة الرسالة بعد 3 ثوانٍ
  setTimeout(() => {
    if (popup.parentNode) {
      popup.style.animation = 'popupFadeOut 0.5s ease-in forwards';
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 500);
    }
  }, 3000);
}

function markLeafActivityNow(){
  try { localStorage.setItem(scopedKey(LAST_LEAF_MS_KEY), String(Date.now())); } catch {}
}
function readLeafActivity(){
  try { return Number(localStorage.getItem(scopedKey(LAST_LEAF_MS_KEY))||'0'); } catch { return 0; }
}

function loadUserName() {
  return localStorage.getItem(USER_NAME_KEY) || '';
}
function saveUserName(name) { 
  localStorage.setItem(USER_NAME_KEY, name);
  userName = name;
}

function resetTreeCounters() {
  state.green = 0;
  state.gold = 0;
  state.leaves = 0;
  state.coffeeCounter = 0;
  saveState();
  saveCoffeeCounter(0);
  try { localStorage.removeItem(leavesMapKey()); } catch {}
  try { localStorage.removeItem(goldExpKey()); } catch {}
}

function fillCounters() {
  setText('home-green', state.green);
  setText('home-green-count', state.green);
  setText('home-gold-count', state.gold);

  setText('stat-green', state.green);
  normalizeExpiredGold();
  setText('stat-gold', state.gold);
  
  // التأكد من أن العداد يعرض القيمة الصحيحة
  ensureCoffeeCounterReset();
  setText('stat-coffee', `${state.coffeeCounter} of 10`);
  
  setText('streak', state.streak);
  setText('qr-green', state.green);
  setText('qr-gold', state.gold);
  setText('qr-total', state.green + state.gold);
  setText('card-total', state.green + state.gold);
  setText('friend-green', state.green);
  setText('friend-gold', state.gold);
  setText('friends-count', state.friends);
  setText('user-name', userName);
  const canvas = document.getElementById('treeCanvas');
  if (canvas) {
    drawTreeImages(canvas, state.green, state.gold);
  } else {
    const svg = document.getElementById('treeSVG');
    if (svg) drawTree(svg, state.green + state.gold);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function computeLeafPosition(i) {
  const base = LEAF_POSITIONS[i % LEAF_POSITIONS.length];
  const variant = base && base.variant ? Number(base.variant) : ((i % 10) + 1);
  return { left: base.x, top: base.y, variant };
}

function drawTreeImages(canvasEl, greenLeavesCount = 0, goldLeavesCount = 0) {
  renderTreeLeaves(canvasEl);
  const map = syncLeavesMapToCounts(greenLeavesCount, goldLeavesCount);
  applyLeavesMapToCanvas(canvasEl, map);
}

function getFillOrderIndices(count = LEAVES_COUNT) {
  const all = Array.from({ length: count }, (_, i) => i);
  return all.filter(i => !SKIPPED_LEAF_INDICES.has(i));
}

function renderTreeLeaves(canvasEl) {
  const layer = document.getElementById('treeLayer') || canvasEl;
  const oldLeaves = layer.querySelectorAll('.tree-leaf');
  oldLeaves.forEach(n => n.remove());
  const order = getFillOrderIndices();
  for (let i of order) {
    const pos = computeLeafPosition(i);
    const leaf = document.createElement('div');
    const url = `url(imgs/Tree/leaves/leave${pos.variant}.svg)`;
    leaf.className = 'tree-leaf tree-leaf--empty';
    leaf.dataset.index = String(i);
    leaf.style.left = pos.left + '%';
    leaf.style.top = pos.top + '%';
    leaf.style.webkitMaskImage = url;
    leaf.style.maskImage = url;
    if (i === 19) {
      leaf.style.transform = 'rotate(259deg)';
    }
    layer.appendChild(leaf);
  }
}

function applyLeavesMapToCanvas(canvasEl, map) {
  const layer = document.getElementById('treeLayer') || canvasEl;
  const leaves = layer.querySelectorAll('.tree-leaf');
  leaves.forEach((leaf) => {
    const idx = Number(leaf.dataset.index || '0');
    if (SKIPPED_LEAF_INDICES.has(idx)) { leaf.remove(); return; }
    const status = map[idx] || 'empty';
    leaf.className = 'tree-leaf ' + 'tree-leaf--' + status;
  });
}

function normalizeExpiredGold() {
  try {
    const rawExp = localStorage.getItem(goldExpKey());
    const exp = rawExp ? JSON.parse(rawExp) : [];
    let changed = false;
    let map = loadLeavesMap();
    const now = Date.now();
    for (let i = 0; i < map.length; i++) {
      if (map[i] === 'gold') {
        const valid = exp[i] && now < exp[i];
        if (!valid) {
          map[i] = 'green';
          if (state.gold > 0) state.gold -= 1;
          state.green += 1;
          changed = true;
        }
      }
    }
    if (changed) {
      saveLeavesMap(map);
      saveState();
    }
  } catch {}
}

function loadLeavesMap() {
  try {
    const raw = localStorage.getItem(leavesMapKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === LEAVES_COUNT) return parsed;
  } catch {}
  return Array.from({ length: LEAVES_COUNT }, () => 'empty');
}

function saveLeavesMap(map) {
  try { localStorage.setItem(leavesMapKey(), JSON.stringify(map)); } catch {}
}

function generateBalancedMap(greenCount, goldCount) {
  const total = Math.min(LEAVES_COUNT, Math.max(0, greenCount + goldCount));
  const map = Array.from({ length: LEAVES_COUNT }, () => 'empty');
  const goldToPlace = Math.min(total, goldCount);
  const goldPositions = getSpreadPositions(total, goldToPlace);
  const order = getFillOrderIndices();
  for (let i = 0; i < total; i++) {
    const canvasIdx = order[i];
    const isGold = goldPositions.has(i);
    map[canvasIdx] = isGold ? 'gold' : 'green';
  }
  const exp = Array.from({ length: LEAVES_COUNT }, () => 0);
  const now = Date.now();
  for (let idx = 0; idx < LEAVES_COUNT; idx++) {
    if (map[idx] === 'gold') exp[idx] = now + GOLD_TTL_MS;
  }
  try { localStorage.setItem(goldExpKey(), JSON.stringify(exp)); } catch {}
  return map;
}

function getSpreadPositions(total, picks) {
  const set = new Set();
  if (picks <= 0 || total <= 0) return set;
  for (let k = 1; k <= picks; k++) {
    const pos = Math.round((k * (total + 1)) / (picks + 1)) - 1;
    set.add(Math.max(0, Math.min(total - 1, pos)));
  }
  return set;
}

function syncLeavesMapToCounts(greenCount, goldCount) {
  let map = loadLeavesMap();
  const targetFilled = Math.min(LEAVES_COUNT, Math.max(0, greenCount + goldCount));
  const currentFilled = map.filter(s => s !== 'empty').length;
  if (currentFilled !== targetFilled || map.filter(s=>s==='gold').length !== goldCount) {
    map = generateBalancedMap(greenCount, goldCount);
    saveLeavesMap(map);
  }
  return map;
}

function addOneLeafToMap(isGold) {
  const map = loadLeavesMap();
  const order = getFillOrderIndices();
  const nextIdx = order.find(i => map[i] === 'empty');
  if (nextIdx == null) return null;
  const shouldBeGold = ((nextIdx + 1) % 5 === 0);
  map[nextIdx] = (isGold || shouldBeGold) ? 'gold' : 'green';
  saveLeavesMap(map);
  try {
    const raw = localStorage.getItem(goldExpKey());
    const exp = raw ? JSON.parse(raw) : Array.from({ length: LEAVES_COUNT }, () => 0);
    const finalGold = map[nextIdx] === 'gold';
    exp[nextIdx] = finalGold ? (Date.now() + GOLD_TTL_MS) : 0;
    localStorage.setItem(goldExpKey(), JSON.stringify(exp));
  } catch {}
  return { map, index: nextIdx, status: map[nextIdx] };
}

function ensureRewardModal() {
  if (document.getElementById('reward-modal')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'reward-modal';
  wrapper.className = 'reward-modal hidden';
  document.body.appendChild(wrapper);
}

function hideRewardModal() {
  const modal = document.getElementById('reward-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

function showGoldRewardPopup() {
  ensureRewardModal();
  const modal = document.getElementById('reward-modal');
  if (!modal) return;
  const reward = getRandomReward();
  const isCode = reward.type === 'code';
  modal.innerHTML = `
    <div class="reward-modal__backdrop"></div>
    <div class="reward-modal__dialog" role="dialog" aria-modal="true" aria-label="Gold reward">
      <button class="reward-close" aria-label="Close">×</button>
      <div class="reward-illust">
        <img src="imgs/Tree/Counter/بن ذهبية.svg" alt="Gold bean" />
      </div>
      <h3 class="reward-title">Congratulations! Gold Leaf ✨</h3>
      <div class="reward-content">
        ${isCode ? `
          <div class="reward-label">Discount code:</div>
          <div class="code-box" id="reward-code">${reward.value}</div>
          <button class="copy-btn" id="copy-reward" data-code="${reward.value}">Copy code</button>
        ` : `
          <div class="reward-label">Your gift 🎁:</div>
          <div class="gift-box">${reward.value}</div>
        `}
      </div>
      <button class="primary reward-cta" id="reward-ok">OK</button>
    </div>
  `;
  modal.classList.remove('hidden');
  const backdrop = modal.querySelector('.reward-modal__backdrop');
  const closeBtn = modal.querySelector('.reward-close');
  const okBtn = modal.querySelector('#reward-ok');
  const copyBtn = modal.querySelector('#reward-copy');
  function closeAll(){ hideRewardModal(); }
  if (backdrop) backdrop.addEventListener('click', closeAll);
  if (closeBtn) closeBtn.addEventListener('click', closeAll);
  if (okBtn) okBtn.addEventListener('click', closeAll);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = copyBtn.getAttribute('data-code') || '';
      if (!code) return;
      try {
        navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied ✔';
      } catch {
        const codeEl = document.getElementById('reward-code');
        if (codeEl) {
          const range = document.createRange();
          range.selectNode(codeEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          copyBtn.textContent = 'Copy manually';
        }
      }
    });
  }
}

function getRandomReward() {
  const showCode = Math.random() < 0.5;
  if (showCode) {
    return { type: 'code', value: generateDiscountCode() };
  }
  const gifts = [
    'Free size upgrade',
    'Free cookie',
    'Free extra espresso shot',
    'Free caramel topping',
  ];
  const gift = gifts[Math.floor(Math.random() * gifts.length)];
  return { type: 'gift', value: gift };
}

function generateDiscountCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BRNS-${part()}-${part()}`;
}

function ensureLossModal(){
  if (document.getElementById('loss-modal')) return;
  const el = document.createElement('div');
  el.id = 'loss-modal';
  el.className = 'loss-modal hidden';
  const screen = document.querySelector('.screen') || document.body;
  screen.appendChild(el);
}

function hideLossModal(){
  const m = document.getElementById('loss-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.innerHTML = '';
}

function showLossModalWithFallingLeaf(onAfterFall){
  ensureLossModal();
  const m = document.getElementById('loss-modal');
  if (!m) return;
  m.innerHTML = `
    <div class="loss-modal__backdrop"></div>
    <div class="loss-modal__dialog" role="dialog" aria-modal="true" aria-label="Leaf lost">
      <div class="loss-header">
        <div class="loss-title">Unfortunately 😢!</div>
        <div class="loss-sub">You lost</div>
        <div class="loss-count" id="loss-count">3</div>
        <div class="loss-sub">leaves today</div>
      </div>
      <div class="loss-leaf-wrap loss-leaf-sway">
        <div class="loss-leaf" aria-hidden="true"></div>
      </div>
    </div>
  `;
  m.classList.remove('hidden');
  const backdrop = m.querySelector('.loss-modal__backdrop');
  const dialog = m.querySelector('.loss-modal__dialog');
  if (backdrop) backdrop.addEventListener('click', () => hideLossModal());
  if (dialog) dialog.addEventListener('click', () => hideLossModal());
  try {
    const el = document.getElementById('loss-count');
    if (el) el.textContent = '1';
  } catch {}
  setTimeout(() => { try { onAfterFall && onAfterFall(); } catch {} }, 3000);
}

function removeOldestGreenLeaf(){
  let map = loadLeavesMap();
  const order = getFillOrderIndices();
  let idx = order.find(i => map[i] === 'green');
  if (idx == null) idx = order.find(i => map[i] !== 'empty');
  if (idx == null) return false;
  const was = map[idx];
  map[idx] = 'empty';
  saveLeavesMap(map);
  if (was === 'green' && state.green > 0) state.green -= 1;
  if (was === 'gold' && state.gold > 0) state.gold -= 1;
  saveState();
  const canvas = document.getElementById('treeCanvas');
  if (canvas) {
    drawTreeImages(canvas, state.green, state.gold);
  }
  fillCounters();
  return true;
}

function startInactivityWatcher(){
  if (leafLossInProgress) return;
  const page = document.body.dataset.page;
  if (page !== 'tree') return;
  const check = () => {
    if (leafLossInProgress) return;
    const last = readLeafActivity();
    const now = Date.now();
    if (!last) return;
    if (now - last >= INACTIVITY_THRESHOLD_MS) {
      let hasAnyLeaf = false;
      try {
        const map = loadLeavesMap();
        hasAnyLeaf = map.some(s => s !== 'empty');
      } catch {}
      if (!hasAnyLeaf && (state.green + state.gold) <= 0) {
        markLeafActivityNow();
        return;
      }
      leafLossInProgress = true;
      showLossModalWithFallingLeaf(() => {
        removeOldestGreenLeaf();
        markLeafActivityNow();
        leafLossInProgress = false;
      });
    }
  };
  setInterval(check, 5000);
}

async function setupQrCamera() {
  try {
    const video = document.getElementById('qr-video');
    if (!video) return;
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = qrStream;
  } catch (err) {
  }
}

async function stopQrCamera() {
  try {
    if (qrStream) {
      qrStream.getTracks().forEach(t => t.stop());
    }
  } catch {}
  qrStream = null;
}

function startQrScanningLoop() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  if (!video || !canvas) return;
  const ctx = canvas.getContext('2d');
  let scanning = true;
  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth || 220;
      canvas.height = video.videoHeight || 220;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const code = jsQR(img.data, img.width, img.height);
        if (code && code.data) {
          scanning = false;
          handleQrResult(code.data);
          return;
        }
      } catch {}
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function handleQrResult(data) {
  try { await stopQrCamera(); } catch {}
  
  // زيادة عداد Beans بعد مسح QR بنجاح
  incrementCoffeeCounter();
  
  try {
    const url = new URL(data);
    try { window.open(url.href, '_blank', 'noopener'); } catch {}
  } catch {
    try {
      const href = 'qr-result.html?data=' + encodeURIComponent(String(data||''));
      window.open(href, '_blank', 'noopener');
    } catch {
      alert('QR: ' + data);
    }
  }
  
  // لا نضيف ورقة خضراء هنا - فقط عداد Beans
  // state.leaves = Math.min(LEAVES_COUNT, state.leaves + 1);
  // const res = addOneLeafToMap(false);
  // if (res && res.status === 'gold') { state.gold += 1; } else { state.green += 1; }
  // saveState();
  
  try { localStorage.setItem('barns-invite-members', JSON.stringify(['Mohammad Al zain'])); } catch {}
  markLeafActivityNow();
  window.location.href = 'rate.html';
}

function drawTree(svg, greenLeaves = 0) {
  svg.innerHTML = '';
  const trunk = document.createElementNS('http://www.w3.org/2000/svg','path');
  trunk.setAttribute('d','M140 280 C 150 220 140 190 165 150 C 183 120 205 105 235 98 C 210 125 210 150 230 160 C 245 150 260 145 275 145 C 260 160 255 175 257 190 C 300 170 330 175 355 180 C 300 205 280 260 280 300 C 280 340 272 370 258 390 C 235 425 210 430 180 430 C 170 430 160 428 150 425 C 165 400 170 365 170 330 C 170 300 168 275 140 280 Z');
  trunk.setAttribute('fill','none');
  trunk.setAttribute('stroke','#6B3F1D');
  trunk.setAttribute('stroke-width','16');
  trunk.setAttribute('stroke-linecap','round');
  trunk.setAttribute('stroke-linejoin','round');
  const gTrunk = document.createElementNS('http://www.w3.org/2000/svg','g');
  gTrunk.setAttribute('transform','translate(40,10)');
  gTrunk.appendChild(trunk);
  svg.appendChild(gTrunk);
  const beans = [];
  for (let i=0;i<LEAVES_COUNT;i++) {
    const angle = (i/LEAVES_COUNT)*Math.PI*2;
    const radius = 140 + (i%2===0?10:-10);
    const x = 260 + Math.cos(angle) * radius;
    const y = 210 + Math.sin(angle) * (radius*0.66);
    beans.push({x,y});
  }
  beans.forEach((p, idx) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    const r = 12;
    const ell = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
    ell.setAttribute('rx', r); ell.setAttribute('ry', r*0.65);
    const isGreen = idx < greenLeaves;
    ell.setAttribute('fill', isGreen ? '#2ea66d' : '#A7AFB0');
    ell.setAttribute('opacity', isGreen ? '1' : '0.55');
    const shine = document.createElementNS('http://www.w3.org/2000/svg','path');
    shine.setAttribute('d', `M ${-r*0.4} 0 C ${-r*0.3} ${-r*0.6}, ${r*0.1} ${-r*0.2}, 0 0 C ${r*0.1} ${r*0.2}, ${-r*0.3} ${r*0.6}, ${-r*0.4} 0`);
    shine.setAttribute('fill','#fff'); shine.setAttribute('opacity','0.7');
    g.appendChild(ell); g.appendChild(shine); svg.appendChild(g);
  });
}

function mountLoginPage() {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('userName');
      const name = nameInput.value.trim();
      if (name) {
        saveUserName(name);
        window.location.href = 'index.html';
      }
    });
  }
}

function mountPageSpecific() {
  const page = document.body.dataset.page;
  if (page === 'qr') {
    setupQrCamera();
    startQrScanningLoop();
    const btn = document.getElementById('qr-close');
    if (btn) btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await stopQrCamera();
      window.location.href = 'tree.html';
    });
    const qrDrinkBtn = document.getElementById('qr-drink-btn');
    if (qrDrinkBtn) {
      qrDrinkBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await stopQrCamera(); } catch {}
        window.location.href = 'share-qr.html';
      });
    }
  }
  if (page === 'qr-invite') {
    setupQrCamera();
    startQrScanningLoop();
    const btn = document.getElementById('qr-close');
    if (btn) btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await stopQrCamera();
      window.location.href = 'invite.html';
    });
  }
  if (page === 'rate') {
    const submit = document.getElementById('rate-submit');
    if (submit) submit.addEventListener('click', () => {
      // عرض pop page جميل
      showRatingSuccessPopup();
      
      // الانتقال إلى صفحة الشجرة بعد 7 ثوانٍ
      setTimeout(() => {
        window.location.href = 'tree.html';
      }, 7000);
    });
    const beans = document.querySelectorAll('#rate-beans .rate-bean');
    let locked = false;
    function setVisual(toIdx, type){
      beans.forEach((b, i) => {
        b.classList.remove('active','is-red','is-yellow','is-green');
        if (i <= toIdx) {
          b.classList.add('active');
          if (type==='red') b.classList.add('is-red');
          if (type==='yellow') b.classList.add('is-yellow');
          if (type==='green') b.classList.add('is-green');
        }
      });
    }
    beans.forEach((b, idx) => {
      const type = idx === 0 || idx === 1 ? 'red' : (idx === 2 ? 'yellow' : 'green');
      b.addEventListener('mouseenter', () => { if (!locked) setVisual(idx, type); });
      b.addEventListener('focus', () => { if (!locked) setVisual(idx, type); });
      b.addEventListener('click', () => { locked = true; setVisual(idx, type); });
      b.addEventListener('mouseleave', () => { if (!locked) setVisual(-1); });
      b.addEventListener('blur', () => { if (!locked) setVisual(-1); });
    });
  }
  
  // دالة عرض pop page نجاح التقييم
  function showRatingSuccessPopup() {
    const popup = document.createElement('div');
    popup.className = 'rating-success-popup';
    popup.innerHTML = `
      <div class="rating-success-content">
        <div class="rating-success-icon"><img src="imgs/Rate/envelope.gif" alt="Envelope"></div>
        <h3 class="rating-success-title">Thank you! 🎊</h3>
        <p class="rating-success-text">Your rating has been sent successfully</p>
        <div class="rating-success-subtitle">We'll work on improving your experience</div>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // إضافة تأثيرات إضافية
    // setTimeout(() => {
    //   const icon = popup.querySelector('.rating-success-icon img');
    //   if (icon) {
    //     icon.style.animation = 'iconBounce 0.8s ease-in-out infinite';
    //   }
    // }, 500);
    
    // إزالة الرسالة عند النقر عليها
    popup.addEventListener('click', () => {
      popup.style.animation = 'popupFadeOut 0.5s ease-in forwards';
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
        // الانتقال إلى صفحة الشجرة فوراً
        window.location.href = 'tree.html';
      }, 500);
    });
    
    // إزالة الرسالة تلقائياً بعد 7 ثوانٍ
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.animation = 'popupFadeOut 0.5s ease-in forwards';
        setTimeout(() => {
          if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
          }
        }, 500);
      }
    }, 7000);
  }
  
  if (page === 'chat') {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-text');
    const body = document.getElementById('chat-body');
    
    // إضافة رسالة تحميل
    function addLoadingMessage() {
      body.insertAdjacentHTML('beforeend', '<div class="msg bot loading">⏳ Barnie is thinking...</div>');
      body.scrollTop = body.scrollHeight;
    }
    
    // إزالة رسالة التحميل
    function removeLoadingMessage() {
      const loadingMsg = body.querySelector('.msg.loading');
      if (loadingMsg) {
        loadingMsg.remove();
      }
    }
    
    // إرسال رسالة إلى n8n webhook
    async function sendToN8n(message) {
      try {
        const response = await fetch(CHAT_CONFIG.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            user: userName || 'Anonymous',
            timestamp: new Date().toISOString(),
            session: Date.now()
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.reply || 'Thanks for your message! I\'ll get back to you soon.';
        } else {
          throw new Error('Network response was not ok');
        }
      } catch (error) {
        console.error('Error sending message to n8n:', error);
        return 'Sorry, I\'m having trouble connecting right now. Please try again later.';
      }
    }
    
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const txt = input.value.trim(); 
      if (!txt) return;
      
      // إضافة رسالة المستخدم
      body.insertAdjacentHTML('beforeend', '<div class="msg me"></div>');
      body.lastElementChild.textContent = txt;
      body.scrollTop = body.scrollHeight;
      input.value = '';
      
      // إضافة رسالة تحميل
      addLoadingMessage();
      
      try {
        // إرسال الرسالة إلى n8n
        const reply = await sendToN8n(txt);
        
        // إزالة رسالة التحميل
        removeLoadingMessage();
        
        // إضافة رد البوت
        body.insertAdjacentHTML('beforeend', '<div class="msg bot"></div>');
        body.lastElementChild.textContent = reply;
        
        // سكرول سلس إلى آخر رسالة
        body.scrollTo({
          top: body.scrollHeight,
          behavior: 'smooth'
        });
        
      } catch (error) {
        // إزالة رسالة التحميل
        removeLoadingMessage();
        
        // رسالة خطأ
        body.insertAdjacentHTML('beforeend', '<div class="msg bot error">Sorry, something went wrong. Please try again.</div>');
        
        // سكرول سلس إلى آخر رسالة
        body.scrollTo({
          top: body.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }
  if (page === 'home') {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Do you want to log out?')) {
          try { sessionStorage.removeItem(SESSION_INIT_KEY); } catch {}
          localStorage.removeItem(USER_NAME_KEY);
          window.location.href = 'login.html';
        }
      });
    }
    animateCountUp('home-green-count', state.green);
    animateCountUp('home-gold-count', state.gold);
  }
  if (page === 'tree') {
    markLeafActivityNow();
    const drinkBtn = document.getElementById('drink-btn');
    if (drinkBtn) {
      drinkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        markLeafActivityNow();
        window.location.href = 'qr.html';
      });
    }
    const canvas = document.getElementById('treeCanvas');
    if (canvas) {
      drawTreeImages(canvas, state.green, state.gold);
      startInactivityWatcher();
      try {
        const interval = setInterval(() => {
          const beforeGold = state.gold;
          normalizeExpiredGold();
          const afterGold = state.gold;
          if (afterGold !== beforeGold) {
            drawTreeImages(canvas, state.green, state.gold);
            fillCounters();
          }
        }, 5000);
        window.addEventListener('beforeunload', () => clearInterval(interval));
      } catch {}
      canvas.addEventListener('click', (e) => {
        const t = e.target;
        if (t && t.classList && t.classList.contains('tree-leaf--gold')) {
          try {
            const idx = Number(t.dataset.index || '-1');
            const raw = localStorage.getItem(goldExpKey());
            const exp = raw ? JSON.parse(raw) : [];
            const valid = exp[idx] && Date.now() < exp[idx];
            if (valid) {
              showGoldRewardPopup();
            } else {
              const map = loadLeavesMap();
              if (map[idx] === 'gold') {
                map[idx] = 'green';
                saveLeavesMap(map);
                t.classList.remove('tree-leaf--gold');
                t.classList.add('tree-leaf--green');
              }
            }
          } catch {
            showGoldRewardPopup();
          }
        }
      });
      const stemImg = document.querySelector('.tree-stem');
      if (stemImg) {
        stemImg.style.position = 'absolute';
        stemImg.style.left = '50%';
        stemImg.style.transform = 'translateX(-50%)';
        stemImg.style.width = '40%';
        stemImg.style.bottom = '10%';
        stemImg.style.zIndex = '2';
      }
    }
  }
  if (page === 'friends') {
    try {
      const fullName = (userName || '').trim();
      const firstName = fullName.split(/\s+/)[0] || '';
      const nameEl = document.querySelector('.fp-profile-card .fp-name');
      const imgEl = document.querySelector('.fp-profile-card .fp-avatar');
      if (nameEl && fullName) nameEl.textContent = fullName;
      if (imgEl) {
        const candidates = buildPeopleImageCandidates(firstName);
        setImageFromCandidates(imgEl, candidates);
      }
      const grid = document.querySelector('.fp-friends-grid');
      if (grid) {
        const normalize = (s) => (s||'').trim().toLowerCase();
        const lowerFirst = normalize(firstName);
        Array.from(grid.querySelectorAll('.fp-friend-card')).forEach(card => {
          const nameEl = card.querySelector('.name');
          if (!nameEl) return;
          const friendFirst = normalize(nameEl.textContent).split(/\s+/)[0] || '';
          if (lowerFirst && friendFirst === lowerFirst) {
            card.remove();
          }
        });
        const hasMohammad = !!Array.from(grid.querySelectorAll('.fp-friend-card .name')).find(n => normalize(n.textContent) === 'mohammad');
        const isCurrentUserMohammad = lowerFirst === 'mohammad';
        if (!isCurrentUserMohammad && !hasMohammad) {
          const card = document.createElement('div');
          card.className = 'fp-friend-card';
          card.innerHTML = `
            <img class="photo" alt="Mohammad" />
            <div class="meta">
              <div class="name">Mohammad</div>
              <div class="row"><img src="imgs/friends/section3/people.svg" alt="friends" /><span>10</span><img src="imgs/friends/section3/streak.svg" alt="streak" /><span>25</span></div>
            </div>
          `;
          grid.appendChild(card);
          const mImg = card.querySelector('img.photo');
          if (mImg) setImageFromCandidates(mImg, buildPeopleImageCandidates('Mohammad'));
        }
      }
    } catch {}
    try {
      const primaryTree = document.querySelector('.fp-trees-row .fp-tree:first-child');
      if (primaryTree) {
        primaryTree.classList.add('is-link');
        primaryTree.addEventListener('click', () => {
          window.location.href = 'tree.html';
        });
      }
    } catch {}
  }
  
  if (page === 'loyalty') {
    try {
      // حساب إجمالي الأوراق
      const totalLeaves = state.green + state.gold;
      
      // ملء بطاقة الولاء الرئيسية
      const loyaltyTotal = document.getElementById('loyalty-total');
      const loyaltyCurrent = document.getElementById('loyalty-current');
      const loyaltyNext = document.getElementById('loyalty-next');
      const loyaltyProgress = document.getElementById('loyalty-progress');
      
      if (loyaltyTotal) loyaltyTotal.textContent = totalLeaves;
      if (loyaltyCurrent) loyaltyCurrent.textContent = totalLeaves;
      if (loyaltyNext) loyaltyNext.textContent = '20';
      
      // تحديث شريط التقدم
      if (loyaltyProgress) {
        const progressPercent = Math.min((totalLeaves / 20) * 100, 100);
        loyaltyProgress.style.width = `${progressPercent}%`;
      }
      
      // ملء الإحصائيات
      const loyaltyGreen = document.getElementById('loyalty-green');
      const loyaltyGold = document.getElementById('loyalty-gold');
      const loyaltyStreak = document.getElementById('loyalty-streak');
      
      if (loyaltyGreen) loyaltyGreen.textContent = state.green;
      if (loyaltyGold) loyaltyGold.textContent = state.gold;
      if (loyaltyStreak) loyaltyStreak.textContent = state.streak;
      
      // تحديث مستويات الولاء
      updateLoyaltyTiers(totalLeaves);
      
      // تحديث المكافآت
      updateLoyaltyRewards(totalLeaves);
      
      // تحديث عرض المستوى في البطاقة الرئيسية
      updateLoyaltyCardDisplay(totalLeaves);
      
    } catch (error) {
      console.error('Error loading loyalty page:', error);
    }
  }
}

// دالة تحديث الإنجازات
function updateAchievements() {
  try {
    // إنجاز الورقة الأولى
    const firstLeaf = document.getElementById('first-leaf');
    if (firstLeaf && (state.green > 0 || state.gold > 0)) {
      const status = firstLeaf.querySelector('.achievement-status');
      if (status) status.textContent = '✅';
    }
    
    // إنجاز Green Master (10 أوراق خضراء)
    const greenMaster = document.getElementById('green-master');
    if (greenMaster && state.green >= 10) {
      const status = greenMaster.querySelector('.achievement-status');
      if (status) status.textContent = '✅';
    }
    
    // إنجاز Gold Collector (5 أوراق ذهبية)
    const goldCollector = document.getElementById('gold-collector');
    if (goldCollector && state.gold >= 5) {
      const status = goldCollector.querySelector('.achievement-status');
      if (status) status.textContent = '✅';
    }
    
    // إنجاز Streak Keeper (7 أيام متتالية)
    const streakKeeper = document.getElementById('streak-keeper');
    if (streakKeeper && state.streak >= 7) {
      const status = streakKeeper.querySelector('.achievement-status');
      if (status) status.textContent = '✅';
    }
    
  } catch (error) {
    console.error('Error updating achievements:', error);
  }
}

// دالة تحديث مستويات الولاء
function updateLoyaltyTiers(totalLeaves) {
  try {
    // تحديث المستوى الحالي
    const tierGreen = document.getElementById('tier-green');
    const tierSilver = document.getElementById('tier-silver');
    const tierGold = document.getElementById('tier-gold');
    
    if (tierGreen && tierSilver && tierGold) {
      // إعادة تعيين جميع المستويات
      tierGreen.className = 'tier-item locked';
      tierSilver.className = 'tier-item locked';
      tierGold.className = 'tier-item locked';
      
      tierGreen.querySelector('.tier-status').textContent = '🔒 Locked';
      tierSilver.querySelector('.tier-status').textContent = '🔒 Locked';
      tierGold.querySelector('.tier-status').textContent = '🔒 Locked';
      
      // تحديد المستوى الحالي
      if (totalLeaves >= 0 && totalLeaves < 50) {
        tierGreen.className = 'tier-item current';
        tierGreen.querySelector('.tier-status').textContent = 'Current';
      } else if (totalLeaves >= 50 && totalLeaves < 100) {
        tierSilver.className = 'tier-item current';
        tierSilver.querySelector('.tier-status').textContent = 'Current';
      } else if (totalLeaves >= 100) {
        tierGold.className = 'tier-item current';
        tierGold.querySelector('.tier-status').textContent = 'Current';
      }
    }
  } catch (error) {
    console.error('Error updating loyalty tiers:', error);
  }
}

// دالة تحديث المكافآت
function updateLoyaltyRewards(totalLeaves) {
  try {
    const rewardDiscount = document.getElementById('reward-discount');
    const rewardCookie = document.getElementById('reward-cookie');
    const rewardCoffee = document.getElementById('reward-coffee');
    const rewardSecond = document.getElementById('reward-second');
    const rewardUpgrade = document.getElementById('reward-upgrade');
    const rewardBonus = document.getElementById('reward-bonus');
    
    if (rewardDiscount && rewardCookie && rewardCoffee && rewardSecond && rewardUpgrade && rewardBonus) {
      // تفعيل/إلغاء تفعيل المكافآت بناءً على عدد الأوراق
      
      // كود خصم - 15 ورقة
      if (totalLeaves >= 15) {
        rewardDiscount.querySelector('.reward-btn').disabled = false;
        rewardDiscount.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardDiscount.querySelector('.reward-btn').disabled = true;
        rewardDiscount.querySelector('.reward-btn').textContent = 'Redeem';
      }
      
      // كوكيز مجاني - 25 ورقة
      if (totalLeaves >= 25) {
        rewardCookie.querySelector('.reward-btn').disabled = false;
        rewardCookie.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardCookie.querySelector('.reward-btn').disabled = true;
        rewardCookie.querySelector('.reward-btn').textContent = 'Redeem';
      }
      
      // قهوة مجانية - 40 ورقة
      if (totalLeaves >= 40) {
        rewardCoffee.querySelector('.reward-btn').disabled = false;
        rewardCoffee.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardCoffee.querySelector('.reward-btn').disabled = true;
        rewardCoffee.querySelector('.reward-btn').textContent = 'Redeem';
      }
      
      // القهوة الثانية مجانية - 60 ورقة
      if (totalLeaves >= 60) {
        rewardSecond.querySelector('.reward-btn').disabled = false;
        rewardSecond.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardSecond.querySelector('.reward-btn').disabled = true;
        rewardSecond.querySelector('.reward-btn').textContent = 'Redeem';
      }
      
      // ترقية الحجم - 80 ورقة
      if (totalLeaves >= 80) {
        rewardUpgrade.querySelector('.reward-btn').disabled = false;
        rewardUpgrade.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardUpgrade.querySelector('.reward-btn').disabled = true;
        rewardUpgrade.querySelector('.reward-btn').textContent = 'Redeem';
      }
      
      // هدية عيد الميلاد - 120 ورقة
      if (totalLeaves >= 120) {
        rewardBonus.querySelector('.reward-btn').disabled = false;
        rewardBonus.querySelector('.reward-btn').textContent = 'Redeem';
      } else {
        rewardBonus.querySelector('.reward-btn').disabled = true;
        rewardBonus.querySelector('.reward-btn').textContent = 'Redeem';
      }
    }
  } catch (error) {
    console.error('Error updating loyalty rewards:', error);
  }
}

// دالة تحديث عرض المستوى في البطاقة الرئيسية
function updateLoyaltyCardDisplay(totalLeaves) {
  try {
    const tierNameElement = document.querySelector('.loyalty-tier .tier-name');
    const tierIconElement = document.querySelector('.loyalty-tier .tier-icon');
    
    if (tierNameElement && tierIconElement) {
      if (totalLeaves >= 0 && totalLeaves < 50) {
        tierNameElement.textContent = 'SPROUT TIER';
        tierIconElement.textContent = '🌿';
      } else if (totalLeaves >= 50 && totalLeaves < 100) {
        tierNameElement.textContent = 'GROWING TIER';
        tierIconElement.textContent = '🥈';
      } else if (totalLeaves >= 100) {
        tierNameElement.textContent = 'MASTER TIER';
        tierIconElement.textContent = '🥇';
      }
    }
  } catch (error) {
    console.error('Error updating loyalty card display:', error);
  }
}
