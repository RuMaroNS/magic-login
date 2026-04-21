const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;

// --- 1. СИСТЕМА ВХОДА И АВТО-ЛОГИНА ---

window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    
    if (!u || !p) return; 

    const { data, error } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    
    if(data) {
        currentUser = data;
        localStorage.setItem('saved_login', u);
        localStorage.setItem('saved_pass', p);
        
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        
        subscribeUpdates();
        window.navTo('cases');
    } else {
        if (localStorage.getItem('saved_login')) {
            localStorage.removeItem('saved_login');
            localStorage.removeItem('saved_pass');
        }
        alert("ACCESS DENIED: INVALID CREDENTIALS");
    }
};

window.onload = () => {
    const savedL = localStorage.getItem('saved_login');
    const savedP = localStorage.getItem('saved_pass');
    const inputU = document.getElementById('user_name');
    const inputP = document.getElementById('user_password');

    if (savedL) inputU.value = savedL;
    if (savedP) inputP.value = savedP;

    // Умное ожидание автозаполнения (600мс)
    setTimeout(() => {
        if (inputU.value.trim() !== "" && inputP.value.trim() !== "") {
            console.log("Auto-login signal detected...");
            window.login();
        }
    }, 600);
};

// --- 2. ЛОГИКА КЕЙСОВ И СТОКА (MARKET) ---

window.renderAllCases = async function() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    if (!data) return;

    // Обычные кейсы
    const normal = data.filter(c => c.type !== 'limited');
    document.getElementById('cases-grid').innerHTML = normal.map(c => `
        <div class="mega-card" onclick="window.showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <div class="price-tag">$${c.price}</div>
        </div>`).join('');

    // Лимитки (с проверкой Stock)
    const limited = data.filter(c => c.type === 'limited');
    document.getElementById('limited-grid').innerHTML = limited.map(c => {
        const stockCount = (c.stock === null || c.stock === undefined) ? 0 : c.stock;
        const isOut = stockCount <= 0;
        
        return `
        <div class="mega-card">
            <div class="stock-badge" style="${isOut ? 'background:#444; color:#888;' : ''}">STOCK: ${stockCount}</div>
            <img src="${GITHUB_BASE}${c.image_url}" style="${isOut ? 'filter:grayscale(1); opacity:0.4;' : ''}">
            <h3>${c.name.toUpperCase()}</h3>
            <div class="price-tag">${c.price_cp || 0} CP</div>
            <button class="buy-btn" ${isOut ? 'disabled' : ''} onclick="window.buyLimited(${c.id}, ${c.price_cp})">
                ${isOut ? 'OUT OF STOCK' : 'PURCHASE'}
            </button>
        </div>`;
    }).join('');
};

window.buyLimited = async function(id, price) {
    if ((currentUser.cyberpunk_points || 0) < price) return alert("NOT ENOUGH CP");

    const { data: item } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    if (!item || item.stock <= 0) return alert("SOLD OUT");

    const newCP = currentUser.cyberpunk_points - price;
    const newStock = item.stock - 1;

    // Списание стока и начисление предмета
    await supabaseClient.from('cases_meta').update({ stock: newStock }).eq('id', id);
    currentUser.inventory.push({ id: Date.now(), char: item.name, status: 'ready' });
    
    await supabaseClient.from('profiles').update({ 
        cyberpunk_points: newCP, 
        inventory: currentUser.inventory 
    }).eq('id', currentUser.id);

    alert("ITEM SECURED!");
};

// --- 3. ПРОФИЛЬ И ИНВЕНТАРЬ ---

window.renderProfile = function() {
    if (!currentUser) return;
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        const s = i.status || 'ready';
        return `
        <div class="mega-card">
            ${s !== 'ready' ? `<div class="status-layer">${s.toUpperCase()}</div>` : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <div class="inv-actions">
                <button class="btn-action withdraw" onclick="window.withdrawItem(${i.id})">WITHDRAW</button>
                <button class="btn-action sell" onclick="window.sellItem(${i.id})">SELL</button>
            </div>
        </div>`;
    }).join('');
};

window.withdrawItem = async function(id) {
    const item = currentUser.inventory.find(x => x.id === id);
    const nick = prompt("ROBLOX USERNAME:");
    if(!nick) return;
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    window.renderProfile();
};

window.sellItem = async function(id) {
    const idx = currentUser.inventory.findIndex(x => x.id === id);
    currentUser.score += 50; 
    currentUser.inventory.splice(idx, 1);
    await supabaseClient.from('profiles').update({ score: currentUser.score, inventory: currentUser.inventory }).eq('id', currentUser.id);
    window.renderProfile();
};

// --- 4. ВСПОМОГАТЕЛЬНОЕ ---

window.navTo = function(id) {
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
            if (document.getElementById('page-profile').classList.contains('active')) window.renderProfile();
        }
    }).subscribe();
}
