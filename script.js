const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;

// --- СИСТЕМА УВЕДОМЛЕНИЙ ---
window.showNotify = (text, type = 'info') => {
    const container = document.getElementById('notification-container');
    const note = document.createElement('div');
    note.className = `cyber-notification ${type}`;
    note.innerHTML = `<div class="note-content">${text}</div><div class="note-bar"></div>`;
    container.appendChild(note);
    setTimeout(() => note.classList.add('show'), 10);
    setTimeout(() => {
        note.classList.remove('show');
        setTimeout(() => note.remove(), 500);
    }, 4000);
};

// --- ВХОД И АВТО-ЛОГИН ---
window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    if (!u || !p) return;

    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('saved_login', u);
        localStorage.setItem('saved_pass', p);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        subscribeUpdates();
        window.navTo('cases');
        window.showNotify(`ACCESS GRANTED: ${u}`, 'success');
    } else {
        window.showNotify("INVALID ACCESS KEY", "error");
    }
};

window.onload = () => {
    const sL = localStorage.getItem('saved_login');
    const sP = localStorage.getItem('saved_pass');
    if (sL) document.getElementById('user_name').value = sL;
    if (sP) document.getElementById('user_password').value = sP;
    setTimeout(() => {
        if (document.getElementById('user_name').value && document.getElementById('user_password').value) window.login();
    }, 600);
};

// --- КЕЙСЫ И МАРКЕТ ---
window.showCaseInfo = async function(id) {
    const { data: caseData } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    if (!caseData) return;
    document.getElementById('case-detail-content').innerHTML = `
        <div class="case-hero">
            <img src="${GITHUB_BASE}${caseData.image_url}">
            <h2>${caseData.name}</h2>
            <button class="buy-btn large" onclick="window.openCase(${caseData.id})">OPEN FOR $${caseData.price}</button>
        </div>`;
    window.navTo('case-info');
};

window.renderAllCases = async function() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    if (!data) return;

    document.getElementById('cases-grid').innerHTML = data.filter(c => c.type !== 'limited').map(c => `
        <div class="mega-card" onclick="window.showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name}</h3>
            <div class="price-tag">$${c.price}</div>
        </div>`).join('');

    document.getElementById('limited-grid').innerHTML = data.filter(c => c.type === 'limited').map(c => {
        const stock = c.stock ?? 0;
        const out = stock <= 0;
        return `
        <div class="mega-card">
            <div class="stock-badge" ${out ? 'style="background:#444"' : ''}>STOCK: ${stock}</div>
            <img src="${GITHUB_BASE}${c.image_url}" ${out ? 'style="filter:grayscale(1); opacity:0.5"' : ''}>
            <h3>${c.name}</h3>
            <button class="buy-btn" ${out ? 'disabled' : ''} onclick="window.buyLimited(${c.id}, ${c.price_cp})">
                ${out ? 'SOLD OUT' : (c.price_cp + ' CP')}
            </button>
        </div>`;
    }).join('');
};

window.buyLimited = async function(id, price) {
    if ((currentUser.cyberpunk_points || 0) < price) {
        return window.showNotify("INSUFFICIENT CP FUNDS", "error");
    }

    const { data: item } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    if (!item || item.stock <= 0) return window.showNotify("ITEM OUT OF STOCK", "error");

    const newStock = item.stock - 1;
    const newCP = currentUser.cyberpunk_points - price;

    await supabaseClient.from('cases_meta').update({ stock: newStock }).eq('id', id);
    currentUser.inventory.push({ id: Date.now(), char: item.name, status: 'ready' });
    
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, cyberpunk_points: newCP }).eq('id', currentUser.id);
    window.showNotify("PURCHASE SUCCESSFUL", "success");
};

// --- ИНВЕНТАРЬ ---
window.renderProfile = function() {
    if (!currentUser) return;
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).slice().reverse().map(i => `
        <div class="mega-card">
            <img src="${GITHUB_BASE}${i.char}.png">
            <button class="buy-btn" onclick="window.withdrawItem(${i.id})">ВЫВОД</button>
        </div>`).join('');
};

window.withdrawItem = async function(id) {
    const nick = prompt("ROBLOX USERNAME:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => x.id === id);
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    window.renderProfile();
    window.showNotify("WITHDRAWAL REQUESTED", "info");
};

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if(id === 'profile') window.renderProfile();
    if(id === 'cases' || id === 'market') window.renderAllCases();
};

function subscribeUpdates() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        if (currentUser && payload.new.id === currentUser.id) {
            currentUser = payload.new;
            document.getElementById('h-balance').innerText = currentUser.score;
            document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
            if(document.getElementById('page-profile').classList.contains('active')) window.renderProfile();
        }
    }).subscribe();
}
