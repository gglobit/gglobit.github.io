// ==UserScript==
// @name         AutoOpenProject
// @version      1.3
// @description  Автозаполнение дней и ночей + логирование и удаление записей
// @match        https://openproject.globus.ru/my/page
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const tasks = [
        { id: 2764, hours: "PT3H" },
        { id: 2765, hours: "PT3H" },
        { id: 2767, hours: "PT3H" },
        { id: 2768, hours: "PT3H" },
    ];

    const nightTasks = [
        { id: 2764, hours: "PT3H" },
        { id: 2765, hours: "PT2H" },
        { id: 2765, hours: "PT1H", nextDay: true },
        { id: 2767, hours: "PT3H", nextDay: true },
        { id: 2768, hours: "PT3H", nextDay: true },
    ];

    const endpoint = 'https://openproject.globus.ru/api/v3/time_entries';

    // Получение CSRF-токена
    function getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    // Добавить дни к дате
    function addDaysToDate(dateString, days = 1) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Создание payload
    function createPayload(task, date) {
        return {
            ongoing: false,
            comment: { format: "plain", raw: "", html: "" },
            spentOn: task.nextDay ? addDaysToDate(date, 1) : date,
            hours: task.hours,
            _links: {
                workPackage: { href: `/api/v3/work_packages/${task.id}` },
                activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
                self: { href: null }
            }
        };
    }

    // Отправка POST-запроса
    function sendRequest(payload) {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            alert("CSRF token not found.");
            return;
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: endpoint,
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "cache-control": "no-cache",
                "content-type": "application/json",
                "cookie": document.cookie, // Добавляем все куки
                "origin": "https://openproject.globus.ru",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "referer": "https://openproject.globus.ru/my/page",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "user-agent": navigator.userAgent,
                "x-authentication-scheme": "Session",
                "x-csrf-token": csrfToken,
                "x-kl-kes-ajax-request": "Ajax_Request",
                "x-requested-with": "XMLHttpRequest"
            },
            data: JSON.stringify(payload),
            onload: response => console.log("Запрос выполнен:", response.responseText),
            onerror: error => console.error("Ошибка:", error),
        });
    }

    // Удаление записей по ID
    function deleteEntry(entryId) {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            alert("CSRF token not found.");
            return;
        }

        GM_xmlhttpRequest({
            method: "DELETE",
            url: `${endpoint}/${entryId}`,
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "cache-control": "no-cache",
                "content-type": "application/json",
                "cookie": document.cookie, // Добавляем все куки
                "origin": "https://openproject.globus.ru",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "referer": "https://openproject.globus.ru/my/page",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "user-agent": navigator.userAgent,
                "x-authentication-scheme": "Session",
                "x-csrf-token": csrfToken,
                "x-kl-kes-ajax-request": "Ajax_Request",
                "x-requested-with": "XMLHttpRequest"
            },
            onload: response => console.log(`Удаление записи ${entryId}:`, response.responseText),
            onerror: error => console.error("Ошибка при удалении записи:", error),
        });
    }

    // Получение и логирование данных
    function fetchAndLogTimeEntries(date) {
        const url = `${endpoint}?pageSize=30&filters=[{"spentOn":{"operator":"<>d","values":["${date}","${date}"]}},{"user_id":{"operator":"=","values":["me"]}}]`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "cache-control": "no-cache",
                "content-type": "application/json",
                "cookie": document.cookie, // Добавляем все куки
                "origin": "https://openproject.globus.ru",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "referer": "https://openproject.globus.ru/my/page",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "user-agent": navigator.userAgent,
                "x-authentication-scheme": "Session",
                "x-csrf-token": getCSRFToken(),
                "x-kl-kes-ajax-request": "Ajax_Request",
                "x-requested-with": "XMLHttpRequest"
            },
            onload: response => {
                try {
                    const data = JSON.parse(response.responseText);
                    const formattedData = data._embedded.elements.map(entry => ({
                        id: entry.id,
                    }));
                    console.log("Полученные данные:", formattedData);

                    // Удаление всех записей
                    formattedData.forEach(entry => deleteEntry(entry.id));
                } catch (error) {
                    console.error("Ошибка обработки данных:", error);
                }
            },
            onerror: error => console.error("Ошибка запроса:", error),
        });
    }

    // Добавление кнопок
    function addButton(text, color, tasksList, fetchData = false) {
        if (document.getElementById(`customButton-${text}`)) return;

        const button = document.createElement('button');
        button.id = `customButton-${text}`;
        button.textContent = text;
        button.style.backgroundColor = color;
        button.style.border = '1px solid #ccc';
        button.classList.add('button', '-highlight', 'button_no-margin', 'spot-action-bar--action');
        button.addEventListener("click", () => {
            let selectedDate = document.getElementById('wp-new-inline-edit--field-spentOn')?.value;
            if (!selectedDate) {
                selectedDate = document.querySelector('[id^="wp-"][id$="inline-edit--field-spentOn"]')?.value;
                if (!selectedDate) {
                    alert("Не удалось найти текущую дату.");
                    return;
                }
            }
            if (fetchData) {
                fetchAndLogTimeEntries(selectedDate);
            } else {
                tasksList.forEach(task => sendRequest(createPayload(task, selectedDate)));
            }
        });

        const actionBar = document.querySelector('.spot-action-bar--right');
        if (actionBar) actionBar.appendChild(button);
    }

    // Проверяем наличие формы и добавляем кнопки
    const modalCheckInterval = setInterval(() => {
        if (document.querySelector('[data-indicator-name="modal"]')) {
            addButton('День', '#f7d423', tasks);
            addButton('Ночь', '#2a414f', nightTasks);
            addButton('Удалить всё', '#f70000', null, true);
        }
    }, 200);
})();
