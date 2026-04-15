// 1. НАСТРОЙКИ
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_PUBLIC_KEY = 'gTrqvbOiCTqlJcDNJ';

// Инициализация EmailJS
emailjs.init(EJS_PUBLIC_KEY);

// ИСПРАВЛЕНО: Используем supabaseClient, чтобы не было конфликта имен
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentMode = ''; 

function showAuth(mode) {
    currentMode = mode;
    document.getElementById('step-choice').style.display = 'none';
    document.getElementById('step-form').style.display = 'block';
    document.getElementById('step-code').style.display = 'none';

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

// --- ВХОД (БЕЗ КОДА) ---
async function login() {
    const email = document.getElementById('user_email').value;
    const pass = document.getElementById('user_password').value;

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
                .eq('email', email)
        .eq('password', pass) // Проверяем и почту, и пароль
        .single();

    if (profile) {
        alert("Вход выполнен! Уровень: " + profile.level);
        document.getElementById('auth-container').style.display = 'none';
        // Запуск игры
    } else {
        alert("Неверный email или пароль!");
    }
}

// --- РЕГИСТРАЦИЯ (С КОДОМ) ---
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
            alert("Ошибка: возможно, такой email уже занят.");
        } else {
            alert("Аккаунт создан! Теперь можно играть.");
            document.getElementById('auth-container').style.display = 'none';
        }
    } else {
        alert("Неверный код подтверждения!");
    }
}
