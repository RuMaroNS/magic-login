const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalRealtime(); 
};

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 2500);
}

function initGlobalRealtime() {
    liveChannel.on('broadcast', { event: 'new-drop' }, (payload) => {
        addToLiveBoard(payload.payload.user, payload.payload.item);
    }).subscribe();
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data) { currentUser = data; enterGame(); }
    }
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    document.getElementById('top-bar').style.display = 'flex';
    navTo('cases');
}

function updateUI() {
    if (!currentUser) return;
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
    document.getElementById('p-balance').innerText = currentUser.score;
    document.getElementById('p-cp').innerText = currentUser.cyberpunk_points || 0;
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    if(pageId === 'market') renderMarket();
    updateUI();
    window.scrollTo(0,0);
}

// --- КЕЙСЫ И РУЛЕТКА ---
async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card" onclick="openRoulette(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <p class="case-price">$${c.price}</p>
            <button class="neon-btn">ОТКРЫТЬ</button>
        </div>`).join('');
}

async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Мало монет!");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    document.getElementById('win-display').style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.1, 0, 0.1, 1)';
        const itemWidth = 130; 
        const finalShift = (50 * itemWidth) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + (itemWidth / 2);
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        
        liveChannel.send({ type: 'broadcast', event: 'new-drop', payload: { user: currentUser.username, item: win.name } });
        addToLiveBoard(currentUser.username, win.name);

        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        if (typeof confetti === 'function') confetti();
    }, 5500);
}

// --- МАРКЕТ И КВЕСТЫ ---
async function renderMarket() {
    const { data: stock } = await supabaseClient.from('limited_stock').select('*');
    document.getElementById('limited-grid').innerHTML = (stock || []).map(i => `
        <div class="case-card">
            <div class="limited-tag">${i.stock > 0 ? 'STOCK: ' + i.stock : 'SOLD OUT'}</div>
            <img src="${GITHUB_BASE}${encodeURIComponent(i.image_url)}.png">
            <h3>${i.name}</h3>
            <button class="neon-btn" style="background:#ff00ff; color:#fff" 
                onclick="${i.stock > 0 ? `buyLimited(${i.id}, ${i.price_cp})` : ''}">
                ${i.price_cp} CP
            </button>
        </div>`).join('');
    
    const { data: tasks } = await supabaseClient.from('cyber_tasks').select('*');
    document.getElementById('tasks-list').innerHTML = (tasks || []).map(t => `
        <div class="task-card">
            <div><b>${t.title}</b><br><span style="color:#00ffcc">+${t.reward} CP</span></div>
            <button class="neon-btn" style="width:120px;" onclick="completeTask(${t.id}, ${t.reward})">DO IT</button>
        </div>`).join('');
}

async function buyLimited(id, price) {
    if ((currentUser.cyberpunk_points || 0) < price) return showNotify("Нет CP!");
    const { data: check } = await supabaseClient.from('limited_stock').select('*').eq('id', id).single();
    if (check.stock <= 0) return showNotify("Пусто!");

    const newCP = currentUser.cyberpunk_points - price;
    const newInv = [...(currentUser.inventory || []), { char: check.name, id: Date.now(), status: 'limited' }];
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP, inventory: newInv }).eq('id', currentUser.id);
    await supabaseClient.from('limited_stock').update({ stock: check.stock - 1 }).eq('id', id);
    currentUser.cyberpunk_points = newCP;
    currentUser.inventory = newInv;
    showNotify("КУПЛЕНО!");
    renderMarket();
}

async function completeTask(taskId, reward) {
    const newCP = (currentUser.cyberpunk_points || 0) + reward;
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP }).eq('id', currentUser.id);
    currentUser.cyberpunk_points = newCP;
    showNotify(`+${reward} CP`);
    updateUI();
}

// --- ВСПОМОГАТЕЛЬНЫЕ ---
function addToLiveBoard(user, item) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div><div style="font-size:10px;color:#5a5a7a">${user}</div><div style="font-size:12px">${item}</div></div>`;
    board.prepend(card);
    if (board.children.length > 15) board.lastElementChild.remove();
}

async function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).slice().reverse().map(i => `
        <div class="inv-item ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn sell-btn" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`).join('');
}

async function login() {
    const u = document.getElementById('user_name').value.trim();
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) { currentUser = data; localStorage.setItem('game_user_id', data.id); enterGame(); }
}

function logout() { localStorage.removeItem('game_user_id'); location.reload(); }

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}
