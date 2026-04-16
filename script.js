const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const BOT_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const ADMIN_ID = '6176762600';

let currentUser = null;
let isOpening = false;

window.onload = () => { autoLogin(); initRealtime(); };

async function autoLogin() {
    const id = localStorage.getItem('game_user_id');
    if (id) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
        if (data) { currentUser = data; enterGame(); }
    }
}

async function simpleLogin() {
    const nick = document.getElementById('login-username').value;
    if (!nick) return;
    const id = Date.now().toString();
    const { data } = await supabaseClient.from('profiles').insert([{ id, username: nick, score: 5000, inventory: [] }]).select().single();
    currentUser = data;
    localStorage.setItem('game_user_id', id);
    enterGame();
}

function enterGame() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('game-interface').style.display = 'block';
    navTo('cases');
}

async function openRoulette(caseId) {
    if (isOpening) return;
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) return showNotify("Мало денег!");

    isOpening = true;
    const newScore = currentUser.score - cData.price;
    await supabaseClient.from('profiles').update({ score: newScore }).eq('id', currentUser.id);
    currentUser.score = newScore;

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const r = cData.loot[Math.floor(Math.random() * cData.loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${r.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;
    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const shift = (50 * 130) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 65;
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    const dropId = Date.now();
    const newInv = [...(currentUser.inventory || []), { char: win.name, id: dropId, caseName: cData.name, status: 'active' }];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
        isOpening = false;
    }, 5500);
}

async function withdrawItem(itemId) {
    const inv = currentUser.inventory;
    const idx = inv.findIndex(i => i.id === itemId);
    if (idx === -1 || inv[idx].status === 'processing') return;

    inv[idx].status = 'processing';
    await supabaseClient.from('profiles').update({ inventory: inv }).eq('id', currentUser.id);
    
    const text = `🚀 **ВЫВОД**\n👤: ${currentUser.username}\n📦: ${inv[idx].char}\n🆔: ${itemId}`;
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=${encodeURIComponent(text)}&parse_mode=Markdown`);
    
    showNotify("Бот получил заявку!");
    renderProfile();
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const newInv = p.new.inventory || [];
        const oldInv = p.old?.inventory || [];
        if (newInv.length > oldInv.length) {
            const last = newInv[newInv.length - 1];
            if (!document.querySelector(`[data-drop-id="${last.id}"]`)) {
                addToLiveBoard(p.new.username, last.char, last.id, last.caseName);
            }
        }
    }).subscribe();
}

function addToLiveBoard(user, item, dropId, caseName) {
    const board = document.getElementById('global-live-feed');
    const card = document.createElement('div');
    card.className = 'drop-card';
    card.setAttribute('data-drop-id', dropId);
    card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div class="drop-info"><div class="drop-user">${user}</div><div class="drop-item-name">${item}</div><div class="drop-case-name">${caseName || 'DROP'}</div></div>`;
    board.prepend(card);
    if (board.children.length > 10) board.lastElementChild.remove();
}

function navTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if(pageId === 'profile') renderProfile();
    if(pageId === 'cases') renderCases();
}

async function renderCases() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    document.getElementById('cases-grid').innerHTML = data.map(c => `
        <div class="case-card" onclick="openRoulette('${c.id}')">
            <img src="${GITHUB_BASE}${c.name}.png">
            <h3>${c.name}</h3>
            <p class="case-price">${c.price}$</p>
            <button class="neon-btn">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

function renderProfile() {
    document.getElementById('p-balance').innerText = currentUser.score;
    document.getElementById('inventory-list').innerHTML = currentUser.inventory.map(i => `
        <div class="inv-item ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
            </div>
        </div>
    `).reverse().join('');
}

function showNotify(t) {
    const n = document.createElement('div'); n.className = 'notification'; n.innerText = t;
    document.getElementById('notification-container').appendChild(n);
    setTimeout(() => n.remove(), 3000);
}
