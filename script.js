const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TELEGRAM_BOT_TOKEN = '8630026221:AAGfuIfKQPdxSkyhU3IVCnRtRkKrlzKD0nk'
const TELEGRAM_CHAT_ID = '6176762600'
const AVATAR_BASE_URL = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/Avatars/";

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

// ---------- АНТИСПАМ ----------
let lastActionTime = 0;
function checkCooldown() {
    const now = Date.now();
    if (now - lastActionTime < 2000) {
        window.showNotify("⏳ Не спеши и не перди! Повтори позже", "error");
        return false;
    }
    lastActionTime = now;
    return true;
}

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

// Глобальное уведомление (от админа) – появляется сверху по центру
function showGlobalNotification(message) {
    const container = document.getElementById('global-notify-container');
    const toast = document.createElement('div');
    toast.className = 'global-toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Отправка глобального уведомления (админ)
window.sendGlobalNotification = async function() {
    if (!currentUser || currentUser.IsAdmin !== 'true') return;
    const input = document.getElementById('global-notify-text');
    const message = input.value.trim();
    if (!message) return;
    
    // Сохраняем в таблицу global_notifications (создайте её в Supabase: id, message, created_at)
    const { error } = await supabaseClient
        .from('global_notifications')
        .insert({ message: message, created_at: new Date() });
    if (error) {
        console.error("Global notify error:", error);
        return window.showNotify("❌ Ошибка отправки", "error");
    }
    input.value = '';
    window.showNotify("✅ Уведомление отправлено всем!", "success");
    // Сами себе тоже покажем
    showGlobalNotification(message);
};

// Подписка на глобальные уведомления в реальном времени
function subscribeGlobalNotifications() {
    supabaseClient
        .channel('global-notify')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_notifications' }, (payload) => {
            const msg = payload.new.message;
            showGlobalNotification(msg);
        })
        .subscribe();
    
    // Также загружаем последние 5 для истории в админке
    loadNotificationsHistory();
}

async function loadNotificationsHistory() {
    const { data } = await supabaseClient
        .from('global_notifications')
        .select('message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    const historyDiv = document.getElementById('notifications-history');
    if (historyDiv && data) {
        historyDiv.innerHTML = data.map(n => `<div>📢 ${new Date(n.created_at).toLocaleString()}: ${n.message}</div>`).join('');
    }
}

window.formatNumber = function(num) {
    if (!num || num < 1000) return (num || 0).toString();
    const suffixes = ["K", "M", "B", "T", "Qa", "Qn"];
    const magnitude = Math.floor(Math.log10(num) / 3);
    const suffix = suffixes[magnitude - 1];
    const scaled = num / Math.pow(1000, magnitude);
    return (Math.round(scaled * 10) / 10).toFixed(1).replace(/\.0$/, '') + suffix;
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
    subscribeGlobalNotifications(); // подписка на глобальные уведомления
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

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('username', u)
        .eq('password', p);
    
    if (error) {
        console.error("Login error:", error);
        return window.showNotify("LOGIN ERROR", "error");
    }
    
    if (data && data.length > 0) {
        currentUser = data[0];
        localStorage.setItem('saved_login', u);
        localStorage.setItem('saved_pass', p);
        
        await supabaseClient
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', currentUser.id);
        
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-interface').style.display = 'block';
        document.getElementById('top-bar').style.display = 'flex';
        document.getElementById('h-balance').innerText = window.formatNumber(currentUser.score || 0);
        document.getElementById('h-cp').innerText = window.formatNumber(currentUser.CP_Point || 0);
        
        const adminBtn = document.getElementById('admin-nav-btn');
        if (adminBtn) adminBtn.style.display = currentUser.IsAdmin === 'true' ? 'block' : 'none';
        
        window.renderAllCases();
        window.renderMarket();
        loadChallenges();
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
    const robloxUser = document.getElementById('reg_roblox').value.trim() || null;
    
    if (!username || !password) {
        return window.showNotify("⚠️ USERNAME AND PASSWORD REQUIRED", "error");
    }
    if (username.length < 3) {
        return window.showNotify("⚠️ USERNAME MUST BE AT LEAST 3 CHARACTERS", "error");
    }
    if (password.length < 4) {
        return window.showNotify("⚠️ PASSWORD MUST BE AT LEAST 4 CHARACTERS", "error");
    }
    
    const { data: existing } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('username', username);
    
    if (existing && existing.length > 0) {
        return window.showNotify("❌ USERNAME ALREADY EXISTS", "error");
    }
    
    const newUser = {
        username: username,
        password: password,
        score: 100,
        CP_Point: 0,
        inventory: [],
        RobloxUSER: robloxUser,
        IsAdmin: 'false',
        last_login: new Date().toISOString()
    };
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .insert([newUser])
        .select();
    
    if (error) {
        console.error("Registration error:", error);
        return window.showNotify("❌ REGISTRATION ERROR: " + error.message, "error");
    }
    
    if (data && data.length > 0) {
        window.showNotify("✅ ACCOUNT CREATED! PLEASE LOGIN", "success");
        document.getElementById('login-panel').style.display = 'block';
        document.getElementById('register-panel').style.display = 'none';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.remove('active');
        document.getElementById('login_username').value = username;
        document.getElementById('login_password').value = password;
    }
};

// ========== ЗАПРОС ВЫВОДА (С АНТИСПАМОМ) ==========
async function requestWithdrawal(itemId, itemName, mutation) {
    if (!checkCooldown()) return false;
    if (!currentUser || !currentUser.RobloxUSER) {
        window.showNotify("❌ Roblox ник не найден в профиле! Заполните его.", "error");
        return false;
    }

    const username = currentUser.RobloxUSER;

    try {
        const { data, error } = await supabaseClient
            .from('withdrawals')
            .insert([{ username: username, item_name: itemName, mutation: mutation || "Normal", status: 'processing' }]);

        if (error) {
            console.error("Ошибка Supabase:", error);
            window.showNotify("❌ Ошибка сервера: " + error.message, "error");
            return false;
        }

        window.showNotify("✅ Заявка создана! Ожидайте выдачу в игре.", "success");
        
        const idx = currentUser.inventory.findIndex(x => x.id === itemId);
        if (idx !== -1) {
            const newInventory = [...currentUser.inventory];
            newInventory[idx] = { ...newInventory[idx], status: 'processing' };
            await supabaseClient.from('profiles')
                .update({ inventory: newInventory })
                .eq('id', currentUser.id);
            currentUser.inventory = newInventory;
            window.renderProfile();
        }
        return true;
    } catch (err) {
        console.error("Критическая ошибка:", err);
        window.showNotify("❌ Произошла ошибка связи.", "error");
        return false;
    }
}

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
            document.getElementById('h-balance').innerText = window.formatNumber(newScore);
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
            <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                <button class="neon-btn-main" onclick="window.openCaseWithAnimation('${caseData.id}')">🎰 OPEN ($${caseData.price})</button>
                <button class="fast-drop-btn" onclick="window.fastDropCase('${caseData.id}')">⚡ FAST OPEN ($${caseData.price})</button>
            </div>
            <div class="loot-table">
                <h3>📦 POSSIBLE LOOT</h3>
                ${lootRows || '<div style="text-align:center; color:#555;">NO LOOT DATA</div>'}
                <div style="margin-top: 15px; font-size: 10px; color: #555; text-align: center;">* SYSTEM_SHOWCASE — шансы из базы данных</div>
            </div>
        </div>
    `;
    window.navTo('case-info');
};

// ========== РУЛЕТКА ==========
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
        mythic: { color: '#ff00aa', text: 'MYTHIC', icon: '✨' },
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

// ОТКРЫТИЕ КЕЙСА С АНТИСПАМОМ
window.openCaseWithAnimation = async function(caseId) {
    if (!checkCooldown()) return;
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
    
    await updateChallengeProgress('open_cases', 1);
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

// ========== ПОКУПКА ЛИМИТКИ (с антиспамом?) – можно добавить, но обычно не спамят ==========
window.buyLimited = async function(id, price) {
    // Не ставим глобальный кулдаун, т.к. покупка не критична. Но можно добавить по желанию
    if (!currentUser) return;
    if ((currentUser.CP_Point || 0) < price) {
        return window.showNotify("INSUFFICIENT CP", "error");
    }
    const { data: item } = await supabaseClient.from('cases_meta').select('*').eq('id', id).single();
    if (!item || item.stock <= 0) return window.showNotify("SOLD OUT", "error");
    
    const newStock = item.stock - 1;
    const newCP = (currentUser.CP_Point || 0) - price;
    
    await supabaseClient.from('cases_meta').update({ stock: newStock }).eq('id', id);
    await supabaseClient.from('profiles').update({ CP_Point: newCP }).eq('id', currentUser.id);
    currentUser.CP_Point = newCP;
    
    const lootOverlay = document.getElementById('loot-overlay');
    const lootImage = document.getElementById('lootImage');
    const lootTitle = document.getElementById('lootTitle');
    const lootRarity = document.getElementById('lootRarity');
    const lootClaimBtn = document.getElementById('loot-claim-btn');
    
    lootImage.src = `${GITHUB_BASE}${item.image_url}`;
    lootTitle.innerText = item.name;
    lootRarity.innerText = 'CASE';
    lootRarity.style.color = '#ffaa00';
    
    const originalOnclick = lootClaimBtn.onclick;
    lootClaimBtn.innerText = '🔓 OPEN CASE';
    lootClaimBtn.onclick = () => {
        lootOverlay.style.display = 'none';
        window.openCaseWithAnimation(item.id);
        setTimeout(() => {
            lootClaimBtn.innerText = '💾 CLAIM';
            lootClaimBtn.onclick = originalOnclick;
        }, 100);
    };
    
    lootOverlay.style.display = 'block';
    
    window.renderMarket();
    window.renderProfile();
    window.showNotify(`PURCHASED: ${item.name} (CASE)`, 'success');
};

// ========== ПРОФИЛЬ (с поддержкой статусов) ==========
window.renderProfile = function() {
    if (!currentUser) return;
    
    const pUsername = document.getElementById('p-username');
    const pWorth = document.getElementById('p-worth');
    const pCpVal = document.getElementById('p-cp-val');
    const robloxInput = document.getElementById('roblox-input');
    
    if (pUsername) pUsername.innerText = currentUser.username;
    if (pWorth) pWorth.innerText = window.formatNumber(currentUser.score || 0);
    if (pCpVal) pCpVal.innerText = window.formatNumber(currentUser.CP_Point || 0);
    if (robloxInput) robloxInput.value = currentUser.RobloxUSER || '';
    
    const list = document.getElementById('inventory-list');
    if (!list) return;
    
    const template = document.getElementById('inv-item-template');
    list.innerHTML = '';
    const inventory = currentUser.inventory || [];
    if (inventory.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#555; grid-column:1/-1;">INVENTORY_EMPTY</div>';
    } else {
        inventory.slice().reverse().forEach(item => {
            const clone = template.content.cloneNode(true);
            let itemChar = item.char;
            if (itemChar && itemChar.endsWith('.png')) itemChar = itemChar.replace('.png', '');
            if (!itemChar && item.name) itemChar = item.name;
            if (!itemChar) itemChar = "Unknown Item";
            const itemFull = allItems[itemChar];
            if (itemFull) {
                const rarity = itemFull.rarity || 'common';
                const rarityColors = { common: '#aaa', rare: '#3399ff', epic: '#aa33ff', legendary: '#ffaa00' };
                const itemNameEl = clone.querySelector('.item-name');
                if (itemNameEl) itemNameEl.style.color = rarityColors[rarity] || '#fff';
                const imgUrl = `${GITHUB_BASE}${itemFull.image_url || 'unknown.png'}`;
                const itemImg = clone.querySelector('.item-img');
                if (itemImg) {
                    itemImg.src = imgUrl;
                    itemImg.onerror = function() { this.src = 'https://placehold.co/150x150?text=NO_IMG'; };
                }
                if (itemNameEl) itemNameEl.innerText = itemFull.display_name;
                
                const sBtn = clone.querySelector('.sell-btn');
                const wBtn = clone.querySelector('.with-btn');
                const statusT = clone.querySelector('.item-status-text');
                
                if (item.status === 'processing') {
                    if (sBtn) sBtn.style.display = 'none';
                    if (wBtn) wBtn.style.display = 'none';
                    if (statusT) {
                        statusT.style.display = 'block';
                        statusT.style.color = '#ffaa00';
                        statusT.innerHTML = '⏳ В обработке...';
                    }
                } else if (item.status === 'ready') {
                    if (sBtn) sBtn.style.display = 'none';
                    if (wBtn) wBtn.style.display = 'none';
                    if (statusT) {
                        statusT.style.display = 'block';
                        statusT.style.color = '#4caf50';
                        statusT.innerHTML = '✅ Готово! Предмет выдан';
                    }
                } else if (item.status === 'cancel') {
                    if (sBtn) sBtn.style.display = 'block';
                    if (wBtn) wBtn.style.display = 'none';
                    if (statusT) {
                        statusT.style.display = 'block';
                        statusT.style.color = '#e53935';
                        statusT.innerHTML = '❌ Отменено';
                    }
                    const sellPrice = itemFull.price || 100;
                    if (sBtn) sBtn.onclick = () => window.sellItem(item.id, sellPrice, itemFull.display_name);
                } else {
                    if (sBtn) sBtn.style.display = 'block';
                    if (wBtn) wBtn.style.display = 'block';
                    if (statusT) statusT.style.display = 'none';
                    
                    const sellPrice = itemFull.price || 100;
                    if (sBtn) sBtn.onclick = () => window.sellItem(item.id, sellPrice, itemFull.display_name);
                    if (wBtn) {
                        wBtn.onclick = async () => {
                            const mutation = item.mutation || "Normal";
                            await requestWithdrawal(item.id, itemFull.display_name, mutation);
                        };
                    }
                }
            } else {
                const itemImg = clone.querySelector('.item-img');
                const itemNameEl = clone.querySelector('.item-name');
                if (itemImg) itemImg.src = 'https://placehold.co/150x150?text=UNKNOWN';
                if (itemNameEl) itemNameEl.innerText = itemChar;
            }
            list.appendChild(clone);
        });
    }
    
    loadChallenges();
    syncWithdrawalsStatus();
    window.updateProfileAvatar(); // обновляем аватарку в профиле
};

// ========== ПРОДАЖА (С АНТИСПАМОМ) ==========
window.sellItem = async function(id, sellPrice, itemDisplayName) {
    if (!checkCooldown()) return;
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
        await updateChallengeProgress('sell_items', 1);
    }
};

// ========== ПРОДАЖА ВСЕГО ИНВЕНТАРЯ ==========
window.sellAllItems = async function() {
    if (!checkCooldown()) return;
    if (!currentUser) return;
    
    const inventory = currentUser.inventory || [];
    const availableItems = inventory.filter(item => item.status !== 'processing' && item.status !== 'ready');
    
    if (availableItems.length === 0) {
        return window.showNotify("❌ Нет предметов для продажи!", "error");
    }
    
    if (!confirm(`Продать ВСЕ ${availableItems.length} предмет(ов) за 80% их стоимости?`)) return;
    
    let totalGain = 0;
    const itemsToSell = [];
    const itemsToKeep = [];
    
    for (const item of inventory) {
        if (item.status === 'processing' || item.status === 'ready') {
            itemsToKeep.push(item);
            continue;
        }
        
        let itemChar = item.char;
        if (itemChar && itemChar.endsWith('.png')) itemChar = itemChar.replace('.png', '');
        if (!itemChar && item.name) itemChar = item.name;
        
        const itemFull = allItems[itemChar];
        if (itemFull) {
            const sellPrice = itemFull.price || 100;
            const playerGain = Math.floor(sellPrice * 0.8);
            totalGain += playerGain;
            itemsToSell.push(item);
        } else {
            itemsToKeep.push(item);
        }
    }
    
    if (itemsToSell.length === 0) {
        return window.showNotify("❌ Нет продаваемых предметов!", "error");
    }
    
    const newScore = (currentUser.score || 0) + totalGain;
    
    const { error } = await supabaseClient.from('profiles')
        .update({ inventory: itemsToKeep, score: newScore })
        .eq('id', currentUser.id);
    
    if (!error) {
        currentUser.inventory = itemsToKeep;
        currentUser.score = newScore;
        window.showNotify(`💰 Продано ${itemsToSell.length} предметов! +${totalGain}$ (20% комиссия)`, "success");
        window.renderProfile();
        document.getElementById('h-balance').innerText = window.formatNumber(newScore);
        await updateChallengeProgress('sell_items', itemsToSell.length);
    } else {
        window.showNotify("❌ Ошибка при продаже!", "error");
    }
};

window.closeAllModals = function() {
    const overlays = document.querySelectorAll('.modal-overlay');
    const modals = document.querySelectorAll('.admin-edit-modal');
    overlays.forEach(el => el.remove());
    modals.forEach(el => el.remove());
};

// ========== ВЫВОД (уже с антиспамом через requestWithdrawal) ==========
window.withdrawItem = async function(id, itemDisplayName) {
    if (!checkCooldown()) return;
    if (!currentUser) return;

    const nick = currentUser.RobloxUSER;
    if (!nick || nick.trim() === "") {
        return window.showNotify("❌ ROBLOX USERNAME NOT SET IN PROFILE", "error");
    }

    const item = currentUser.inventory.find(i => i.id === id);
    const mutation = item ? (item.mutation || "Normal") : "Normal";

    const { error: dbError } = await supabaseClient
        .from('withdrawals')
        .insert([{
            username: nick.trim(),
            item_name: itemDisplayName,
            mutation: mutation,
            status: 'processing'
        }]);

    if (dbError) {
        console.error("Supabase Error:", dbError);
        return window.showNotify("❌ DATABASE ERROR: " + dbError.message, "error");
    }

    const newInventory = currentUser.inventory.map(item => 
        item.id === id ? { ...item, status: 'processing' } : item
    );

    const { error: profileError } = await supabaseClient.from('profiles')
        .update({ inventory: newInventory })
        .eq('id', currentUser.id);

    if (!profileError) {
        window.showNotify(`✅ WITHDRAWAL REQUESTED!\n🎮 ${nick.trim()}`, "success");
        window.renderProfile();
        await updateChallengeProgress('withdraw_items', 1);
    } else {
        window.showNotify("❌ ERROR UPDATING INVENTORY", "error");
    }
};

// ========== ОБНОВЛЕНИЕ ROBLOX USERNAME ==========
window.updateRoblox = async function() {
    if (!currentUser) return;
    
    const robloxInput = document.getElementById('roblox-input');
    if (!robloxInput) {
        console.error("roblox-input element not found");
        return;
    }
    
    const roblox = robloxInput.value.trim();
    if (!roblox) {
        window.showNotify("❌ PLEASE ENTER ROBLOX USERNAME", "error");
        return;
    }
    
    const { error } = await supabaseClient.from('profiles')
        .update({ RobloxUSER: roblox })
        .eq('id', currentUser.id);
    
    if (!error) {
        currentUser.RobloxUSER = roblox;
        window.showNotify("✅ ROBLOX USERNAME SAVED!", "success");
    } else {
        console.error("Update error:", error);
        window.showNotify("❌ ERROR SAVING: " + (error.message || "Unknown error"), "error");
    }
};

// ========== ПРОМОКОДЫ (без антиспама, т.к. одноразовые) ==========
window.activatePromoCode = async function() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    if (!code) return;
    
    const { data: promo } = await supabaseClient
        .from('promocodes')
        .select('*')
        .eq('code', code)
        .single();
    
    if (!promo) return window.showNotify("❌ INVALID PROMO CODE", "error");
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return window.showNotify("❌ EXPIRED", "error");
    if (promo.max_uses > 0 && promo.uses_count >= promo.max_uses) return window.showNotify("❌ USED UP", "error");
    
    const { data: existing } = await supabaseClient
        .from('promo_activations')
        .select('*')
        .eq('promo_id', promo.id)
        .eq('user_id', currentUser.id);
    
    if (existing && existing.length >= promo.per_user_limit) return window.showNotify("❌ ALREADY USED", "error");
    
    if (promo.only_new_players === 'true') {
        const accountAge = (new Date() - new Date(currentUser.last_login)) / (1000 * 60 * 60 * 24);
        if (accountAge > 7) return window.showNotify("❌ NEW PLAYERS ONLY", "error");
    }
    
    await supabaseClient.from('promo_activations').insert({ promo_id: promo.id, user_id: currentUser.id });
    await supabaseClient.from('promocodes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id);
    
    await givePromoReward(promo);
};

async function givePromoReward(promo) {
    switch (promo.reward_type) {
        case 'cp':
            const newCP = (currentUser.CP_Point || 0) + parseInt(promo.reward_value);
            await supabaseClient.from('profiles').update({ CP_Point: newCP }).eq('id', currentUser.id);
            currentUser.CP_Point = newCP;
            window.showNotify(`🎁 +${promo.reward_value} CP!`, 'success');
            break;
        case 'money':
            const newMoney = (currentUser.score || 0) + parseInt(promo.reward_value);
            await supabaseClient.from('profiles').update({ score: newMoney }).eq('id', currentUser.id);
            currentUser.score = newMoney;
            window.showNotify(`🎁 +$${promo.reward_value}!`, 'success');
            break;
        case 'case':
            const lootOverlay = document.getElementById('loot-overlay');
            const lootImage = document.getElementById('lootImage');
            const lootTitle = document.getElementById('lootTitle');
            const lootRarity = document.getElementById('lootRarity');
            const lootClaimBtn = document.getElementById('loot-claim-btn');
            
            const caseData = allCases.find(c => c.id == parseInt(promo.reward_value));
            lootImage.src = `${GITHUB_BASE}${caseData?.image_url || 'unknown.png'}`;
            lootTitle.innerText = caseData?.name || 'FREE CASE';
            lootRarity.innerText = 'PROMO CODE';
            lootRarity.style.color = '#ffaa00';
            
            const originalOnclick = lootClaimBtn.onclick;
            lootClaimBtn.innerText = '🔓 OPEN CASE';
            lootClaimBtn.onclick = () => {
                lootOverlay.style.display = 'none';
                window.openCaseWithAnimation(parseInt(promo.reward_value));
                setTimeout(() => {
                    lootClaimBtn.innerText = '💾 CLAIM';
                    lootClaimBtn.onclick = originalOnclick;
                }, 100);
            };
            lootOverlay.style.display = 'block';
            return;
        case 'item':
            const newItem = { id: Date.now(), char: promo.reward_value, };
            const newInventory = [...(currentUser.inventory || []), newItem];
            await supabaseClient.from('profiles').update({ inventory: newInventory }).eq('id', currentUser.id);
            currentUser.inventory = newInventory;
            window.showNotify(`🎁 +${promo.reward_value}!`, 'success');
            break;
    }
    window.renderProfile();
}

// ========== ЗАДАНИЯ ==========
async function loadChallenges() {
    try {
        const { data: challenges } = await supabaseClient.from('challenges').select('*').eq('is_active', true);
        const { data: progress } = await supabaseClient
            .from('user_challenge_progress')
            .select('*')
            .eq('user_id', currentUser.id);
        
        const progressMap = {};
        progress?.forEach(p => { progressMap[p.challenge_id] = p; });
        
        const container = document.getElementById('challenges-list');
        if (!container || !challenges) return;
        
        container.innerHTML = challenges.map(ch => {
            const prog = progressMap[ch.id];
            const completed = prog?.is_completed;
            return `
                <div class="challenge-card ${completed ? 'completed' : ''}">
                    <div class="challenge-info">
                        <h4>${ch.name}</h4>
                        <p>${ch.description}</p>
                    </div>
                    <div class="challenge-progress">
                        ${!completed ? `
                            <span>${prog?.current_progress || 0}/${ch.required_amount}</span>
                            <div class="challenge-reward">🏆 +${ch.reward_cp} CP</div>
                        ` : `
                            <span>✅ COMPLETED</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) { console.error(e); }
}

async function updateChallengeProgress(type, amount = 1) {
    try {
        const { data: challenges } = await supabaseClient
            .from('challenges')
            .select('*')
            .eq('challenge_type', type)
            .eq('is_active', true);
        
        for (const ch of challenges || []) {
            const { data: prog } = await supabaseClient
                .from('user_challenge_progress')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('challenge_id', ch.id)
                .maybeSingle();
            
            if (prog?.is_completed) continue;
            
            const newProgress = (prog?.current_progress || 0) + amount;
            
            if (newProgress >= ch.required_amount) {
                await supabaseClient.from('user_challenge_progress').upsert({
                    user_id: currentUser.id,
                    challenge_id: ch.id,
                    current_progress: ch.required_amount,
                    is_completed: true,
                    completed_at: new Date()
                });
                const newCP = (currentUser.CP_Point || 0) + ch.reward_cp;
                await supabaseClient.from('profiles').update({ CP_Point: newCP }).eq('id', currentUser.id);
                currentUser.CP_Point = newCP;
                window.showNotify(`🏆 CHALLENGE COMPLETED! +${ch.reward_cp} CP`, 'success');
            } else {
                await supabaseClient.from('user_challenge_progress').upsert({
                    user_id: currentUser.id,
                    challenge_id: ch.id,
                    current_progress: newProgress,
                    is_completed: false
                });
            }
        }
        loadChallenges();
    } catch(e) { console.error(e); }
}

// ========== АДМИН ПАНЕЛЬ ==========
window.renderAdminPanel = async function() {
    if (!currentUser || currentUser.IsAdmin !== 'true') return;
    await loadAdminUsers();
    await loadAdminPromocodes();
    await loadAdminChallenges();
    await loadNotificationsHistory(); // загружаем историю уведомлений
};

async function loadAdminUsers() {
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
        row.insertCell(2).innerHTML = `<span style="color:#ffaa00">⚡${user.CP_Point || 0}</span>`;
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
        row.insertCell(5).innerText = user.RobloxUSER || 'Not set';
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
}

async function loadAdminPromocodes() {
    const { data: promos } = await supabaseClient.from('promocodes').select('*');
    const container = document.getElementById('promocodes-list');
    if (!container) return;
    container.innerHTML = (promos || []).map(p => `
        <div class="promo-card">
            <div><b>${p.code}</b> | ${p.reward_type}: ${p.reward_value} | Uses: ${p.uses_count}/${p.max_uses || '∞'}</div>
            <button class="delete-promo" onclick="deletePromoCode(${p.id})">DELETE</button>
        </div>
    `).join('');
}

async function loadAdminChallenges() {
    const { data: challenges } = await supabaseClient.from('challenges').select('*');
    const container = document.getElementById('challenges-admin-list');
    if (!container) return;
    container.innerHTML = (challenges || []).map(ch => `
        <div class="promo-card">
            <div><b>${ch.name}</b> | ${ch.challenge_type} | ${ch.required_amount} times | Reward: ${ch.reward_cp} CP</div>
            <button class="delete-promo" onclick="deleteChallenge(${ch.id})">DELETE</button>
        </div>
    `).join('');
}

function toggleAdminSection(sectionId) {
    const content = document.getElementById(sectionId);
    const arrow = content.previousElementSibling.querySelector('.arrow');
    if (content.style.display === 'none' || getComputedStyle(content).display === 'none') {
        content.style.display = 'block';
        arrow.classList.remove('collapsed');
    } else {
        content.style.display = 'none';
        arrow.classList.add('collapsed');
    }
}

window.showCreatePromoModal = function() {
    closeAllModals();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = () => closeAllModals();
    const modal = document.createElement('div');
    modal.className = 'admin-edit-modal';
    modal.innerHTML = `
        <h3 style="color:#00d4ff; margin-bottom:20px;">🎫 CREATE PROMOCODE</h3>
        <label>CODE</label>
        <input type="text" id="promo-code" placeholder="EXAMPLE123">
        <label>REWARD TYPE</label>
        <select id="promo-type" style="width:100%; padding:10px; margin:10px 0; background:#050510; border:1px solid #1a1a3a; color:#fff; border-radius:8px;">
            <option value="cp">⚡ CP (Cyber Points)</option>
            <option value="money">💰 MONEY</option>
            <option value="case">📦 CASE (opens instantly)</option>
            <option value="item">🎁 ITEM (adds to inventory)</option>
        </select>
        <label>VALUE</label>
        <input type="text" id="promo-value" placeholder="Amount or Case/Item ID">
        <label>MAX USES (0 = unlimited)</label>
        <input type="number" id="promo-max-uses" placeholder="Max uses" value="1">
        <label>PER USER LIMIT</label>
        <input type="number" id="promo-per-user" placeholder="Per user" value="1">
        <label style="display:flex; align-items:center; gap:10px; margin:15px 0;">
            <input type="checkbox" id="promo-new-only" style="width:20px; height:20px; cursor:pointer; accent-color:#00d4ff;">
            <span style="font-family:'Orbitron'; font-size:12px; color:#00d4ff;">🔰 NEW PLAYERS ONLY (account < 7 days)</span>
        </label>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="neon-btn-small" style="flex:1;" onclick="createPromoCode()">CREATE</button>
            <button class="back-btn" style="margin:0; flex:1;" onclick="closeAllModals()">CANCEL</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
};

window.showCreateChallengeModal = function() {
    closeAllModals();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = () => closeAllModals();
    const modal = document.createElement('div');
    modal.className = 'admin-edit-modal';
    modal.innerHTML = `
        <h3 style="color:#00d4ff; margin-bottom:20px;">🏆 CREATE CHALLENGE</h3>
        <label>CHALLENGE NAME</label>
        <input type="text" id="challenge-name" placeholder="e.g., Case Opener">
        <label>DESCRIPTION</label>
        <input type="text" id="challenge-desc" placeholder="e.g., Open 10 cases">
        <label>CHALLENGE TYPE</label>
        <select id="challenge-type" style="width:100%; padding:10px; margin:10px 0; background:#050510; border:1px solid #1a1a3a; color:#fff; border-radius:8px;">
            <option value="open_cases">📦 OPEN CASES</option>
            <option value="sell_items">💰 SELL ITEMS</option>
            <option value="withdraw_items">📤 WITHDRAW ITEMS</option>
        </select>
        <label>REQUIRED AMOUNT</label>
        <input type="number" id="challenge-amount" placeholder="Required amount" value="10">
        <label>REWARD CP</label>
        <input type="number" id="challenge-reward" placeholder="Reward CP" value="50">
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="neon-btn-small" style="flex:1;" onclick="createChallenge()">CREATE</button>
            <button class="back-btn" style="margin:0; flex:1;" onclick="closeAllModals()">CANCEL</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
};

window.createPromoCode = async function() {
    const code = document.getElementById('promo-code')?.value.trim().toUpperCase();
    const reward_type = document.getElementById('promo-type')?.value;
    const reward_value = document.getElementById('promo-value')?.value.trim();
    const max_uses = parseInt(document.getElementById('promo-max-uses')?.value) || 0;
    const per_user_limit = parseInt(document.getElementById('promo-per-user')?.value) || 1;
    const only_new_players = document.getElementById('promo-new-only')?.checked ? 'true' : 'false';
    
    if (!code || !reward_value) {
        return window.showNotify("❌ Fill all fields", "error");
    }
    
    const { error } = await supabaseClient.from('promocodes').insert({
        code, reward_type, reward_value, max_uses, per_user_limit, only_new_players,
        uses_count: 0, created_at: new Date()
    });
    
    if (error) {
        return window.showNotify("❌ Error: " + error.message, "error");
    }
    
    window.showNotify("✅ Promocode created!", "success");
    closeAllModals();
    loadAdminPromocodes();
};

window.createChallenge = async function() {
    const name = document.getElementById('challenge-name')?.value.trim();
    const description = document.getElementById('challenge-desc')?.value.trim();
    const challenge_type = document.getElementById('challenge-type')?.value;
    const required_amount = parseInt(document.getElementById('challenge-amount')?.value);
    const reward_cp = parseInt(document.getElementById('challenge-reward')?.value);
    
    if (!name) {
        return window.showNotify("❌ Fill challenge name", "error");
    }
    
    const { error } = await supabaseClient.from('challenges').insert({
        name, description, challenge_type, required_amount, reward_cp, is_active: true
    });
    
    if (error) {
        return window.showNotify("❌ Error: " + error.message, "error");
    }
    
    window.showNotify("✅ Challenge created!", "success");
    closeAllModals();
    loadAdminChallenges();
};

window.deletePromoCode = async function(id) {
    await supabaseClient.from('promocodes').delete().eq('id', id);
    loadAdminPromocodes();
};

window.deleteChallenge = async function(id) {
    await supabaseClient.from('challenges').delete().eq('id', id);
    loadAdminChallenges();
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
        <input type="number" id="edit-cp" value="${user.CP_Point || 0}">
        <label>Roblox Username</label>
        <input type="text" id="edit-roblox" value="${user.RobloxUSER || ''}">
        <label style="display:flex; align-items:center; gap:10px; margin:10px 0;">
            <input type="checkbox" id="edit-admin" style="width:20px; height:20px; cursor:pointer; accent-color:#00d4ff;" ${user.IsAdmin === 'true' ? 'checked' : ''}>
            <span style="font-family:'Orbitron'; font-size:12px; color:#00d4ff;">Is Admin?</span>
        </label>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="neon-btn-small" style="flex:1;" onclick="saveAdminEdit('${user.id}')">SAVE</button>
            <button class="back-btn" style="margin:0; flex:1;" onclick="this.closest('.admin-edit-modal').remove(); document.querySelector('.modal-overlay').remove();">CANCEL</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

window.saveAdminEdit = async function(userId) {
    const balance = parseInt(document.getElementById('edit-balance').value) || 0;
    const cp = parseInt(document.getElementById('edit-cp').value) || 0;
    const roblox = document.getElementById('edit-roblox').value || null;
    const isAdmin = document.getElementById('edit-admin').checked ? 'true' : 'false';
    const { error } = await supabaseClient.from('profiles')
        .update({ score: balance, CP_Point: cp, RobloxUSER: roblox, IsAdmin: isAdmin })
        .eq('id', userId);
    if (error) return window.showNotify("UPDATE ERROR", "error");
    window.showNotify("USER UPDATED", "success");
    document.querySelector('.modal-overlay')?.remove();
    document.querySelector('.admin-edit-modal')?.remove();
    if (currentUser.IsAdmin === 'true') loadAdminUsers();
    if (currentUser.id === userId) {
        currentUser.score = balance;
        currentUser.CP_Point = cp;
        currentUser.RobloxUSER = roblox;
        currentUser.IsAdmin = isAdmin;
        window.renderProfile();
        const adminBtn = document.getElementById('admin-nav-btn');
        if (adminBtn) adminBtn.style.display = isAdmin === 'true' ? 'block' : 'none';
    }
};

async function deleteUserAccount(userId, username) {
    if (!confirm(`Delete "${username}"?`)) return;
    await supabaseClient.from('profiles').delete().eq('id', userId);
    window.showNotify(`✅ USER "${username}" DELETED`, "success");
    if (currentUser.IsAdmin === 'true') loadAdminUsers();
}

window.filterUsers = function() {
    const search = document.getElementById('search-user')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#users-table-body tr');
    rows.forEach(row => {
        const username = row.cells[0]?.innerText.toLowerCase() || '';
        row.style.display = username.includes(search) ? '' : 'none';
    });
};

// ========== FAST DROP ==========
window.fastDropCase = async function(caseId) {
    if (!checkCooldown()) return;
    if (!currentUser) return;
    const caseData = allCases.find(c => c.id == caseId);
    if (!caseData) return;
    if ((currentUser.score || 0) < caseData.price) {
        return window.showNotify("INSUFFICIENT FUNDS", "error");
    }
    let lootItems = caseData.loot || [];
    if (typeof lootItems === 'string') {
        try { lootItems = JSON.parse(lootItems); } catch(e) { lootItems = []; }
    }
    if (lootItems.length === 0) return window.showNotify("NO LOOT IN THIS CASE", "error");
    
    const selected = getRandomItemFromLoot(lootItems);
    if (selected) {
        const newScore = (currentUser.score || 0) - caseData.price;
        const newItem = { id: Date.now(), char: selected.name, };
        const newInv = [...(currentUser.inventory || []), newItem];
        
        const { error } = await supabaseClient.from('profiles').update({
            inventory: newInv, score: newScore
        }).eq('id', currentUser.id);
        
        if (!error) {
            currentUser.score = newScore;
            currentUser.inventory = newInv;
            const itemFull = allItems[selected.name];
            window.showNotify(`⚡ FAST DROP! +${itemFull?.display_name || selected.name}`, 'success');
            window.renderProfile();
            document.getElementById('h-balance').innerText = window.formatNumber(newScore);
            await updateChallengeProgress('open_cases', 1);
        } else {
            window.showNotify("ERROR", "error");
        }
    }
};

// ========== АВАТАРКИ (с удалением старой и fallback на NoName.png) ==========
async function uploadAvatarToSupabase(file) {
    if (!currentUser) return false;
    
    if (file.size > 2 * 1024 * 1024) {
        window.showNotify("❌ File too large! Max 2MB", "error");
        return false;
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        window.showNotify("❌ Only PNG or JPG images allowed!", "error");
        return false;
    }
    
    let progressBar = document.querySelector('.upload-progress-bar');
    if (!progressBar) {
        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = '<div class="upload-progress-bar"></div>';
        document.querySelector('.avatar-upload-section')?.appendChild(progressDiv);
        progressBar = progressDiv.querySelector('.upload-progress-bar');
    }
    if (progressBar) progressBar.style.width = '30%';
    
    const fileExt = file.type === 'image/png' ? 'png' : 'jpg';
    const fileName = `${currentUser.username}.${fileExt}`;
    const filePath = `avatars/${fileName}`;
    
    try {
        // Удаляем старую аватарку, если есть
        const { data: existingFiles } = await supabaseClient.storage.from('avatars').list('avatars', { search: currentUser.username });
        if (existingFiles && existingFiles.length > 0) {
            for (const f of existingFiles) {
                await supabaseClient.storage.from('avatars').remove([`avatars/${f.name}`]);
            }
        }
        
        if (progressBar) progressBar.style.width = '60%';
        
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        if (progressBar) progressBar.style.width = '90%';
        
        const { data: urlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', currentUser.id);
        
        if (updateError) throw updateError;
        
        currentUser.avatar_url = urlData.publicUrl;
        
        if (progressBar) {
            progressBar.style.width = '100%';
            setTimeout(() => progressBar.style.width = '0%', 1000);
        }
        
        window.updateProfileAvatar();
        window.showNotify("✅ Avatar uploaded successfully!", "success");
        return true;
    } catch (error) {
        console.error("Upload error:", error);
        window.showNotify("❌ Upload failed: " + error.message, "error");
        if (progressBar) progressBar.style.width = '0%';
        return false;
    }
}

// Получение URL аватарки (приоритет: avatar_url из профиля -> Supabase Storage -> NoName.png)
window.getAvatarUrl = function(username) {
    if (!username) return null;
    // Если в профиле есть прямой URL
    if (currentUser && currentUser.avatar_url && currentUser.avatar_url.startsWith('http')) {
        return currentUser.avatar_url;
    }
    // Пробуем Storage
    const supabaseUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/${username}.png`).data.publicUrl;
    return supabaseUrl;
};

// Проверка существования аватарки (Storage или NoName.png всегда существует как fallback)
window.checkAvatarExists = async function(username) {
    if (!username) return false;
    const supabaseUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/${username}.png`).data.publicUrl;
    try {
        const response = await fetch(supabaseUrl, { method: 'HEAD' });
        if (response.ok) return true;
    } catch(e) {}
    // Fallback: если нет своей, используем NoName.png (он точно есть в Storage)
    return false;
};

// Обновление аватарки в профиле и в preview
window.updateProfileAvatar = async function() {
    if (!currentUser) return;
    const avatarImg = document.getElementById('profile-avatar-img');
    const previewImg = document.getElementById('avatar-preview-img');  // ← было "document document", исправлено
    
    let avatarUrl = null;
    if (currentUser.avatar_url && currentUser.avatar_url.startsWith('http')) {
        avatarUrl = currentUser.avatar_url;
    } else {
        // Пытаемся получить из Storage
        const storageUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/${currentUser.username}.png`).data.publicUrl;
        const exists = await window.checkAvatarExists(currentUser.username);
        if (exists) {
            avatarUrl = storageUrl;
        } else {
            // Если нет своей аватарки, используем NoName.png
            avatarUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/NoName.png`).data.publicUrl;
        }
    }
    
    if (avatarImg) avatarImg.src = avatarUrl;
    if (previewImg) previewImg.src = avatarUrl;
};

// Обработчик загрузки файла
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('avatar-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentUser) {
                window.showNotify("❌ Please login first", "error");
                return;
            }
            await uploadAvatarToSupabase(file);
            fileInput.value = '';
        });
    }
});

window.refreshAvatar = async function() {
    await window.updateProfileAvatar();
    window.showNotify("Avatar refreshed", "success");
};

// Обновляем рендер профиля, чтобы подтянуть аватарку
const oldRenderProfile = window.renderProfile;
window.renderProfile = function() { 
    oldRenderProfile(); 
    window.updateProfileAvatar(); 
};

// ========== РЕАЛЬНОЕ ВРЕМЯ, СТАТУСЫ ==========
async function setUserOnline(isOnline = true) {
    if (!currentUser) return;
    const { error } = await supabaseClient
        .from('online_status')
        .upsert({
            user_id: currentUser.id,
            username: currentUser.username,
            last_seen: new Date().toISOString(),
            is_online: isOnline
        });
    if (error) console.error("Online status error:", error);
}

async function pingOnline() {
    if (!currentUser) return;
    await supabaseClient
        .from('online_status')
        .update({ last_seen: new Date().toISOString() })
        .eq('user_id', currentUser.id);
}

function subscribeToOnlineStatus() {
    supabaseClient
        .channel('online-status-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_status' }, () => {
            if (document.getElementById('page-leaderstats').classList.contains('active')) {
                window.renderLeaderboard();
            }
        })
        .subscribe();
    
    supabaseClient
        .channel('profiles-online-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser?.id}` }, () => {
            if (document.getElementById('page-leaderstats').classList.contains('active')) {
                window.renderLeaderboard();
            }
        })
        .subscribe();
}

window.addEventListener('beforeunload', () => {
    if (currentUser) {
        supabaseClient
            .from('online_status')
            .update({ is_online: false, last_seen: new Date().toISOString() })
            .eq('user_id', currentUser.id);
    }
});

document.addEventListener('click', () => pingOnline());
document.addEventListener('keydown', () => pingOnline());

const originalLogin = window.login;
window.login = async function() {
    await originalLogin();
    if (currentUser) {
        await setUserOnline(true);
        subscribeToOnlineStatus();
        pingOnline();
    }
};

const actionsToPing = ['openCaseWithAnimation', 'fastDropCase', 'sellItem', 'buyLimited', 'activatePromoCode', 'withdrawItem', 'updateRoblox'];
actionsToPing.forEach(actionName => {
    const originalAction = window[actionName];
    if (originalAction) {
        window[actionName] = async function(...args) {
            await pingOnline();
            return originalAction.apply(this, args);
        };
    }
});

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// ========== ЛИДЕРБОРД ==========
window.renderLeaderboard = async function() {
    if (!currentUser) return;
    
    const { data: users } = await supabaseClient
        .from('profiles')
        .select('id, username, score, avatar_url')
        .gte('score', 1000)
        .order('score', { ascending: false })
        .limit(10);
    
    if (!users || users.length === 0) {
        document.getElementById('leaderboard-list').innerHTML = '<div style="text-align:center; padding:20px; color:#888;">⚠️ No players with 1000+ coins</div>';
        return;
    }
    
    const userIds = users.map(u => u.id);
    const { data: onlineStatuses } = await supabaseClient
        .from('online_status')
        .select('user_id, is_online, last_seen')
        .in('user_id', userIds);
    
    const onlineMap = {};
    onlineStatuses?.forEach(s => {
        const isActuallyOnline = s.is_online && (new Date() - new Date(s.last_seen)) < 120000;
        onlineMap[s.user_id] = isActuallyOnline;
    });
    
    let html = '';
    for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const isOnline = onlineMap[u.id] || false;
        const rank = i + 1;
        let rankClass = rank === 1 ? 'top1' : (rank === 2 ? 'top2' : (rank === 3 ? 'top3' : ''));
        
        let avatarUrl = u.avatar_url && u.avatar_url.startsWith('http') ? u.avatar_url : null;
        if (!avatarUrl) {
            const storageUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/${u.username}.png`).data.publicUrl;
            const exists = await window.checkAvatarExists(u.username);
            if (exists) avatarUrl = storageUrl;
            else avatarUrl = supabaseClient.storage.from('avatars').getPublicUrl(`avatars/NoName.png`).data.publicUrl;
        }
        
        html += `
            <div class="leader-row">
                <div class="leader-rank ${rankClass}">#${rank}</div>
                <div class="leader-avatar">
                    <img class="leader-avatar-img" src="${avatarUrl}" onerror="this.src='${supabaseClient.storage.from('avatars').getPublicUrl('avatars/NoName.png').data.publicUrl}'">
                    <div class="online-indicator ${isOnline ? 'online' : 'offline'}"></div>
                </div>
                <div class="leader-info">
                    <div class="leader-name">${u.username}</div>
                    <div class="leader-stats">${isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}</div>
                </div>
                <div class="leader-score">💰 ${window.formatNumber(u.score)}</div>
            </div>
        `;
    }
    document.getElementById('leaderboard-list').innerHTML = html;
};

// ========== ПОДПИСКА НА ОБНОВЛЕНИЯ ПРОФИЛЯ ==========
function subscribeUpdates() {
    supabaseClient.channel('any').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles' }, 
        payload => {
            if (currentUser && payload.new.id === currentUser.id) {
                currentUser = payload.new;
                document.getElementById('h-balance').innerText = window.formatNumber(currentUser.score || 0);
                document.getElementById('h-cp').innerText = window.formatNumber(currentUser.CP_Point || 0);
                if (document.getElementById('page-profile').classList.contains('active')) {
                    window.renderProfile();
                }
            }
        }
    ).subscribe();
}

// ========== НАВИГАЦИЯ ==========
window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + id);
    if (targetPage) targetPage.classList.add('active');
    if (id === 'profile') window.renderProfile();
    if (id === 'cases') window.renderAllCases();
    if (id === 'market') window.renderMarket();
    if (id === 'leaderstats') window.renderLeaderboard();
    if (id === 'admin') {
        if (currentUser && currentUser.IsAdmin === 'true') {
            window.renderAdminPanel();
        } else {
            window.navTo('profile');
            window.showNotify("❌ ADMIN ACCESS ONLY", "error");
        }
    }
};

// Функция для вкладок (из HTML)
function switchTab(tab) {
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    if (tab === 'login') {
        loginPanel.style.display = 'block';
        registerPanel.style.display = 'none';
        btns[0].classList.add('active');
    } else {
        loginPanel.style.display = 'none';
        registerPanel.style.display = 'block';
        btns[1].classList.add('active');
    }
}

// Синхронизация статусов выводов
async function syncWithdrawalsStatus() {
    if (!currentUser || !currentUser.RobloxUSER) return;
    const { data: withdrawals } = await supabaseClient
        .from('withdrawals')
        .select('*')
        .eq('username', currentUser.RobloxUSER);
    if (!withdrawals || withdrawals.length === 0) return;
    
    let needUpdate = false;
    let newInventory = [...(currentUser.inventory || [])];
    for (const withdrawal of withdrawals) {
        const itemIndex = newInventory.findIndex(item => item.char === withdrawal.item_name && item.status === 'processing');
        if (itemIndex !== -1) {
            if (withdrawal.status === 'ready') {
                newInventory[itemIndex] = { ...newInventory[itemIndex], status: 'ready' };
                needUpdate = true;
            } else if (withdrawal.status === 'cancel') {
                newInventory[itemIndex] = { ...newInventory[itemIndex], status: 'cancel' };
                needUpdate = true;
            }
        }
    }
    if (needUpdate) {
        await supabaseClient.from('profiles').update({ inventory: newInventory }).eq('id', currentUser.id);
        currentUser.inventory = newInventory;
        window.renderProfile();
    }
}
