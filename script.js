const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const SELL_COMMISSION = 0.20;
let isSpinning = false;
let liveDrops = [];

// Создаем один общий канал для всех
const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalRealtime(); // Запускаем прослушку сразу
};

function showNotify(text) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 500);
    }, 3000);
}

// ФИКС: Слушаем сигналы от других игроков
function initGlobalRealtime() {
    liveChannel
    .on('broadcast', { event: 'new-drop' }, (payload) => {
        // Когда кто-то другой выбил предмет, добавляем его в лайв-борд
        addToLive(win.name, currentUser.email);
    })
    .subscribe();
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data) { currentUser = data; enterGame(); }
    }
}

function logout() {
    localStorage.removeItem('game_user_id');
    currentUser = null;
    document.getElementById('game-interface').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    showNotify("Вы вышли");
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
        showNotify(`Привет, ${user}!`);
    } else showNotify("Ошибка входа!");
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data, error } = await supabaseClient.from('profiles').insert([{ username: user, password: pass, score: 50, inventory: [] }]).select().single();
    if (error) return showNotify("Ник занят!");
    login();
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
}

async function openRoulette(caseId) {
    if (isSpinning) return; // КУЛДАУН

    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Недостаточно баланса!");

    isSpinning = true;
    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';

    // БЕСКОНЕЧНАЯ ЛЕНТА
    let tapeHTML = '';
    for (let i = 0; i < 150; i++) {
        const item = cData.loot[i % cData.loot.length];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${item.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const winIndex = 130; // Выигрышный слот в конце ленты
    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    tape.querySelectorAll('.roulette-item')[winIndex].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        const itemWidth = 140; // Ширина айтема из CSS
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const finalShift = (winIndex * itemWidth) - (wrapperWidth / 2) + (itemWidth / 2);
        
        tape.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    setTimeout(async () => {
        // Добавляем в инвентарь (твой старый код...)
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;

        // КЛЮЧЕВОЙ МОМЕНТ: Добавляем в LIVE
        addToLive(win.name, currentUser.email);

        // Показываем окно выигрыша
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        
        showNotify(`Вы выбили: ${win.name}`);
        isSpinning = false; // Снимаем блок
    }, 6500);
}

async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    currentUser.inventory = currentUser.inventory.filter(i => i.id !== itemId);
    currentUser.score += sellPrice;
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
    renderProfile();
    showNotify(`+$${sellPrice}`);
}

async function withdrawItem(id) {
    const nick = prompt("Ник в Roblox:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => x.id === id);
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("Заявка отправлена!");
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('Вывод: ' + nick + ' Предмет: ' + item.char)}`);
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('win-display').style.display = 'none';
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    window.scrollTo(0,0);
}

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

function renderLiveHeader() {
    const container = document.querySelector('.drop-tape');
    if (!container) return;
    container.innerHTML = liveDrops.map(d => `
        <div class="drop-card">
            <img src="${GITHUB_BASE}${d.name}.png">
            <div class="drop-info">
                <span class="drop-user">${d.email.split('@')[0]}</span>
                <span class="drop-item">${d.name}</span>
            </div>
        </div>
    `).join('');
}

async function renderProfile() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-balance').innerText = currentUser.score;
    const invList = document.getElementById('inventory-list');
    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center; width:100%;">ПУСТО</div>';
        return;
    }
    invList.innerHTML = currentUser.inventory.map(i => `
        <div class="inv-item ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn sell-btn" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`).reverse().join('');
}

function addToLive(itemName, userEmail) {
    liveDrops.unshift({ name: itemName, email: userEmail });
    if (liveDrops.length > 12) liveDrops.pop(); // Ограничиваем длину
    renderLiveHeader();
}

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}
