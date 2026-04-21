const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

let currentUser = null;
let allCases = [];
let allItems = {}; // Словарь предметов из items_meta { name: fullItem }

// ========== УВЕДОМЛЕНИЯ ==========
window.showNotify = function(text, type = "success") {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = `cyber-notification ${type}`;
    n.innerHTML = `<span>${text}</span><div class="note-bar"></div>`;
    container.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 500);
    }, 3000);
};

// ========== ЗАГРУЗКА ПРЕДМЕТОВ ИЗ items_meta ==========
async function loadItemsMeta() {
    const { data } = await supabaseClient.from('items_meta').select('*');
    if (data) {
        data.forEach(item => {
            allItems[item.name] = item;
        });
    }
    console.log("Items loaded:", Object.keys(allItems).length);
}

// ========== АВТО-ЛОГИН ==========
window.onload = async () => {
    await loadItemsMeta();
    const savedU = localStorage.getItem('saved_login');
    const savedP = localStorage.getItem('saved_pass');
    if (savedU && savedP) {
        document.getElementById('user_name').value = savedU;
        document.getElementById('user_password').value = savedP;
        window.login();
    }
};

// ========== ЛОГИН ==========
window.login = async function() {
    const u = document.getElementById('user_name').value;
    const p = document.getElementById('user_password').value;
    if (!u || !p) return;

    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    
    if (data) {
        currentUser = data;
        localStorage.setItem('saved_login', u);
        localStorage.setItem('saved_pass', p);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        document.getElementById('h-balance').innerText = currentUser.score || 0;
        document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
        window.renderAllCases();
        window.renderMarket();
        subscribeUpdates();
        window.navTo('cases');
        window.showNotify(`ACCESS GRANTED: ${u}`, 'success');
    } else {
        window.showNotify("INVALID CREDENTIALS", "error");
    }
};

// ========== ФУНКЦИЯ ВЫБОРА ПРЕДМЕТА ПО ШАНСАМ ==========
function getRandomItemFromLoot(lootArray) {
    if (!lootArray || lootArray.length === 0) return null;
    
    // Нормализуем шансы (суммируем)
    let totalChance = 0;
    for (const item of lootArray) {
        totalChance += item.chance || 0;
    }
    
    if (totalChance === 0) return lootArray[0];
    
    let random = Math.random() * totalChance;
    let accumulated = 0;
    
    for (const item of lootArray) {
        accumulated += item.chance || 0;
        if (random <= accumulated) {
            return item;
        }
    }
    return lootArray[0];
}

// ========== РЕНДЕР КЕЙСОВ ==========
window.renderAllCases = async function() {
    const { data } = await supabaseClient.from('cases_meta').select('*');
    if (data) {
        allCases = data;
        const grid = document.getElementById('cases-grid');
        grid.innerHTML = data.filter(c => c.type !== 'limited').map(c => `
            <div class="mega-card" onclick="window.showCaseInfo('${c.id}')">
                <img src="${GITHUB_BASE}${c.image_url}" onerror="this.src='https://placehold.co/200x150?text=NO_IMG'">
                <h3>${c.name}</h3>
                <div class="price-tag">$${c.price}</div>
            </div>
        `).join('');
    }
};

// ========== СТРАНИЦА КЕЙСА С ТАБЛИЦЕЙ ЛУТА ИЗ loot JSONB ==========
window.showCaseInfo = async function(id) {
    const caseData = allCases.find(c => c.id == id);
    if (!caseData) return;

    // Получаем loot из JSONB колонки
    let lootItems = caseData.loot || [];
    
    // Если loot это строка JSON, парсим
    if (typeof lootItems === 'string') {
        try {
            lootItems = JSON.parse(lootItems);
        } catch(e) {
            lootItems = [];
        }
    }

    // Строим таблицу лута с картинками из items_meta
    const lootRows = lootItems.map(item => {
        const itemFull = allItems[item.name] || { name: item.name, image_url: 'unknown.png', sell_price: 0 };
        return `
            <div class="loot-row">
                <div class="loot-name">
                    <img src="${GITHUB_BASE}${itemFull.image_url || 'unknown.png'}" onerror="this.src='https://placehold.co/40x40?text=?'">
                    <span>${item.name}</span>
                </div>
                <div class="loot-chance">${item.chance || 0}%</div>
            </div>
        `;
    }).join('');

    const content = document.getElementById('case-detail-content');
    content.innerHTML = `
        <div class="case-hero">
            <img src="${GITHUB_BASE}${caseData.image_url}" onerror="this.src='https://placehold.co/300x300?text=NO_IMG'">
            <h1>${caseData.name}</h1>
            <button class="neon-btn-main" onclick="window.openCase('${caseData.id}')">INITIALIZE OPENING ($${caseData.price})</button>
            
            <div class="loot-table">
                <h3>📦 POSSIBLE LOOT</h3>
                ${lootRows || '<div style="text-align:center; color:#555;">NO LOOT DATA</div>'}
                <div style="margin-top: 15px; font-size: 10px; color: #555; text-align: center;">* SYSTEM_SHOWCASE — шансы из базы данных</div>
            </div>
        </div>
    `;
    window.navTo('case-info');
};

// ========== ОТКРЫТИЕ КЕЙСА (С УЧЁТОМ ШАНСОВ ИЗ loot) ==========
// ========== ОТКРЫТИЕ КЕЙСА ==========
window.openCase = async function(caseId) {
    if (!currentUser) return;
    const caseData = allCases.find(c => c.id == caseId);
    if (!caseData) return;
    
    if ((currentUser.score || 0) < caseData.price) {
        return window.showNotify("INSUFFICIENT FUNDS", "error");
    }

    let lootItems = caseData.loot || [];
    if (typeof lootItems === 'string') {
        try {
            lootItems = JSON.parse(lootItems);
        } catch(e) {
            lootItems = [];
        }
    }
    
    if (lootItems.length === 0) {
        return window.showNotify("NO LOOT IN THIS CASE", "error");
    }

    const selectedLoot = getRandomItemFromLoot(lootItems);
    if (!selectedLoot) {
        return window.showNotify("ERROR SELECTING ITEM", "error");
    }

    const itemFull = allItems[selectedLoot.name] || { 
        name: selectedLoot.name, 
        image_url: 'unknown.png',
        price: 100  // цена по умолчанию
    };

    const newItem = {
        id: Date.now(),
        char: itemFull.image_url || selectedLoot.name,
        name: selectedLoot.name,
        sell_price: itemFull.price || 100  // ← цена из items_meta.price
    };

    const newInventory = [...(currentUser.inventory || []), newItem];
    const newScore = (currentUser.score || 0) - caseData.price;

    const { error } = await supabaseClient.from('profiles').update({
        inventory: newInventory,
        score: newScore
    }).eq('id', currentUser.id);

    if (!error) {
        window.showNotify(`🎁 YOU GOT: ${selectedLoot.name}`, 'success');
        window.navTo('profile');
    } else {
        window.showNotify("OPENING ERROR", "error");
    }
};

// ========== МАРКЕТ (ЛИМИТКИ) ==========
window.renderMarket = async function() {
    const { data } = await supabaseClient.from('cases_meta').select('*').eq('type', 'limited');
    const grid = document.getElementById('limited-grid');
    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:#555;">NO_LIMITED_ITEMS</div>';
        return;
    }
    grid.innerHTML = data.map(c => {
        const stock = c.stock ?? 0;
        const soldOut = stock <= 0;
        return `
            <div class="mega-card" style="position:relative;">
                <div class="stock-badge">STOCK: ${stock}</div>
                <img src="${GITHUB_BASE}${c.image_url}" onerror="this.src='https://placehold.co/200x150?text=NO_IMG'" style="${soldOut ? 'filter:grayscale(1); opacity:0.5' : ''}">
                <h3>${c.name}</h3>
                <button class="buy-btn" ${soldOut ? 'disabled' : ''} onclick="window.buyLimited(${c.id}, ${c.price_cp || 0})">
                    ${soldOut ? 'SOLD OUT' : (c.price_cp + ' CP')}
                </button>
            </div>
        `;
    }).join('');
};

// ========== КУПИТЬ ЛИМИТКУ ==========
window.buyLimited = async function(id, price) {
    if (!currentUser) return;
    if ((currentUser.cyberpunk_points || 0) < price) {
        return window.showNotify("INSUFFICIENT CP", "error");
    }
    
    const { data: item } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    if (!item || item.stock <= 0) return window.showNotify("SOLD OUT", "error");
    
    const newStock = item.stock - 1;
    const newCP = (currentUser.cyberpunk_points || 0) - price;
    
    // Находим цену предмета из items_meta по имени
    const itemFull = allItems[item.name] || { price: 100 };
    
    const newInventory = [...(currentUser.inventory || []), {
        id: Date.now(),
        char: item.image_url,
        name: item.name,
        sell_price: itemFull.price || 100
    }];
    
    await supabaseClient.from('cases_meta').update({ stock: newStock }).eq('id', id);
    const { error } = await supabaseClient.from('profiles').update({
        inventory: newInventory,
        cyberpunk_points: newCP
    }).eq('id', currentUser.id);
    
    if (!error) {
        window.showNotify(`PURCHASED: ${item.name}`, 'success');
        window.renderMarket();
        window.renderProfile();
    }
};

// ========== ПРОФИЛЬ (С SELL И WITHDRAW) ==========
window.renderProfile = function() {
    if (!currentUser) return;
    document.getElementById('p-username').innerText = currentUser.username;
    document.getElementById('p-worth').innerText = currentUser.score || 0;
    document.getElementById('p-cp-val').innerText = currentUser.cyberpunk_points || 0;
    
    const list = document.getElementById('inventory-list');
    const template = document.getElementById('inv-item-template');
    list.innerHTML = '';

    const inventory = currentUser.inventory || [];
    if (inventory.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#555; grid-column:1/-1;">INVENTORY_EMPTY</div>';
        return;
    }

    inventory.slice().reverse().forEach(item => {
        const clone = template.content.cloneNode(true);
        const imgUrl = `${GITHUB_BASE}${item.char || 'unknown.png'}`;
        clone.querySelector('.item-img').src = imgUrl;
        clone.querySelector('.item-img').onerror = function() { this.src = 'https://placehold.co/150x150?text=ITEM'; };
        clone.querySelector('.item-name').innerText = item.name || 'Unknown Item';
        
        const sBtn = clone.querySelector('.sell-btn');
        const wBtn = clone.querySelector('.with-btn');
        const statusT = clone.querySelector('.item-status-text');

        if (item.status === 'processing') {
            sBtn.style.display = 'none';
            wBtn.style.display = 'none';
            statusT.style.display = 'block';
        } else {
            sBtn.onclick = () => window.sellItem(item.id, item.sell_price || 150);
            wBtn.onclick = () => window.withdrawItem(item.id);
        }
        list.appendChild(clone);
    });
};

// ========== ПРОДАЖА (С КОМИССИЕЙ 20%) ==========
window.sellItem = async function(id, sellPrice = 150) {
    const idx = currentUser.inventory.findIndex(x => x.id === id);
    if (idx === -1) return;
    
    // Комиссия 20% — игрок получает 80% от цены предмета
    const commissionRate = 0.8;  // 80%
    const playerGain = Math.floor(sellPrice * commissionRate);
    
    const newInventory = [...currentUser.inventory];
    newInventory.splice(idx, 1);
    const newScore = (currentUser.score || 0) + playerGain;
    
    const { error } = await supabaseClient.from('profiles')
        .update({ inventory: newInventory, score: newScore })
        .eq('id', currentUser.id);
    
    if (!error) {
        window.showNotify(`SOLD: +${playerGain}$ (${Math.round((1-commissionRate)*100)}% FEE)`, "success");
        window.renderProfile();
    }
};

// ========== ВЫВОД ==========
window.withdrawItem = async function(id) {
    const nick = prompt("ENTER YOUR ROBLOX USERNAME:");
    if (!nick || nick.trim() === "") {
        return window.showNotify("WITHDRAWAL CANCELLED", "error");
    }
    
    const newInventory = currentUser.inventory.map(item => 
        item.id === id ? { ...item, status: 'processing' } : item
    );
    
    const { error } = await supabaseClient.from('profiles')
        .update({ inventory: newInventory })
        .eq('id', currentUser.id);
    
    if (!error) {
        window.showNotify(`WITHDRAWAL REQUEST SENT TO BOT (${nick})`, "success");
        window.renderProfile();
    }
};

// ========== НАВИГАЦИЯ ==========
window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (id === 'profile') window.renderProfile();
    if (id === 'cases') window.renderAllCases();
    if (id === 'market') window.renderMarket();
};

// ========== ПОДПИСКА НА ОБНОВЛЕНИЯ ==========
function subscribeUpdates() {
    supabaseClient.channel('any').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles' }, 
        payload => {
            if (currentUser && payload.new.id === currentUser.id) {
                currentUser = payload.new;
                document.getElementById('h-balance').innerText = currentUser.score || 0;
                document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
                if (document.getElementById('page-profile').classList.contains('active')) {
                    window.renderProfile();
                }
            }
        }
    ).subscribe();
}
