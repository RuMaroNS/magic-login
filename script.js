const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
let currentCase = null;

window.onload = () => { autoLogin(); };

// --- НАВИГАЦИЯ ---
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    if(pageId === 'market') renderMarket();
    updateUI();
}

// --- КЕЙСЫ (НЮАНС 4) ---
async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card" onclick="showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name}</h3>
            <button class="neon-btn">OPEN</button>
        </div>`).join('');
}

async function showCaseInfo(id) {
    const { data: c } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    currentCase = c;
    navTo('case-info');
    
    document.getElementById('case-detail-content').innerHTML = `
        <div class="detail-header">
            <img src="${GITHUB_BASE}${c.image_url}" class="detail-img">
            <h1>${c.name}</h1>
            <button class="neon-btn open-btn-big" onclick="startOpening()">OPEN FOR $${c.price}</button>
        </div>`;

    document.getElementById('loot-chances-grid').innerHTML = c.loot.map(item => `
        <div class="loot-card">
            <img src="${GITHUB_BASE}${item.name}.png">
            <div class="chance-tag">${item.chance}%</div>
            <p>${item.name}</p>
        </div>`).join('');
}

// --- ИНВЕНТАРЬ (НЮАНС 1) ---
window.withdrawItem = async function(id) {
    const item = currentUser.inventory.find(x => x.id === id);
    if (item.status === 'processing') return;

    const nick = prompt("ROBLOX NICK:");
    if (!nick) return;

    // Ставим статус в памяти и базе
    currentUser.inventory = currentUser.inventory.map(i => {
        if(i.id === id) i.status = 'processing';
        return i;
    });

    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    showNotify("REQUEST SENT");
};

function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    const invList = document.getElementById('inventory-list');
    
    invList.innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        let statusClass = i.status || 'ready';
        let statusText = '';
        if(i.status === 'processing') statusText = 'В ОБРАБОТКЕ';
        if(i.status === 'accept') statusText = 'УСПЕШНО';
        if(i.status === 'decline') statusText = 'ОТКАЗАНО';

        return `
        <div class="inv-item state-${statusClass}">
            ${i.status && i.status !== 'ready' ? `<div class="status-overlay">${statusText}</div>` : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns" ${i.status && i.status !== 'ready' ? 'style="display:none"' : ''}>
                <button class="w-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="s-btn" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`;
    }).join('');
}

// --- ОСТАЛЬНОЕ ---
async function login() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) { currentUser = data; enterGame(); }
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    document.getElementById('top-bar').style.display = 'flex';
    navTo('cases');
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
