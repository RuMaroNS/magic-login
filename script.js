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

function showNotify(text) {
    const container = document.getElementById('notification-container');
    if(!container) return;
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

function showAuth(mode) {
    const ids = ['step-choice', 'step-form', 'step-code', 'btn-reg', 'btn-login'];
    const els = {};
    ids.forEach(id => els[id] = document.getElementById(id));

    if(els['step-choice']) els['step-choice'].style.display = (mode === 'choice' ? 'block' : 'none');
    if(els['step-form']) els['step-form'].style.display = (mode === 'choice' ? 'none' : 'block');
    if(els['step-code']) els['step-code'].style.display = (mode === 'otp' ? 'block' : 'none');

    if(mode === 'reg') {
        if(els['btn-reg']) els['btn-reg'].style.display = 'block';
        if(els['btn-login']) els['btn-login'].style.display = 'none';
    } else if(mode === 'login') {
        if(els['btn-reg']) els['btn-reg'].style.display = 'none';
        if(els['btn-login']) els['btn-login'].style.display = 'block';
    }
}

async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('email', email).eq('password', pass).single();
    
    if (data) {
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    } else {
        showNotify("Ошибка входа!");
    }
}

function loginSuccess(profile) {
    currentUser = profile;
    const authCont = document.getElementById('auth-container');
    const gameUI = document.getElementById('game-ui');
    if(authCont) authCont.style.display = 'none';
    if(gameUI) gameUI.style.display = 'block';
    updateUI();
}

async function openCase() {
    if (!currentUser || currentUser.score < 50) return showNotify("Нужно 50$!");
    
    const display = document.getElementById('case-display');
    if(display) display.classList.add('spinning');
    
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
            if(display) {
                display.classList.remove('spinning');
                display.innerHTML = `<img src="${GITHUB_BASE}${win.char}.png">`;
            }
            updateUI();
            showNotify(`Выпал ${win.char}!`);
        }, 800);
    }
}

function updateUI() {
    const balanceEl = document.getElementById('p-balance');
    const listEl = document.getElementById('inventory-list');
    
    if (balanceEl) balanceEl.innerText = currentUser.score;
    
    if (listEl) {
        listEl.innerHTML = ''; // Очистка списка
        if (currentUser.inventory) {
            currentUser.inventory.forEach(i => {
                listEl.innerHTML += `
                    <div class="inv-item">
                        <img src="${GITHUB_BASE}${i.char}.png">
                        <p style="font-size:10px; margin:5px 0;">${i.char}</p>
                        <button onclick="requestWithdraw(${i.id})" style="background:#2ecc71; color:white; border:none; padding:4px; border-radius:4px; cursor:pointer; width:100%; font-size:10px;">ВЫВОД</button>
                    </div>`;
            });
        }
    }
}

async function requestWithdraw(id) {
    const nick = prompt("Твой ник в Roblox:");
    if(!nick) return;
    const item = currentUser.inventory.find(i => i.id === id);
    const text = `💰 ВЫВОД\nЮзер: ${currentUser.email}\nНик: ${nick}\nДроп: ${item.char}`;
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(text)}`);
    
    const updated = currentUser.inventory.filter(i => i.id !== id);
    await supabaseClient.from('profiles').update({ inventory: updated }).eq('email', currentUser.email);
    currentUser.inventory = updated;
    updateUI();
    showNotify("Заявка у админа!");
}

async function sendOTP() {
    const email = document.getElementById('user_email').value;
    if(!email) return showNotify("Введи Email!");
    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP})
    .then(() => {
        showNotify("Код на почте!");
        const form = document.getElementById('step-form');
        const code = document.getElementById('step-code');
        if(form) form.style.display = 'none';
        if(code) code.style.display = 'block';
    });
}

async function register() {
    const otp = document.getElementById('otp_input').value;
    if (otp == generatedOTP) {
        const email = document.getElementById('user_email').value;
        const pass = document.getElementById('user_password').value;
        const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 100, inventory: [] }]).select().single();
        if (data) loginSuccess(data);
    } else {
        showNotify("Неверный код!");
    }
}

function switchTab(t) {
    document.querySelectorAll('.tab').forEach(x => x.style.display = 'none');
    const target = document.getElementById('tab-' + t);
    if(target) target.style.display = 'block';
}

function logout() { localStorage.clear(); location.reload(); }

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', u.email).eq('password', u.password).single();
        if (data) loginSuccess(data);
    }
};
