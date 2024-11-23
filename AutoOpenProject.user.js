// ==UserScript==
// @name         AutoOpenProject
// @version      1.0
// @description  Добавляет кнопки для автоматического заполенния дней и ночей
// @match        https://openproject.globus.ru/my/page
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Фиксированный Payload
    let Payload2764 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT3H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2764" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };
    let Payload2765 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT3H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2765" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };
    let Payload2765_2 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT2H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2765" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };
    let Payload2765_1 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT1H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2765" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };
        let Payload2767 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT3H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2767" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };
        let Payload2768 = {
        ongoing: false,
        comment: {
            format: "plain",
            raw: "",
            html: ""
        },
        spentOn: "", // Заполняем позже
        hours: "PT3H",
        _links: {
            workPackage: { href: "/api/v3/work_packages/2768" },
            activity: { href: "/api/v3/time_entries/activities/5", title: "Сопровождение ПО" },
            self: { href: null }
        }
    };

    // Цель запроса
    const endpoint = 'https://openproject.globus.ru/api/v3/time_entries';
    const updateTableEndpoint = 'https://openproject.globus.ru/api/v3/time_entries?pageSize=500&filters=%5B%7B%22spentOn%22%3A%7B%22operator%22%3A%22%3C%3Ed%22%2C%22values%22%3A%5B%222024-11-18%22%2C%222024-11-24%22%5D%7D%7D%2C%7B%22user_id%22%3A%7B%22operator%22%3A%22%3D%22%2C%22values%22%3A%5B%22me%22%5D%7D%7D%5D';

    // Функция для получения текущего csrf-токена
    function getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    function addOneDayToDate(dateString) {
        // Преобразуем строку в объект Date
        const date = new Date(dateString);

        // Прибавляем один день
        date.setDate(date.getDate() + 1);

        // Возвращаем новую дату в формате YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // месяц с ведущим нулем
        const day = String(date.getDate()).padStart(2, '0'); // день с ведущим нулем

        return `${year}-${month}-${day}`;
    }
    // Функция для получения выбранной даты из формы
    function getSelectedDateFromForm() {
        const dateInput = document.getElementById('wp-new-inline-edit--field-spentOn');
        if (dateInput && dateInput.value) {
            return dateInput.value;
        }
        return null;
    }

    // Функция отправки запроса
function sendRequest(Payload, selectedDate) {
    if (selectedDate) {
        Payload.spentOn = selectedDate; // Обновляем дату в payload
    } else {
        alert("Не удалось найти текущую дату.");
        return;
    }

    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        alert("CSRF token not found.");
        return;
    }

    // Получаем все куки из браузера
    const cookies = document.cookie;

    GM_xmlhttpRequest({
        method: "POST",
        url: endpoint,
        headers: {
            "accept": "application/json, text/plain, */*",
            "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "cookie": cookies, // Добавляем все куки
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
        data: JSON.stringify(Payload),
        onload: function(response) {
            console.log("Запрос выполнен успешно!", response.responseText);
        },
        onerror: function(error) {
            console.error("Ошибка при выполнении запроса:", error);
        }
    });
}
    // Функция для добавления кнопки в форму
    function addButtonToForm() {
                // Получаем выбранную дату из формы и обновляем payload
        const selectedDate = getSelectedDateFromForm();
        // Проверяем, существует ли уже кнопка
        if (document.getElementById('customRequestButton')) {
            return;
        }

        const button = document.createElement('button');
        button.classList.add('button');
        button.classList.add('-highlight');
        button.classList.add('button_no-margin');
        button.classList.add('spot-action-bar--action');
        button.style.backgroundColor = '#f7d423';
        button.style.border = '1px solid #fcd405';

        button.id = 'customRequestButton';
        button.textContent = 'День';
        // Добавляем обработчик события
        button.addEventListener("click", () => {
            sendRequest(Payload2764, selectedDate);
            sendRequest(Payload2765, selectedDate);
            sendRequest(Payload2767, selectedDate);
            sendRequest(Payload2768, selectedDate);
        });

        // Находим контейнер для кнопки, например, action bar
        const actionBar = document.querySelector('.spot-action-bar--right');
        if (actionBar) {
            actionBar.appendChild(button);
        }
          // Проверяем, существует ли уже кнопка
        if (document.getElementById('customRequestButtonHight')) {
            return;
        }

        const button1 = document.createElement('button');
        button1.classList.add('button');
        button1.classList.add('-highlight');
        button1.classList.add('button_no-margin');
        button1.classList.add('spot-action-bar--action');
        button1.style.backgroundColor = '#2a414f';
        button1.style.border = '1px solid #446375';

        button1.id = 'customRequestButton';
        button1.textContent = 'Ночь';
        // Добавляем обработчик события
        button1.addEventListener("click", () => {
            sendRequest(Payload2764, selectedDate);
            sendRequest(Payload2765_2, selectedDate);
            sendRequest(Payload2765_1, addOneDayToDate(selectedDate));
            sendRequest(Payload2767, addOneDayToDate(selectedDate));
            sendRequest(Payload2768, addOneDayToDate(selectedDate));
        });

        // Находим контейнер для кнопки, например, action bar
        const actionBar1 = document.querySelector('.spot-action-bar--right');
        if (actionBar1) {
            actionBar1.appendChild(button1);
        }
    }

    // Fallback: Polling for modal presence
    const modalCheckInterval = setInterval(() => {
        if (document.querySelector('[data-indicator-name="modal"]')) {
            addButtonToForm();
        }
    }, 200);

})();