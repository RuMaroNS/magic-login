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
        // 1. Ищем игрока в таблице profiles
        let { data: profile, error: selectError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        // 2. Если игрока нет — создаем его
        if (!profile) {
            console.log("Игрок не найден, создаем новый профиль...");
            const { data: newData, error: insError } = await supabaseClient
                .from('profiles')
                .insert([{ email: email, score: 0, level: 1 }])
                .select()
                .single();
            
            if (insError) {
                console.error("Ошибка вставки:", insError);
                return alert("Ошибка при создании профиля");
            }
            profile = newData;
        }

        // 3. УСПЕХ! Используем обратные кавычки (клавиша Ё), чтобы вставить переменные
        alert(Успех! Твой уровень: ${profile.level}, Очки: ${profile.score});
        
        console.log("Профиль загружен:", profile);
        // Здесь можно переключать экран на саму игру
    } else {
        alert("Неверный код!");
    }
}
