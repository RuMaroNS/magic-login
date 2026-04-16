const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ==========================================
// ВОТ ОНА — ТАБЛИЦА С КЕЙСАМИ И ИХ ЛУТОМ
// ==========================================
const CASE_TABLE = [
    { 
        id: "case_basic", 
        name: "LUCKY BLOCK CASE", 
        price: 50, 
        img: "Case_Basic.png",
        items: [
            {char: 'TacoBlock', chance: 40},
            {char: 'AdminBlock', chance: 40},
            {char: 'SecretBlock', chance: 20}
        ]
    },
    { 
        id: "case_premium", 
        name: "GALAXY CASE", 
        price: 250, 
        img: "Case_Premium.png",
        items: [
            {char: 'LosTacoBlocks', chance: 45},
            {char: 'LosAdminBlocks', chance: 45},
            {char: 'SecretBlock', chance: 10}
        ]
    },
    { 
        id: "case_meme", 
        name: "BRAINROT CASE", 
        price: 100, 
        img: "Case_Basic.png", // Можешь заменить на свою картинку
        items: [
            {char: 'AdminBlock', chance: 50},
            {char: 'TacoBlock', chance: 40},
            {char: 'SecretBlock', chance: 10}
        ]
    }
];

let currentUser = null;

// --- АВТОРИЗАЦИЯ ---
function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-btn-reg').classList.toggle('active', mode === 'reg');
    document.getElementById('otp-area').style.display = 'none';
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
    document.getElementById('btn-confirm-action').style.display = 'none';
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if(data) loginSuccess(data);
    else showNotify("Ошибка входа или пароля!");
}

function loginSuccess(profile) {
    currentUser = profile;
    localStorage.setItem('game_user', JSON.stringify(profile));
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

// --- ЛАЙВ БОРД КАРТОЧКАМИ ---
function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if(newInv.length > oldInv.length) {
            const lastItem = newInv[newInv.length - 1];
            const userNick = p.new.email ? p.new.email.split('@')[0] : "Player";
            addToLiveBoard(userNick, lastItem.char);
        }
    }).subscribe();
}

function addToLiveBoard(username, itemName) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `
        <img src="${GITHUB_BASE}${itemName}.png">
        <div class="drop-info">
            <span class="drop-nick">${username}</span>
            <span class="drop-item">${itemName}</span>
        </div>
    `;
    board.prepend(card);
    if (board.childNodes.length > 20) board.removeChild(board.lastChild);
}

// --- НАВИГАЦИЯ ---
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = CASE_TABLE.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.img}">
            <h4>${c.name}</h4>
            <p style="color:#00d4ff; margin: 10px 0;">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette('${c.id}')">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

// --- РУЛЕТКА ---
async function openRoulette(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("НЕДОСТАТОЧНО СРЕДСТВ!");

    currentUser.score -= cData.price;
    navTo('opening');
    
    const tape = document.getElementById('roulette-tape');
    const winDisplay = document.getElementById('win-display');
    winDisplay.style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';

    // Генерируем 60 элементов из лута конкретного кейса
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.items[Math.floor(Math.random() * cData.items.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.char}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    // Считаем шанс выпадения
    let rand = Math.random() * 100;
    let cum = 0;
    let win = cData.items[0];
    for (let itm of cData.items) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    const nodes = tape.querySelectorAll('.roulette-item');
    nodes[50].innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const cardWidth = 110; 
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const shift = (50 * cardWidth) - (wrapperWidth / 2) + (cardWidth / 2);
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    const newInv = [...(currentUser.inventory || []), { char: win.char, id: Date.now() }];
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        winDisplay.style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.char}`;
        showNotify(`ВЫИГРЫШ: ${win.char}`);
    }, 5500);
}

function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png" style="width:50px;">
            <p style="font-size:10px;">${i.char}</p>
        </div>
    `).join('');
}

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

function logout() { localStorage.clear(); location.reload(); }
