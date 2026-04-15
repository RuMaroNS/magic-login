const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const TG_CHAT_ID = '6176762600';
const EJS_KEY = 'gTrqvbOiCTqlJcDNJ';
const GITHUB_BASE = "https://raw.githubusercontent.com/marons/magic-login/main/Drops/";

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
let currentUser = null;

const items = [
    {char: 'TacoBlock', price: 10, chance: 0.122},
    {char: 'AdminBlock', price: 10, chance: 0.122},
    {char: 'SecretBlock', price: 89, chance: 0.0415},
    {char: 'LosTacoBlocks', price: 67, chance: 0.055},
    {char: 'LosAdminBlocks', price: 67, chance: 0.055}
];

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', u.email).eq('password', u.password).single();
        if (data) loginSuccess(data);
    }
};

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if (data) {
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    } else {
        showNotify("Ошибка входа!");
    }
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

async function openCase() {
    if (currentUser.score < 50) return showNotify("Мало денег!");
    const display = document.getElementById('case-display');
    display.classList.add('spinning');

    let rand = Math.random();
    let cumulative = 0;
    let win = items[0];
    for (let i of items) {
        cumulative += i.chance;
        if (rand < cumulative) { win = i; break; }
    }

    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient.from('profiles').update({ score: newScore, inventory: newInv }).eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        setTimeout(() => {
            display.classList.remove('spinning');
            display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png" width="120">`;
            updateUI();
            showNotify("Выпал предмет! Проверь профиль.");
            addLive(win.char);
        }, 800);
    }
}

function addLive(name) {
    const lb = document.getElementById('live-board');
    const e = document.createElement('div');
    e.className = 'live-entry';
    e.innerHTML = `🔥 Кто-то выбил <b>${name}</b>`;
    lb.prepend(e);
    if(lb.children.length > 2) lb.lastChild.remove();
}

async function requestWithdraw(id) {
    const nick = prompt("Введи свой никнейм для вывода:");
    if(!nick) return;

    const item = currentUser.inventory.find(i => i.id === id);
    const text = `💰 ЗАЯВКА НА ВЫВОД\nПочта: ${currentUser.email}\nНик: ${nick}\nПредмет: ${item.char}`;
    
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(text)}`);
    
    const updatedInv = currentUser.inventory.filter(i => i.id !== id);
    await supabaseClient.from('profiles').update({ inventory: updatedInv }).eq('email', currentUser.email);
    
    currentUser.inventory = updatedInv;
    updateUI();
    showNotify("Заявка ушла админу!");
}

function updateUI() {
    document.getElementById('p-balance').innerText = currentUser.score;
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    if (currentUser.inventory) {
        currentUser.inventory.forEach(i => {
            list.innerHTML += `
                <div class="inv-item">
                    <img src="${GITHUB_BASE}${i.char}.png">
                    <div style="font-size:10px;">${i.char}</div>
                    <button onclick="requestWithdraw(${i.id})">Вывод</button>
                </div>`;
        });
    }
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function showAuth(m) {
    document.getElementById('step-choice').style.display = m === 'choice' ? 'block' : 'none';
    document.getElementById('step-form').style.display = m === 'choice' ? 'none' : 'block';
}

function logout() { localStorage.clear(); location.reload(); }
window.onload = async () => {
    const savedUser = localStorage.getItem('game_user');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            const { data } = await supabaseClient.from('profiles').select('*').eq('email', userData.email).eq('password', userData.password).single();
            if (data) loginSuccess(data);
        } catch (e) { console.log("Кеш пуст"); }
    }
};

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice') ? 'block' : 'none';
    document.getElementById('step-form').style.display = (mode === 'choice') ? 'none' : 'block';
    document.getElementById('step-code').style.display = 'none';
    if(mode !== 'choice') {
        document.getElementById('auth-title').innerText = (mode === 'reg') ? "Регистрация" : "Вход";
        document.getElementById('btn-reg').style.display = (mode === 'reg') ? 'block' : 'none';
        document.getElementById('btn-login').style.display = (mode === 'login') ? 'block' : 'none';
    }
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if (data) {
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    } else {
        showNotify("Ошибка входа!");
    }
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
    showNotify("С возвращением!");
}

function logout() {
    localStorage.removeItem('game_user');
    location.reload();
}

async function openCase() {
    if (currentUser.score < 50) return showNotify("Нужно 50$!");
    
    const display = document.getElementById('case-display');
    display.classList.add('spinning');
    
    let rand = Math.random();
    let cumulative = 0;
    let win = items[0];

    for (let item of items) {
        cumulative += item.chance;
        if (rand < cumulative) { win = item; break; }
    }

    currentUser.score = currentUser.score - 50 + win.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('email', currentUser.email);
    
    setTimeout(() => {
        display.classList.remove('spinning');
        // Формируем прямую ссылку на картинку в GitHub
        const fullPath = GITHUB_BASE + win.char + ".png";
        display.innerHTML = '<img src="' + fullPath + '" style="width:100px; height:100px; object-fit:contain;">';
        updateUI();
        showNotify("Выпало: " + win.char + "! Цена: " + win.price + "$");
    }, 800);
}

async function sendSupport() {
    const msg = document.getElementById('support-msg').value;
    if (!msg) return showNotify("Напиши текст!");
    const text = "⚠️ ПОДДЕРЖКА\nЮзер: " + currentUser.email + "\nСообщение: " + msg;
    
    const url = "https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage?chat_id=" + TG_CHAT_ID + "&text=" + encodeURIComponent(text);
    
    await fetch(url);
    showNotify("Отправлено админу!");
    document.getElementById('support-msg').value = "";
}

function updateUI() {
    document.getElementById('p-email').innerText = currentUser.email;
    document.getElementById('p-balance').innerText = currentUser.score;
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
}

async function sendOTP() {
    const email = document.getElementById('user_email').value;
    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP})
    .then(() => {
        showNotify("Код отправлен!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    if (document.getElementById('otp_input').value == generatedOTP) {
        const email = document.getElementById('user_email').value;
        const pass = document.getElementById('user_password').value;
        const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 100, level: 1 }]).select().single();
        if (data) {
            localStorage.setItem('game_user', JSON.stringify(data));
            loginSuccess(data);
        }
    } else {
        showNotify("Неверный код!");
    }
}
