// 1. КОНФИГ (Замени только значения, если они другие)
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_PUBLIC_KEY = 'gTrqvbOiCTqlJcDNJ';

// Инициализация
emailjs.init(EJS_PUBLIC_KEY);
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let generatedOTP;
let currentMode = '';

// ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ОКОН
function showAuth(mode) {
    currentMode = mode;
    document.getElementById('step-choice').style.display = 'none';
    document.getElementById('step-form').style.display = 'none';
    document.getElementById('step-code').style.display = 'none';

    if (mode === 'choice') {
        document.getElementById('step-choice').style.display = 'block';
    } else {
        document.getElementById('step-form').style.display = 'block';
        if (mode === 'reg') {
            document.getElementById('auth-title').innerText = "Регистрация";
            document.getElementById('btn-reg').style.display = 'block';
            document.getElementById('btn-login').style.display = 'none';
        } else {
            document.getElementById('auth-title').innerText = "Вход";
            document.getElementById('btn-reg').style.display = 'none';
            document.getElementById('btn-login').style.display = 'block';
        }
    }
}

// ОТПРАВКА КОДА (Для регистрации)
async function sendOTP() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    if (!email || !pass) return alert("Заполни все поля!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    const templateParams = {
        to_email: email,
        passcode: generatedOTP
    };

    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', templateParams)
        .then(() => {
            alert("Код отправлен на почту!");
            document.getElementById('step-form').style.display = 'none';
            document.getElementById('step-code').style.display = 'block';
        })
        .catch(err => alert("Ошибка EmailJS: " + err));
}

// РЕГИСТРАЦИЯ (Создание записи)
async function register() {
    const userInput = document.getElementById('otp_input').value;
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    if (userInput == generatedOTP) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .insert([{ email: email, password: pass, score: 0, level: 1 }])
            .select();

        if (error) {
            console.error(error);
            alert("Ошибка: этот Email уже занят или база недоступна.");
        } else {
            alert("Успешная регистрация! Можешь играть.");
            document.getElementById('auth-container').style.display = 'none';
        }
    } else {
        alert("Неверный код!");
    }
}

// ВХОД (Проверка почты и пароля)
async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    if (!email || !pass) return alert("Заполни все поля!");

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();

    if (profile) {
        alert("Вход выполнен! Твой уровень: " + profile.level);
        document.getElementById('auth-container').style.display = 'none';
    } else {
        alert("Неверный email или пароль!");
    }
}
