// --- КОНСТАНТЫ ---
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const TG_CHAT_ID = '6176762600';
const GITHUB_BASE = "https://raw.githubusercontent.com/marons/magic-login/main/Drops/";

// Инициализация клиентов
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
emailjs.init('gTrqvbOiCTqlJcDNJ');

let currentUser = null;
let generatedOTP = null;

// Настройка предметов (с твоими ценами)
const items = [
    {char: 'TacoBlock', price: 10},
    {char: 'AdminBlock', price: 10},
    {char: 'SecretBlock', price: 0.5},
    {char: 'LosTacoBlocks', price: 4},
    {char: 'LosAdminBlocks', price: 4}
];

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function showNotify(text) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function validateEmail(email) {
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
}

// --- АВТОРИЗАЦИЯ ---

function showAuth(mode) {
    const choice = document.getElementById('step-choice');
    const form = document.getElementById('step-form');
    const code = document.getElementById('step-code');
    const regBtn = document.getElementById('btn-reg');
    const logBtn = document.getElementById('btn-login');

    if (choice) choice.style.display = (mode === 'choice' ? 'block' : 'none');
    if (form) form.style.display = (mode === 'choice' ? 'none' : 'block');
    if (code) code.style.display = (mode === 'otp' ? 'block' : 'none');

    if (regBtn) regBtn.style.display = (mode === 'reg' ? 'block' : 'none');
    if (logBtn) logBtn.style.display = (mode === 'login' ? 'block' : 'none');
}

async function sendOTP() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    if (!validateEmail(email)) return showNotify("Введите корректный Email!");
    if (pass.length < 8) return showNotify("Пароль должен быть от 8 символов!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    // 1. Отправка в Telegram
    const tgText = `🔐 КОД ПОДТВЕРЖДЕНИЯ: ${generatedOTP}\nДля пользователя: ${email}`;
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(tgText)}`);

    // 2. Отправка на почту через EmailJS
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', { to_email: email, passcode: generatedOTP })
    .then(() => {
        showNotify("Код отправлен!");
        showAuth('otp'); // Переключаем на ввод кода
    }).catch(() => showNotify("Ошибка отправки кода"));
}

async function register() {
    const otpInp = document.getElementById('otp_input').value;
    if (otpInp != generatedOTP) return showNotify("Неверный код!");

    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    const { data, error } = await supabaseClient
        .from('profiles')
        .insert([{ email, password: pass, score: 100, inventory: [] }])
        .select().single();
    
    if (error) return showNotify("Email уже занят!");
    loginSuccess(data);
}

async function login() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    if (!email || !pass) return showNotify("Заполните все поля!");

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();
    
    if (data) loginSuccess(data);
    else showNotify("Неверный логин или пароль!");
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

// --- ИГРОВАЯ ЛОГИКА ---

async function openCase() {
    if (currentUser.score < 50) return showNotify("Мало денег!");
    
    const display = document.getElementById('case-display');
    display.classList.add('spinning');

    const win = items[Math.floor(Math.random() * items.length)];
    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ score: newScore, inventory: newInv })
        .eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        
        setTimeout(() => {
            display.classList.remove('spinning');
            display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" style="width:120px;">`;
            updateUI();
            showNotify(`Выпал: ${win.char}`);
        }, 800);
    }
}

function updateUI() {
    if (!currentUser) return;
    document.getElementById('p-balance').innerText = currentUser.score;
    const list = document.getElementById('inventory-list');
    if (!list) return;

    list.innerHTML = '';
    currentUser.inventory.forEach(item => {
        list.innerHTML += `
            <div class="inv-item">
                <img src="${GITHUB_BASE}${item.char}.png" style="width:40px;">
                <p>${item.char}</p>
                <button onclick="requestWithdraw(${item.id})">ВЫВОД</button>
            </div>`;
    });
}

async function requestWithdraw(id) {
    const nick = prompt("Твой ник в Roblox:");
    if (!nick) return;

    const item = currentUser.inventory.find(i => i.id === id);
    if (!item) return;

    const tgText = `💰 ВЫВОД: ${currentUser.email} | Ник: ${nick} | Предмет: ${item.char}`;
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(tgText)}`);

    emailjs.send('service_j9ls8lo', 'template_cxh5ojg', {
        email: currentUser.email,
        name: nick,
        item_name: item.char,
        to_email: 'sdulimos@gmail.com'
    });

    const updatedInventory = currentUser.inventory.filter(i => i.id !== id);
    const { error } = await supabaseClient
        .from('profiles')
        .update({ inventory: updatedInventory })
        .eq('email', currentUser.email);
    
    if (!error) {
        currentUser.inventory = updatedInventory;
        updateUI();
        showNotify("Заявка принята!");
    }
}

// --- LIVE BOARD ---

function listenToDrops() {
    supabaseClient
        .channel('live_drops')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
            const oldInv = payload.old.inventory || [];
            const newInv = payload.new.inventory || [];
            if (newInv.length > oldInv.length) {
                const lastDrop = newInv[newInv.length - 1];
                addDropToFeed(payload.new.email, lastDrop.char);
            }
        })
        .subscribe();
}

function addDropToFeed(userEmail, charName) {
    const feed = document.getElementById('drops-feed');
    if (!feed) return;
    const name = userEmail.split('@')[0];
    const entry = document.createElement('div');
    entry.className = 'drop-entry';
    entry.innerHTML = `
        <img src="${GITHUB_BASE}${charName}.png" style="width:20px;">
        <span><b>${name}</b> выбил ${charName}</span>`;
    feed.prepend(entry);
    if (feed.children.length > 7) feed.lastChild.remove();
}

// --- СИСТЕМНОЕ ---

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function logout() {
    location.reload();
}

window.onload = () => {
    listenToDrops();
    console.log("App Started");
};

// --- АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ---

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice' ? 'block' : 'none');
    document.getElementById('step-form').style.display = (mode === 'choice' ? 'none' : 'block');
    document.getElementById('btn-reg').style.display = (mode === 'reg' ? 'block' : 'none');
    document.getElementById('btn-login').style.display = (mode === 'login' ? 'block' : 'none');
}

async function sendOTP() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    // ПРОВЕРКИ
    if (!validateEmail(email)) return showNotify("Введите правильную почту!");
    if (pass.length < 8) return showNotify("Пароль слишком короткий (мин. 8 символов)!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    // Отправка кода в Telegram (Бесплатно и безлимитно)
    const tgMessage = `🔐 КОД ДЛЯ ${email}: ${generatedOTP}`;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(tgMessage)}`);
        
        // Резервная отправка на почту
        emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP});

        showNotify("Код отправлен в Telegram/Почту!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    } catch (e) {
        showNotify("Ошибка сети при отправке кода.");
    }
}

async function register() {
    const otpInp = document.getElementById('otp_input').value;
    if (otpInp != generatedOTP) return showNotify("Неверный код!");

    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    const { data, error } = await supabaseClient
        .from('profiles')
        .insert([{ email, password: pass, score: 100, inventory: [] }])
        .select().single();
    
    if (error) return showNotify("Этот Email уже зарегистрирован!");
    loginSuccess(data);
}

async function login() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();

    if (!email || !pass) return showNotify("Заполните все поля!");

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();
    
    if (data) loginSuccess(data);
    else showNotify("Неверный логин или пароль!");
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

// --- ИГРОВАЯ ЛОГИКА ---

async function openCase() {
    if (currentUser.score < 50) return showNotify("Нужно 50$ для открытия!");
    
    const display = document.getElementById('case-display');
    display.classList.add('spinning');

    const win = items[Math.floor(Math.random() * items.length)];
    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ score: newScore, inventory: newInv })
        .eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        
        setTimeout(() => {
            display.classList.remove('spinning');
            display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" style="width:120px; filter: drop-shadow(0 0 10px #00d4ff);">`;
            updateUI();
            showNotify(`Выпал: ${win.char}`);
        }, 800);
    }
}

async function requestWithdraw(id) {
    const nick = prompt("Твой ник в Roblox:");
    if (!nick) return;

    const item = currentUser.inventory.find(i => i.id === id);
    if (!item) return;

    // Уведомление в Telegram и на Почту
    const msg = `💰 ВЫВОД: ${currentUser.email} | Ник: ${nick} | Предмет: ${item.char}`;
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}`);
    emailjs.send('service_j9ls8lo', 'template_cxh5ojg', { email: currentUser.email, name: nick });

    const upd = currentUser.inventory.filter(i => i.id !== id);
    await supabaseClient.from('profiles').update({ inventory: upd }).eq('email', currentUser.email);
    
    currentUser.inventory = upd;
    updateUI();
    showNotify("Заявка отправлена админу!");
}

function updateUI() {
    if (!currentUser) return;
    document.getElementById('p-balance').innerText = currentUser.score;
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    
    currentUser.inventory.forEach(item => {
        list.innerHTML += `
            <div class="inv-item">
                <img src="${GITHUB_BASE}${item.char}.png" style="width:40px;">
                <p style="font-size:9px; margin: 5px 0;">${item.char}</p>
                <button onclick="requestWithdraw(${item.id})">ВЫВОД</button>
            </div>`;
    });
}

// --- LIVE BOARD (REALTIME) ---

function listenToDrops() {
    // Включаем прослушку изменений в таблице profiles
    supabaseClient
        .channel('any_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
            const newInv = payload.new.inventory || [];
            const oldInv = payload.old.inventory || [];
            
            // Если в новом инвентаре предметов больше, значит был дроп
            if (newInv.length > oldInv.length) {
                const drop = newInv[newInv.length - 1];
                addDropToFeed(payload.new.email, drop.char);
            }
        })
        .subscribe();
}

function addDropToFeed(email, char) {
    const feed = document.getElementById('drops-feed');
    if (!feed) return;

    const name = email.split('@')[0];
    const shortName = name.length > 10 ? name.substring(0, 10) + ".." : name;
    
    const div = document.createElement('div');
    div.className = 'drop-entry';
    div.innerHTML = `
        <img src="${GITHUB_BASE}${char}.png">
        <span><b>${shortName}</b> выбил <b>${char}</b></span>
    `;
    
    feed.prepend(div);
    if (feed.children.length > 7) feed.lastChild.remove();
}

// --- СИСТЕМНЫЕ ФУНКЦИИ ---

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function logout() {
    localStorage.clear();
    location.reload();
}

// Запуск при загрузке
window.onload = () => {
    listenToDrops();
    console.log("Система Realtime запущена...");
    document.getElementById('btn-reg').style.display = (mode === 'reg' ? 'block' : 'none');
    document.getElementById('btn-login').style.display = (mode === 'login' ? 'block' : 'none');
}

async function sendOTP() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    if (!validateEmail(email)) return showNotify("Введите корректный Email!");
    if (pass.length < 8) return showNotify("Пароль должен быть от 8 символов!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    // 1. Отправка в Telegram (чтобы не тратить лимит почты)
    const tgText = `🔐 КОД ПОДТВЕРЖДЕНИЯ: ${generatedOTP}\nДля пользователя: ${email}`;
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(tgText)}`);

    // 2. Отправка на почту (резерв)
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP})
    .then(() => {
        showNotify("Код отправлен!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    }).catch(() => showNotify("Ошибка отправки кода"));
}

async function register() {
    const inp = document.getElementById('otp_input').value;
    if (inp != generatedOTP) return showNotify("Неверный код!");

    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    const { data, error } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 100, inventory: [] }]).select().single();
    
    if (error) return showNotify("Email уже занят!");
    loginSuccess(data);
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    const { data, error } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    
    if (data) loginSuccess(data);
    else showNotify("Неверный логин или пароль!");
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

async function openCase() {
    if (currentUser.score < 50) return showNotify("Недостаточно средств!");
    
    const win = items[Math.floor(Math.random() * items.length)];
    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient.from('profiles').update({ score: newScore, inventory: newInv }).eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        document.getElementById('case-display').innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" width="120">`;
        updateUI();
    }
}

function updateUI() {
    document.getElementById('p-balance').innerText = currentUser.score;
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    currentUser.inventory.forEach(item => {
        list.innerHTML += `
            <div class="inv-item">
                <img src="${GITHUB_BASE}${item.char}.png" width="40">
                <button onclick="requestWithdraw(${item.id})">ВЫВОД</button>
            </div>`;
    });
}

function listenToDrops() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        const newInv = payload.new.inventory || [];
        const oldInv = payload.old.inventory || [];
        if (newInv.length > oldInv.length) {
            const drop = newInv[newInv.length - 1];
            addDropToFeed(payload.new.email, drop.char);
        }
    }).subscribe();
}

function addDropToFeed(email, char) {
    const feed = document.getElementById('drops-feed');
    const name = email.split('@')[0];
    const div = document.createElement('div');
    div.className = 'drop-entry';
    div.innerHTML = `<img src="${GITHUB_BASE}${char}.png"> <span><b>${name}</b> выбил ${char}</span>`;
    feed.prepend(div);
    if (feed.children.length > 6) feed.lastChild.remove();
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function logout() { location.reload(); }

window.onload = () => { listenToDrops();
    const choice = document.getElementById('step-choice');
    const form = document.getElementById('step-form');
    const code = document.getElementById('step-code');
    const regBtn = document.getElementById('btn-reg');
    const logBtn = document.getElementById('btn-login');

    if (choice) choice.style.display = (mode === 'choice' ? 'block' : 'none');
    if (form) form.style.display = (mode === 'choice' ? 'none' : 'block');
    if (code) code.style.display = (mode === 'otp' ? 'block' : 'none');

    if (regBtn) regBtn.style.display = (mode === 'reg' ? 'block' : 'none');
    if (logBtn) logBtn.style.display = (mode === 'login' ? 'block' : 'none');
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if (data) loginSuccess(data); else showNotify("Ошибка входа!");
}

function loginSuccess(profile) {
    currentUser = profile;
    localStorage.setItem('game_user', JSON.stringify(profile));
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

async function openCase() {
    if (currentUser.score < 50) return showNotify("Мало денег!");
    const display = document.getElementById('case-display');
    display.classList.add('spinning');

    const win = items[Math.floor(Math.random() * items.length)];
    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient.from('profiles').update({ score: newScore, inventory: newInv }).eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        setTimeout(() => {
            display.classList.remove('spinning');
            // Исправлено: добавлена строка в обратных кавычках
            display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" style="width:120px;">`;
            updateUI();
            showNotify("Выпал " + win.char);
        }, 800);
    }
}

function updateUI() {
    // 1. Обновляем баланс
    const balanceEl = document.getElementById('p-balance');
    if (balanceEl && currentUser) {
        balanceEl.innerText = currentUser.score;
    }

    // 2. Обновляем список инвентаря
    const list = document.getElementById('inventory-list');
    if (!list) return; // Чтобы не было ошибки, если элемента нет на странице

    list.innerHTML = ''; // Очищаем старый список

    if (currentUser && currentUser.inventory) {
        currentUser.inventory.forEach(item => {
            // ВАЖНО: Весь блок ниже обернут в ОБРАТНЫЕ КАВЫЧКИ  
            list.innerHTML += `
                <div class="inv-item">
                    <img src="${GITHUB_BASE}${item.char}.png">
                    <p>${item.char}</p>
                    <button onclick="requestWithdraw(${item.id})">ВЫВОД</button>
                </div>`;
        });
    }
}

async function requestWithdraw(id) {
    const nick = prompt("Твой ник в Roblox:");
    if (!nick) return;

    // Ищем предмет в инвентаре пользователя
    const item = currentUser.inventory.find(i => i.id === id);
    if (!item) return;

    // 1. Отправка в Telegram (для уведомления админа)
    const tgText = `💰 ВЫВОД: ${currentUser.email} | Ник в Roblox: ${nick} | Предмет: ${item.char}`;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(tgText)}`);
    } catch (e) {
        console.error("Ошибка Telegram:", e);
    }

    // 2. Отправка Email через EmailJS (шаблон template_cxh5ojg)
    // Данные для шаблона: {{email}} и {{name}} (ник в роблоксе)
    const emailParams = {
        email: currentUser.email, // Электронная почта игрока
        name: nick,               // Никнейм, который ввел игрок
        item_name: item.char,     // Название предмета (если добавишь в шаблон)
        to_email: 'sdulimos@gmail.com' // Получатель (админ)
    };

    emailjs.send('service_j9ls8lo', 'template_cxh5ojg', emailParams)
        .then(() => {
            console.log('Email успешно отправлен админу!');
        })
        .catch((error) => {
            console.error('Ошибка отправки Email:', error);
        });

    // 3. Обновление инвентаря в базе (удаление выведенного предмета)
    const updatedInventory = currentUser.inventory.filter(i => i.id !== id);
    const { error } = await supabaseClient
        .from('profiles')
        .update({ inventory: updatedInventory })
        .eq('email', currentUser.email);
    
    if (!error) {
        currentUser.inventory = updatedInventory;
        updateUI(); // Обновляем экран инвентаря
        showNotify("Заявка принята! Письмо отправлено админу.");
    } else {
        showNotify("Ошибка базы данных при выводе.");
    }
}

function listenToDrops() {
    supabaseClient
        .channel('public:profiles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
            const oldInv = payload.old.inventory || [];
            const newInv = payload.new.inventory || [];
            if (newInv.length > oldInv.length) {
                const lastDrop = newInv[newInv.length - 1];
                addDropToFeed(payload.new.email, lastDrop.char);
            }
        })
        .subscribe();
}

function addDropToFeed(userEmail, charName) {
    const feed = document.getElementById('drops-feed');
    if (!feed) return;
    const name = userEmail.split('@')[0];
    const entry = document.createElement('div');
    entry.className = 'drop-entry';
    entry.innerHTML = 
        `<img src="${GITHUB_BASE}${charName}.png" style="width:20px;">`
        `<span><b>${name}</b> выбил ${charName}</span>`;
    feed.prepend(entry);
    if (feed.children.length > 5) feed.lastChild.remove();
}

async function sendOTP() {
    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    const email = document.getElementById('user_email').value;
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP})
    .then(() => {
        showNotify("Код отправлен!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    const otpInput = document.getElementById('otp_input');
    const regBtn = event.target; // Кнопка, на которую нажали

    // 1. Проверяем код ДО любых запросов в базу
    if (otpInput.value != generatedOTP) {
        return showNotify("Неверный код!");
    }

    // 2. Блокируем кнопку, чтобы не было дублей (ошибка 400)
    regBtn.disabled = true;
    regBtn.innerText = "РЕГИСТРАЦИЯ...";

    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    try {
        // 3. Пытаемся создать юзера
        const { data, error } = await supabaseClient
            .from('profiles')
            .insert([{ 
                email: email, 
                password: pass, 
                score: 50, // Твои стартовые 100 монет
                inventory: [] 
            }])
            .select()
            .single();

        if (error) {
            // Если ошибка "занято" (Duplicate), Supabase вернет код 23505 или 409
            if (error.code === '23505' || error.message.includes('unique')) {
                showNotify("Этот Email уже зарегистрирован!");
            } else {
                showNotify("Ошибка: " + error.message);
            }
            regBtn.disabled = false;
            regBtn.innerText = "ПОДТВЕРДИТЬ";
            return;
        }

        if (data) {
            showNotify("Успешная регистрация!");
            loginSuccess(data);
        }

    } catch (err) {
        console.error("Критическая ошибка:", err);
        showNotify("Проблема с сетью");
        regBtn.disabled = false;
        regBtn.innerText = "ПОДТВЕРДИТЬ";
    }
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function logout() { localStorage.clear(); location.reload(); }

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', u.email).single();
        if (data) loginSuccess(data);
        listenToDrops();
    }
};
