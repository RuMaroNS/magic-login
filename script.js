const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
let currentCase = null;

// Глобальные функции
window.navTo = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const p = document.getElementById('page-' + pageId);
    if(p) p.classList.add('active');
    
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    if(pageId === 'market') renderMarket();
    updateUI();
};

window.onload = () => { autoLogin(); };

// --- КЕЙСЫ ---
async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card" onclick="window.showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <div class="case-price">$${c.price}</div>
            <button class="neon-btn">INFO</button>
        </div>`).join('');
}

window.showCaseInfo = async function(id) {
    const { data: c } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    currentCase = c;
    window.navTo('case-info');
    
    document.getElementById('case-detail-content').innerHTML = `
        <div class="detail-box">
            <img src="${GITHUB_BASE}${c.image_url}" class="case-preview-img">
            <h1>${c.name}</h1>
            <button class="neon-btn open-btn" onclick="window.startOpening()">OPEN FOR $${c.price}</button>
        </div>`;

    document.getElementById('loot-chances-grid').innerHTML = c.loot.map(item => `
        <div class="loot-card">
            <div class="chance-tag">${item.chance}%</div>
            <img src="${GITHUB_BASE}${item.name}.png">
            <p>${item.name}</p>
        </div>`).join('');
};

window.startOpening = async function() {
    if (currentUser.score < currentCase.price) return window.showNotify("NOT ENOUGH CASH");
    
    currentUser.score -= currentCase.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);
    
    window.navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.style.transition = 'none'; tape.style.transform = 'translateX(0)';
    
    const win = currentCase.loot[Math.floor(Math.random() * currentCase.loot.length)];
    const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now(), status: 'ready' }];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;
    
    setTimeout(() => {
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = win.name;
    }, 5000);
};

// --- МАРКЕТ ---
async function renderMarket() {
    const { data: stock } = await supabaseClient.from('limited_stock').select('*');
    document.getElementById('limited-grid').innerHTML = stock.map(i => `
        <div class="case-card">
            <div class="stock-badge">STOCK: ${i.stock}</div>
            <img src="${GITHUB_BASE}${i.image_url}.png">
            <h3>${i.name}</h3>
            <button class="neon-btn" onclick="window.buyLimited(${i.id}, ${i.price_cp})">${i.price_cp} CP</button>
        </div>`).join('');
}

// --- ПРОФИЛЬ И ИНВЕНТАРЬ ---
function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    const invList = document.getElementById('inventory-list');
    
    invList.innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        const s = i.status || 'ready';
        let overlay = '';
        if (s === 'processing') overlay = '<div class="inv-overlay proc">В ОБРАБОТКЕ</div>';
        if (s === 'accept') overlay = '<div class="inv-overlay acc">УСПЕШНО</div>';
        if (s === 'decline') overlay = '<div class="inv-overlay dec">ОТКАЗАНО</div>';

        return `
        <div class="inv-item st-${s}">
            ${overlay}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns" ${s !== 'ready' ? 'style="display:none"' : ''}>
                <button class="w-btn" onclick="window.withdrawItem(${i.id})">ВЫВОД</button>
                <button class="s-btn" onclick="window.sellItem(${i.id})">ПРОДАТЬ</button>
            </div>
        </div>`;
    }).join('');
}

window.sellItem = async function(id) {
    const itemIdx = currentUser.inventory.findIndex(x => x.id === id);
    if(itemIdx === -1) return;
    currentUser.score += 50; // Цена продажи
    currentUser.inventory.splice(itemIdx, 1);
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    window.showNotify("ITEM SOLD FOR $50");
};

window.withdrawItem = async function(id) {
    const item = currentUser.inventory.find(x => x.id === id);
    if(item.status !== 'ready') return;
    const nick = prompt("ROBLOX NICK:");
    if(!nick) return;
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    window.showNotify("WITHDRAWAL REQUESTED");
};

// --- СИСТЕМА ---
window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) { currentUser = data; localStorage.setItem('game_user_id', data.id); enterGame(); }
};

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    document.getElementById('top-bar').style.display = 'flex';
    window.navTo('cases');
}

async function autoLogin() {
    const id = localStorage.getItem('game_user_id');
    if(id) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
        if(data) { currentUser = data; enterGame(); }
    }
}

function updateUI() {
    if(!currentUser) return;
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
}

window.showNotify = function(t) {
    const c = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification'; n.innerText = t;
    c.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
};
