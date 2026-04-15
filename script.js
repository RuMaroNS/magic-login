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

        // 2. Если игрока нет (ошибка 406 или пустой результат) — создаем его
        if (!profile) {
            console.log("Игрок не найден, создаем новый профиль...");
            
            const { data: newData, error: insertError } = await supabaseClient
                .from('profiles')
                .insert([{ email: email, score: 0, level: 1 }])
                .select()
                .single();
            
            if (insertError) {
                console.error("Ошибка при создании игрока:", insertError);
                return alert("Не удалось создать профиль в базе.");
            }
            profile = newData;
        }

        // 3. Успешный вход! Выводим данные через обратные кавычки (клавиша Ё)
        alert(Успех! Твой уровень: ${profile.level}, Очки: ${profile.score});
        
        // Здесь можно скрыть форму входа и показать саму игру
        console.log("Данные успешно загружены:", profile);

    } else {
        alert("Неверный код! Попробуй еще раз.");
    }
}
