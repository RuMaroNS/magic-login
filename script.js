const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
let currentCase = null;

// СЛУШАЕМ ИЗМЕНЕНИЯ (Real-time)
function subscribeToUpdates() {
    supabaseClient
        .channel('any')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
            if (currentUser && payload.new.id === currentUser.id) {
                currentUser = payload.new;
                updateUI();
                if (document.getElementById('page-profile').classList.contains('active')) renderProfile();
            }
        })
        .subscribe();
}

window.navTo = function(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if(id === 'profile') renderProfile();
    if(id === 'cases') renderCases();
    if(id === 'market') renderMarket();
};

window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) { 
        currentUser = data; 
        localStorage.setItem('game_user_id', data.id); 
        enterGame(); 
    } else { showNotify("ACCESS DENIED"); }
};

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    document.getElementById('top-bar').style.display = 'flex';
    subscribeToUpdates();
    window.navTo('cases');
}

// РЕНДЕР КЕЙСОВ
async function renderCases() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = data.map(c => `
        <div class="mega-card case" onclick="window.showCaseInfo(${c.id})">
            <div class="card-glow"></div>
            <img src="${GITHUB_BASE}${c.image_url}">
            <div class="card-info">
                <h3>${c.name}</h3>
                <div class="price-tag">$${c.price}</div>
            </div>
        </div>`).join('');
}

window.showCaseInfo = async function(id) {
    const { data: c } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    currentCase = c;
    window.navTo('case-info');
    document.getElementById('case-detail-hero').innerHTML = `
        <div class="hero-content">
            <img src="${GITHUB_BASE}${c.image_url}" class="hero-img">
            <h1>${c.name}</h1>
            <button class="buy-btn" onclick="window.startOpening()">OPEN_DATA ($${c.price})</button>
        </div>`;
    document.getElementById('loot-chances-grid').innerHTML = c.loot.map(l => `
        <div class="loot-mini">
            <span class="l-chance">${l.chance}%</span>
            <img src="${GITHUB_BASE}${l.name}.png">
        </div>`).join('');
};

// МАРКЕТ (STOCK CARD)
async function renderMarket() {
    const { data } = await supabaseClient.from('limited_stock').select('*');
    document.getElementById('limited-grid').innerHTML = data.map(i => `
        <div class="mega-card stock">
            <div class="stock-header">IN STOCK: ${i.stock}</div>
            <img src="${GITHUB_BASE}${i.image_url}.png">
            <h3>${i.name}</h3>
            <button class="buy-btn cp" onclick="window.buyLimited(${i.id}, ${i.price_cp})">${i.price_cp} CP</button>
        </div>`).join('');
}

function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        const s = i.status || 'ready';
        return `
        <div class="mega-card inv st-${s}">
            ${s !== 'ready' ? `<div class="status-overlay">${s.toUpperCase()}</div>` : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <div class="card-btns">
                <button class="btn-w" onclick="window.withdrawItem(${i.id})" ${s!=='ready'?'disabled':''}>WITHDRAW</button>
                <button class="btn-s" onclick="window.sellItem(${i.id})" ${s!=='ready'?'disabled':''}>SELL</button>
            </div>
        </div>`;
    }).join('');
}

window.withdrawItem = async function(id) {
    const item = currentUser.inventory.find(x => x.id === id);
    if(item.status !== 'ready') return;
    const nick = prompt("ROBLOX USERNAME:");
    if(!nick) return;
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    showNotify("REQUEST LOGGED");
};

function updateUI() {
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
}

window.showNotify = function(t) {
    const n = document.createElement('div');
    n.className = 'notif'; n.innerText = t;
    document.getElementById('notification-container').appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(()=>n.remove(), 400); }, 3000);
};

async function autoLogin() {
    const id = localStorage.getItem('game_user_id');
    if(id) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
        if(data) { currentUser = data; enterGame(); }
    }
}
