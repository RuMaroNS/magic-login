const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const SELL_COMMISSION = 0.20; 

window.onload = () => { autoLogin(); };

// ФУНКЦИЯ УВЕДОМЛЕНИЙ
function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    
    setTimeout(() => n.classList.add('show'), 3);
    
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 2500);
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
    showNotify("Вы вышли из системы");
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    if (!user || !pass) return showNotify("Введите данные!");

    const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
        showNotify(`С возвращением, ${user}!`);
    } else showNotify("Неверный логин или пароль!");
}

async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    if (!user || !pass) return showNotify("Заполните поля!");

    const { data, error } = await supabaseClient.from('profiles').insert([{ username: user, password: pass, score: 50, inventory: [] }]).select().single();
    if (error) return showNotify("Никнейм уже занят!");
    
    showNotify("Аккаунт создан!");
    login();
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
    initRealtime();
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if (newInv.length > oldInv.length) {
            addToLiveBoard(p.new.username, newInv[newInv.length - 1].char);
        }
    }).subscribe();
}

async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Недостаточно монет!");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.1, 0, 0.1, 1)';
        const itemWidth = 130; 
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

async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    if (!itemData) return showNotify("Ошибка связи с базой!");

    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    currentUser.inventory = currentUser.inventory.filter(i => i.id !== itemId);
    currentUser.score += sellPrice;

    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
    renderProfile();
    showNotify(`Предмет продан за $${sellPrice}`);
}

async function withdrawItem(id) {
    const nick = prompt("Введите ваш ник в Roblox для получения:");
    if (!nick) return;
    
    const item = currentUser.inventory.find(x => x.id === id);
    if (!item || item.status === 'processing') return;

    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    
    showNotify("Заявка на вывод отправлена!");

    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TG_CHAT_ID,
            text: `🚀 **ЗАЯВКА НА ВЫВОД**\n👤 Игрок: ${currentUser.username}\n🎮 Roblox: ${nick}\n📦 Предмет: ${item.char}`,
            parse_mode: 'Markdown'
        })
    }).catch(() => showNotify("Ошибка отправки в ТГ!"));
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
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

async function renderProfile() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;

    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-balance').innerText = currentUser.score;

    const invList = document.getElementById('inventory-list');
    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center; width:100%;">ВАШ ИНВЕНТАРЬ ПУСТ</div>';
        return;
    }

    invList.innerHTML = currentUser.inventory.map(i => {
        const isP = i.status === 'processing';
        return `
            <div class="inv-item ${isP ? 'processing' : ''}">
                ${isP ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
                <img src="${GITHUB_BASE}${i.char}.png">
                <p>${i.char}</p>
                <div class="inv-btns">
                    <button class="withdraw-btn" ${isP ? 'disabled' : ''} onclick="withdrawItem(${i.id})">ВЫВОД</button>
                    <button class="withdraw-btn sell-btn" ${isP ? 'disabled' : ''} onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
                </div>
            </div>`;
    }).reverse().join('');
}

function addToLiveBoard(user, item) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div><div style="font-size:10px;color:#5a5a7a">${user}</div><div style="font-size:12px">${item}</div></div>`;
    board.prepend(card);
    if (board.children.length > 15) board.lastChild.remove();
}

function switchAuthMode(mode) {
    document.getElementById('tab-btn-login').className = (mode === 'login' ? 'active' : '');
    document.getElementById('tab-btn-reg').className = (mode === 'reg' ? 'active' : '');
    document.getElementById('btn-login-action').style.display = (mode === 'login' ? 'block' : 'none');
    document.getElementById('btn-reg-action').style.display = (mode === 'reg' ? 'block' : 'none');
}
