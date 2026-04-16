const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const SELL_COMMISSION = 0.20; 

window.onload = checkCookies;

// --- АВТОРИЗАЦИЯ ---
function checkCookies() {
    if (!localStorage.getItem('cookies_accepted')) {
        document.getElementById('cookie-banner').style.display = 'block';
    } else {
        autoLogin();
    }
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data) { currentUser = data; enterGame(); }
    }
}

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    if (!user || !pass) return showNotify("Заполни поля!");
    if (pass.length < 8) return showNotify("Пароль от 8 символов!");

    const { data, error } = await supabaseClient.from('profiles').insert([
        { username: user, password: pass, score: 50, inventory: [] }
    ]).select().single();

    if (error) return showNotify("Ник занят!");
    login();
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else showNotify("Ошибка входа!");
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

// --- СИНХРОНИЗАЦИЯ ---
async function syncFromDB() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
}

// --- РУЛЕТКА ---
async function openRoulette(caseId) {
    await syncFromDB();
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Мало монет!");

    const newScore = currentUser.score - cData.price;
    await supabaseClient.from('profiles').update({ score: newScore }).eq('id', currentUser.id);
    currentUser.score = newScore;

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    const winDisplay = document.getElementById('win-display');
    
    winDisplay.style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    void tape.offsetHeight; 

    const loot = cData.loot;
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = loot[Math.floor(Math.random() * loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    let rand = Math.random() * 100, cum = 0, win = loot[0];
    for (let itm of loot) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const shift = (50 * 130) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 65;
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        winDisplay.style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
    }, 5500);
}

// --- ВЫВОД И ПРОДАЖА ---
async function withdrawItem(id) {
    const robloxNick = prompt("Ник в Roblox:");
    if (!robloxNick) return;

    const item = currentUser.inventory.find(x => x.id === id);
    if (!item || item.status === 'processing') return;

    // Блокируем предмет
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();

    const msg = `🚀 **ВЫВОД**\n👤 Игрок: ${currentUser.username}\n🎮 Roblox: ${robloxNick}\n📦 Предмет: ${item.char}`;

    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
        });

        if (res.ok) showNotify("Заявка отправлена!");
        else {
            delete item.status;
            await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
            renderProfile();
            showNotify("Ошибка ТГ!");
        }
    } catch (e) { showNotify("Ошибка сети!"); }
}

async function sellItem(itemId, charName) {
    const item = currentUser.inventory.find(i => i.id === itemId);
    if (item?.status === 'processing') return showNotify("Предмет в обработке!");

    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    if (!itemData) return;

    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    const updatedInv = currentUser.inventory.filter(i => i.id !== itemId);
    const newScore = currentUser.score + sellPrice;

    await supabaseClient.from('profiles').update({ inventory: updatedInv, score: newScore }).eq('id', currentUser.id);
    currentUser.inventory = updatedInv;
    currentUser.score = newScore;
    renderProfile();
}

// --- LIVE BOARD ---
function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if (newInv.length > oldInv.length) {
            addToLiveBoard(p.new.username || "Player", newInv[newInv.length - 1].char);
        }
    }).subscribe();
}

function addToLiveBoard(user, item) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div class="drop-info"><span>${user}</span><span>${item}</span></div>`;
    board.prepend(card);
    setTimeout(() => {
        card.style.opacity = "0";
        setTimeout(() => card.remove(), 500);
    }, 60000);
}

// --- ИНТЕРФЕЙС ---
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name}</h3><p>${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette(${c.id})">ОТКРЫТЬ</button>
        </div>`).join('');
}

async function renderProfile() {
    await syncFromDB();
    document.getElementById('p-balance').innerText = currentUser.score;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).map(i => {
        const isP = i.status === 'processing';
        return `
        <div class="inv-item ${isP ? 'processing' : ''}">
            ${isP ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <button class="withdraw-btn" ${isP ? 'disabled' : ''} onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn" ${isP ? 'disabled' : ''} style="background:${isP ? '#555' : '#e67e22'}" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`;
    }).join('');
}

function showNotify(t) {
    const c = document.getElementById('notification-container');
    const n = document.createElement('div'); n.className = 'notification'; n.innerText = t;
    c.appendChild(n); setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

function logout() { localStorage.removeItem('game_user_id'); location.reload(); }
