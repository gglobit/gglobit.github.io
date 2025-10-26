document.addEventListener('DOMContentLoaded', function() {
    const testButton = document.getElementById('testButton');
    
    testButton.addEventListener('click', function() {
        // Сохраняем исходный текст
        const originalText = testButton.textContent;
        
        // Меняем текст на "Тест пройден"
        testButton.textContent = 'Тест пройден';
        testButton.style.backgroundColor = '#2196F3';
        
        // Через 1 секунду возвращаем исходный текст
        setTimeout(function() {
            testButton.textContent = originalText;
            testButton.style.backgroundColor = '#4CAF50';
        }, 1000);
    });
});
