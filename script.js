const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const GITHUB_BASE = "https://raw.githubusercontent.com/RuMaroNs/magic-login/main/img/";
const TG_TOKEN = '8503277013:AAHK1uBNYc4f8zhchfXdPxwFBJ-eExGONvw'; 
const TG_CHAT_ID = '6176762600';

let currentUser = null;
const SELL_COMMISSION = 0.20; 
let isSpinning = false;

window.onload = () => { autoLogin(); };
// Создаем один общий канал для всех
const liveChannel = supabaseClient.channel('live-drops');

window.onload = () => { 
    autoLogin(); 
    initGlobalRealtime(); // Запускаем прослушку сразу
};

// ФУНКЦИЯ УВЕДОМЛЕНИЙ
function showNotify(text) {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerText = text;
    container.appendChild(n);
    
    // Плавное появление
    setTimeout(() => n.classList.add('show'), 10);
    
    // Плавное удаление через 3 секунды
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 500); // Удаляем из DOM после анимации
    }, 3000);
}

// ФИКС: Слушаем сигналы от других игроков
function initGlobalRealtime() {
    liveChannel
    .on('broadcast', { event: 'new-drop' }, (payload) => {
        // Когда кто-то другой выбил предмет, добавляем его в лайв-борд
        addToLiveBoard(payload.payload.user, payload.payload.item);
    })
    .subscribe();
}

async function autoLogin() {
const savedId = localStorage.getItem('game_user_id');
if (savedId) {
@@ -39,55 +52,38 @@
currentUser = null;
document.getElementById('game-interface').style.display = 'none';
document.getElementById('auth-screen').style.display = 'flex';
    showNotify("Вы вышли из системы");
    showNotify("Вы вышли");
}

async function login() {
const user = document.getElementById('user_name').value.trim();
const pass = document.getElementById('user_password').value;
    if (!user || !pass) return showNotify("Введите данные!");

const { data } = await supabaseClient.from('profiles').select('*').eq('username', user).eq('password', pass).single();
if(data) {
currentUser = data;
localStorage.setItem('game_user_id', data.id);
enterGame();
        showNotify(`С возвращением, ${user}!`);
    } else showNotify("Неверный логин или пароль!");
        showNotify(`Привет, ${user}!`);
    } else showNotify("Ошибка входа!");
}

async function register() {
const user = document.getElementById('user_name').value.trim();
const pass = document.getElementById('user_password').value;
    if (!user || !pass) return showNotify("Заполните поля!");

const { data, error } = await supabaseClient.from('profiles').insert([{ username: user, password: pass, score: 50, inventory: [] }]).select().single();
    if (error) return showNotify("Никнейм уже занят!");
    
    showNotify("Аккаунт создан!");
    if (error) return showNotify("Ник занят!");
login();
}

function enterGame() {
document.getElementById('auth-screen').style.display = 'none';
document.getElementById('game-interface').style.display = 'block';
navTo('cases');
    initRealtime();
}

function initRealtime() {
    supabaseClient.channel('any').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const oldInv = p.old?.inventory || [];
        const newInv = p.new?.inventory || [];
        if (newInv.length > oldInv.length) {
            addToLiveBoard(p.new.username, newInv[newInv.length - 1].char);
        }
    }).subscribe();
}

async function openRoulette(caseId) {
    if (isSpinning) return; // Если уже крутим — выходим (Кулдаун)
    
    const { data: cData } = await supabaseClient.from('cases_meta').select('*').eq('id', caseId).single();
    if (currentUser.score < cData.price) {
        showNotify("Недостаточно монет!");
        return;
    }

    isSpinning = true; // Включаем блокировку
    currentUser.score -= cData.price;
    await supabaseClient.from('profiles').update({ score: currentUser.score }).eq('id', currentUser.id);

    navTo('opening');
    
    // ... (Тут твой код отрисовки ленты рулетки) ...

    const win = cData.loot[Math.floor(Math.random() * cData.loot.length)];
    
    // Таймер завершения анимации
    setTimeout(async () => {
        // ... (Твой код сохранения в БД и показа окна выигрыша) ...
        
        showNotify(`Вы выбили: ${win.name}`);
        isSpinning = false; // Выключаем блокировку после завершения
    }, 5500);
}

async function withdrawItem(id) {
    const nick = prompt("Введите ваш ник в Roblox для получения:");
    const nick = prompt("Ник в Roblox:");
if (!nick) return;
    
const item = currentUser.inventory.find(x => x.id === id);
    if (!item || item.status === 'processing') return;

item.status = 'processing';
await supabaseClient.from('profiles').update({ inventory: currentUser.inventory }).eq('id', currentUser.id);
renderProfile();
    
    showNotify("Заявка на вывод отправлена!");

    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TG_CHAT_ID,
            text: `🚀 **ЗАЯВКА НА ВЫВОД**\n👤 Игрок: ${currentUser.username}\n🎮 Roblox: ${nick}\n📦 Предмет: ${item.char}`,
            parse_mode: 'Markdown'
        })
    }).catch(() => showNotify("Ошибка отправки в ТГ!"));
    showNotify("Заявка отправлена!");
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent('Вывод: ' + nick + ' Предмет: ' + item.char)}`);
}

function navTo(pageId) {
document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('win-display').style.display = 'none';
if(pageId === 'profile') renderProfile();
if(pageId === 'cases') renderCases();
window.scrollTo(0,0);
@@ -184,29 +177,23 @@
async function renderProfile() {
const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
if (data) currentUser = data;

document.getElementById('p-username').innerText = currentUser.username;
document.getElementById('p-balance').innerText = currentUser.score;

const invList = document.getElementById('inventory-list');
if (!currentUser.inventory || currentUser.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center; width:100%;">ВАШ ИНВЕНТАРЬ ПУСТ</div>';
        invList.innerHTML = '<div style="color:#5a5a7a; padding:40px; text-align:center; width:100%;">ПУСТО</div>';
return;
}

    invList.innerHTML = currentUser.inventory.map(i => {
        const isP = i.status === 'processing';
        return `
            <div class="inv-item ${isP ? 'processing' : ''}">
                ${isP ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
                <img src="${GITHUB_BASE}${i.char}.png">
                <p>${i.char}</p>
                <div class="inv-btns">
                    <button class="withdraw-btn" ${isP ? 'disabled' : ''} onclick="withdrawItem(${i.id})">ВЫВОД</button>
                    <button class="withdraw-btn sell-btn" ${isP ? 'disabled' : ''} onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
                </div>
            </div>`;
    }).reverse().join('');
    invList.innerHTML = currentUser.inventory.map(i => `
        <div class="inv-item ${i.status === 'processing' ? 'processing' : ''}">
            ${i.status === 'processing' ? '<div class="overlay">В ОБРАБОТКЕ</div>' : ''}
            <img src="${GITHUB_BASE}${i.char}.png">
            <p>${i.char}</p>
            <div class="inv-btns">
                <button class="withdraw-btn" onclick="withdrawItem(${i.id})">ВЫВОД</button>
                <button class="withdraw-btn sell-btn" onclick="sellItem(${i.id}, '${i.char}')">ПРОДАТЬ</button>
            </div>
        </div>`).reverse().join('');
}

function addToLiveBoard(user, item) {
@@ -215,7 +202,7 @@
card.className = 'drop-card';
card.innerHTML = `<img src="${GITHUB_BASE}${item}.png"><div><div style="font-size:10px;color:#5a5a7a">${user}</div><div style="font-size:12px">${item}</div></div>`;
board.prepend(card);
    if (board.children.length > 15) board.lastChild.remove();
    if (board.children.length > 15) board.lastElementChild.remove();
}

function switchAuthMode(mode) {
