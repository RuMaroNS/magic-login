const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ТАБЛИЦА КЕЙСОВ И ЛУТА
const CASE_TABLE = [
    { 
        id: "case_basic", 
        name: "LUCKY CASE", 
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
        name: "TESTER CASE", 
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

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

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
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin:10px 0;">${c.price}$</p>
            <button class="main-btn" onclick="openRoulette('${c.id}')">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

async function openRoulette(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("МАЛО ДЕНЕГ!");

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
        const shift = (50 * 120) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 60;
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

async function withdrawItem(id, name) {
    const nick = prompt("Введите ник в Roblox для вывода:");
    if(!nick) return;
    currentUser.inventory = currentUser.inventory.filter(x => x.id !== id);
    const h = JSON.parse(localStorage.getItem('w_hist') || '[]');
    h.unshift({ name, nick, status: 'В обработке', date: new Date().toLocaleDateString() });
    localStorage.setItem('w_hist', JSON.stringify(h));
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("ЗАЯВКА ОТПРАВЛЕНА");
}

function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score + "$";
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item"><img src="${GITHUB_BASE}${i.char}.png"><p>${i.char}</p><button class="withdraw-btn" onclick="withdrawItem(${i.id},'${i.char}')">ВЫВОД</button></div>
    `).join('');
    const h = JSON.parse(localStorage.getItem('w_hist') || '[]');
    document.getElementById('withdraw-history').innerHTML = h.map(x => `<div style="font-size:10px; background:#151525; padding:8px; margin-top:5px; border-radius:5px;">${x.name} -> ${x.nick} | <b>${x.status}</b></div>`).join('');
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldI = p.old?.inventory || [];
        const newI = p.new?.inventory || [];
        if(newI.length > oldI.length) {
            const item = newI[newI.length - 1];
            const nick = p.new.email ? p.new.email.split('@')[0] : "Игрок";
            const feed = document.getElementById('global-live-feed');
            const c = document.createElement('div');
            c.className = 'feed-card';
            c.innerHTML = `<img src="${GITHUB_BASE}${item.char}.png"><div><span class="f-nick">${nick}</span><span class="f-item">${item.char}</span></div>`;
            feed.prepend(c);
            setTimeout(() => c.remove(), 20000);
        }
    }).subscribe();
}

async function login() {
    const e = document.getElementById('user_email').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', e).eq('password', p).single();
    if(data) {
        currentUser = data;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    } else showNotify("ОШИБКА ВХОДА");
}

function showAuth(m) {
    document.getElementById('step-choice').style.display = (m=='choice'?'block':'none');
    document.getElementById('step-form').style.display = (m=='choice'?'none':'block');
}

function logout() { localStorage.clear(); location.reload(); }
