const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ТАБЛИЦА ЛУТА
const ITEMS_DB = [
    {char: 'TacoBlock', chance: 30},
    {char: 'AdminBlock', chance: 30},
    {char: 'SecretBlock', chance: 15},
    {char: 'LosTacoBlocks', chance: 15},
    {char: 'LosAdminBlocks', chance: 10}
];

// ТАБЛИЦА КЕЙСОВ
const CASE_TABLE = [
    { id: "case_basic", name: "LUCKY BLOCK CASE", price: 50, img: "Case_Basic.png" },
    { id: "case_premium", name: "GALAXY CASE", price: 200, img: "Case_Premium.png" }
];

let currentUser = null;

// УВЕДОМЛЕНИЯ
function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 500);
    }, 2500);
}

// НАВИГАЦИЯ (МГНОВЕННАЯ С ЭФФЕКТОМ)
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if(target) target.classList.add('active');
    
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

// РЕНДЕР МАГАЗИНА
function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = CASE_TABLE.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.img}">
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin: 10px 0;">Цена: ${c.price}$</p>
            <button class="main-btn" onclick="openRoulette('${c.id}')">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

// РУЛЕТКА (КАК В CS:GO)
async function openRoulette(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("НЕДОСТАТОЧНО СРЕДСТВ!");

    // Снимаем баланс сразу
    currentUser.score -= cData.price;
    navTo('opening');
    
    const tape = document.getElementById('roulette-tape');
    const winDisplay = document.getElementById('win-display');
    winDisplay.style.display = 'none';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';

    // Заполняем ленту 60 предметами
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const randItem = ITEMS_DB[Math.floor(Math.random() * ITEMS_DB.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${randItem.char}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    // Определяем честный выигрыш
    let rand = Math.random() * 100;
    let cum = 0;
    let win = ITEMS_DB[0];
    for (let itm of ITEMS_DB) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    // Ставим выигрыш на 50-ю позицию
    const nodes = tape.querySelectorAll('.roulette-item');
    nodes[50].innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;

    // Запускаем прокрутку
    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const cardWidth = 120; // 110px + 10px margin
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const shift = (50 * cardWidth) - (wrapperWidth / 2) + (cardWidth / 2);
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    // Обновляем БД
    const newInv = [...(currentUser.inventory || []), { char: win.char, id: Date.now() }];
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    // Конец анимации
    setTimeout(() => {
        winDisplay.style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫ ВЫБИЛИ: ${win.char}`;
        showNotify(`ВЫИГРЫШ: ${win.char}`);
    }, 5500);
}

// ВЫВОД ПРЕДМЕТОВ
async function withdrawItem(id, name) {
    const targetNick = prompt("Введите ваш ник в игре / ID для вывода:");
    if(!targetNick) return showNotify("ВЫВОД ОТМЕНЕН");

    currentUser.inventory = currentUser.inventory.filter(x => x.id !== id);
    
    // Сохраняем в историю
    const history = JSON.parse(localStorage.getItem('w_hist_full') || '[]');
    history.unshift({ name, target: targetNick, status: 'В обработке', date: new Date().toLocaleDateString() });
    localStorage.setItem('w_hist_full', JSON.stringify(history));

    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("ЗАЯВКА НА ВЫВОД СОЗДАНА!");
}

// ОБНОВЛЕНИЕ ПРОФИЛЯ
function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score + "$";
    
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <button class="withdraw-btn" onclick="withdrawItem(${i.id}, '${i.char}')">ВЫВОД</button>
        </div>
    `).join('');

    const hList = document.getElementById('withdraw-history');
    const hData = JSON.parse(localStorage.getItem('w_hist_full') || '[]');
    hList.innerHTML = hData.map(x => `
        <div style="background:#151525; padding:12px; border-radius:12px; margin-top:8px; font-size:12px; border:1px solid #1f1f35;">
            <b>${x.name}</b> → ${x.target} | <span style="color:#00d4ff">${x.status}</span>
        </div>
    `).join('');
}

// LIVE BOARD (БЕЗ ОШИБОК)
function initRealtime() {
    supabaseClient.channel('global').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if(newInv.length > oldInv.length) {
            const item = newInv[newInv.length - 1];
            const name = p.new.email ? p.new.email.split('@')[0] : "Игрок";
            addToLive(name, item.char);
        }
    }).subscribe();
}

function addToLive(u, i) {
    const f = document.getElementById('global-live-feed');
    const c = document.createElement('div');
    c.className = 'feed-card';
    c.innerHTML = `<img src="${GITHUB_BASE}${i}.png"><div><span class="f-nick">${u}</span><span class="f-item">${i}</span></div>`;
    f.prepend(c);
    setTimeout(() => c.remove(), 60000);
}

// ВХОД И АВТОРИЗАЦИЯ
async function login() {
    const e = document.getElementById('user_email').value;
    const p = document.getElementById('user_password').value;
    if(p.length < 8) return showNotify("ПАРОЛЬ МИН. 8 СИМВОЛОВ!");

    const { data } = await supabaseClient.from('profiles').select('*').eq('email', e).eq('password', p).single();
    if(data) {
        currentUser = data;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    } else {
        showNotify("ОШИБКА ВХОДА");
    }
}

function showAuth(m) {
    document.getElementById('step-choice').style.display = (m=='choice'?'block':'none');
    document.getElementById('step-form').style.display = (m=='choice'?'none':'block');
}

function logout() { localStorage.clear(); location.reload(); }

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', u.email).eq('password', u.password).single();
        if (data) { currentUser = data; document.getElementById('auth-screen').style.display='none'; document.getElementById('game-interface').style.display='block'; navTo('cases'); initRealtime(); }
    }
};
