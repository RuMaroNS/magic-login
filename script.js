// НАСТРОЙКИ
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_KEY = 'gTrqvbOiCTqlJcDNJ';
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw';
const TG_CHAT_ID = '6176762600';

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
emailjs.init(EJS_KEY);

let currentUser = null;
let generatedOTP;

// ЭМОДЗИ И ШАНСЫ (0.5 = 50%, 0.01 = 1%)
const items = [
    {char: '💩', price: 1, chance: 0.4},
    {char: '💀', price: 10, chance: 0.2},
    {char: '😎', price: 60, chance: 0.15},
    {char: '⚡', price: 200, chance: 0.05},
    {char: '🔥', price: 500, chance: 0.02},
    {char: '❤️‍🔥', price: 1000, chance: 0.01}
];

// ПРОВЕРКА КЕША ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
window.onload = async () => {
    const savedUser = localStorage.getItem('game_user');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        // Проверяем актуальность данных в базе
        const { data } = await supabaseClient.from('profiles').select('*').eq('email', userData.email).eq('password', userData.password).single();
        if (data) {
            loginSuccess(data);
        }
    }
};

function showAuth(mode) {
    document.getElementById('step-choice').style.display = (mode === 'choice') ? 'block' : 'none';
    document.getElementById('step-form').style.display = (mode === 'choice') ? 'none' : 'block';
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
        localStorage.setItem('game_user', JSON.stringify(data)); // СОХРАНЯЕМ В КЕШ
        loginSuccess(data);
    } else {
        alert("Неверные данные!");
    }
}

function loginSuccess(profile) {
    currentUser = profile;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    updateUI();
}

function logout() {
    localStorage.removeItem('game_user'); // ЧИСТИМ КЕШ
    location.reload();
}

// СИМУЛЯТОР КЕЙСОВ
async function openCase() {
    if (currentUser.score < 50) return alert("Нужно минимум 50$!");
    
    const display = document.getElementById('case-display');
    display.style.transform = "scale(1.5) rotate(20deg)";
    
    let rand = Math.random();
    let cumulative = 0;
    let win = items[0];

    for (let item of items) {
        cumulative += item.chance;
        if (rand < cumulative) { win = item; break; }
    }

    // Обновляем баланс
    currentUser.score = currentUser.score - 50 + win.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('email', currentUser.email);
    
    setTimeout(() => {
        display.style.transform = "scale(1) rotate(0deg)";
        display.innerText = win.char;
        updateUI();
        alert(Выпало: ${win.char}! Цена: ${win.price}$);
    }, 500);
}

// ПОДДЕРЖКА В ТЕЛЕГРАМ
async function sendSupport() {
    const msg = document.getElementById('support-msg').value;
    if (!msg) return;
    const text = ⚠️ ПОДДЕРЖКА\nЮзер: ${currentUser.email}\nСообщение: ${msg};
    await fetch(https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(text)});
    alert("Сообщение отправлено админу!");
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

// Регистрация и отправка OTP (используй функции из прошлого шага)
async function sendOTP() {
    const email = document.getElementById('user_email').value;
    generatedOTP = Math.floor(1000 + Math.random() * 9000);
    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', {to_email: email, passcode: generatedOTP})
    .then(() => {
        alert("Код на почте!");
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-code').style.display = 'block';
    });
}

async function register() {
    if (document.getElementById('otp_input').value == generatedOTP) {
        const email = document.getElementById('user_email').value;
        const pass = document.getElementById('user_password').value;
        const { data } = await supabaseClient.from('profiles').insert([{ email, password: pass, score: 100, level: 1 }]).select().single();
        localStorage.setItem('game_user', JSON.stringify(data));
        loginSuccess(data);
    }
}
