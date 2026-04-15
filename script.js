// 1. НАСТРОЙКИ (Вставь свои данные)
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_PUBLIC_KEY = 'gTrqvbOiCTqlJcDNJ';

// Инициализация библиотек
emailjs.init(EJS_PUBLIC_KEY);
const supabase = supabase.createClient(SB_URL, SB_KEY);

let generatedOTP;

// ФУНКЦИЯ ОТПРАВКИ КОДА
async function sendOTP() {
    const email = document.getElementById('user_email').value;
    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    const templateParams = {
        to_email: email,
        passcode: generatedOTP // Должно совпадать с {{passcode}} в шаблоне!
    };

    emailjs.send('service_j9ls8lo', 'template_ebxnpr6', templateParams)
        .then(() => {
            alert("Код отправлен!");
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'block';
        })
        .catch(err => alert("Ошибка EmailJS: " + err));
}

// ФУНКЦИЯ ПРОВЕРКИ И ЗАГРУЗКИ ДАННЫХ
async function verifyOTP() {
    const userInput = document.getElementById('otp_input').value;
    const email = document.getElementById('user_email').value;

    if (userInput == generatedOTP) {
        // Ищем игрока в Supabase
        let { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        // Если игрока нет — создаем его
        if (!profile) {
            const { data, error: insError } = await supabase
                .from('profiles')
                .insert([{ email: email, score: 0, level: 1 }])
                .select().single();
            profile = data;
        }

        alert(Успех! Уровень: ${profile.level}, Очки: ${profile.score});
        // Тут можно запускать саму игру
    } else {
        alert("Неверный код!");
    }
}
