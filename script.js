const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ==========================================
// ПОЛНАЯ ТАБЛИЦА КЕЙСОВ (МЕТАДАТА)
// ==========================================
const CASE_TABLE = [
    { 
        id: "case_basic", 
        name: "LUCKY BLOCK CASE", 
        price: 50, 
        img: "Case_Basic.png",
        items: [
            {char: 'TacoBlock', chance: 45},
            {char: 'AdminBlock', chance: 45},
            {char: 'SecretBlock', chance: 10}
        ]
    },
    { 
        id: "case_premium", 
        name: "GALAXY CASE", 
        price: 250, 
        img: "Case_Premium.png",
        items: [
            {char: 'LosTacoBlocks', chance: 40},
            {char: 'LosAdminBlocks', chance: 40},
            {char: 'SecretBlock', chance: 20}
        ]
    },
    { 
        id: "case_meme", 
        name: "BRAINROT CASE", 
        price: 100, 
        img: "Case_Basic.png", 
        items: [
            {char: 'AdminBlock', chance: 50},
            {char: 'TacoBlock', chance: 40},
            {char: 'SecretBlock', chance: 10}
        ]
    },
    { 
        id: "case_taco", 
        name: "RAINING TACOS", 
        price: 75, 
        img: "Case_Premium.png", 
        items: [
            {char: 'TacoBlock', chance: 70},
            {char: 'LosTacoBlocks', chance: 25},
            {char: 'SecretBlock', chance: 5}
        ]
    }
];

let currentUser = null;

// --- COOKIE & АВТО-ВХОД ---
function checkCookies() {
    if (!localStorage.getItem('cookies_accepted')) {
        document.getElementById('cookie-banner').style.display = 'block';
    } else {
        autoLogin();
    }
}

function acceptCookies() {
    localStorage.setItem('cookies_accepted', 'true');
    document.getElementById('cookie-banner').style.display = 'none';
    autoLogin();
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        // Тянем свежие данные только по ID
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data && !error) {
            currentUser = data;
            enterGame();
        } else {
            localStorage.removeItem('game_user_id');
        }
    }
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id); // Храним ТОЛЬКО ID
        enterGame();
    } else showNotify("Ошибка входа!");
}

async function register() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 500, inventory: [] }]).select().single();
    if(data) login();
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

// --- СИНХРОНИЗАЦИЯ С БД ПЕРЕД ДЕЙСТВИЕМ ---
async function syncFromDB() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
}

// --- РЕНДЕР ПРОФИЛЯ ---
async function renderProfile() {
    await syncFromDB(); // Обновляем данные из базы
    document.getElementById('p-balance').innerText = currentUser.score;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
        </div>
    `).join('');
}

// --- РУЛЕТКА ---
async function openRoulette(caseId) {
    await syncFromDB(); // Жесткая проверка баланса перед открытием
    const cData = CASE_TABLE.find(x => x.id === caseId);
    
    if (currentUser.score < cData.price) return showNotify("Недостаточно средств!");

    // Снимаем деньги в БД
    const newScore = currentUser.score - cData.price;
    const { error: updateError } = await supabaseClient.from('profiles').update({ score: newScore }).eq('id', currentUser.id);
    if (updateError) return showNotify("Ошибка связи с сервером!");

    currentUser.score = newScore;
    navTo('opening');
    
    const tape = document.getElementById('roulette-tape');
    const winDisplay = document.getElementById('win-display');
    winDisplay.style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';

    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const randItem = cData.items[Math.floor(Math.random() * cData.items.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${randItem.char}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    let rand = Math.random() * 100, cum = 0, win = cData.items[0];
    for (let itm of cData.items) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const shift = (50 * 130) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 65;
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    // Сохраняем выигрыш в БД
    const newItem = { char: win.char, id: Date.now() };
    const newInv = [...(currentUser.inventory || []), newItem];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        winDisplay.style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.char}`;
        showNotify(`Выпал ${win.char}!`);
    }, 5500);
}

// --- ЛАЙВ-БОРД ---
function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if(newInv.length > oldInv.length) {
            const lastItem = newInv[newInv.length - 1];
            const nick = p.new.email ? p.new.email.split('@')[0] : "Player";
            addToLiveBoard(nick, lastItem.char);
        }
    }).subscribe();
}

function addToLiveBoard(username, itemName) {
    const board = document.getElementById('global-live-feed');
    if (!board) return;
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${itemName}.png"><div class="drop-info"><span class="drop-nick">${username}</span><span class="drop-item">${itemName}</span></div>`;
    board.prepend(card);
    if (board.childNodes.length > 20) board.removeChild(board.lastChild);
}

function renderCases() {
    document.getElementById('cases-grid').innerHTML = CASE_TABLE.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.img}">
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin:15px 0;">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette('${c.id}')">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

function showNotify(t) {
    const c = document.getElementById('notification-container');
    const n = document.createElement('div'); n.className = 'notification'; n.innerText = t;
    c.appendChild(n); setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

function logout() { localStorage.removeItem('game_user_id'); location.reload(); }

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}

window.onload = checkCookies;
