class DataMatrixComparator {
    constructor() {
        this.datasetA = new Map();
        this.datasetB = new Map();
        this.results = {
            common: [],
            onlyA: [],
            onlyB: []
        };
        
        this.initializeEventListeners();
        this.updateCounts();
    }

    initializeEventListeners() {
        // Текстовые области
        document.getElementById('dataset-a').addEventListener('input', (e) => {
            this.updateDataset('A', e.target.value);
        });
        
        document.getElementById('dataset-b').addEventListener('input', (e) => {
            this.updateDataset('B', e.target.value);
        });

        // Файловые инпуты
        document.getElementById('file-a').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'A');
        });
        
        document.getElementById('file-b').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'B');
        });

        // Кнопка сравнения
        document.getElementById('compare-btn').addEventListener('click', () => {
            this.performComparison();
        });

        // Кнопки экспорта
        document.getElementById('export-txt').addEventListener('click', () => {
            this.exportResults('txt');
        });
        
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportResults('csv');
        });

        // Чекбоксы опций
        ['ignore-case', 'normalize-spaces', 'remove-special'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                if (this.datasetA.size > 0 || this.datasetB.size > 0) {
                    this.updateDatasets();
                }
            });
        });
    }

    normalizeCode(code) {
        if (!code || typeof code !== 'string') return '';
        
        let normalized = code.trim();
        
        // Специальная нормализация для датаматрикс кодов
        normalized = this.normalizeDataMatrixFormat(normalized);
        
        // Игнорировать регистр
        if (document.getElementById('ignore-case').checked) {
            normalized = normalized.toLowerCase();
        }
        
        // Нормализовать пробелы
        if (document.getElementById('normalize-spaces').checked) {
            normalized = normalized.replace(/\s+/g, ' ').trim();
        }
        
        // Удалить специальные символы (кроме основных символов датаматрикс)
        if (document.getElementById('remove-special').checked) {
            // Оставляем только буквы, цифры, основные символы датаматрикс
            normalized = normalized.replace(/[^\w\d\u001D+\-=\/\.,:;!@#$%^&*()_|\\~`'"<>?{}[\]]/g, '');
        }
        
        return normalized;
    }

    normalizeDataMatrixFormat(code) {
        // Заменяем HTML-кодированные разделители на стандартные
        let normalized = code
            .replace(/&#x1D;/g, '\u001D')  // Заменяем HTML-кодированный ASCII 29 на реальный символ
            .replace(/&#29;/g, '\u001D')   // Альтернативное кодирование
            .trim();
        
        // Пытаемся разобрать структуру датаматрикс кода
        // Обычная структура: GTIN + серийный номер + GS1 разделители + данные
        
        // Если есть символы ASCII 29 (разделители GS1), нормализуем их
        if (normalized.includes('\u001D')) {
            // Формат с GS1 разделителями: заменяем их на пробелы для унификации
            normalized = normalized.replace(/\u001D/g, ' ');
        }
        
        // Убираем лишние пробелы в начале и конце
        normalized = normalized.replace(/^\s+|\s+$/g, '');
        
        // Нормализуем множественные пробелы до одиночных
        normalized = normalized.replace(/\s+/g, ' ');
        
        return normalized;
    }

    // Извлекает ключевые компоненты датаматрикс кода для более точного сравнения
    extractDataMatrixComponents(code) {
        const normalized = this.normalizeDataMatrixFormat(code);
        
        // Пытаемся извлечь основные компоненты
        // Примерная структура: GTIN(14) + Serial + AI(91) + Date + AI(92) + Crypto
        
        const components = {
            gtin: '',
            serial: '',
            expiry: '',
            crypto: '',
            raw: normalized
        };
        
        // Разбиваем по пробелам (после нормализации)
        const parts = normalized.split(/\s+/);
        
        if (parts.length >= 1) {
            // Первая часть обычно содержит GTIN + серийный номер
            const firstPart = parts[0];
            
            // GTIN обычно начинается с 01 и имеет 14 цифр
            if (firstPart.startsWith('01') && firstPart.length > 16) {
                components.gtin = firstPart.substring(0, 16); // 01 + 14 цифр GTIN
                components.serial = firstPart.substring(16); // Остальное - серийный номер
            } else {
                components.serial = firstPart;
            }
        }
        
        // Ищем дату (AI 91)
        const expiryIndex = parts.findIndex(part => part === '91EE10' || part.includes('91'));
        if (expiryIndex !== -1 && expiryIndex + 1 < parts.length) {
            components.expiry = parts[expiryIndex + 1];
        }
        
        // Ищем криптографическую подпись (AI 92)
        const cryptoIndex = parts.findIndex(part => part === '92' || part.startsWith('92'));
        if (cryptoIndex !== -1 && cryptoIndex + 1 < parts.length) {
            components.crypto = parts[cryptoIndex + 1];
        }
        
        return components;
    }

    // Генерирует унифицированный ключ для сравнения
    generateComparisonKey(code) {
        const components = this.extractDataMatrixComponents(code);
        
        // Создаем ключ из основных компонентов
        const key = [
            components.gtin,
            components.serial,
            components.expiry,
            components.crypto
        ].filter(part => part).join('|');
        
        return key || components.raw;
    }

    parseDataset(text) {
        if (!text) return new Map();
        
        const lines = text.split(/[\r\n]+/);
        const codes = new Map(); // Используем Map для хранения соответствия ключ -> оригинальный код
        
        lines.forEach(line => {
            const normalized = this.normalizeCode(line);
            if (normalized) {
                // Генерируем ключ для сравнения на основе компонентов
                const comparisonKey = this.generateComparisonKey(normalized);
                
                // Игнорировать регистр для ключа сравнения, если опция включена
                const finalKey = document.getElementById('ignore-case').checked ? 
                    comparisonKey.toLowerCase() : comparisonKey;
                
                // Сохраняем первый встреченный код для этого ключа
                if (!codes.has(finalKey)) {
                    codes.set(finalKey, {
                        original: line.trim(),
                        normalized: normalized,
                        key: finalKey
                    });
                }
            }
        });
        
        return codes;
    }

    updateDataset(dataset, text) {
        if (dataset === 'A') {
            this.datasetA = this.parseDataset(text);
        } else {
            this.datasetB = this.parseDataset(text);
        }
        
        this.updateCounts();
        this.updateCompareButton();
    }

    updateDatasets() {
        const textA = document.getElementById('dataset-a').value;
        const textB = document.getElementById('dataset-b').value;
        
        this.datasetA = this.parseDataset(textA);
        this.datasetB = this.parseDataset(textB);
        
        this.updateCounts();
        this.updateCompareButton();
        
        // Если уже есть результаты, обновим их
        if (!document.getElementById('results').classList.contains('hidden')) {
            this.performComparison();
        }
    }

    updateCounts() {
        document.getElementById('count-a').textContent = `Кодов: ${this.datasetA.size}`;
        document.getElementById('count-b').textContent = `Кодов: ${this.datasetB.size}`;
    }

    updateCompareButton() {
        const compareBtn = document.getElementById('compare-btn');
        const canCompare = this.datasetA.size > 0 && this.datasetB.size > 0;
        compareBtn.disabled = !canCompare;
    }

    async handleFileUpload(event, dataset) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            const textareaId = dataset === 'A' ? 'dataset-a' : 'dataset-b';
            const textarea = document.getElementById(textareaId);
            
            // Добавляем к существующему тексту или заменяем
            const existingText = textarea.value.trim();
            const newText = existingText ? existingText + '\n' + text : text;
            
            textarea.value = newText;
            this.updateDataset(dataset, newText);
            
            // Показываем уведомление
            this.showNotification(`Файл "${file.name}" успешно загружен в набор ${dataset}`);
            
        } catch (error) {
            this.showNotification(`Ошибка при загрузке файла: ${error.message}`, 'error');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    performComparison() {
        const compareBtn = document.getElementById('compare-btn');
        compareBtn.classList.add('loading');
        compareBtn.disabled = true;

        // Небольшая задержка для показа эффекта загрузки
        setTimeout(() => {
            this.calculateResults();
            this.displayResults();
            
            compareBtn.classList.remove('loading');
            compareBtn.disabled = false;
        }, 500);
    }

    calculateResults() {
        const keysA = new Set(this.datasetA.keys());
        const keysB = new Set(this.datasetB.keys());
        
        // Находим пересечения и различия по ключам
        const commonKeys = [...keysA].filter(key => keysB.has(key));
        const onlyAKeys = [...keysA].filter(key => !keysB.has(key));
        const onlyBKeys = [...keysB].filter(key => !keysA.has(key));
        
        // Преобразуем обратно в оригинальные коды
        this.results.common = commonKeys.map(key => ({
            key,
            codeA: this.datasetA.get(key).original,
            codeB: this.datasetB.get(key).original
        }));
        
        this.results.onlyA = onlyAKeys.map(key => ({
            key,
            code: this.datasetA.get(key).original
        }));
        
        this.results.onlyB = onlyBKeys.map(key => ({
            key,
            code: this.datasetB.get(key).original
        }));
        
        // Сортируем результаты по ключам
        this.results.common.sort((a, b) => a.key.localeCompare(b.key));
        this.results.onlyA.sort((a, b) => a.key.localeCompare(b.key));
        this.results.onlyB.sort((a, b) => a.key.localeCompare(b.key));
    }

    displayResults() {
        // Показываем секцию результатов
        document.getElementById('results').classList.remove('hidden');
        
        // Обновляем статистику
        document.getElementById('common-count').textContent = this.results.common.length;
        document.getElementById('only-a-count').textContent = this.results.onlyA.length;
        document.getElementById('only-b-count').textContent = this.results.onlyB.length;
        
        // Отображаем списки кодов
        this.displayCodeList('missing-codes', this.results.onlyA);
        this.displayCodeList('extra-codes', this.results.onlyB);
        this.displayCodeList('common-codes', this.results.common);
        
        // Прокручиваем к результатам
        document.getElementById('results').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }

    displayCodeList(containerId, codes) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (codes.length === 0) {
            return; // CSS правило :empty покажет сообщение "Коды не найдены"
        }
        
        codes.forEach(item => {
            const codeElement = document.createElement('div');
            codeElement.className = 'code-item';
            
            // Определяем какой код показывать
            let displayCode = '';
            let copyCode = '';
            
            if (containerId === 'common-codes') {
                // Для общих кодов показываем оба варианта, если они отличаются
                if (item.codeA === item.codeB) {
                    displayCode = item.codeA;
                    copyCode = item.codeA;
                } else {
                    displayCode = `A: ${item.codeA}\nB: ${item.codeB}`;
                    copyCode = item.codeA; // Копируем версию из набора A
                    codeElement.classList.add('different-formats');
                    codeElement.title = 'Одинаковые данные в разных форматах. Нажмите для копирования версии A';
                }
            } else {
                displayCode = item.code;
                copyCode = item.code;
                codeElement.title = 'Нажмите для копирования';
            }
            
            codeElement.textContent = displayCode;
            
            // Добавляем возможность копирования по клику
            codeElement.addEventListener('click', () => {
                this.copyToClipboard(copyCode);
                this.showNotification('Код скопирован в буфер обмена');
            });
            
            container.appendChild(codeElement);
        });
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    exportResults(format) {
        if (!this.results.common && !this.results.onlyA && !this.results.onlyB) {
            this.showNotification('Нет данных для экспорта. Выполните сравнение сначала.', 'error');
            return;
        }

        let content = '';
        let filename = '';
        
        if (format === 'txt') {
            content = this.generateTxtReport();
            filename = `datamatrix_comparison_${this.getCurrentTimestamp()}.txt`;
        } else if (format === 'csv') {
            content = this.generateCsvReport();
            filename = `datamatrix_comparison_${this.getCurrentTimestamp()}.csv`;
        }
        
        this.downloadFile(content, filename);
    }

    generateTxtReport() {
        const timestamp = new Date().toLocaleString('ru-RU');
        
        let report = `ОТЧЕТ О СРАВНЕНИИ ДАТАМАТРИКС КОДОВ\n`;
        report += `Дата: ${timestamp}\n`;
        report += `${'='.repeat(50)}\n\n`;
        
        report += `СТАТИСТИКА:\n`;
        report += `- Общих кодов: ${this.results.common.length}\n`;
        report += `- Только в наборе A: ${this.results.onlyA.length}\n`;
        report += `- Только в наборе B: ${this.results.onlyB.length}\n`;
        report += `- Всего в наборе A: ${this.datasetA.size}\n`;
        report += `- Всего в наборе B: ${this.datasetB.size}\n\n`;
        
        if (this.results.onlyA.length > 0) {
            report += `НЕДОСТАЮЩИЕ В НАБОРЕ B (${this.results.onlyA.length}):\n`;
            report += `${'-'.repeat(30)}\n`;
            this.results.onlyA.forEach(item => report += `${item.code}\n`);
            report += `\n`;
        }
        
        if (this.results.onlyB.length > 0) {
            report += `ЛИШНИЕ В НАБОРЕ B (${this.results.onlyB.length}):\n`;
            report += `${'-'.repeat(30)}\n`;
            this.results.onlyB.forEach(item => report += `${item.code}\n`);
            report += `\n`;
        }
        
        if (this.results.common.length > 0) {
            report += `ОБЩИЕ КОДЫ (${this.results.common.length}):\n`;
            report += `${'-'.repeat(30)}\n`;
            this.results.common.forEach(item => {
                if (item.codeA === item.codeB) {
                    report += `${item.codeA}\n`;
                } else {
                    report += `A: ${item.codeA}\n`;
                    report += `B: ${item.codeB}\n`;
                    report += `${'-'.repeat(20)}\n`;
                }
            });
        }
        
        return report;
    }

    generateCsvReport() {
        let csv = 'Тип,Код A,Код B\n';
        
        this.results.onlyA.forEach(item => {
            csv += `"Только в A","${item.code.replace(/"/g, '""')}",""\n`;
        });
        
        this.results.onlyB.forEach(item => {
            csv += `"Только в B","","${item.code.replace(/"/g, '""')}"\n`;
        });
        
        this.results.common.forEach(item => {
            csv += `"Общий","${item.codeA.replace(/"/g, '""')}","${item.codeB.replace(/"/g, '""')}"\n`;
        });
        
        return csv;
    }

    getCurrentTimestamp() {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/:/g, '-');
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        this.showNotification(`Файл "${filename}" загружен`);
    }

    showNotification(message, type = 'success') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Стили для уведомления
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            background: type === 'error' ? 
                'linear-gradient(135deg, #dc3545, #c82333)' : 
                'linear-gradient(135deg, #28a745, #1e7e34)',
            animation: 'slideIn 0.3s ease-out'
        });
        
        document.body.appendChild(notification);
        
        // Убираем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Добавляем стили для анимации уведомлений
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new DataMatrixComparator();
});