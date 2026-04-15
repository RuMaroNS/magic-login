// Инициализация EmailJS (вставь свой Public Key)
emailjs.init("gTrqvbOiCTqlJcDNJ");

let generatedOTP;

function sendOTP() {
    const email = document.getElementById('user_email').value;
    if (!email) return alert("Введите почту!");

    generatedOTP = Math.floor(1000 + Math.random() * 9000);

    const templateParams = {
        to_email: email, 
        passcode: generatedOTP // Теперь ключ совпадает с {{passcode}} в шаблоне
    };

    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams)
        .then(() => {
            alert("Код отправлен!");
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'block';
        })
        .catch((error) => {
            console.error('Ошибка отправки:', error);
            // Если ошибка 422 осталась, проверь правильность SERVICE_ID и TEMPLATE_ID
            alert("Ошибка: " + JSON.stringify(error));
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
