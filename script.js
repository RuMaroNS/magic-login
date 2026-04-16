const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '7032738927:AAH0zFcl4_H_9o9G-lZp1D6Y5v7wJ_6m_vM'; 
const TG_CHAT_ID = '6469643444';

let currentUser = null;
let isSpinning = false; 

const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalBroadcast();
};

// --- ФУНКЦИЯ РАСЧЕТА ШАНСОВ (ВАЖНО ДЛЯ ТВОЕГО JSON) ---
function getItemByChance(lootArray) {
    const totalChance = lootArray.reduce((sum, item) => sum + item.chance, 0);
    let random = Math.random() * totalChance;
    for (let item of lootArray) {
        if (random < item.chance) return item;
        random -= item.chance;
    }
    return lootArray[0];
}

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

function initGlobalBroadcast() {
    liveChannel.on('broadcast', { event: 'new-drop' }, (payload) => {
        addToLiveBoard(payload.payload.user, payload.payload.item);
    }).subscribe();
}

async function autoLogin() {
    const savedId = localStorage.getItem('game_user_id');
    if (savedId) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', savedId).single();
        if (data) { currentUser = data; enterGame(); }
    }
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
}

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ОТКРЫТИЯ ---
async function openRoulette(caseId) {
    if (isSpinning) return;

    // 1. Получаем инфу о кейсе
    const { data: cData, error } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (error || !cData) return showNotify("Ошибка кейса!");

    // 2. Проверка баланса
    if (currentUser.score < cData.price) return showNotify("Недостаточно монет!");

    isSpinning = true;
    
    // Снимаем деньги
    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);
    const balEl = document.getElementById('p-balance');
    if (balEl) balEl.innerText = currentUser.score;

    navTo('opening');
    document.getElementById('win-display').style.display = 'none';

    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    // Генерация ленты
    let tapeHTML = '';
    const itemsCount = 100; 
    const winIndex = 85; 

    for(let i = 0; i < itemsCount; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${encodeURIComponent(rand.name)}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    // Выбираем выигрыш по шансам
    const win = getItemByChance(cData.loot);
    const winSlot = tape.querySelectorAll('.roulette-item')[winIndex];
    winSlot.innerHTML = `<img src="${GITHUB_BASE}${encodeURIComponent(win.name)}.png">`;

    setTimeout(() => {
        const itemWidth = 130; 
        const wrapper = document.querySelector('.roulette-wrapper');
        const wrapperWidth = wrapper ? wrapper.offsetWidth : 700;
        const finalShift = (winIndex * itemWidth) - (wrapperWidth / 2) + (itemWidth / 2);
        
        tape.style.transition = 'transform 7s cubic-bezier(0.1, 0, 0.1, 1)';
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 100);

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now(), status: 'active' }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        
        liveChannel.send({
            type: 'broadcast',
            event: 'new-drop',
            payload: { user: currentUser.username, item: win.name }
        });
        
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        
        // Безопасный вызов конфетти
        if (window.confetti) window.confetti();
        isSpinning = false;
    }, 7200);
}

// --- ВСЯ ОСТАЛЬНАЯ ЛОГИКА (ОСТАВЛЯЕМ) ---
async function renderProfile() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-balance').innerText = currentUser.score;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = ''; 
    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#5a5a7a;">ИНВЕНТАРЬ ПУСТ</div>';
        return;
    }
    currentUser.inventory.slice().reverse().forEach(item => {
        const card = document.createElement('div');
        card.className = `inv-item ${item.status === 'processing' ? 'processing' : ''}`;
        card.innerHTML = `
            ${item.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${encodeURIComponent(item.char)}.png">
            <h3>${item.char}</h3>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem('${item.id}')">ВЫВОД</button>
                <button class="sell-btn" onclick="sellItem('${item.id}', '${item.char}')">ПРОДАТЬ</button>
            </div>`;
        invList.appendChild(card);
    });
}

async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    if (!cases) return;
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${encodeURIComponent(c.image_url)}">
            <h3>${c.name.toUpperCase()}</h3>
            <p class="case-price">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette(${c.id})">ОТКРЫТЬ</button>
        </div>`).join('');
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bottom-navbar button').forEach(b => b.classList.remove('active'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');
    const targetBtn = document.getElementById('nav-' + pageId);
    if (targetBtn) targetBtn.classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    if (!itemData) return showNotify("Цена не найдена!");
    const sellPrice = Math.floor(itemData.price * 0.8);
    currentUser.inventory = currentUser.inventory.filter(i => String(i.id) !== String(itemId));
    currentUser.score += sellPrice;
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
    renderProfile();
    showNotify(`Продано за $${sellPrice}`);
}

async function withdrawItem(id) {
    const nick = prompt("Твой ник в Roblox:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => String(x.id) === String(id));
    if (!item) return;
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("Заявка отправлена модератору!");
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('КЛИЕНТ: ' + nick + '\nПРЕДМЕТ: ' + item.char)}`);
}

function addToLiveBoard(username, itemName) {
    const board = document.getElementById('global-live-feed');
    if (!board) return;
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `
        <img src="${GITHUB_BASE}${encodeURIComponent(itemName)}.png">
        <div class="drop-info">
            <span class="drop-nick">${username}</span>
            <span class="drop-item">${itemName}</span>
        </div>`;
    board.prepend(card);
    if (board.childNodes.length > 15) board.removeChild(board.lastChild);
}

function switchAuthMode(mode) {
    document.getElementById('btn-login-action').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('btn-reg-action').style.display = mode === 'reg' ? 'block' : 'none';
    document.getElementById('tab-btn-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-btn-reg').classList.toggle('active', mode === 'reg');
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else showNotify("Неверный логин или пароль!");
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    if (user.length < 3) return showNotify("Короткий ник!");
    const { data, error } = await supabaseClient.from('profiles').insert([{ username: user, password: pass, score: 100, inventory: [] }]).select().single();
    if (error) return showNotify("Ник уже занят!");
    currentUser = data;
    localStorage.setItem('game_user_id', data.id);
    enterGame();
}

function logout() {
    localStorage.removeItem('game_user_id');
    location.reload();
}
