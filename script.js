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

// --- СИСТЕМНЫЕ ФУНКЦИИ ---

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification cyber-border';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 2500);
}

function initGlobalRealtime() {
    liveChannel
    .on('broadcast', { event: 'new-drop' }, (payload) => {
        addToLiveBoard(payload.payload.user, payload.payload.item);
    })
    .subscribe();
}

function addToLiveBoard(user, item) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div><div style="font-size:10px;color:#5a5a7a">${user}</div><div style="font-size:12px">${item}</div></div>`;
    board.prepend(card);
    if (board.children.length > 15) board.lastElementChild.remove();
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data) { 
            currentUser = data; 
            enterGame(); 
        }
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

// --- НАВИГАЦИЯ (ТО ЧТО ВЫЛЕТАЛО) ---

function navTo(page) {
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Показываем нужную
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Снимаем активный класс с кнопок навигации
    document.querySelectorAll('.cyber-nav button').forEach(b => b.style.color = '#888');

    // Логика загрузки данных для страниц
    if (page === 'cases') renderCases();
    if (page === 'profile') renderProfile();
    if (page === 'market') renderMarket();
    
    updateUI();
}

// --- АВТОРИЗАЦИЯ ---

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}

async function login() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if (data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else {
        showNotify("НЕВЕРНЫЙ ID ИЛИ ПАРОЛЬ");
    }
}

async function register() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    if (u.length < 3) return showNotify("НИК СЛИШКОМ КОРОТКИЙ");
    
    const { data: exist } = await supabaseClient.from('profiles').select('*').eq('username', u).single();
    if (exist) return showNotify("НИК ЗАНЯТ");

    const { data, error } = await supabaseClient.from('profiles').insert([{ username: u, password: p, score: 1000, inventory: [], cyberpunk_points: 0 }]).select().single();
    if (data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    }
}

function logout() {
    localStorage.removeItem('game_user_id');
    location.reload();
}

// --- КЕЙСЫ И РУЛЕТКА ---

async function renderCases() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = data.map(c => `
        <div class="case-card cyber-border" onclick="openRoulette(${c.id})">
            <img src="${GITHUB_BASE}${encodeURIComponent(c.image_url)}">
            <h3 style="margin:10px 0;">${c.name}</h3>
            <button class="neon-btn">${c.price}$</button>
        </div>
    `).join('');
}

async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("МАЛО МОНЕТ!");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);
    updateUI();

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    document.getElementById('win-display').style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${encodeURIComponent(rand.name)}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    const winIdx = 50;
    tape.querySelectorAll('.roulette-item')[winIdx].innerHTML = `<img src="${GITHUB_BASE}${encodeURIComponent(win.name)}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.1, 0, 0.1, 1)';
        const itemWidth = 130; 
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const finalShift = (winIdx * itemWidth) - (wrapperWidth / 2) + (itemWidth / 2);
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now(), status: 'idle' }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        
        liveChannel.send({ type: 'broadcast', event: 'new-drop', payload: { user: currentUser.username, item: win.name } });
        addToLiveBoard(currentUser.username, win.name);

        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        if (typeof confetti === 'function') confetti();
    }, 5500);
}

// --- МАРКЕТ И КВЕСТЫ (CYBER UPDATE) ---

async function renderMarket() {
    const { data: stock } = await supabaseClient.from('limited_stock').select('*');
    const grid = document.getElementById('limited-grid');
    
    grid.innerHTML = (stock || []).map(i => `
        <div class="item-card cyber-border">
            <div class="limited-tag">${i.stock > 0 ? 'STOCK: ' + i.stock : 'SOLD OUT'}</div>
            <img src="${GITHUB_BASE}${encodeURIComponent(i.image_url)}.png">
            <h4>${i.name}</h4>
            <button class="neon-btn" style="background:var(--cyber-pink)" 
                onclick="${i.stock > 0 ? `buyLimited(${i.id}, ${i.price_cp})` : ''}">
                ${i.price_cp} CP
            </button>
        </div>
    `).join('');
    
    const { data: tasks } = await supabaseClient.from('cyber_tasks').select('*');
    document.getElementById('tasks-list').innerHTML = (tasks || []).map(t => `
        <div class="task-card cyber-border">
            <div>
                <div class="task-title">${t.title}</div>
                <div class="task-reward">+${t.reward} CP</div>
            </div>
            <button class="neon-btn" style="width:100px; background:var(--cyber-green)" onclick="completeTask(${t.id}, ${t.reward})">DO IT</button>
        </div>
    `).join('');
}

async function buyLimited(id, price) {
    if ((currentUser.cyberpunk_points || 0) < price) return showNotify("НЕДОСТАТОЧНО CP!");
    const { data: check } = await supabaseClient.from('limited_stock').select('*').eq('id', id).single();
    if (check.stock <= 0) return showNotify("РАЗОБРАЛИ!");

    const newCP = currentUser.cyberpunk_points - price;
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP }).eq('id', currentUser.id);
    await supabaseClient.from('limited_stock').update({ stock: check.stock - 1 }).eq('id', id);
    
    const newInv = [...(currentUser.inventory || []), { char: check.name, id: Date.now(), rarity: 'LIMITED' }];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    
    currentUser.cyberpunk_points = newCP;
    currentUser.inventory = newInv;
    showNotify("ЛИМИТКА КУПЛЕНА!");
    renderMarket();
    updateUI();
}

async function completeTask(taskId, reward) {
    const newCP = (currentUser.cyberpunk_points || 0) + reward;
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP }).eq('id', currentUser.id);
    currentUser.cyberpunk_points = newCP;
    showNotify(`+${reward} CP ПОЛУЧЕНО!`);
    updateUI();
}

// --- ПРОФИЛЬ, ВЫВОД И ПРОДАЖА ---

function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    const invList = document.getElementById('inventory-list');
    
    invList.innerHTML = (currentUser.inventory || []).slice().reverse().map(i => `
        <div class="item-card cyber-border ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="limited-tag" style="background:#f1c40f">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${encodeURIComponent(i.char)}.png">
            <h4 style="margin:10px 0;">${i.char}</h4>
            <div style="display:flex; gap:5px; flex-direction:column;">
                <button class="neon-btn" style="background:var(--cyber-green); font-size:10px; padding:8px;" 
                    onclick="withdrawItem(${i.id}, '${i.char}')">ВЫВОД</button>
                <button class="neon-btn" style="background:#e74c3c; font-size:10px; padding:8px;" 
                    onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>
    `).join('');
}

async function sellItem(itemId, charName) {
    if (!confirm(`ПРОДАТЬ ${charName}?`)) return;
    const price = 100; // Базовая цена
    currentUser.inventory = currentUser.inventory.filter(i => i.id !== itemId);
    currentUser.score = Number(currentUser.score) + price;
    
    await supabaseClient.from('profiles').update({ 
        inventory: currentUser.inventory, 
        score: currentUser.score 
    }).eq('id', currentUser.id);
    
    showNotify(`ПРОДАНО ЗА ${price}$`);
    renderProfile();
    updateUI();
}

async function withdrawItem(itemId, charName) {
    const krskTime = new Date().toLocaleString("ru-RU", {timeZone: "Asia/Krasnoyarsk"});
    const msg = `<b>🚨 ЗАЯВКА НА ВЫВОД</b>\n👤 Игрок: ${currentUser.username}\n🎁 Предмет: ${charName}\n⏰ Время: ${krskTime}`;

    // Ставим статус "в обработке"
    currentUser.inventory = currentUser.inventory.map(i => i.id === itemId ? {...i, status: 'processing'} : i);
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' })
        });
        showNotify("ЗАЯВКА ОТПРАВЛЕНА В ТГ!");
    } catch(e) {
        showNotify("ОШИБКА ТЕЛЕГРАМА");
    }
    renderProfile();
}
