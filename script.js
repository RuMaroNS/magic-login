// Инициализация EmailJS (вставь свой Public Key)
emailjs.init("gTrqvbOiCTqlJcDNJ");

let generatedOTP;

function sendOTP() {
    const email = document.getElementById('user_email').value;
    if (!email) return alert("Введите почту!");

    // 1. Генерируем код
    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    // 2. Рассчитываем время (текущее + 15 минут) для переменной {{time}}
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const expirationTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 3. Сопоставляем данные с шаблоном
    const templateParams = {
        to_email: email,        // Чтобы EmailJS знал куда слать (проверь это в Settings шаблона)
        passcode: generatedOTP, // Это попадет в {{passcode}}
        time: expirationTime    // Это попадет в {{time}}
    };

    // 4. Отправляем
    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams)
        .then(() => {
            alert("Код отправлен на почту!");
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'block';
        })
        .catch((error) => {
            console.error('Ошибка:', error);
            alert("Ошибка при отправке.");
        });
}

function verifyOTP() {
    const userInput = document.getElementById('otp_input').value;
    
    if (userInput == generatedOTP) {
        alert("Успешный вход! Добро пожаловать.");
        // Здесь можно перенаправить на другую страницу
        window.location.href = "https://your-cool-game.com";
    } else {
        alert("Неверный код. Попробуй еще раз.");
    }
}
