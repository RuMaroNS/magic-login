const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const SELL_COMMISSION = 0.20; 
const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalRealtime();
};

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification cyber-border';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 2500);
}

function initGlobalRealtime() {
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
    document.getElementById('top-bar').style.display = 'flex';
    navTo('cases');
}

function updateUI() {
    if (!currentUser) return;
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
    document.getElementById('p-balance').innerText = currentUser.score;
    document.getElementById('p-cp').innerText = currentUser.cyberpunk_points || 0;
}

// --- ЛОГИКА МАРКЕТА И КВЕСТОВ ---

async function renderMarket() {
    const { data: stock } = await supabaseClient.from('limited_stock').select('*');
    const grid = document.getElementById('limited-grid');
    
    grid.innerHTML = stock.map(i => `
        <div class="item-card cyber-border">
            <div class="limited-tag">${i.stock > 0 ? 'STOCK: ' + i.stock : 'SOLD OUT'}</div>
            <img src="${GITHUB_BASE}${encodeURIComponent(i.image_url)}.png">
            <h4>${i.name}</h4>
            <button class="neon-btn" style="background:var(--cyber-pink)" 
                onclick="${i.stock > 0 ? `buyLimited(${i.id}, ${i.price_cp})` : ''}">
                ${i.price_cp} CP
            </button>
        </div>
    `).join('');
    
    const { data: tasks } = await supabaseClient.from('cyber_tasks').select('*');
    document.getElementById('tasks-list').innerHTML = tasks.map(t => `
        <div class="task-card cyber-border">
            <div>
                <div class="task-title">${t.title}</div>
                <div class="task-reward">+${t.reward} CP</div>
            </div>
            <button class="neon-btn" style="width:100px; background:var(--cyber-green)" onclick="completeTask(${t.id}, ${t.reward})">DO IT</button>
        </div>
    `).join('');
}

async function buyLimited(id, price) {
    if ((currentUser.cyberpunk_points || 0) < price) return showNotify("НЕДОСТАТОЧНО CP!");
    
    const { data: check } = await supabaseClient.from('limited_stock').select('stock, name').eq('id', id).single();
    if (check.stock <= 0) return showNotify("РАЗОБРАЛИ!");

    const newCP = currentUser.cyberpunk_points - price;
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP }).eq('id', currentUser.id);
    await supabaseClient.from('limited_stock').update({ stock: check.stock - 1 }).eq('id', id);
    
    const newInv = [...(currentUser.inventory || []), { char: check.name, id: Date.now(), rarity: 'LIMITED' }];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    
    currentUser.cyberpunk_points = newCP;
    currentUser.inventory = newInv;
    showNotify("ЛИМИТКА В ИНВЕНТАРЕ!");
    renderMarket();
    updateUI();
}

async function completeTask(taskId, reward) {
    const newCP = (currentUser.cyberpunk_points || 0) + reward;
    await supabaseClient.from('profiles').update({ cyberpunk_points: newCP }).eq('id', currentUser.id);
    currentUser.cyberpunk_points = newCP;
    showNotify(`+${reward} CP ПОЛУЧЕНО!`);
    updateUI();
}

// --- СТАНДАРТНАЯ ЛОГИКА (РУЛЕТКА, ВЫВОД, ПРОДАЖА) ---

async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("МАЛО МОНЕТ!");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);
    updateUI();

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

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        
        liveChannel.send({ type: 'broadcast', event: 'new-drop', payload: { user: currentUser.username, item: win.name } });
        addToLiveBoard(currentUser.username, win.name);

        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        if (typeof confetti === 'function') confetti();
    }, 5500);
}

// ... (оставшиеся функции: login, register, logout, sellItem, withdrawItem, navTo, renderCases, renderProfile) ...
// Важно: в renderProfile и renderCases добавь вызов updateUI()
