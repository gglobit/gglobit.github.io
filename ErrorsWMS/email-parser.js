/**
 * Email Parser для файлов писем Outlook
 * Поддерживает форматы: .msg, .eml, .txt
 * 
 * @author M.Fedorkov
 * @version 1.0
 */

/**
 * Основная функция парсинга получателей из файла письма
 * @param {File} file - Файл письма для парсинга
 * @returns {Promise<Object>} Объект с получателями: {to, cc, bcc, from, replyTo, other}
 */
async function parseEmailRecipients(file) {
    try {
        let content = await readFileContent(file);
        
        // Обработка MSG файлов
        if (file.name.toLowerCase().endsWith('.msg')) {
            content = processMsgFile(content);
        }
        
        const recipients = extractRecipients(content, file.name);
        return recipients;
    } catch (error) {
        console.error('Error parsing email file:', error);
        throw new Error(`Ошибка при парсинге файла: ${error.message}`);
    }
}

/**
 * Читает содержимое файла в зависимости от типа
 * @param {File} file - Файл для чтения
 * @returns {Promise<string>} Содержимое файла
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        
        reader.onerror = function() {
            reject(new Error('Ошибка чтения файла'));
        };
        
        // Для MSG файлов читаем как ArrayBuffer, для остальных как текст
        if (file.name.toLowerCase().endsWith('.msg')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file, 'utf-8');
        }
    });
}

/**
 * Обрабатывает MSG файлы (бинарные файлы Outlook)
 * @param {ArrayBuffer} content - Бинарное содержимое MSG файла
 * @returns {string} Извлеченный текст
 */
function processMsgFile(content) {
    if (content instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(content);
        let text = '';
        let currentString = '';
        let inTextBlock = false;
        
        for (let i = 0; i < uint8Array.length - 1; i++) {
            const char = uint8Array[i];
            const nextChar = uint8Array[i + 1];
            
            // Ищем читаемые символы
            if ((char >= 32 && char <= 126) || char === 10 || char === 13 || char === 9) {
                currentString += String.fromCharCode(char);
                inTextBlock = true;
            } else if (char === 0 && nextChar !== 0) {
                // Пропускаем одиночные нулевые байты (Unicode)
                continue;
            } else {
                // Если накопили строку длиннее 3 символов, сохраняем её
                if (inTextBlock && currentString.length > 3) {
                    text += currentString + '\n';
                }
                currentString = '';
                inTextBlock = false;
            }
        }
        
        // Обрабатываем последнюю строку
        if (inTextBlock && currentString.length > 3) {
            text += currentString + '\n';
        }
        
        return text;
    }
    return content;
}

/**
 * Извлекает получателей из содержимого файла
 * @param {string} content - Содержимое файла
 * @param {string} filename - Имя файла
 * @returns {Object} Объект с получателями
 */
function extractRecipients(content, filename) {
    const recipients = {
        to: [],
        cc: [],
        bcc: [],
        from: [],
        replyTo: [],
        other: []
    };

    // Основной поиск по стандартным паттернам email headers
    const headerPatterns = {
        to: [
            /^To:\s*(.+)$/gmi,
            /\nTo:\s*(.+)$/gmi,
            /^Кому:\s*(.+)$/gmi
        ],
        cc: [
            /^Cc:\s*(.+)$/gmi,
            /\nCc:\s*(.+)$/gmi,
            /^Копия:\s*(.+)$/gmi
        ],
        bcc: [
            /^Bcc:\s*(.+)$/gmi,
            /\nBcc:\s*(.+)$/gmi,
            /^Скрытая копия:\s*(.+)$/gmi
        ],
        from: [
            /^From:\s*(.+)$/gmi,
            /\nFrom:\s*(.+)$/gmi,
            /^От:\s*(.+)$/gmi,
            /^Отправитель:\s*(.+)$/gmi
        ]
    };

    // Поиск по заголовкам
    for (const [type, patternList] of Object.entries(headerPatterns)) {
        for (const pattern of patternList) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const emails = extractEmailsFromString(match[1]);
                recipients[type].push(...emails);
            }
        }
    }

    // Специальный поиск для MSG файлов
    if (filename.toLowerCase().endsWith('.msg')) {
        const msgRecipients = extractMsgRecipients(content);
        
        // Если нашли структурированных получателей, используем их
        if (msgRecipients.to.length > 0) {
            recipients.to = msgRecipients.to;
        }
        if (msgRecipients.cc.length > 0) {
            recipients.cc = msgRecipients.cc;
        }
        if (msgRecipients.from.length > 0) {
            recipients.from = msgRecipients.from;
        }
    } else {
        // Для других файлов - стандартный поиск всех email
        const allFoundEmails = findAllEmailsInText(content);
        if (allFoundEmails.length > 0 && recipients.to.length === 0) {
            recipients.other.push(...allFoundEmails);
        }
    }

    // Удаление дубликатов и очистка
    for (const type of Object.keys(recipients)) {
        recipients[type] = [...new Set(recipients[type])]
            .filter(email => email && email.includes('@'))
            .map(email => email.toLowerCase().trim());
    }

    return recipients;
}

/**
 * Извлекает получателей специально для MSG файлов
 * @param {string} content - Содержимое MSG файла
 * @returns {Object} Объект с получателями
 */
function extractMsgRecipients(content) {
    const recipients = {
        to: [],
        cc: [],
        from: []
    };

    // Ищем строки To: с полным списком получателей
    const toPatterns = [
        /To:\s*<([^>]+)>(?:,\s*<([^>]+)>)*[^<]*$/gmi,
        /To:\s*(.+?)(?=\r?\n[A-Z][a-z]+:|$)/gmi
    ];

    for (const pattern of toPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const fullToLine = match[1];
            if (fullToLine && fullToLine.includes('@')) {
                // Разбираем строку получателей
                const toEmails = parseRecipientsLine(fullToLine);
                if (toEmails.length > 10) { // Если нашли много получателей - это скорее всего правильный список
                    recipients.to.push(...toEmails);
                    break; // Нашли основной список, прекращаем поиск
                }
            }
        }
    }

    // Если не нашли в заголовках, ищем в бинарных данных но более селективно
    if (recipients.to.length === 0) {
        const binaryEmails = extractEmailsFromBinary(content);
        // Фильтруем только email с доменами globit
        const filteredEmails = binaryEmails.filter(email => 
            email.includes('@globit.') && !email.includes('globus.ru')
        );
        
        if (filteredEmails.length >= 10) { // Ожидаем список получателей
            recipients.to = filteredEmails;
        }
    }

    return recipients;
}

/**
 * Парсит строку получателей формата "Name <email>; Name2 <email2>"
 * @param {string} line - Строка с получателями
 * @returns {Array<string>} Массив email адресов
 */
function parseRecipientsLine(line) {
    const emails = [];
    
    // Ищем все email в угловых скобках
    const bracketEmails = line.match(/<([^>]+@[^>]+)>/g);
    if (bracketEmails) {
        for (const match of bracketEmails) {
            const email = match.replace(/[<>]/g, '').trim();
            if (email.includes('@')) {
                emails.push(email.toLowerCase());
            }
        }
    }
    
    // Если не нашли в скобках, ищем просто email адреса
    if (emails.length === 0) {
        const simpleEmails = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g);
        if (simpleEmails) {
            emails.push(...simpleEmails.map(e => e.toLowerCase()));
        }
    }
    
    return [...new Set(emails)];
}

/**
 * Извлекает email адреса из строки
 * @param {string} str - Строка для поиска email
 * @returns {Array<string>} Массив найденных email адресов
 */
function extractEmailsFromString(str) {
    if (!str) return [];
    
    const emails = [];
    
    // Специальная обработка для строк с множественными получателями
    // Формат: "Name <email>; Name2 <email2>; ..."
    if (str.includes('<') && str.includes('>') && (str.includes(';') || str.includes(','))) {
        const recipientPattern = /([^<;,]+)\s*<([^>]+)>/g;
        let match;
        while ((match = recipientPattern.exec(str)) !== null) {
            const email = match[2].trim().toLowerCase();
            if (email.includes('@')) {
                emails.push(email);
            }
        }
        
        if (emails.length > 0) {
            return [...new Set(emails)];
        }
    }
    
    // Разбиваем строку по разделителям
    const parts = str.split(/[;,\n\r\t]+/);
    
    for (const part of parts) {
        const cleanPart = part.trim();
        if (!cleanPart) continue;
        
        // Основные паттерны для извлечения email
        const emailPatterns = [
            // Email в угловых скобках
            /<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})>/,
            // Обычный email
            /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/
        ];
        
        for (const pattern of emailPatterns) {
            const match = cleanPart.match(pattern);
            if (match) {
                emails.push(match[1].toLowerCase().trim());
                break; // Нашли email в этой части, переходим к следующей
            }
        }
    }
    
    return [...new Set(emails)];
}

/**
 * Поиск всех email адресов в тексте для не-MSG файлов
 * @param {string} content - Содержимое файла
 * @returns {Array<string>} Массив найденных email адресов
 */
function findAllEmailsInText(content) {
    const emailPatterns = [
        // Стандартный email
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // Email в угловых скобках
        /<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})>/g,
        // Email с именем "Name <email@domain.com>"
        /[^<]*<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})>/g
    ];

    const allEmails = [];
    for (const pattern of emailPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const email = match[1] || match[0];
            if (email.includes('@')) {
                allEmails.push(email.toLowerCase().trim());
            }
        }
    }
    
    return [...new Set(allEmails)];
}

/**
 * Поиск email адресов в бинарных данных MSG файла
 * @param {string} content - Содержимое файла после конвертации
 * @returns {Array<string>} Массив найденных email адресов
 */
function extractEmailsFromBinary(content) {
    const emails = [];
    
    // Конвертируем строку обратно в байты для поиска
    const bytes = [];
    for (let i = 0; i < content.length; i++) {
        bytes.push(content.charCodeAt(i));
    }
    
    // Ищем последовательности символов, которые могут быть email
    let currentEmail = '';
    let foundAt = false;
    
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        
        // Если это печатный ASCII символ
        if ((byte >= 32 && byte <= 126) || byte === 64) { // 64 = @
            const char = String.fromCharCode(byte);
            
            if (char === '@') {
                foundAt = true;
                currentEmail += char;
            } else if ((char >= 'a' && char <= 'z') || 
                      (char >= 'A' && char <= 'Z') || 
                      (char >= '0' && char <= '9') || 
                      char === '.' || char === '-' || char === '_' || char === '+') {
                currentEmail += char;
            } else {
                // Конец потенциального email
                if (foundAt && currentEmail.length > 5 && currentEmail.includes('.')) {
                    // Проверяем, что это валидный email
                    const emailMatch = currentEmail.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/);
                    if (emailMatch) {
                        const email = emailMatch[0].toLowerCase();
                        // Фильтруем только осмысленные email (не служебные)
                        if (!email.includes('globusgrp.org') && 
                            !email.match(/^[a-f0-9-]{30,}@/) && // Исключаем GUID-подобные
                            email.length < 50) { // Исключаем слишком длинные
                            emails.push(email);
                        }
                    }
                }
                currentEmail = '';
                foundAt = false;
            }
        } else {
            // Неподходящий символ
            if (foundAt && currentEmail.length > 5 && currentEmail.includes('.')) {
                const emailMatch = currentEmail.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/);
                if (emailMatch) {
                    const email = emailMatch[0].toLowerCase();
                    if (!email.includes('globusgrp.org') && 
                        !email.match(/^[a-f0-9-]{30,}@/) &&
                        email.length < 50) {
                        emails.push(email);
                    }
                }
            }
            currentEmail = '';
            foundAt = false;
        }
    }
    
    // Проверяем последний накопленный email
    if (foundAt && currentEmail.length > 5 && currentEmail.includes('.')) {
        const emailMatch = currentEmail.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/);
        if (emailMatch) {
            const email = emailMatch[0].toLowerCase();
            if (!email.includes('globusgrp.org') && 
                !email.match(/^[a-f0-9-]{30,}@/) &&
                email.length < 50) {
                emails.push(email);
            }
        }
    }
    
    return [...new Set(emails)]; // Удаляем дубликаты
}

// Экспорт для использования в Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseEmailRecipients,
        extractRecipients,
        extractEmailsFromString,
        findAllEmailsInText
    };
}

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
    window.EmailParser = {
        parseEmailRecipients,
        extractRecipients,
        extractEmailsFromString,
        findAllEmailsInText
    };
}
