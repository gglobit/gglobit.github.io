// ==UserScript==
// @name         ExportExcel
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Генератор отчетов по заказу
// @author       Chertilasus
// @match        *://d1.globus.ru/ensi-ctl/orders/list/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.16.9/xlsx.full.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script loaded.');

    // Функция для форматирования чисел с разделением целой и дробной части запятой
    function formatNumber(num) {
        return num.toString().replace(/\./g, ',');
    }

    // Функция для генерации и скачивания Excel файла
    async function generateAndDownloadExcel(response, orderNumber) {
        console.log('Generating Excel file...');
        var workbook = XLSX.utils.book_new();

        var items = response.data.items.map((item) => {
            let weightRangeMatch = item.name.match(/(\d+([.,]\d+)?)-(\d+([.,]\d+)?)\s*(г|кг)/);
            let averageWeight = '';
            if (weightRangeMatch) {
                let weight1 = weightRangeMatch[1].includes(',') || weightRangeMatch[1].includes('.') ? parseFloat(weightRangeMatch[1].replace(',', '.')) : parseInt(weightRangeMatch[1]);
                let weight2 = weightRangeMatch[3].includes(',') || weightRangeMatch[3].includes('.') ? parseFloat(weightRangeMatch[3].replace(',', '.')) : parseInt(weightRangeMatch[3]);
                let unit = weightRangeMatch[5];
                if (unit === 'г') {
                    averageWeight = formatNumber((weight1 + weight2) / 2 / 1000); // Переводим в килограммы
                } else if (unit === 'кг') {
                    averageWeight = formatNumber((weight1 + weight2) / 2); // Остается в килограммах
                }
            }
            let totalWeight = item.sell_type === 'weight-by-piece' ? formatNumber(item.picked_weight / 1000) : ''; // Переводим в килограммы
            let regularPrice = formatNumber(item.cost / 100);
            let priceWithDiscount = formatNumber(item.price / 100);
            let priceWithoutPromo = item.sell_type === 'weight-by-piece' && item.picked_weight && item.qty ? formatNumber((item.price / item.picked_weight) * item.picked_weight / item.qty) : priceWithDiscount;
            let totalWithoutPromo = item.qty ? formatNumber(item.qty * priceWithoutPromo) : '';
            let priceWithDiscountAndPromo = formatNumber(item.price_with_rules / 100);
            let totalWithQuantity = formatNumber(item.price_total / 100);
            return [
                item.name,
                averageWeight,
                totalWeight,
                item.qty,
                regularPrice,
                priceWithDiscount,
                priceWithoutPromo,
                totalWithoutPromo,
                priceWithDiscountAndPromo,
                totalWithQuantity
            ];
        });

        items.unshift([
            "Название",
            "Средний вес",
            "Итоговый вес",
            "Кол-во",
            "Регулярная цена, руб.",
            "Цена со скидкой, руб.",
            "Цена без промокода, руб.",
            "Итого без учета промокода, руб.",
            "Цена со скидкой и промокодом, руб.",
            "Итого с учетом кол-ва, руб."
        ]);

        // Суммируем значения в столбце "Итого без учета промокода, руб."
        let totalWithoutPromoSum = items.slice(1).reduce((sum, item) => sum + parseFloat(item[7].replace(',', '.')), 0);

        items.push([
            "Итого",
            "",
            "",
            "",
            "",
            "",
            "",
            formatNumber(totalWithoutPromoSum),
            "",
            formatNumber(response.data.price / 100)
        ]);

        items.push([
            "Скидка",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            formatNumber(totalWithoutPromoSum - response.data.price / 100)
        ]);

        var worksheet = XLSX.utils.aoa_to_sheet(items);

        for (let i = 2; i <= items.length - 2; i++) { // Исключаем последние две строки (Итого и Скидка)
            if (response.data.items[i-2].qty === 0) {
                continue; // Пропускаем строки с количеством 0
            }

            if (response.data.items[i-2].sell_type === 'weight-by-piece') {
                worksheet[`G${i}`] = { t: 'n', f: `=F${i}/B${i}*C${i}/D${i}` }; // Формула для штучно-весовых товаров
                worksheet[`H${i}`] = { t: 'n', f: `=F${i}/B${i}*C${i}` }; // Формула для штучно-весовых товаров
            } else {
                worksheet[`G${i}`] = { t: 'n', f: `=F${i}` }; // Формула для штучных и весовых товаров
                worksheet[`H${i}`] = { t: 'n', f: `=G${i}*D${i}` }; // Формула для штучных и весовых товаров
            }
        }

        worksheet[`H${items.length - 1}`] = { t: 'n', f: `=SUM(H2:H${items.length - 2})`};
        worksheet[`J${items.length}`] = { t: 'n', f: `=H${items.length - 1}-J${items.length - 1}`};
        XLSX.utils.book_append_sheet(workbook, worksheet, "Товары");
        var wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([wbout], { type: "application/octet-stream" });
        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Отчет ${orderNumber}.xlsx`;
        link.click();
        console.log('Excel file downloaded.');
    }

    // Функция для создания кнопки
    function createButton() {
        console.log('Creating button...');
        const orderListElement = document.evaluate('//*[@id="orderList"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (orderListElement) {
            const button = document.createElement('button');
            button.innerText = 'Скачать отчет';
            button.style.margin = '5px';
            button.style.padding = '10px 20px';
            button.style.fontSize = '16px';
            button.style.color = '#fff';
            button.style.backgroundColor = '#007bff';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';
            button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
            button.style.transition = 'background-color 0.1s, transform 0.1s';
            button.style.fontFamily = 'Arial, sans-serif';
            button.style.fontWeight = 'bold';

            button.onmouseover = function() {
                button.style.backgroundColor = '#0056b3';
                button.style.transform = 'scale(1.03)';
            };

            button.onmouseout = function() {
                button.style.backgroundColor = '#007bff';
                button.style.transform = 'scale(1)';
            };

            button.onclick = async () => {
                console.log('Button clicked');
                let intercepted = false;
                const originalFetch = fetch;
                window.fetch = async function(resource, options) {
                    console.log('Intercepting fetch request:', resource, options);
                    const response = await originalFetch(resource, options);
                    if (!intercepted && resource.includes('/bff-manage/api/v1/orders/orders/') && resource.includes('?include=')) {
                        console.log('Target URL detected for fetch.');
                        intercepted = true;
                        const text = await response.clone().text(); // Клонируем ответ перед чтением
                        try {
                            const jsonResponse = JSON.parse(text);
                            console.log('Response parsed for fetch:', jsonResponse);
                            const orderNumber = jsonResponse.data.number || 'UnknownOrder';
                            generateAndDownloadExcel(jsonResponse, orderNumber);
                        } catch (e) {
                            console.error('Error parsing response for fetch:', e);
                        }
                    }
                    return response;
                };
            };
            orderListElement.appendChild(button);
            console.log('Button added to the page.');
        } else {
            console.log('Element with XPath //*[@id="orderList"] not found.');
        }
    }

    // Добавляем небольшую задержку перед созданием кнопки
    setTimeout(createButton, 2000);
})();