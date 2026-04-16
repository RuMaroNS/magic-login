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

// Проверка полей
function validateFields() {
    const email = document.getElementById('user_email').value.trim();
    const pass = document.getElementById('user_password').value.trim();
    if (!email || !pass) {
        showNotify("Email и пароль не могут быть пустыми!");
        return false;
    }
    return { email, pass };
}

async function login() {
    const fields = validateFields();
    if (!fields) return;

    const { data, error } = await supabaseClient.from('profiles')
        .select('*')
        .eq('email', fields.email)
        .eq('password', fields.pass)
        .single();
    
    if (data) {
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    } else {
        showNotify("Ошибка входа! Проверьте данные.");
    }
}

function loginSuccess(profile) {
    // Вторая проверка: если в профиле пустые данные (защита базы)
    if (!profile.email || !profile.password || profile.email.trim() === "" || profile.password.trim() === "") {
        punishUser(profile.email);
        return;
    }

    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
    initRealtime();
}

async function punishUser(email) {
    showNotify("КРИТИЧЕСКАЯ ОШИБКА ДАННЫХ. АККАУНТ УДАЛЕН.");
    await supabaseClient.from('profiles').delete().eq('email', email);
    logout();
}

// LiveBoard Логика
function initRealtime() {
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
            const newInv = payload.new.inventory;
            const oldInv = payload.old.inventory;
            if (newInv && newInv.length > (oldInv ? oldInv.length : 0)) {
                const lastItem = newInv[newInv.length - 1];
                const userEmail = payload.new.email.split('@')[0];
                document.getElementById('live-text').innerHTML = 
                    `<span style="color:#00d4ff">${userEmail}</span> выбил <span style="color:#2ecc71">${lastItem.char}</span>!`;
            }
        })
        .subscribe();
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
    document.getElementById('p-balance').innerText = currentUser.score;
    const listEl = document.getElementById('inventory-list');
    listEl.innerHTML = '';
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

async function sendOTP() {
    const fields = validateFields();
    if (!fields) return;

    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: fields.email, passcode: generatedOTP})
    .then(() => {
        showNotify("Код на почте!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    const otp = document.getElementById('otp_input').value;
    const fields = validateFields();
    if (otp == generatedOTP) {
        const { data } = await supabaseClient.from('profiles').insert([{ 
            email: fields.email, 
            password: fields.pass, 
            score: 100, 
            inventory: [] 
        }]).select().single();
        if (data) loginSuccess(data);
    } else {
        showNotify("Неверный код!");
    }
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

function logout() { localStorage.clear(); location.reload(); }

window.onload = async () => {
    const saved = localStorage.getItem('game_user');
    if (saved) {
        const u = JSON.parse(saved);
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', u.email).eq('password', u.password).single();
        if (data) loginSuccess(data);
    }
};
