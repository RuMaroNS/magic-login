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
    {char: 'SecretBlock', price: 89, chance: 0.90},
    {char: 'LosTacoBlocks', price: 67, chance: 0.108},
    {char: 'LosAdminBlocks', price: 67, chance: 0.108}
];

function showNotify(text) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}

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
            display.innerHTML = <img src="${GITHUB_BASE}${win.char}.png" style="width:120px;">;
            updateUI();
            showNotify("Выпал " + win.char);
        }, 800);
    }
}

function updateUI() {
    document.getElementById('p-balance').innerText = currentUser.score;
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    if (currentUser.inventory) {
        currentUser.inventory.forEach(item => {
            list.innerHTML += 
                <div class="inv-item">
                    <img src="${GITHUB_BASE}${item.char}.png">
                    <p>${item.char}</p>
                    <button onclick="requestWithdraw(${item.id})">ВЫВОД</button>
                </div>;
        });
    }
}

async function requestWithdraw(id) {
    const nick = prompt("Твой ник в Roblox:");
    if (!nick) return;
    const item = currentUser.inventory.find(i => i.id === id);
    const text = 💰 ВЫВОД: ${currentUser.email} | Ник: ${nick} | Предмет: ${item.char};
    await fetch(https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(text)});
    
    const upd = currentUser.inventory.filter(i => i.id !== id);
    await supabaseClient.from('profiles').update({ inventory: upd }).eq('email', currentUser.email);
    currentUser.inventory = upd;
    updateUI();
    showNotify("Заявка у админа!");
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
    if (document.getElementById('otp_input').value == generatedOTP) {
        const email = document.getElementById('user_email').value;
        const pass = document.getElementById('user_password').value;
        const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 100, inventory: [] }]).select().single();
        if (data) loginSuccess(data);
    } else showNotify("Неверный код!");
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
    }
};
