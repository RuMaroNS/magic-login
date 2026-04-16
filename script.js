const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '7032738927:AAH0zFcl4_H_9o9G-lZp1D6Y5v7wJ_6m_vM'; 
const TG_CHAT_ID = '6469643444';

let currentUser = null;
const SELL_COMMISSION = 0.20; // 20% комиссия

window.onload = () => { autoLogin(); };

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
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else alert("Ошибка входа!");
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data, error } = await supabaseClient.from('profiles').insert([{ username: user, password: pass, score: 50, inventory: [] }]).select().single();
    if (error) return alert("Ник занят!");
    login();
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

// ЛАЙВ БОРД (ТОЛЬКО НОВЫЙ ЛУТ)
function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        // Если предметов стало больше — это дроп из кейса
        if (newInv.length > oldInv.length) {
            addToLiveBoard(p.new.username, newInv[newInv.length - 1].char);
        }
    }).subscribe();
}

// ОТКРЫТИЕ КЕЙСА
async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return alert("Мало монет!");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    // Лента рулетки
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.1, 0, 0.1, 1)'; // Плавная, но четкая анимация
        const itemWidth = 130; // 120 + 10 margin
        const rouletteWrapper = document.querySelector('.roulette-wrapper');
        const finalShift = (50 * itemWidth) - (rouletteWrapper.offsetWidth / 2) + (itemWidth / 2);
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
    setTimeout(async () => {
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        if (typeof confetti === 'function') confetti();
    }, 5500);
}

// ПРОДАЖА ПРЕДМЕТА
async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    if (!itemData) return alert("Ошибка цены!");

    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    currentUser.inventory = currentUser.inventory.filter(i => i.id !== itemId);
    currentUser.score += sellPrice;

    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
    renderProfile();
    alert(`+$${sellPrice} получено!`);
}

// ВЫВОД ПРЕДМЕТА
async function withdrawItem(id) {
    const nick = prompt("Ник в Roblox:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => x.id === id);
    if (!item || item.status === 'processing') return;

    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('🚀 ВЫВОД\n👤: ' + currentUser.username + '\n🎮 Roblox: ' + nick + '\n📦: ' + item.char)}`);
}

// НАВИГАЦИЯ
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    window.scrollTo(0,0); // Всегда наверх при смене страницы
}

// РЕНДЕР КЕЙСОВ
async function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = '<div style="color:#00d4ff; width:100%; text-align:center;">ЗАГРУЗКА...</div>';
    
    const { data: cases, error } = await supabaseClient.from('cases_meta').select('*');
    if (error) { grid.innerHTML = 'Ошибка базы данных!'; return; }

    grid.innerHTML = cases.map(c => `
        <div class="case-card" onclick="openRoulette(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <p class="case-price">$${c.price}</p>
            <button class="neon-btn">ОТКРЫТЬ</button>
        </div>`).join('');
}

// РЕНДЕР ПРОФИЛЯ С НОВЫМ ДИЗАЙНОМ ИНВЕНТАРЯ
async function renderProfile() {
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '<div style="color:#00d4ff;">СИНХРОНИЗАЦИЯ...</div>';

    // Получаем свежие данные профиля
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (!error) currentUser = data;

    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-balance').innerText = currentUser.score;

    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center;">ИНВЕНТАРЬ ПУСТ</div>';
        return;
    }

    invList.innerHTML = currentUser.inventory.map(i => {
        const isProcessing = i.status === 'processing';
        return `
            <div class="inv-item ${isProcessing ? 'processing' : ''}">
                ${isProcessing ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
                <img src="${GITHUB_BASE}${i.char}.png">
                <p>${i.char}</p>
                <div class="inv-btns">
                    <button class="withdraw-btn" ${isProcessing ? 'disabled' : ''} onclick="withdrawItem(${i.id})">ВЫВОД</button>
                    <button class="withdraw-btn sell-btn" ${isProcessing ? 'disabled' : ''} onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
                </div>
            </div>`;
    }).reverse().join('');
}

// ЛАЙВ ДРОПЫ В ШАПКЕ
function addToLiveBoard(user, item) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div><div style="font-size:10px;color:#5a5a7a">${user}</div><div style="font-size:12px">${item}</div></div>`;
    board.prepend(card);
    if (board.children.length > 15) board.lastElementChild.remove();
}

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}
