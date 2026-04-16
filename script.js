const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_KEY = 'gTrqvbOiCTqlJcDNJ';
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const TG_CHAT_ID = '6176762600';
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
emailjs.init(EJS_KEY);

let currentUser = null;
let generatedOTP;

const items = [
    {char: 'TacoBlock', price: 10, chance: 0.122},
    {char: 'AdminBlock', price: 10, chance: 0.122},
    {char: 'SecretBlock', price: 89, chance: 0.0415},
    {char: 'LosTacoBlocks', price: 67, chance: 0.055},
    {char: 'LosAdminBlocks', price: 67, chance: 0.055}
];

// --- ВАЛИДАЦИЯ И БЕЗОПАСНОСТЬ ---

function validateFields() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();
    
    if (!email || !pass) {
        showNotify("ЗАПОЛНИ ВСЕ ПОЛЯ!");
        return false;
    }
    if (pass.length < 8) {
        showNotify("ПАРОЛЬ МИНИМУМ 8 СИМВОЛОВ!");
        return false;
    }
    return { email, pass };
}

async function punishUser(profile) {
    showNotify("ОШИБКА ДАННЫХ. ПРОФИЛЬ УДАЛЕН.");
    await supabaseClient.from('profiles').delete().eq('id', profile.id);
    logout();
}

// --- ЛЕНТА ДРОПОВ (LIVE FEED) ---

function addToLiveFeed(username, itemName) {
    const feed = document.getElementById('global-live-feed');
    if (!feed) return;

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
        <img src="${GITHUB_BASE}${itemName}.png" onerror="this.src='https://via.placeholder.com/50'">
        <div class="feed-info">
            <span class="feed-user">${username}</span>
            <span class="feed-item">${itemName}</span>
        </div>
    `;

    feed.prepend(card);

    // Удаление через 60 секунд
    setTimeout(() => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(-20px)';
        card.style.transition = '0.5s';
        setTimeout(() => card.remove(), 500);
    }, 60000);
}

function initRealtime() {
    supabaseClient
        .channel('global-drops')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
            const newInv = payload.new.inventory;
            const oldInv = payload.old.inventory;
            if (newInv && newInv.length > (oldInv ? oldInv.length : 0)) {
                const lastItem = newInv[newInv.length - 1];
                const userNick = payload.new.email.split('@')[0];
                addToLiveFeed(userNick, lastItem.char);
            }
        })
        .subscribe();
}

// --- СИСТЕМА АВТОРИЗАЦИИ ---

async function login() {
    const fields = validateFields();
    if (!fields) return;

    const { data, error } = await supabaseClient.from('profiles')
        .select('*')
        .eq('email', fields.email)
        .eq('password', fields.pass)
        .single();
    
    if (data) {
        if (!data.email || !data.password) return punishUser(data);
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    } else {
        showNotify("НЕВЕРНЫЙ ЛОГИН ИЛИ ПАРОЛЬ!");
    }
}

async function sendOTP() {
    const fields = validateFields();
    if (!fields) return;

    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: fields.email, passcode: generatedOTP})
    .then(() => {
        showNotify("КОД ОТПРАВЛЕН!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    const otp = document.getElementById('otp_input').value;
    const fields = validateFields();
    if (otp == generatedOTP) {
        const { data, error } = await supabaseClient.from('profiles').insert([{ 
            email: fields.email, 
            password: fields.pass, 
            score: 100, 
            inventory: [] 
        }]).select().single();
        
        if (data) loginSuccess(data);
    } else {
        showNotify("НЕВЕРНЫЙ КОД!");
    }
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
    initRealtime();
    showNotify("С ВОЗВРАЩЕНИЕМ!");
}

// --- ИГРОВАЯ ЛОГИКА ---

async function openCase() {
    if (!currentUser || currentUser.score < 50) return showNotify("НУЖНО 50$!");
    
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

    const { error } = await supabaseClient.from('profiles')
        .update({ score: newScore, inventory: newInv })
        .eq('email', currentUser.email);
    
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        setTimeout(() => {
            display.classList.remove('spinning');
            display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;
            updateUI();
            showNotify(`ВЫПАЛ ${win.char}!`);
        }, 800);
    }
}

function updateUI() {
    const balanceEl = document.getElementById('p-balance');
    const listEl = document.getElementById('inventory-list');
    
    if (balanceEl) balanceEl.innerText = currentUser.score;
    if (listEl) {
        listEl.innerHTML = '';
        (currentUser.inventory || []).forEach(i => {
            listEl.innerHTML += `
                <div class="inv-item">
                    <img src="${GITHUB_BASE}${i.char}.png">
                    <p>${i.char}</p>
                </div>`;
        });
    }
}

// --- ВСПОМОГАТЕЛЬНОЕ ---

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
    }, 3000);
}

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice' ? 'block' : 'none');
    document.getElementById('step-form').style.display = (mode === 'choice' ? 'none' : 'block');
    document.getElementById('step-code').style.display = (mode === 'otp' ? 'block' : 'none');
    
    const bReg = document.getElementById('btn-reg');
    const bLog = document.getElementById('btn-login');
    if(mode === 'reg') { bReg.style.display = 'block'; bLog.style.display = 'none'; }
    if(mode === 'login') { bReg.style.display = 'none'; bLog.style.display = 'block'; }
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

function logout() {
    localStorage.clear();
    location.reload();
}

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles')
            .select('*').eq('email', u.email).eq('password', u.password).single();
        if (data) loginSuccess(data);
    }
};
