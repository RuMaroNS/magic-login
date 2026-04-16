const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ТАБЛИЦА КЕЙСОВ
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

// АВТОРИЗАЦИЯ
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
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    } else showNotify("Ошибка входа!");
}

async function register() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 500, inventory: [] }]).select().single();
    if(data) loginSuccess(data);
}

// ЛАЙВ БОРД
function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if(newInv.length > oldInv.length) {
            const lastItem = newInv[newInv.length - 1];
            const nick = p.new.email.split('@')[0];
            const board = document.getElementById('global-live-feed');
            const card = document.createElement('div');
            card.className = 'drop-card';
            card.innerHTML = `<img src="${GITHUB_BASE}${lastItem.char}.png"><div class="drop-info"><span class="drop-nick">${nick}</span><span class="drop-item">${lastItem.char}</span></div>`;
            board.prepend(card);
            if (board.childNodes.length > 15) board.removeChild(board.lastChild);
        }
    }).subscribe();
}

// ПРОФИЛЬ (СЕТКА)
function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <button class="withdraw-btn" onclick="withdrawItem(${i.id}, '${i.char}')">ВЫВОД</button>
        </div>
    `).join('');
}

async function withdrawItem(id, name) {
    const nick = prompt("Ник для вывода:");
    if(!nick) return;
    currentUser.inventory = currentUser.inventory.filter(x => x.id !== id);
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("Заявка создана!");
}

// МАГАЗИН
function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = CASE_TABLE.map(c => `
        <div class="case-card" style="background:#151525; padding:20px; border-radius:15px; text-align:center; border:1px solid #2a2a45;">
            <img src="${GITHUB_BASE}${c.img}" style="width:120px;">
            <h4>${c.name}</h4>
            <p style="color:#00d4ff; margin:10px 0;">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette('${c.id}')">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

// РУЛЕТКА
async function openRoulette(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("Мало денег!");

    currentUser.score -= cData.price;
    navTo('opening');
    
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';

    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.items[Math.floor(Math.random() * cData.items.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.char}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    let rand = Math.random() * 100;
    let cum = 0;
    let win = cData.items[0];
    for (let itm of cData.items) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const shift = (50 * 120) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 60;
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    const newInv = [...(currentUser.inventory || []), { char: win.char, id: Date.now() }];
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.char}`;
        showNotify("Успех!");
    }, 5500);
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
}

function showNotify(t) {
    const c = document.getElementById('notification-container');
    const n = document.createElement('div'); n.className = 'notification'; n.innerText = t;
    c.appendChild(n); setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

function logout() { localStorage.clear(); location.reload(); }
