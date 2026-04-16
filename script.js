const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '7032738927:AAH0zFcl4_H_9o9G-lZp1D6Y5v7wJ_6m_vM'; 
const TG_CHAT_ID = '6469643444';

let currentUser = null;
let isSpinning = false; 
const SELL_COMMISSION = 0.20; 

const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalBroadcast();
};

// --- УВЕДОМЛЕНИЯ ---
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
    }, 3000);
}

function initGlobalBroadcast() {
    liveChannel
    .on('broadcast', { event: 'new-drop' }, (payload) => {
        addToLiveBoard(payload.payload.user, payload.payload.item);
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

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
}

// --- БЕСКОНЕЧНАЯ РУЛЕТКА ---
async function openRoulette(caseId) {
    if (isSpinning) return;

    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Мало монет!");

    isSpinning = true;
    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    
    let tapeHTML = '';
    const itemsCount = 150; 
    const winIndex = 135; 

    for(let i = 0; i < itemsCount; i++) {
        const rand = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    tape.querySelectorAll('.roulette-item')[winIndex].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        const itemWidth = 110; // min-width 100 + margin 10
        const wrapperWidth = document.querySelector('.roulette-wrapper').offsetWidth;
        const finalShift = (winIndex * itemWidth) - (wrapperWidth / 2) + (itemWidth / 2);
        
        tape.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0.1, 1)';
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now(), status: 'active' }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        
        addToLiveBoard(currentUser.username, win.name);
        liveChannel.send({
            type: 'broadcast',
            event: 'new-drop',
            payload: { user: currentUser.username, item: win.name }
        });
        
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        if (typeof confetti === 'function') confetti();
        isSpinning = false;
    }, 6500);
}

// --- ПОЛНЫЙ РЕНДЕР ИНВЕНТАРЯ ---
async function renderProfile() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = data;
    
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-balance').innerText = currentUser.score;
    
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = ''; 

    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center; width:100%;">ИНВЕНТАРЬ ПУСТ</div>';
        return;
    }

    currentUser.inventory.slice().reverse().forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = `inv-item ${item.status === 'processing' ? 'processing' : ''}`;
        
        itemCard.innerHTML = `
            ${item.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${item.char}.png">
            <h3>${item.char}</h3>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem('${item.id}')">ВЫВОД</button>
                <button class="sell-btn" onclick="sellItem('${item.id}', '${item.char}')">ПРОДАТЬ</button>
            </div>
        `;
        invList.appendChild(itemCard);
    });
}

async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <p class="case-price">$${c.price}</p>
            <button class="neon-btn" onclick="openRoulette(${c.id})">ОТКРЫТЬ</button>
        </div>`).join('');
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

async function sellItem(itemId, charName) {
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    
    currentUser.inventory = currentUser.inventory.filter(i => String(i.id) !== String(itemId));
    currentUser.score += sellPrice;
    
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
    renderProfile();
    showNotify(`+$${sellPrice}`);
}

async function withdrawItem(id) {
    const nick = prompt("Ник в Roblox:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => String(x.id) === String(id));
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("Заявка отправлена!");
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('Вывод: ' + nick + '\nПредмет: ' + item.char)}`);
}

function addToLiveBoard(username, itemName) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.innerHTML = `<img src="${GITHUB_BASE}${itemName}.png"><div class="drop-info"><span class="drop-nick">${username}</span><span class="drop-item">${itemName}</span></div>`;
    board.prepend(card);
    if (board.childNodes.length > 20) board.removeChild(board.lastChild);
}

function switchAuthMode(mode) {
    document.getElementById('btn-login-action').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('btn-reg-action').style.display = mode === 'reg' ? 'block' : 'none';
    document.getElementById('tab-btn-login').className = mode === 'login' ? 'active' : '';
    document.getElementById('tab-btn-reg').className = mode === 'reg' ? 'active' : '';
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
    currentUser = data;
    localStorage.setItem('game_user_id', data.id);
    enterGame();
}

function logout() {
    localStorage.removeItem('game_user_id');
    location.reload();
}
