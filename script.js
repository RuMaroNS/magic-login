const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
const SELL_COMMISSION = 0.20; // Комиссия 20% (игрок получает 80% от цены)

// --- РЕГИСТРАЦИЯ (С НОВЫМИ ПРАВИЛАМИ) ---
async function register() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;

    if (!user || !pass) return showNotify("Поля не могут быть пустыми!");
    if (pass.length < 8) return showNotify("Пароль от 8 символов!");

    const { data, error } = await supabaseClient.from('profiles').insert([
        { username: user, password: pass, score: 50, inventory: [] }
    ]).select().single();

    if (error) return showNotify("Никнейм уже занят!");
    login();
}

async function login() {
    const user = document.getElementById('user_name').value.trim();
    const pass = document.getElementById('user_password').value;
    
    const { data } = await supabaseClient.from('profiles')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single();

    if(data) {
        currentUser = data;
        localStorage.setItem('game_user_id', data.id);
        enterGame();
    } else showNotify("Неверный ник или пароль!");
}

// --- ЗАГРУЗКА КЕЙСОВ ИЗ БАЗЫ ---
async function renderCases() {
    const { data: cases } = await supabaseClient.from('cases_meta').select('*');
    const grid = document.getElementById('cases-grid');
    grid.innerHTML = cases.map(c => `
        <div class="case-card">
            <img src="${GITHUB_BASE}${c.name.replace(/ /g, '_')}.png">
            <h3>${c.name}</h3>
            <p style="color:#00d4ff; margin:15px 0;">${c.price}$</p>
            <button class="neon-btn" onclick="openRoulette(${c.id})">ОТКРЫТЬ</button>
        </div>
    `).join('');
}

// --- ОТКРЫТИЕ КЕЙСА (ДАННЫЕ ИЗ БД) ---
async function openRoulette(caseId) {
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    await syncFromDB();

    if (currentUser.score < cData.price) return showNotify("Мало монет!");

    // Списание баланса
    const newScore = currentUser.score - cData.price;
    await supabaseClient.from('profiles').update({ score: newScore }).eq('id', currentUser.id);
    currentUser.score = newScore;

    navTo('opening');
    const tape = document.getElementById('roulette-tape');
    const loot = cData.loot;

    // Рендер ленты
    let tapeHTML = '';
    for(let i=0; i<60; i++) {
        const rand = loot[Math.floor(Math.random() * loot.length)];
        tapeHTML += `<div class="roulette-item"><img src="${GITHUB_BASE}${rand.name}.png"></div>`;
    }
    tape.innerHTML = tapeHTML;

    // Математика выигрыша
    let rand = Math.random() * 100, cum = 0, win = loot[0];
    for (let itm of loot) {
        cum += itm.chance;
        if (rand <= cum) { win = itm; break; }
    }

    tape.querySelectorAll('.roulette-item')[50].innerHTML = `<img src="${GITHUB_BASE}${win.name}.png">`;

    setTimeout(() => {
        tape.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        const shift = (50 * 130) - (document.querySelector('.roulette-wrapper').offsetWidth / 2) + 65;
        tape.style.transform = `translateX(-${shift}px)`;
    }, 50);

    // Сохранение в инвентарь
    const newItem = { char: win.name, id: Date.now() };
    const newInv = [...(currentUser.inventory || []), newItem];
    await supabaseClient.from('profiles').update({ inventory: newInv }).eq('id', currentUser.id);
    currentUser.inventory = newInv;

    setTimeout(() => {
        document.getElementById('win-display').style.display = 'block';
        document.getElementById('win-name-text').innerText = `ВЫПАЛО: ${win.name}`;
    }, 5500);
}

// --- ПРОДАЖА ПРЕДМЕТА ---
async function sellItem(itemId, charName) {
    // Получаем цену предмета из базы метадаты
    const { data: itemData } = await supabaseClient.from('items_meta').select('price').eq('name', charName).single();
    
    if (!itemData) return showNotify("Ошибка цены!");

    const sellPrice = Math.floor(itemData.price * (1 - SELL_COMMISSION));
    
    // Удаляем из инвентаря и начисляем деньги
    const updatedInv = currentUser.inventory.filter(i => i.id !== itemId);
    const newScore = currentUser.score + sellPrice;

    const { error } = await supabaseClient.from('profiles').update({
        inventory: updatedInv,
        score: newScore
    }).eq('id', currentUser.id);

    if (!error) {
        currentUser.inventory = updatedInv;
        currentUser.score = newScore;
        renderProfile();
        showNotify(`Продано за ${sellPrice}$`);
    }
}

async function renderProfile() {
    await syncFromDB();
    document.getElementById('p-balance').innerText = currentUser.score;
    document.getElementById('inventory-list').innerHTML = (currentUser.inventory || []).map(i => `
        <div class="inv-item">
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn" style="background:#e67e22" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>
    `).join('');
}
