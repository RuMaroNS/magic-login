const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TELEGRAM_BOT_TOKEN = '8241678987:AAG4Z8YaYTFTOT12hNVN9PG6Z3wPjzhSCNg'
const TELEGRAM_CHAT_ID = '6176762600'

let currentUser = null;
let allCases = [];
let allItems = {};
let telegramInitialized = false;
let currentSelectedLoot = null;
let currentCaseData = null;
let rouletteItemsArray = [];
let spinVelocity = 0;
let spinDecay = 0.98;
let spinAnimationId = null;
let isSlowingDown = false;
let currentOffset = 0;
let maxOffset = 0;

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

async function loadItemsMeta() {
    const { data } = await supabaseClient.from('items_meta').select('*');
    if (data) {
        data.forEach(item => {
            allItems[item.name] = {
                name: item.name,
                display_name: item.display_name || item.name,
                image_url: item.image_url,
                price: item.price || 100,
                rarity: item.rarity || 'common'
            };
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
        document.getElementById('login_username').value = savedU;
        document.getElementById('login_password').value = savedP;
        window.login();
    }
};

// ========== ЛОГИН ==========
window.login = async function() {
    const u = document.getElementById('login_username').value;
    const p = document.getElementById('login_password').value;
    if (!u || !p) return;

    const { data } = await supabaseClient.from('profiles').select('*').eq('username', u).eq('password', p).single();
    
    if (data) {
        currentUser = data;
        localStorage.setItem('saved_login', u);
        localStorage.setItem('saved_pass', p);
        
        // Обновляем last_login
        await supabaseClient.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', currentUser.id);
        
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        document.getElementById('h-balance').innerText = currentUser.score || 0;
        document.getElementById('h-cp').innerText = currentUser.cyberpunk_points || 0;
        
        // Показ кнопки админки
        const adminBtn = document.getElementById('admin-nav-btn');
        if (adminBtn) adminBtn.style.display = currentUser.is_admin ? 'block' : 'none';
        
        // Запрос Telegram если пусто
        if (!currentUser.TelegramUSER) {
            setTimeout(() => {
                const tg = prompt("🔗 LINK YOUR TELEGRAM USERNAME:\n(You can skip)");
                if (tg && tg.trim()) {
                    supabaseClient.from('profiles').update({ TelegramUSER: tg.trim() }).eq('id', currentUser.id);
                    currentUser.TelegramUSER = tg.trim();
                }
            }, 1000);
        }
        
        window.renderAllCases();
        window.renderMarket();
        subscribeUpdates();
        window.navTo('cases');
        window.showNotify(`ACCESS GRANTED: ${u}`, 'success');
    } else {
        window.showNotify("INVALID CREDENTIALS", "error");
    }
};

// ========== РЕГИСТРАЦИЯ ==========
window.register = async function() {
    const username = document.getElementById('reg_username').value.trim();
    const password = document.getElementById('reg_password').value.trim();
    const telegramUser = document.getElementById('reg_telegram').value.trim() || null;
    
    if (!username || !password) {
        return window.showNotify("⚠️ USERNAME AND PASSWORD REQUIRED", "error");
    }
    if (username.length < 3) {
        return window.showNotify("⚠️ USERNAME MUST BE AT LEAST 3 CHARACTERS", "error");
    }
    if (password.length < 4) {
        return window.showNotify("⚠️ PASSWORD MUST BE AT LEAST 4 CHARACTERS", "error");
    }
    
    const { data: existing } = await supabaseClient.from('profiles').select('username').eq('username', username).single();
    if (existing) {
        return window.showNotify("❌ USERNAME ALREADY EXISTS", "error");
    }
    
    const newUser = {
        username: username,
        password: password,
        score: 0,
        CP_Point: 0,
        inventory: [],
        TelegramUSER: TelegramUSER,
        isAdmin: false,
        last_login: new Date().toISOString()
    };
    
    const { data, error } = await supabaseClient.from('profiles').insert([newUser]).select().single();
    if (error) {
        return window.showNotify("❌ REGISTRATION ERROR", "error");
    }
    if (data) {
        window.showNotify("✅ ACCOUNT CREATED! PLEASE LOGIN", "success");
        document.querySelector('#login-tab-content').classList.add('active');
        document.querySelector('#signup-tab-content').classList.remove('active');
        document.querySelector('.login-tab a').classList.add('active');
        document.querySelector('.signup-tab a').classList.remove('active');
        document.getElementById('login_username').value = username;
        document.getElementById('login_password').value = password;
    }
};

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('login-tab-btn');
    const registerBtn = document.getElementById('register-tab-btn');
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    
    if (loginBtn && registerBtn) {
        loginBtn.onclick = () => {
            loginBtn.classList.add('active');
            registerBtn.classList.remove('active');
            loginPanel.style.display = 'block';
            registerPanel.style.display = 'none';
        };
        registerBtn.onclick = () => {
            registerBtn.classList.add('active');
            loginBtn.classList.remove('active');
            loginPanel.style.display = 'none';
            registerPanel.style.display = 'block';
        };
    }
});

// ========== ФУНКЦИЯ ВЫБОРА ПРЕДМЕТА ПО ШАНСАМ ==========
function getRandomItemFromLoot(lootArray) {
    if (!lootArray || lootArray.length === 0) return null;
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

// ========== ЗАБРАТЬ ЛУТ ==========
window.claimLoot = async function() {
    if (!window.pendingLoot || !currentCaseData) return;
    const lootOverlay = document.getElementById('loot-overlay');
    lootOverlay.style.opacity = '0';
    lootOverlay.style.transition = 'opacity 0.3s';
    setTimeout(async () => {
        lootOverlay.style.display = 'none';
        lootOverlay.style.opacity = '1';
        const newInventory = [...(currentUser.inventory || []), window.pendingLoot];
        const newScore = (currentUser.score || 0) - currentCaseData.price;
        const { error } = await supabaseClient.from('profiles').update({
            inventory: newInventory,
            score: newScore
        }).eq('id', currentUser.id);
        if (!error) {
            const itemFull = allItems[window.pendingLoot.char];
            window.showNotify(`🎁 YOU GOT: ${itemFull?.display_name || window.pendingLoot.char}`, 'success');
            window.renderProfile();
            window.renderAllCases();
            document.getElementById('h-balance').innerText = newScore;
        } else {
            window.showNotify("ERROR SAVING ITEM", "error");
        }
        window.pendingLoot = null;
        currentCaseData = null;
    }, 300);
};

// ========== СТРАНИЦА КЕЙСА ==========
window.showCaseInfo = async function(id) {
    const caseData = allCases.find(c => c.id == id);
    if (!caseData) return;
    let lootItems = caseData.loot || [];
    if (typeof lootItems === 'string') {
        try {
            lootItems = JSON.parse(lootItems);
        } catch(e) {
            lootItems = [];
        }
    }
    const lootRows = lootItems.map(item => {
        const itemFull = allItems[item.name] || { name: item.name, image_url: 'unknown.png' };
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
            <button class="neon-btn-main" onclick="window.openCaseWithAnimation('${caseData.id}')">Open ($${caseData.price})</button>
            <div class="loot-table">
                <h3>📦 POSSIBLE LOOT</h3>
                ${lootRows || '<div style="text-align:center; color:#555;">NO LOOT DATA</div>'}
                <div style="margin-top: 15px; font-size: 10px; color: #555; text-align: center;">* SYSTEM_SHOWCASE — шансы из базы данных</div>
            </div>
        </div>
    `;
    window.navTo('case-info');
};

// ========== СОЗДАНИЕ РУЛЕТКИ ==========
function createRouletteWithChances(lootItems, totalSlots = 100) {
    const rouletteSlots = [];
    for (const item of lootItems) {
        const chance = item.chance || 0;
        const slotsCount = Math.floor((chance / 100) * totalSlots);
        for (let i = 0; i < slotsCount; i++) {
            rouletteSlots.push(item);
        }
    }
    while (rouletteSlots.length < totalSlots) {
        const randomItem = lootItems[Math.floor(Math.random() * lootItems.length)];
        rouletteSlots.push(randomItem);
    }
    for (let i = rouletteSlots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rouletteSlots[i], rouletteSlots[j]] = [rouletteSlots[j], rouletteSlots[i]];
    }
    return rouletteSlots;
}

// ========== ПРЕДЗАГРУЗКА РУЛЕТКИ ==========
async function preloadRoulette(lootItems) {
    const track = document.getElementById('rouletteTrack');
    if (!track) return;
    const allItems_ = createRouletteWithChances(lootItems, 100);
    rouletteItemsArray = allItems_;
    maxOffset = rouletteItemsArray.length * 150;
    track.innerHTML = rouletteItemsArray.map(item => {
        const itemFull = allItems[item.name];
        const displayName = itemFull ? itemFull.display_name : item.name;
        return `
            <div class="roulette-item">
                <img src="${GITHUB_BASE}${itemFull?.image_url || 'unknown.png'}" onerror="this.src='https://placehold.co/80x80?text=NO_IMG'">
                <span>${displayName}</span>
            </div>
        `;
    }).join('');
    await new Promise(resolve => setTimeout(resolve, 50));
}

// ========== ВРАЩЕНИЕ ==========
function startSpin() {
    if (spinAnimationId) cancelAnimationFrame(spinAnimationId);
    const track = document.getElementById('rouletteTrack');
    if (!track) return;
    currentOffset = 0;
    spinVelocity = 45;
    isSlowingDown = false;
    track.style.transition = 'none';
    track.style.transform = `translateX(0px)`;
    function animateSpin() {
        if (isSlowingDown) {
            spinVelocity *= spinDecay;
        }
        currentOffset += spinVelocity;
        if (currentOffset >= maxOffset) {
            currentOffset -= maxOffset;
        }
        track.style.transition = 'none';
        track.style.transform = `translateX(-${currentOffset}px)`;
        spinAnimationId = requestAnimationFrame(animateSpin);
    }
    animateSpin();
}

// ========== ЗАМЕДЛЕНИЕ ==========
function startSlowdown() {
    isSlowingDown = true;
    function checkAndStop() {
        if (spinVelocity <= 0.3) {
            cancelAnimationFrame(spinAnimationId);
            spinAnimationId = null;
            const track = document.getElementById('rouletteTrack');
            const items = track.querySelectorAll('.roulette-item');
            const centerIndex = Math.floor(items.length / 2);
            const centerItem = items[centerIndex];
            const itemName = centerItem?.querySelector('span')?.innerText;
            let landedItem = null;
            for (const item of rouletteItemsArray) {
                const itemFull = allItems[item.name];
                if (itemFull && itemFull.display_name === itemName) {
                    landedItem = item;
                    break;
                }
                if (item.name === itemName) {
                    landedItem = item;
                    break;
                }
            }
            if (!landedItem && rouletteItemsArray[centerIndex]) {
                landedItem = rouletteItemsArray[centerIndex];
            }
            const overlay = document.getElementById('roulette-overlay');
            overlay.style.display = 'none';
            if (landedItem) {
                showLootWin(landedItem);
            } else {
                showLootWin(rouletteItemsArray[Math.floor(rouletteItemsArray.length / 2)]);
            }
        } else {
            requestAnimationFrame(checkAndStop);
        }
    }
    setTimeout(() => {
        if (spinAnimationId) {
            checkAndStop();
        }
    }, 100);
}

// ========== ПОКАЗ ВЫИГРЫША ==========
function showLootWin(selectedLoot) {
    if (!selectedLoot) {
        console.error("Нет предмета!");
        return;
    }
    const itemFull = allItems[selectedLoot.name];
    if (!itemFull) {
        console.error("❌ Предмет не найден в allItems:", selectedLoot.name);
        return;
    }
    const rarity = itemFull.rarity || 'common';
    const rarityConfig = {
        common: { color: '#aaa', text: 'COMMON', icon: '⬜' },
        rare: { color: '#3399ff', text: 'RARE', icon: '🔵' },
        epic: { color: '#aa33ff', text: 'EPIC', icon: '🟣' },
        legendary: { color: '#ffaa00', text: 'LEGENDARY', icon: '🌟' }
    };
    const config = rarityConfig[rarity];
    const lootOverlay = document.getElementById('loot-overlay');
    const lootImage = document.getElementById('lootImage');
    const lootTitle = document.getElementById('lootTitle');
    const lootRarity = document.getElementById('lootRarity');
    const lootRays = document.getElementById('lootRays');
    lootImage.src = `${GITHUB_BASE}${itemFull.image_url}`;
    lootTitle.innerText = itemFull.display_name;
    lootRarity.innerHTML = `${config.icon} ${config.text} ${config.icon}`;
    lootRarity.style.color = config.color;
    lootRarity.style.textShadow = `0 0 10px ${config.color}`;
    const lootContent = document.querySelector('.loot-content');
    if (lootContent) {
        lootContent.style.borderColor = config.color;
    }
    lootRays.style.animation = 'none';
    void lootRays.offsetHeight;
    lootRays.style.animation = 'rays 2s ease-out';
    lootOverlay.style.display = 'block';
    window.pendingLoot = {
        id: Date.now(),
        char: selectedLoot.name,
    };
}

// ========== ОТКРЫТИЕ КЕЙСА ==========
window.openCaseWithAnimation = async function(caseId) {
    if (!currentUser) return;
    const caseData = allCases.find(c => c.id == caseId);
    if (!caseData) return;
    currentCaseData = caseData;
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
    await preloadRoulette(lootItems);
    const overlay = document.getElementById('roulette-overlay');
    const resultDiv = document.getElementById('rouletteResult');
    const progressBar = document.getElementById('rouletteProgress');
    overlay.style.display = 'block';
    resultDiv.innerHTML = '<span class="result-icon">🎲</span><span class="result-text">SPINNING...</span>';
    progressBar.style.width = '0%';
    startSpin();
    setTimeout(() => {
        progressBar.style.transition = 'width 3.5s linear';
        progressBar.style.width = '100%';
    }, 50);
    setTimeout(() => {
        resultDiv.innerHTML = '<span class="result-icon">🎰</span><span class="result-text">SLOWING DOWN...</span>';
        startSlowdown();
    }, 3500);
};

// ========== МАРКЕТ ==========
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
    const itemFull = allItems[item.name] || { price: 100 };
    const newInventory = [...(currentUser.inventory || []), {
        id: Date.now(),
        char: item.name,
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

// ========== ПРОФИЛЬ ==========
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
        let itemChar = item.char;
        if (itemChar && itemChar.endsWith('.png')) {
            itemChar = itemChar.replace('.png', '');
        }
        if (!itemChar && item.name) {
            itemChar = item.name;
        }
        if (!itemChar) {
            itemChar = "Unknown Item";
        }
        const itemFull = allItems[itemChar];
        if (itemFull) {
            const rarity = itemFull.rarity || 'common';
            const rarityColors = {
                common: '#aaa',
                rare: '#3399ff',
                epic: '#aa33ff',
                legendary: '#ffaa00'
            };
            clone.querySelector('.item-name').style.color = rarityColors[rarity] || '#fff';
            const imgUrl = `${GITHUB_BASE}${itemFull.image_url || 'unknown.png'}`;
            clone.querySelector('.item-img').src = imgUrl;
            clone.querySelector('.item-img').onerror = function() { 
                this.src = 'https://placehold.co/150x150?text=NO_IMG'; 
            };
            clone.querySelector('.item-name').innerText = itemFull.display_name;
            const sBtn = clone.querySelector('.sell-btn');
            const wBtn = clone.querySelector('.with-btn');
            const statusT = clone.querySelector('.item-status-text');
            if (item.status === 'processing') {
                sBtn.style.display = 'none';
                wBtn.style.display = 'none';
                statusT.style.display = 'block';
            } else {
                const sellPrice = itemFull.price || 100;
                sBtn.onclick = () => window.sellItem(item.id, sellPrice, itemFull.display_name);
                wBtn.onclick = () => window.withdrawItem(item.id, itemFull.display_name);
            }
        } else {
            clone.querySelector('.item-img').src = 'https://placehold.co/150x150?text=UNKNOWN';
            clone.querySelector('.item-name').innerText = itemChar;
            const sBtn = clone.querySelector('.sell-btn');
            const wBtn = clone.querySelector('.with-btn');
            sBtn.onclick = () => window.showNotify("CANNOT SELL: ITEM NOT IN DATABASE", "error");
            wBtn.onclick = () => window.showNotify("CANNOT WITHDRAW: ITEM NOT IN DATABASE", "error");
        }
        list.appendChild(clone);
    });
};

// ========== ПРОДАЖА ==========
window.sellItem = async function(id, sellPrice, itemDisplayName) {
    const idx = currentUser.inventory.findIndex(x => x.id === id);
    if (idx === -1) return;
    const commissionRate = 0.8;
    const playerGain = Math.floor(sellPrice * commissionRate);
    const newInventory = [...currentUser.inventory];
    newInventory.splice(idx, 1);
    const newScore = (currentUser.score || 0) + playerGain;
    const { error } = await supabaseClient.from('profiles')
        .update({ inventory: newInventory, score: newScore })
        .eq('id', currentUser.id);
    if (!error) {
        window.showNotify(`SOLD: ${itemDisplayName} +${playerGain}$ (20% FEE)`, "success");
        window.renderProfile();
    }
};

// ========== TELEGRAM ==========
async function initTelegramBot() {
    if (telegramInitialized) return true;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const data = await response.json();
        if (data.ok) {
            console.log(`✅ Telegram bot initialized: @${data.result.username}`);
            telegramInitialized = true;
            return true;
        } else {
            console.error("❌ Telegram bot token invalid");
            return false;
        }
    } catch (error) {
        console.error("❌ Telegram connection error:", error);
        return false;
    }
}

async function sendToTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN) return false;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error("Telegram send error:", error);
        return false;
    }
}

// ========== ВЫВОД ==========
window.withdrawItem = async function(id, itemDisplayName) {
    if (!currentUser) return;
    await initTelegramBot();
    const nick = prompt("🎮 ENTER YOUR ROBLOX USERNAME:");
    if (!nick || nick.trim() === "") {
        return window.showNotify("❌ WITHDRAWAL CANCELLED", "error");
    }
    const timestamp = new Date().toLocaleString('ru-RU');
    const telegramMessage = `
🎲 <b>NEW WITHDRAWAL REQUEST</b> 🎲
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> <code>${currentUser.username}</code>
🆔 <b>User ID:</b> <code>${currentUser.id}</code>
📦 <b>Item:</b> <i>${itemDisplayName}</i>
🎮 <b>Roblox Nick:</b> <code>${nick.trim()}</code>
💰 <b>Balance:</b> $${currentUser.score || 0}
⚡ <b>CP:</b> ${currentUser.cyberpunk_points || 0}
🕐 <b>Time:</b> ${timestamp}
━━━━━━━━━━━━━━━━━━━━
<code>Status: PENDING</code>`;
    window.showNotify("📤 SENDING REQUEST TO BOT...", "info");
    const sent = await sendToTelegram(telegramMessage);
    if (sent) {
        const newInventory = currentUser.inventory.map(item => 
            item.id === id ? { ...item, status: 'processing' } : item
        );
        const { error } = await supabaseClient.from('profiles')
            .update({ inventory: newInventory })
            .eq('id', currentUser.id);
        if (!error) {
            window.showNotify(`✅ WITHDRAWAL REQUEST SENT!\n🎮 ${nick.trim()}`, "success");
            window.renderProfile();
        } else {
            window.showNotify("❌ ERROR UPDATING INVENTORY", "error");
        }
    } else {
        window.showNotify("❌ TELEGRAM ERROR. REQUEST NOT SENT", "error");
    }
};

// ========== АДМИН ПАНЕЛЬ ==========
window.renderAdminPanel = async function() {
    if (!currentUser || !currentUser.is_admin) return;
    const { data: allUsers } = await supabaseClient.from('profiles').select('*');
    if (!allUsers) return;
    document.getElementById('total-users').innerText = allUsers.length;
    let totalItems = 0;
    allUsers.forEach(u => { if (u.inventory) totalItems += u.inventory.length; });
    document.getElementById('total-items').innerText = totalItems;
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    for (const user of allUsers) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = user.username;
        row.insertCell(1).innerHTML = `<span style="color:#00ffcc">$${user.score || 0}</span>`;
        row.insertCell(2).innerHTML = `<span style="color:#ffaa00">⚡${user.cyberpunk_points || 0}</span>`;
        const invCell = row.insertCell(3);
        if (user.inventory && user.inventory.length > 0) {
            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'user-inventory-items';
            user.inventory.slice(0, 5).forEach(item => {
                const tag = document.createElement('span');
                tag.className = 'inv-item-tag';
                tag.innerText = item.char || item.name || '?';
                itemsDiv.appendChild(tag);
            });
            if (user.inventory.length > 5) {
                const more = document.createElement('span');
                more.className = 'inv-item-tag';
                more.innerText = `+${user.inventory.length - 5}`;
                itemsDiv.appendChild(more);
            }
            invCell.appendChild(itemsDiv);
        } else {
            invCell.innerText = 'Empty';
        }
        row.insertCell(4).innerText = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        row.insertCell(5).innerText = user.TelegramUSER || 'Not set';
        const actionsCell = row.insertCell(6);
        const editBtn = document.createElement('button');
        editBtn.innerText = 'EDIT';
        editBtn.className = 'edit-btn';
        editBtn.onclick = () => openAdminEditModal(user);
        actionsCell.appendChild(editBtn);
        if (user.username !== currentUser.username) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerText = 'DELETE';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteUserAccount(user.id, user.username);
            actionsCell.appendChild(deleteBtn);
        }
    }
};

function openAdminEditModal(user) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = () => { overlay.remove(); modal.remove(); };
    const modal = document.createElement('div');
    modal.className = 'admin-edit-modal';
    modal.innerHTML = `
        <h3 style="color:#00d4ff; margin-bottom:15px;">EDIT USER: ${user.username}</h3>
        <label>Balance ($)</label>
        <input type="number" id="edit-balance" value="${user.score || 0}">
        <label>Cyberpunk Points (CP)</label>
        <input type="number" id="edit-cp" value="${user.cyberpunk_points || 0}">
        <label>Telegram Username</label>
        <input type="text" id="edit-telegram" value="${user.TelegramUSER || ''}">
        <label>Is Admin?</label>
        <input type="checkbox" id="edit-admin" ${user.is_admin ? 'checked' : ''}>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="neon-btn-main" style="flex:1;" onclick="saveAdminEdit('${user.id}')">SAVE</button>
            <button class="back-btn" style="margin:0; flex:1;" onclick="this.closest('.admin-edit-modal').remove(); document.querySelector('.modal-overlay').remove();">CANCEL</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    window.currentEditUserId = user.id;
}

window.saveAdminEdit = async function(userId) {
    const balance = parseInt(document.getElementById('edit-balance').value) || 0;
    const cp = parseInt(document.getElementById('edit-cp').value) || 0;
    const telegram = document.getElementById('edit-telegram').value || null;
    const isAdmin = document.getElementById('edit-admin').checked;
    const { error } = await supabaseClient.from('profiles')
        .update({ score: balance, cyberpunk_points: cp, TelegramUSER: telegram, is_admin: isAdmin })
        .eq('id', userId);
    if (error) {
        window.showNotify("❌ UPDATE ERROR", "error");
    } else {
        window.showNotify("✅ USER UPDATED", "success");
        document.querySelector('.modal-overlay')?.remove();
        document.querySelector('.admin-edit-modal')?.remove();
        if (currentUser.is_admin) window.renderAdminPanel();
        if (currentUser.id === userId) {
            currentUser.score = balance;
            currentUser.cyberpunk_points = cp;
            currentUser.TelegramUSER = telegram;
            currentUser.is_admin = isAdmin;
            window.renderProfile();
        }
    }
};

async function deleteUserAccount(userId, username) {
    if (!confirm(`Delete user "${username}" permanently?`)) return;
    const { error } = await supabaseClient.from('profiles').delete().eq('id', userId);
    if (error) {
        window.showNotify("❌ DELETE ERROR", "error");
    } else {
        window.showNotify(`✅ USER "${username}" DELETED`, "success");
        if (currentUser.is_admin) window.renderAdminPanel();
    }
}

window.filterUsers = function() {
    const search = document.getElementById('search-user')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#users-table-body tr');
    rows.forEach(row => {
        const username = row.cells[0]?.innerText.toLowerCase() || '';
        row.style.display = username.includes(search) ? '' : 'none';
    });
};

// ========== НАВИГАЦИЯ ==========
window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + id);
    if (targetPage) targetPage.classList.add('active');
    if (id === 'profile') window.renderProfile();
    if (id === 'cases') window.renderAllCases();
    if (id === 'market') window.renderMarket();
    if (id === 'admin') {
        if (currentUser && currentUser.is_admin) {
            window.renderAdminPanel();
        } else {
            window.navTo('profile');
            window.showNotify("❌ ADMIN ACCESS ONLY", "error");
        }
    }
};

// ========== ПОДПИСКА ==========
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
