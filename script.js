const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_KEY = 'gTrqvbOiCTqlJcDNJ';
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const TG_CHAT_ID = '6176762600';
const GITHUB_BASE = "https://raw.githubusercontent.com/marons/magic-login/main/Drops/";

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

function showNotify(text) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice') ? 'block' : 'none';
    document.getElementById('step-form').style.display = (mode === 'choice') ? 'none' : 'block';
    document.getElementById('step-code').style.display = 'none';
    document.getElementById('btn-reg').style.display = (mode === 'reg') ? 'block' : 'none';
    document.getElementById('btn-login').style.display = (mode === 'login') ? 'block' : 'none';
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    if (data) loginSuccess(data); else showNotify("Ошибка!");
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    localStorage.setItem('game_user', JSON.stringify(profile));
    updateUI();
}

async function openCase() {
    if (currentUser.score < 50) return showNotify("Нет денег!");
    const display = document.getElementById('case-display');
    display.classList.add('spinning');
    
    let win = items[Math.floor(Math.random() * items.length)];
    const newInv = [...(currentUser.inventory || []), { ...win, id: Date.now() }];
    const newScore = currentUser.score - 50;

    const { error } = await supabaseClient.from('profiles').update({ score: newScore, inventory: newInv }).eq('email', currentUser.email);
    if (!error) {
        currentUser.score = newScore;
        currentUser.inventory = newInv;
        setTimeout(() => {
            display.classList.remove('spinning');
            display.innerHTML = <img src="${GITHUB_BASE}${win.char}.png">;
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
        currentUser.inventory.forEach(i => {
            list.innerHTML += <div class="inv-item">
                <img src="${GITHUB_BASE}${i.char}.png">
                <p style="font-size:10px;">${i.char}</p>
                <button onclick="requestWithdraw(${i.id})" style="background:#2ecc71; border:none; color:white; font-size:9px; padding:3px; cursor:pointer; width:100%; border-radius:4px;">ВЫВОД</button>
            </div>;
        });
    }
}

async function requestWithdraw(id) {
    const nick = prompt("Ник в Roblox:");
    if(!nick) return;
    const item = currentUser.inventory.find(i => i.id === id);
    await fetch(https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent("ВЫВОД: " + nick + " - " + item.char)});
    const upd = currentUser.inventory.filter(i => i.id !== id);
    await supabaseClient.from('profiles').update({ inventory: upd }).eq('email', currentUser.email);
    currentUser.inventory = upd;
    updateUI();
    showNotify("Отправлено!");
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    document.getElementById('tab-' + t).style.display = 'block';
}

async function sendOTP() {
    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: document.getElementById('user_email').value, passcode: generatedOTP})
    .then(() => {
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    if (document.getElementById('otp_input').value == generatedOTP) {
        const { data } = await supabaseClient.from('profiles').insert([{ email: document.getElementById('user_email').value, password: document.getElementById('user_password').value, score: 100, inventory: [] }]).select().single();
        if (data) loginSuccess(data);
    }
}

async function sendSupport() {
    await fetch(https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent("Support: " + document.getElementById('support-msg').value)});
    showNotify("Отправлено!");
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
