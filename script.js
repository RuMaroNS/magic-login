const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

// ТАБЛИЦА ДАННЫХ КЕЙСОВ
const CASE_TABLE = [
    {
        id: "case_1",
        name: "SKIBIDI BOX",
        price: 50,
        img: "Case_Basic.png",
        items: [
            {char: 'TacoBlock', chance: 0.4},
            {char: 'AdminBlock', chance: 0.4},
            {char: 'SecretBlock', chance: 0.2}
        ]
    },
    {
        id: "case_2",
        name: "GALAXY BOX",
        price: 200,
        img: "Case_Premium.png",
        items: [
            {char: 'LosTacoBlocks', chance: 0.5},
            {char: 'LosAdminBlocks', chance: 0.5}
        ]
    }
];

let currentUser = null;

// ПЕРЕХОДЫ МЕЖДУ СТРАНИЦАМИ
function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

// РЕНДЕР КЕЙСОВ
function renderCases() {
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = CASE_TABLE.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.img}">
            <h4>${c.name}</h4>
            <button class="main-btn" onclick="startOpening('${c.id}')">${c.price}$</button>
        </div>
    `).join('');
}

// ЛОГИКА ОТКРЫТИЯ
async function startOpening(caseId) {
    const cData = CASE_TABLE.find(x => x.id === caseId);
    if (currentUser.score < cData.price) return showNotify("НЕДОСТАТОЧНО СРЕДСТВ!");

    navTo('opening');
    document.getElementById('btn-back-after').style.display = 'none';
    document.getElementById('win-name').innerText = "ОТКРЫВАЕМ...";
    document.getElementById('case-render').classList.add('spinning');

    // Расчет дропа
    let rand = Math.random();
    let cumulative = 0;
    let win = cData.items[0];
    for (let item of cData.items) {
        cumulative += item.chance;
        if (rand < cumulative) { win = item; break; }
    }

    const newScore = currentUser.score - cData.price;
    const newInv = [...(currentUser.inventory || []), { char: win.char, id: Date.now() }];

    const { error } = await supabaseClient.from('profiles')
        .update({ score: newScore, inventory: newInv })
        .eq('id', currentUser.id);

    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        
        setTimeout(() => {
            document.getElementById('case-render').classList.remove('spinning');
            document.getElementById('case-render').innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" style="width:150px">`;
            document.getElementById('win-name').innerText = `ВЫПАЛ: ${win.char}`;
            document.getElementById('btn-back-after').style.display = 'block';
        }, 2000);
    }
}

// ВЫВОД И ИСТОРИЯ
async function withdrawItem(id, name) {
    const itemIdx = currentUser.inventory.findIndex(x => x.id === id);
    if(itemIdx === -1) return;

    // Удаляем из инвентаря
    currentUser.inventory.splice(itemIdx, 1);
    
    // Добавляем в историю (в рамках этого сеанса для примера)
    const history = JSON.parse(localStorage.getItem('withdraw_history') || '[]');
    history.unshift({ name, date: new Date().toLocaleDateString(), status: 'В ОБРАБОТКЕ' });
    localStorage.setItem('withdraw_history', JSON.stringify(history));

    await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
    showNotify("ЗАЯВКА НА ВЫВОД СОЗДАНА!");
    renderProfile();
}

function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score + "$";
    
    // Инвентарь
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = currentUser.inventory.map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <button class="withdraw-btn" onclick="withdrawItem(${i.id}, '${i.char}')">ВЫВОД</button>
        </div>
    `).join('');

    // История
    const histList = document.getElementById('withdraw-history');
    const history = JSON.parse(localStorage.getItem('withdraw_history') || '[]');
    histList.innerHTML = history.map(h => `
        <div style="background:#151525; padding:10px; border-radius:10px; margin-top:8px; font-size:11px;">
            ${h.name} — <span style="color:#2ecc71">${h.status}</span> <small style="float:right">${h.date}</small>
        </div>
    `).join('');
}

// LIVE FEED LOGIC
function addToLiveFeed(user, item) {
    const feed = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
        <img src="${GITHUB_BASE}${item}.png">
        <div>
            <span class="f-nick">${user}</span>
            <span class="f-item">${item}</span>
        </div>
    `;
    feed.prepend(card);
    setTimeout(() => card.remove(), 60000);
}

// ... (Функции login, register, showNotify такие же как раньше, но с проверкой pass.length < 8)

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice' ? 'block' : 'none');
    document.getElementById('step-form').style.display = (mode === 'choice' ? 'none' : 'block');
    
    const bReg = document.getElementById('btn-reg');
    const bLog = document.getElementById('btn-login');
    if(mode === 'reg') { bReg.style.display = 'block'; bLog.style.display = 'none'; }
    if(mode === 'login') { bReg.style.display = 'none'; bLog.style.display = 'block'; }
}

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification'; n.innerText = text;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(()=>n.remove(), 500); }, 3000);
}

function logout() { localStorage.clear(); location.reload(); }

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    if(pass.length < 8) return showNotify("ПАРОЛЬ ОТ 8 СИМВОЛОВ!");

    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if(data) {
        currentUser = data;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        navTo('cases');
        initRealtime();
    } else {
        showNotify("ОШИБКА ВХОДА");
    }
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles'}, p => {
        if(p.new.inventory.length > p.old.inventory.length) {
            addToLiveFeed(p.new.email.split('@')[0], p.new.inventory.at(-1).char);
        }
    }).subscribe();
}
