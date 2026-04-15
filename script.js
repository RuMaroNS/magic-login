// 1. НАСТРОЙКИ
const SB_URL = 'https://wbkygibviddkdjxbahbg.supabase.co';
const SB_KEY = 'sb_publishable_l5wIAt6RrAl4Uo8uZKerRQ_xBYDS-Kv';
const EJS_PUBLIC_KEY = 'gTrqvbOiCTqlJcDNJ';

// Инициализация библиотек
emailjs.init(EJS_PUBLIC_KEY);

// ИСПРАВЛЕНО: Правильная инициализация клиента
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let generatedOTP;

// ФУНКЦИЯ ОТПРАВКИ КОДА
async function sendOTP() {
    const email = document.getElementById('user_email').value;
    if (!email) return alert("Введите почту!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    const templateParams = {
        to_email: email,
        passcode: generatedOTP
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
        try {
            // Используем исправленный supabaseClient
            let { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('email', email)
                .single();

            if (!profile) {
                console.log("Создаем новый профиль...");
                const { data: newData, error: insError } = await supabaseClient
                    .from('profiles')
                    .insert([{ email: email, score: 0, level: 1 }])
                    .select()
                    .single();
                
                if (insError) throw insError;
                profile = newData;
            }

            // ИСПРАВЛЕНО: Добавлены обратные кавычки (клавиша Ё)
            alert(Успех! Твой уровень: ${profile.level}, Очки: ${profile.score});
            
            console.log("Данные загружены:", profile);

        } catch (err) {
            console.error("Ошибка supabaseClient:", err);
            alert("Проблема с базой данных. Проверь консоль (F12)");
        }
    } else {
        alert("Неверный код!");
    }
}
