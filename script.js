const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;

// REAL-TIME: Слушаем базу
function subscribeUpdates() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        if (currentUser && payload.new.id === currentUser.id) {
            currentUser = payload.new;
            updateUI();
            if (document.getElementById('page-profile').classList.contains('active')) renderProfile();
        }
    }).subscribe();
}

window.navTo = function(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if(id === 'profile') renderProfile();
    if(id === 'cases' || id === 'market') renderAllCases();
};

// Загрузка всех кейсов и разделение на Обычные и Лимитки
async function renderAllCases() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    
    // 1. Обычные кейсы (где type не limited)
    const normalCases = data.filter(c => c.type !== 'limited');
    document.getElementById('cases-grid').innerHTML = normalCases.map(c => `
        <div class="mega-card" onclick="window.showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name}</h3>
            <div class="price-tag">$${c.price}</div>
            <button class="buy-btn">OPEN</button>
        </div>`).join('');

    // 2. Лимитки (где type == 'limited')
    const limitedCases = data.filter(c => c.type === 'limited');
    document.getElementById('limited-grid').innerHTML = limitedCases.map(c => `
        <div class="mega-card">
            <div class="stock-badge">STOCK: ${c.stock || '∞'}</div>
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name}</h3>
            <button class="buy-btn" onclick="window.buyLimited(${c.id})">${c.price_cp || 100} CP</button>
        </div>`).join('');
}

window.showCaseInfo = async function(id) {
    const { data: c } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    window.navTo('case-info');
    document.getElementById('case-detail-hero').innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <img src="${GITHUB_BASE}${c.image_url}" style="width:250px;">
            <h1 style="font-family:Orbitron; font-size:40px;">${c.name}</h1>
            <button class="buy-btn" style="width:200px; margin-top:20px;">OPEN FOR $${c.price}</button>
        </div>`;
};

function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        const s = i.status || 'ready';
        return `
        <div class="mega-card">
            ${s !== 'ready' ? `<div class="status-layer">${s.toUpperCase()}</div>` : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="buy-btn" style="background:#00ffcc; color:#000;" onclick="window.withdrawItem(${i.id})">ВЫВОД</button>
                <button class="buy-btn" style="background:#ff4444;" onclick="window.sellItem(${i.id})">SELL</button>
            </div>
        </div>`;
    }).join('');
}

// ВХОД
window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        subscribeUpdates();
        window.navTo('cases');
    }
};

function updateUI() {
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
}

window.onload = async () => {
    const id = localStorage.getItem('game_user_id');
    if(id) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
        if(data) { currentUser = data; window.login(); }
    }
};
