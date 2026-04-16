const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
const SELL_COMMISSION = 0.20; 

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
window.onload = () => {
    checkCookies();
};

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
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data && !error) {
            currentUser = data;
            enterGame();
        } else {
            localStorage.removeItem('game_user_id');
        }
    }
}

// --- ВХОД И РЕГИСТРАЦИЯ (Username + 8 символов) ---
function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-btn-reg').classList.toggle('active', mode === 'reg');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;

    if (!user || !pass) return showNotify("Поля не могут быть пустыми!");
    if (pass.length < 8) return showNotify("Пароль должен быть от 8 символов!");

    // score: 50 — это стартовый капитал, здесь НЕТ комиссий
    const { data, error } = await supabaseClient.from('profiles').insert([
        { username: user, password: pass, score: 50, inventory: [] }
    ]).select().single();

    if (error) {
        console.error(error);
        return showNotify("Никнейм уже занят!");
    }
    
    showNotify("Аккаунт создан! +50 монет.");
    login(); // После рега сразу входим
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();

    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else {
        showNotify("Неверный ник или пароль!");
    }
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

// --- СИНХРОНИЗАЦИЯ И ЭКОНОМИКА ---
async function syncFromDB() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
}

async function renderCases() {
    const { data: cases, error } = await supabaseClient.from('cases_meta').select('*');
    if (error) {
        console.error("Ошибка БД:", error);
        return showNotify("Ошибка загрузки данных!");
    }
    
    const grid = document.getElementById('cases-grid');
    if (!grid) return; // Защита от ошибок

    grid.innerHTML = cases.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.image_url || 'Case_Basic.png'}">
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin:15px 0; font-size:20px;">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette(${c.id})">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

async function openRoulette(caseId) {
    await syncFromDB();
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    
    if (currentUser.score < cData.price) return showNotify("Мало монет!");

    const newScore = currentUser.score - cData.price;
    await supabaseClient.from('profiles').update({ score: newScore }).eq('id', currentUser.id);
    currentUser.score = newScore;

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
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

    const newItem = { char: win.name, id: Date.now() };
    const newInv = [...(currentUser.inventory || []), newItem];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
    }, 5500);
}

// --- ПРОДАЖА ПРЕДМЕТА ---
async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    if (!itemData) return showNotify("Цена предмета не найдена!");

    // Вычисляем сколько получит игрок: Цена * 0.8 (если комиссия 20%)
    const moneyToReceive = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    
    const updatedInv = currentUser.inventory.filter(i => i.id !== itemId);
    const newScore = currentUser.score + moneyToReceive;

    const { error } = await supabaseClient.from('profiles').update({
        inventory: updatedInv,
        score: newScore
    }).eq('id', currentUser.id);

    if (!error) {
        currentUser.inventory = updatedInv;
        currentUser.score = newScore;
        renderProfile();
        showNotify(`Продано! Вы получили ${moneyToReceive}$`);
    }
}

// --- НАВИГАЦИЯ И УВЕДОМЛЕНИЯ ---
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

async function renderProfile() {
    await syncFromDB(); 
    // Просто выводим число из базы, БЕЗ математики
    document.getElementById('p-balance').innerText = currentUser.score; 
    
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn" style="background:#e67e22" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>
    `).join('');
}

function showNotify(t) {
    const c = document.getElementById('notification-container');
    const n = document.createElement('div'); n.className = 'notification'; n.innerText = t;
    c.appendChild(n); setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2000);
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if(newInv.length > oldInv.length) {
            const lastItem = newInv[newInv.length - 1];
            const nick = p.new.username || "Player";
            addToLiveBoard(nick, lastItem.char);
        }
    }).subscribe();
}

function addToLiveBoard(username, itemName) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${itemName}.png"><div class="drop-info"><span class="drop-nick">${username}</span><span class="drop-item">${itemName}</span></div>`;
    board.prepend(card);
    if (board.childNodes.length > 20) board.removeChild(board.lastChild);
}

async function withdrawItem(id) {
    const nick = prompt("Твой ник в Roblox для вывода:");
    if(!nick) return;
    const item = currentUser.inventory.find(x => x.id === id);
    currentUser.inventory = currentUser.inventory.filter(x => x.id !== id);
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("Заявка на вывод создана!");
}

function logout() { localStorage.removeItem('game_user_id'); location.reload(); }
