const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
let currentCase = null;

// ПОДПИСКА НА ОБНОВЛЕНИЯ БАЗЫ
function initRealtime() {
    supabaseClient
        .channel('db-changes')
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

// ВХОД
window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else {
        alert("ACCESS DENIED");
    }
};

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    document.getElementById('top-bar').style.display = 'flex';
    initRealtime();
    window.navTo('cases');
}

// КЕЙСЫ
async function renderCases() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = data.map(c => `
        <div class="mega-card" onclick="window.showCaseInfo(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <div class="price-tag">$${c.price}</div>
        </div>`).join('');
}

window.showCaseInfo = async function(id) {
    const { data: c } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    currentCase = c;
    window.navTo('case-info');
    document.getElementById('case-detail-hero').innerHTML = `
        <div class="hero-box">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h1>${c.name}</h1>
            <button class="buy-btn" onclick="window.startOpening()">OPEN_DATA ($${c.price})</button>
        </div>`;
    document.getElementById('loot-chances-grid').innerHTML = c.loot.map(l => `
        <div class="loot-mini">
            <span class="chance">${l.chance}%</span>
            <img src="${GITHUB_BASE}${l.name}.png">
            <p>${l.name}</p>
        </div>`).join('');
};

// РУЛЕТКА
window.startOpening = async function() {
    if(currentUser.score < currentCase.price) return alert("NOT_ENOUGH_CASH");
    
    currentUser.score -= currentCase.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);
    
    window.navTo('opening');
    const tape = document.getElementById('roulette-tape');
    tape.innerHTML = "";
    
    // Создаем 50 элементов для ленты
    for(let i=0; i<50; i++) {
        const item = currentCase.loot[Math.floor(Math.random()*currentCase.loot.length)];
        tape.innerHTML += `<div class="tape-item"><img src="${GITHUB_BASE}${item.name}.png"></div>`;
    }

    const winItem = currentCase.loot[Math.floor(Math.random()*currentCase.loot.length)];
    const winIdx = 45;
    tape.children[winIdx].innerHTML = `<img src="${GITHUB_BASE}${winItem.name}.png">`;

    setTimeout(() => {
        tape.style.transform = `translateX(-${winIdx * 150 - 300}px)`;
    }, 100);

    setTimeout(async () => {
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = winItem.name;
        
        currentUser.inventory.push({ id: Date.now(), char: winItem.name, status: 'ready' });
        await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    }, 5500);
};

// МАРКЕТ
async function renderMarket() {
    const { data } = await supabaseClient.from('limited_stock').select('*');
    document.getElementById('limited-grid').innerHTML = data.map(i => `
        <div class="mega-card">
            <div class="stock-badge">STOCK: ${i.stock}</div>
            <img src="${GITHUB_BASE}${i.image_url}.png">
            <h3>${i.name}</h3>
            <button class="buy-btn" onclick="window.buyLimited(${i.id}, ${i.price_cp})">${i.price_cp} CP</button>
        </div>`).join('');
}

// ПРОФИЛЬ
function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).slice().reverse().map(i => {
        const s = i.status || 'ready';
        return `
        <div class="mega-card inv">
            ${s !== 'ready' ? `<div class="status-layer">${s.toUpperCase()}</div>` : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <div class="inv-btns" ${s !== 'ready' ? 'style="display:none"' : ''}>
                <button class="btn-w" onclick="window.withdrawItem(${i.id})">WITHDRAW</button>
                <button class="btn-s" onclick="window.sellItem(${i.id})">SELL</button>
            </div>
        </div>`;
    }).join('');
}

window.withdrawItem = async function(id) {
    const item = currentUser.inventory.find(x => x.id === id);
    const nick = prompt("ROBLOX NICKNAME:");
    if(!nick) return;
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
};

function updateUI() {
    document.getElementById('h-balance').innerText = currentUser.score;
    document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
}

window.onload = async () => {
    const id = localStorage.getItem('game_user_id');
    if(id) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
        if(data) { currentUser = data; enterGame(); }
    }
};
