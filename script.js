const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { autoLogin(); initGlobalRealtime(); };

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
}

function initGlobalRealtime() {
    liveChannel.on('broadcast', { event: 'new-drop' }, (payload) => {
        addToLiveBoard(payload.payload.user, payload.payload.item);
    }).subscribe();
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

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
    if(pageId === 'market') renderMarket();
    updateUI();
}

// --- КЕЙСЫ ---
async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    if(!cases) return;
    document.getElementById('cases-grid').innerHTML = cases.map(c => `
        <div class="case-card" onclick="openRoulette(${c.id})">
            <img src="${GITHUB_BASE}${c.image_url}">
            <h3>${c.name.toUpperCase()}</h3>
            <p style="color:#2ecc71; font-family:Orbitron; margin:10px 0;">$${c.price}</p>
            <button class="neon-btn">ОТКРЫТЬ</button>
        </div>`).join('');
}

async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("НЕДОСТАТОЧНО СРЕДСТВ");

    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    document.getElementById('win-display').style.display = 'none';
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
        const finalShift = (50 * itemWidth) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + (itemWidth / 2);
        tape.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    setTimeout(async () => {
        const newInv = [...(currentUser.inventory || []), { char: win.name, id: Date.now() }];
        await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
        currentUser.inventory = newInv;
        liveChannel.send({ type: 'broadcast', event: 'new-drop', payload: { user: currentUser.username, item: win.name } });
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = win.name;
        if (typeof confetti === 'function') confetti();
    }, 5500);
}

// --- МАРКЕТ И КВЕСТЫ (ФИКС 404) ---
async function renderMarket() {
    try {
        const { data: stock } = await supabaseClient.from('limited_stock').select('*');
        if (stock) {
            document.getElementById('limited-grid').innerHTML = stock.map(i => `
                <div class="case-card">
                    <div class="limited-tag">STOCK: ${i.stock}</div>
                    <img src="${GITHUB_BASE}${i.image_url}.png">
                    <h3>${i.name}</h3>
                    <button class="neon-btn" style="background:#ff00ff" onclick="buyLimited(${i.id}, ${i.price_cp})">${i.price_cp} CP</button>
                </div>`).join('');
        }
    } catch(e) { console.log("Limited table missing"); }

    try {
        const { data: tasks } = await supabaseClient.from('cyber_tasks').select('*');
        if (tasks) {
            document.getElementById('tasks-list').innerHTML = tasks.map(t => `
                <div class="task-card">
                    <div class="task-info"><div class="task-title">${t.title}</div><div class="task-reward">+${t.reward} CP</div></div>
                    <button class="neon-btn" style="width:100px" onclick="completeTask(${t.id}, ${t.reward})">OK</button>
                </div>`).join('');
        }
    } catch(e) { console.log("Tasks table missing"); }
}

// --- ИНВЕНТАРЬ (ФИКС sellItem/withdrawItem) ---
window.sellItem = async function(itemId, charName) {
    try {
        const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
        const price = Math.floor(itemData.price * 0.8);
        currentUser.inventory = currentUser.inventory.filter(i => i.id !== itemId);
        currentUser.score += price;
        await supabaseClient.from('profiles').update({ inventory: currentUser.inventory, score: currentUser.score }).eq('id', currentUser.id);
        renderProfile(); updateUI(); showNotify(`+$${price}`);
    } catch(e) { showNotify("ОШИБКА"); }
}

window.withdrawItem = async function(id) {
    const nick = prompt("ROBLOX NICKNAME:");
    if (!nick) return;
    const item = currentUser.inventory.find(x => x.id === id);
    item.status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    renderProfile();
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('ВЫВОД: ' + nick + ' | ' + item.char)}`);
    showNotify("ЗАЯВКА ОТПРАВЛЕНА");
}

async function renderProfile() {
    document.getElementById('p-username').innerText = currentUser.username;
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = (currentUser.inventory || []).slice().reverse().map(i => `
        <div class="inv-item ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn sell-btn" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`).join('');
}

async function login() {
    const u = document.getElementById('user_name').value.trim();
    const p = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    if(data) { currentUser = data; localStorage.setItem('game_user_id', data.id); enterGame(); } else { showNotify("ОШИБКА ВХОДА"); }
}

function logout() { localStorage.removeItem('game_user_id'); location.reload(); }
function switchAuthMode(m) {
    document.getElementById('tab-btn-login').className = (m==='login'?'active':'');
    document.getElementById('tab-btn-reg').className = (m==='reg'?'active':'');
    document.getElementById('btn-login-action').style.display = (m==='login'?'block':'none');
    document.getElementById('btn-reg-action').style.display = (m==='reg'?'block':'none');
}

function addToLiveBoard(u, i) {
    const b = document.getElementById('global-live-feed');
    const c = document.createElement('div');
    c.className = 'drop-card';
    c.innerHTML = `<img src="${GITHUB_BASE}${i}.png"><div><div style="font-size:10px;color:#5a5a7a">${u}</div><div style="font-size:12px">${i}</div></div>`;
    b.prepend(c); if (b.children.length > 15) b.lastElementChild.remove();
}
