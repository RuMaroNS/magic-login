const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

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
    }
];

let currentUser = null;

// --- COOKIE & LOCAL STORAGE FIX ---
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
    showNotify("Cookie приняты!");
}

async function autoLogin() {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    }
}

// --- АВТОРИЗАЦИЯ ---
function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-btn-reg').classList.toggle('active', mode === 'reg');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user', JSON.stringify(data));
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    } else showNotify("Ошибка входа!");
}

// --- РУЛЕТКА (ПОЛНЫЙ ФИКС) ---
async function openRoulette(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("Мало денег!");

    currentUser.score -= cData.price;
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

    // Шансы
    let rand = Math.random() * 100;
    let cum = 0;
    let win = cData.items[0];
    for (let itm of cData.items) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    // Ставим приз на 50-й слот
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const itemWidth = 130; // 120px + 10px margin
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const shift = (50 * itemWidth) - (wrapperWidth / 2) + (itemWidth / 2);
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    // Обновляем базу
    const newInv = [...(currentUser.inventory || []), { char: win.char, id: Date.now() }];
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;
    localStorage.setItem('game_user', JSON.stringify(currentUser));

    setTimeout(() => {
        winDisplay.style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.char}`;
        showNotify(`Выпал ${win.char}!`);
    }, 5500);
}

// --- ПРОФИЛЬ & КЕЙСЫ ---
function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score + "$";
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
        </div>
    `).join('');
}

function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = CASE_TABLE.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.img}">
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin:15px 0; font-size: 20px;">${c.price}$</p>
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

window.onload = checkCookies;
