// ==UserScript==
// @name         CreatioBugChecker
// @namespace    http://tampermonkey.net/
// @version      2024-12-12
// @description  Creatio Auto Bug Checker
// @author       Aboba
// @match        https://cc.globus.ru/0/Nui/ViewModule.aspx
// @icon         https://www.google.com/s2/favicons?sz=64&domain=globus.ru
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Функция для извлечения значения из куки по имени
    function getCookie(name) {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [cookieName, cookieValue] = cookie.split('=');
            if (cookieName === name) {
                return cookieValue;
            }
        }
        return null;
    }

    // Функция для формирования актуальных заголовков
    function getHeaders() {
        const csrfToken = getCookie('BPMCSRF'); // Извлекаем BPMCSRF из куки
        const timestamp = new Date().toISOString();
        const userAgent = navigator.userAgent;

        return {
            'accept': '*/*',
            'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'bpmcsrf': csrfToken, // Используем извлеченный BPMCSRF
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://cc.globus.ru',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://cc.globus.ru/0/Nui/ViewModule.aspx',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'timestamp': timestamp,
            'user-agent': userAgent,
            'x-request-source': 'ajax-provider',
            'x-requested-with': 'XMLHttpRequest',
        };
    }

    // Функция для отправки запроса
    function sendRequest() {
        const headers = getHeaders();
        const cookies = document.cookie; // Получаем текущие куки

        // Вывод заголовков и куки в консоль
        console.log('Headers:', headers);
        console.log('Cookies:', cookies);

        const jsonData = {
            rootSchemaName: 'OmniTask',
            operationType: 0,
            includeProcessExecutionData: true,
            filters: {
                items: {
                    'ed3596ed-6c8b-43bf-ba4a-8a6111943642': {
                        items: {
                            FolderFilters: {
                                items: {
                                    customExtendFilter_OmniTask3: {
                                        items: {
                                            customFilterOmniPerformerGroup_OmniTask: {
                                                filterType: 1,
                                                comparisonType: 11,
                                                isEnabled: true,
                                                trimDateTimeParameterToDate: false,
                                                leftExpression: {
                                                    expressionType: 0,
                                                    columnPath: 'OmniPerformerGroup.Name',
                                                },
                                                rightExpression: {
                                                    expressionType: 2,
                                                    parameter: {
                                                        dataValueType: 1,
                                                        value: 'Исполнители ИМ Администратор сайта КО',
                                                    },
                                                },
                                            },
                                            'bb7a0d01-10ff-4156-92e9-56ac6d6882b6': {
                                                filterType: 4,
                                                comparisonType: 3,
                                                isEnabled: true,
                                                trimDateTimeParameterToDate: false,
                                                leftExpression: {
                                                    expressionType: 0,
                                                    columnPath: 'OmniPerformerGroup',
                                                },
                                                rightExpressions: [
                                                    {
                                                        expressionType: 2,
                                                        parameter: {
                                                            dataValueType: 10,
                                                            value: 'c32ec91b-7d4f-491f-b8c7-2c1262a4f4a9',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                        logicalOperation: 1,
                                        isEnabled: true,
                                        filterType: 6,
                                        rootSchemaName: 'OmniTask',
                                    },
                                },
                                logicalOperation: 0,
                                isEnabled: true,
                                filterType: 6,
                                rootSchemaName: 'OmniTask',
                            },
                            CustomFilters: {
                                items: {
                                    customFilterOmniStatus_OmniTask: {
                                        filterType: 1,
                                        comparisonType: 3,
                                        isEnabled: true,
                                        trimDateTimeParameterToDate: false,
                                        leftExpression: {
                                            expressionType: 0,
                                            columnPath: 'OmniStatus',
                                        },
                                        rightExpression: {
                                            expressionType: 2,
                                            parameter: {
                                                dataValueType: 10,
                                                value: '1307bf83-ed85-422f-82ae-1c84ce3985cc',
                                            },
                                        },
                                    },
                                },
                                logicalOperation: 0,
                                isEnabled: true,
                                filterType: 6,
                            },
                        },
                        logicalOperation: 0,
                        isEnabled: true,
                        filterType: 6,
                    },
                },
                logicalOperation: 0,
                isEnabled: true,
                filterType: 6,
            },
            columns: {
                items: {
                    Id: {
                        caption: '',
                        orderDirection: 0,
                        orderPosition: -1,
                        isVisible: true,
                        expression: {
                            expressionType: 0,
                            columnPath: 'Id',
                        },
                    },
                },
            },
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://cc.globus.ru/0/DataService/json/Syncreply/SelectQuery',
            headers: headers,
            data: JSON.stringify(jsonData),
            onload: function(response) {
                try {
                    // Парсим ответ как JSON
                    const responseData = JSON.parse(response.responseText);

                    // Проверяем, есть ли данные в ответе
                    if (responseData.rows && Array.isArray(responseData.rows)) {
                        // Собираем все Id в массив
                        const ids = responseData.rows.map(row => row.Id);

                        // Массив для хранения результатов
                        const results = [];

                        // Функция для выполнения запроса с каждым Id
                        function fetchDataForId(id) {
                            const jsonDataForId = {
                                'rootSchemaName': 'OmniTaskChating',
                                'filters': {
                                    'items': {
                                        'sms': {
                                            'items': {
                                                'masterRecordFilter': {
                                                    'filterType': 1,
                                                    'comparisonType': 3,
                                                    'leftExpression': {
                                                        'expressionType': 0,
                                                        'columnPath': 'OmniTask',
                                                    },
                                                    'rightExpression': {
                                                        'expressionType': 2,
                                                        'parameter': {
                                                            'dataValueType': 1,
                                                            'value': id, // Подставляем Id
                                                        },
                                                    },
                                                },
                                            },
                                            'logicalOperation': 0,
                                            'isEnabled': true,
                                            'filterType': 6,
                                        },
                                    },
                                    'logicalOperation': 0,
                                    'isEnabled': true,
                                    'filterType': 6,
                                },
                                'columns': {
                                    'items': {
                                        'OmniMessage': {
                                            'expression': {
                                                'columnPath': 'OmniMessage',
                                            },
                                        },
                                    },
                                },
                            };

                            // Отправляем запрос для текущего Id
                            GM_xmlhttpRequest({
                                method: 'POST',
                                url: 'https://cc.globus.ru/0/DataService/json/SyncReply/SelectQuery',
                                headers: headers,
                                data: JSON.stringify(jsonDataForId),
                                onload: function(responseForId) {
                                    try {
                                        // Парсим ответ
                                        const responseDataForId = JSON.parse(responseForId.responseText);

                                        // Ищем ссылку в ответе
                                        let linkNumber = "Без бага"; // По умолчанию "Без бага"

                                        // Функция для поиска ссылки
  // Функция для поиска ссылки в тексте
function findLinkNumber(data) {
    if (typeof data === 'string') {
        // Проверяем, содержит ли строка ссылку
        const linkMatch = data.match(/https:\/\/tfs-devops\.globus\.ru\/.*\/(\d+)/);
        if (linkMatch && linkMatch[1]) {
            return linkMatch[1]; // Возвращаем число
        }

        // Проверяем альтернативный формат ссылки
        const altLinkMatch = data.match(/https:\/\/tfs-devops\.globus\.ru\/.*\/Epics\/\?workitem=(\d+)/);
        if (altLinkMatch && altLinkMatch[1]) {
            return altLinkMatch[1]; // Возвращаем число
        }
    } else if (typeof data === 'object' && data !== null) {
        // Рекурсивно ищем в объекте или массиве
        for (const key in data) {
            const result = findLinkNumber(data[key]);
            if (result) {
                return result;
            }
        }
    }
    return null;
}
                                        // Ищем ссылку в ответе
                                        linkNumber = findLinkNumber(responseDataForId) || "Без бага";

                                        // Если ссылка найдена, выполняем запрос на получение state
                                        if (linkNumber !== "Без бага") {
                                            fetchWorkItemState(id, linkNumber, results, ids);
                                        } else {
                                            // Если ссылка не найдена, добавляем результат с "Без бага"
                                            results.push({
                                                id: id,
                                                linkNumber: "Без бага",
                                                state: "Без бага"
                                            });

                                            // Если все запросы выполнены, выводим результат
                                            if (results.length === ids.length) {
                                                console.log('Final Results:', results);
                                                displayTable(results); // Выводим таблицу
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Failed to parse response for Id:', id, error);
                                    }
                                },
                                onerror: function(error) {
                                    console.error('Request failed for Id:', id, error);
                                }
                            });
                        }

                        // Выполняем запросы для каждого Id
                        ids.forEach(fetchDataForId);
                    } else {
                        console.error('No rows found in the response:', responseData);
                    }
                } catch (error) {
                    console.error('Failed to parse response:', error);
                }
            },
            onerror: function(error) {
                console.error('Request failed:', error);
            }
        });

        // Функция для выполнения запроса на получение state
        function fetchWorkItemState(id, linkNumber, results, ids) {
            const apiUrl = `https://tfs-devops.globus.ru/DigitalOne/_apis/wit/workItems/${linkNumber}?%24expand=1`;

            // Use GM_xmlhttpRequest to make a GET request
            GM_xmlhttpRequest({
                method: "GET",
                url: apiUrl,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const state = data.fields["System.State"] || "Без бага";

                        // Добавляем результат в массив
                        results.push({
                            id: id,
                            linkNumber: linkNumber,
                            state: state
                        });

                        // Если все запросы выполнены, выводим результат
                        if (results.length === ids.length) {
                            console.log('Final Results:', results);
                            displayTable(results); // Выводим таблицу
                        }
                    } catch (error) {
                        console.error("Error parsing response:", error);
                    }
                },
                onerror: function(error) {
                    console.error("Request failed:", error);
                }
            });
        }
    }

// Функция для отображения таблицы
// Функция для отображения таблицы
function displayTable(data) {
    // Порядок состояний багов для сортировки
    const bugStateOrder = [
        "New",
        "Analysis",
        "Approved",
        "On hold",
        "In Progress",
        "Review",
        "Ready for test",
        "Testing",
        "Ready for release",
        "Done",
        "Removed"
    ];

    // Сортируем данные в обратном порядке по состоянию багов
    data.sort((a, b) => {
        const aIndex = bugStateOrder.indexOf(a.state);
        const bIndex = bugStateOrder.indexOf(b.state);
        return bIndex - aIndex; // Обратный порядок
    });

    // Создаем контейнер для таблицы
    const tableContainer = document.createElement('div');
    tableContainer.style.position = 'fixed';
    tableContainer.style.top = '50%';
    tableContainer.style.left = '50%';
    tableContainer.style.transform = 'translate(-50%, -50%)'; // Центрируем контейнер
    tableContainer.style.width = '80%';
    tableContainer.style.maxWidth = '800px';
    tableContainer.style.backgroundColor = 'white';
    tableContainer.style.zIndex = '10000';
    tableContainer.style.borderRadius = '8px';
    tableContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    tableContainer.style.display = 'flex';
    tableContainer.style.flexDirection = 'column';
    tableContainer.style.animation = 'slideIn 0.5s ease-in-out forwards'; // Добавляем анимацию
    tableContainer.style.border = '1px solid #eaeaea'; // Боковые рамки
    tableContainer.style.maxHeight = '90vh'; // Максимальная высота контейнера
    tableContainer.style.overflowY = 'auto'; // Добавляем вертикальный скроллбар при необходимости

    // Создаем блок статистики
    const statsContainer = document.createElement('div');
    statsContainer.style.display = 'flex';
    statsContainer.style.justifyContent = 'space-between';
    statsContainer.style.padding = '12px 16px';
    statsContainer.style.backgroundColor = '#f9f9f9';
    statsContainer.style.borderBottom = '1px solid #eaeaea';
    statsContainer.style.fontSize = '16px'; // Увеличенный размер шрифта
    statsContainer.style.fontWeight = 'normal'; // Убираем жирность

    // Вычисляем статистику
    const totalRequests = data.length; // Общее число заявок
    const requestsWithBugs = data.filter(item => item.state !== "Без бага").length; // Заявки с багами
    const requestsWithBugsDone = data.filter(item => item.state === "Done").length; // Заявки с багами в статусе Done

    // Добавляем статистику в блок
    const totalRequestsText = document.createElement('span');
    totalRequestsText.textContent = `Заявок в работе: ${totalRequests}`;
    statsContainer.appendChild(totalRequestsText);

    const requestsWithBugsText = document.createElement('span');
    requestsWithBugsText.textContent = `Заявок с багами: ${requestsWithBugs}`;
    statsContainer.appendChild(requestsWithBugsText);

    const requestsWithBugsDoneText = document.createElement('span');
    requestsWithBugsDoneText.textContent = `Решено багов: ${requestsWithBugsDone}`;
    statsContainer.appendChild(requestsWithBugsDoneText);

    // Создаем кнопки управления
    const controlButtons = document.createElement('div');
    controlButtons.style.display = 'flex';
    controlButtons.style.justifyContent = 'flex-end';
    controlButtons.style.padding = '12px 16px';
    controlButtons.style.backgroundColor = '#f9f9f9';
    controlButtons.style.borderBottom = '1px solid #eaeaea';

    // Кнопка закрытия
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Закрыть';
    closeButton.style.padding = '6px 14px';
    closeButton.style.backgroundColor = '#dc3545';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.borderRadius = '4px';
    closeButton.style.fontSize = '16px'; // Увеличенный размер шрифта
    closeButton.style.fontWeight = 'normal'; // Убираем жирность
    closeButton.addEventListener('click', () => {
        tableContainer.remove(); // Удаляем таблицу
        document.body.prepend(startButton);
    });

    controlButtons.appendChild(closeButton);

    // Создаем таблицу
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '16px'; // Увеличенный размер шрифта
    table.style.border = '1px solid #eaeaea'; // Боковые рамки для таблицы

    // Создаем заголовок таблицы
    const headerRow = document.createElement('tr');
    ['ID Заявки', 'ID Бага', 'Состояние'].forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.style.borderBottom = '2px solid #ddd';
        th.style.padding = '12px 16px';
        th.style.backgroundColor = '#f9f9f9';
        th.style.fontSize = '18px'; // Увеличенный размер шрифта
        th.style.fontWeight = 'normal'; // Убираем жирность
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Заполняем таблицу данными
    data.forEach(item => {
        const row = document.createElement('tr');
        row.style.transition = 'background-color 0.3s ease';

        // ID Заявки
        const idCell = document.createElement('td');
        idCell.style.borderBottom = '1px solid #eaeaea';
        idCell.style.padding = '12px 16px';

        // Формируем ссылку для ID Заявки
        const idLink = document.createElement('a');
        idLink.textContent = item.id;
        idLink.href = `https://cc.globus.ru/0/Nui/ViewModule.aspx#CardModuleV2/OmniTask1Page/edit/${item.id}`;
        idLink.target = '_blank'; // Открываем ссылку в новом окне
        idLink.style.color = '#007bff';
        idLink.style.textDecoration = 'none';
        idLink.style.transition = 'color 0.3s ease';
        idLink.style.fontSize = '16px'; // Увеличенный размер шрифта
        idLink.style.fontWeight = 'normal'; // Убираем жирность
        idLink.addEventListener('mouseover', () => idLink.style.color = '#0056b3');
        idLink.addEventListener('mouseout', () => idLink.style.color = '#007bff');
        idCell.appendChild(idLink);

        row.appendChild(idCell);

        // ID Бага
        const bugIdCell = document.createElement('td');
        bugIdCell.style.borderBottom = '1px solid #eaeaea';
        bugIdCell.style.padding = '12px 16px';

        if (item.linkNumber !== "Без бага") {
            // Создаем ссылку для ID Бага
            const bugLink = document.createElement('a');
            bugLink.textContent = item.linkNumber;
            bugLink.href = `https://tfs-devops.globus.ru/DigitalOne/Dev-Support/_workitems/edit/${item.linkNumber}`;
            bugLink.target = '_blank'; // Открываем ссылку в новом окне
            bugLink.style.color = '#007bff';
            bugLink.style.textDecoration = 'none';
            bugLink.style.transition = 'color 0.3s ease';
            bugLink.style.fontSize = '16px'; // Увеличенный размер шрифта
            bugLink.style.fontWeight = 'normal'; // Убираем жирность
            bugLink.addEventListener('mouseover', () => bugLink.style.color = '#0056b3');
            bugLink.addEventListener('mouseout', () => bugLink.style.color = '#007bff');
            bugIdCell.appendChild(bugLink);
        } else {
            // Если бага нет, просто текст
            bugIdCell.textContent = item.linkNumber;
            bugIdCell.style.fontSize = '16px'; // Увеличенный размер шрифта
            bugIdCell.style.fontWeight = 'normal'; // Убираем жирность
        }

        row.appendChild(bugIdCell);

        // Состояние
        const stateCell = document.createElement('td');
        stateCell.style.borderBottom = '1px solid #eaeaea';
        stateCell.style.padding = '12px 16px';

        if (item.state !== "Без бага") {
            // Создаем ссылку для состояния
            const stateLink = document.createElement('a');
            stateLink.textContent = item.state;
            stateLink.href = `https://tfs-devops.globus.ru/DigitalOne/Dev-Support/_workitems/edit/${item.linkNumber}`;
            stateLink.target = '_blank'; // Открываем ссылку в новом окне
            stateLink.style.textDecoration = 'none';
            stateLink.style.fontSize = '16px'; // Увеличенный размер шрифта
            stateLink.style.fontWeight = 'normal'; // Убираем жирность

            // Устанавливаем цвет ссылки в зависимости от состояния
            if (["New", "Analysis", "Approved"].includes(item.state)) {
                stateLink.style.color = 'white';
                stateLink.style.backgroundColor = '#007bff';
                stateLink.style.padding = '4px 8px';
                stateLink.style.borderRadius = '4px';
            } else if (["On hold", "In Progress", "Review", "Ready for test", "Testing", "Ready for release"].includes(item.state)) {
                stateLink.style.color = 'black';
                stateLink.style.backgroundColor = 'rgb(251, 209, 68)';
                stateLink.style.padding = '4px 8px';
                stateLink.style.borderRadius = '4px';
            } else if (item.state === "Done") {
                stateLink.style.color = 'white';
                stateLink.style.backgroundColor = 'green';
                stateLink.style.padding = '4px 8px';
                stateLink.style.borderRadius = '4px';
                stateLink.style.animation = 'pulse 1.5s infinite'; // Анимация пульсации
            }

            stateCell.appendChild(stateLink);
        } else {
            // Если нет состояния, просто текст
            stateCell.textContent = item.state;
            stateCell.style.fontSize = '16px'; // Увеличенный размер шрифта
            stateCell.style.fontWeight = 'normal'; // Убираем жирность
        }

        row.appendChild(stateCell);
        table.appendChild(row);

        // Добавляем эффект наведения на строку
        row.addEventListener('mouseover', () => row.style.backgroundColor = '#f1f1f1');
        row.addEventListener('mouseout', () => row.style.backgroundColor = 'transparent');
    });

    // Добавляем таблицу в контейнер
    tableContainer.appendChild(statsContainer); // Добавляем статистику
    tableContainer.appendChild(controlButtons);
    tableContainer.appendChild(table);

    // Добавляем контейнер на страницу
    document.body.prepend(tableContainer);

    // Добавляем анимацию в CSS
    const style = document.createElement('style');
    style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
        100% {
            transform: scale(1);
        }
    }
    `;
    document.head.appendChild(style);
}
    // Кнопка для запуска процесса
const startButton = document.createElement('button');
startButton.textContent = 'Bug checker';
startButton.style.position = 'fixed';
startButton.style.top = '10px';
startButton.style.left = '50%';
startButton.style.transform = 'translateX(-50%)';
startButton.style.padding = '8px 16px'; // Уменьшенные отступы
startButton.style.backgroundColor = '#213494';
startButton.style.color = 'white';
startButton.style.border = 'none';
startButton.style.cursor = 'pointer';
startButton.style.borderRadius = '6px'; // Уменьшенное закругление
startButton.style.zIndex = '10001';
startButton.style.fontSize = '14px'; // Уменьшенный размер шрифта
startButton.style.fontWeight = 'normal'; // Убираем жирность
startButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'; // Уменьшенная тень
startButton.style.transition = 'background-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease'; // Плавные переходы

// Анимация при наведении
startButton.addEventListener('mouseover', () => {
    startButton.style.backgroundColor = '#152575'; // Темнее при наведении
    startButton.style.transform = 'translateX(-50%) scale(1.05)'; // Увеличиваем размер
    startButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'; // Увеличиваем тень
});

// Возвращаем исходные стили при уходе курсора
startButton.addEventListener('mouseout', () => {
    startButton.style.backgroundColor = '#213494';
    startButton.style.transform = 'translateX(-50%) scale(1)';
    startButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
});

startButton.addEventListener('click', () => {
    startButton.remove();
    sendRequest(); // Запускаем процесс
});

// Добавляем кнопку на страницу
document.body.prepend(startButton);

    // Ожидаем полной загрузки страницы
    window.addEventListener('load', function() {
        // Кнопка уже добавлена, процесс запускается по нажатию
    });
})();