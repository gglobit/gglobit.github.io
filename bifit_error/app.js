let analysisData = null;

function parseInput(text) {
    let jsonText = text.trim();
    
    const bodyMatch = text.match(/Body:\s*(\{[\s\S]*)/);
    if (bodyMatch) {
        jsonText = bodyMatch[1];
    }
    
    const startIndex = jsonText.indexOf('{');
    if (startIndex === -1) {
        throw new Error('JSON объект не найден');
    }
    
    jsonText = jsonText.substring(startIndex);
    
    let braceCount = 0;
    let endIndex = -1;
    let inString = false;
    let escape = false;
    
    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escape) {
            escape = false;
            continue;
        }
        
        if (char === '\\' && inString) {
            escape = true;
            continue;
        }
        
        if (char === '"' && !escape) {
            inString = !inString;
            continue;
        }
        
        if (!inString) {
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i;
                    break;
                }
            }
        }
    }
    
    if (endIndex === -1) {
        throw new Error('Не удалось найти конец JSON объекта');
    }
    
    jsonText = jsonText.substring(0, endIndex + 1);
    
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, (char) => {
            if (char === '\n' || char === '\r' || char === '\t') return char;
            return '';
        });
        return JSON.parse(jsonText);
    }
}

function analyzeOrder() {
    const input = document.getElementById('inputJson').value.trim();
    if (!input) {
        alert('Вставьте текст запроса');
        return;
    }
    
    let data;
    try {
        data = parseInput(input);
    } catch (e) {
        alert('Ошибка парсинга JSON: ' + e.message);
        console.error(e);
        return;
    }
    
    const order = data.onlineOrder;
    const items = data.onlineOrderItems || [];
    
    analysisData = {
        order: order,
        items: items,
        barcodeGroups: {},
        problems: [],
        stats: {
            totalItems: items.length,
            weightItems: 0,
            pieceItems: 0,
            markedItems: 0,
            unmarkedItems: 0
        }
    };
    
    items.forEach((item, index) => {
        item._index = index;
        const barcode = item.barcode || item.vendorCode || 'NO_BARCODE';
        
        if (!analysisData.barcodeGroups[barcode]) {
            analysisData.barcodeGroups[barcode] = {
                barcode: barcode,
                items: [],
                marks: [],
                totalQuantity: 0,
                totalAmount: 0,
                isWeight: false,
                isMarked: false,
                problems: []
            };
        }
        
        const group = analysisData.barcodeGroups[barcode];
        group.items.push(item);
        group.totalQuantity += item.quantity;
        group.totalAmount += item.price * item.quantity;
        
        if (item.unitCode === 166) {
            group.isWeight = true;
            analysisData.stats.weightItems++;
        } else {
            analysisData.stats.pieceItems++;
        }
        
        if (item.markType || item.codeForOfd) {
            group.isMarked = true;
            group.marks.push({
                code: item.codeForOfd,
                markType: item.markType,
                quantity: item.quantity,
                itemIndex: index
            });
            analysisData.stats.markedItems++;
        } else {
            analysisData.stats.unmarkedItems++;
        }
    });
    
    findProblems();
    renderAmountAnalysis();
    renderProblems();
}

function findProblems() {
    const groups = analysisData.barcodeGroups;
    
    for (const barcode in groups) {
        const group = groups[barcode];
        
        const hasWeightItems = group.items.some(i => i.unitCode === 166);
        const hasPieceItems = group.items.some(i => i.unitCode === 796);
        
        if (hasWeightItems && hasPieceItems) {
            const problem = {
                type: 'MIXED_UNIT',
                severity: 'critical',
                title: 'Смешанные единицы измерения',
                description: `Товар "${group.items[0].description}" имеет позиции и как весовой (166), и как штучный (796)`,
                barcode: barcode,
                items: group.items
            };
            group.problems.push(problem);
            analysisData.problems.push(problem);
        }
        
        const descriptions = new Set(group.items.map(i => i.description));
        if (descriptions.size > 1) {
            const descList = [...descriptions];
            const problem = {
                type: 'DIFFERENT_PRODUCTS_SAME_BARCODE',
                severity: 'critical',
                title: 'Разные товары с одним ШК',
                description: `ШК ${barcode} используется для разных товаров: ${descList.join(', ')}`,
                barcode: barcode,
                items: group.items
            };
            group.problems.push(problem);
            analysisData.problems.push(problem);
        }
        
        if (group.items.length > 1) {
            const itemsWithMark = group.items.filter(i => i.codeForOfd);
            const itemsWithoutMark = group.items.filter(i => !i.codeForOfd);
            const itemsWithoutCheck = group.items.filter(i => i.codeForOfd && !i.markCheck);
            
            if (itemsWithMark.length > 0 && itemsWithoutMark.length > 0) {
                const isMarkedProduct = group.items.some(i => i.paymentSubject === 'TM' || i.paymentSubject === 'ATM');
                if (isMarkedProduct) {
                    const problem = {
                        type: 'PARTIAL_MARKS',
                        severity: 'critical',
                        title: 'Не все позиции имеют марку',
                        description: `${itemsWithMark.length} поз. с маркой, ${itemsWithoutMark.length} поз. без`,
                        barcode: barcode,
                        items: itemsWithoutMark
                    };
                    group.problems.push(problem);
                    analysisData.problems.push(problem);
                }
            }
            
            if (itemsWithoutCheck.length > 0) {
                const problem = {
                    type: 'MISSING_MARK_CHECK',
                    severity: 'critical',
                    title: 'Нет проверки марки',
                    description: `${itemsWithoutCheck.length} поз. с маркой, но без проверки`,
                    barcode: barcode,
                    items: itemsWithoutCheck
                };
                group.problems.push(problem);
                analysisData.problems.push(problem);
            }
        }
        
        if (group.isMarked && !group.isWeight) {
            const marksCount = group.marks.filter(m => m.code).length;
            const totalPieceQty = group.items.filter(i => i.unitCode === 796).reduce((sum, i) => sum + i.quantity, 0);
            
            if (marksCount !== Math.round(totalPieceQty) && totalPieceQty > 0) {
                const problem = {
                    type: 'MARKS_COUNT_MISMATCH',
                    severity: 'warning',
                    title: 'Кол-во марок ≠ кол-ву товара',
                    description: `Марок: ${marksCount}, товара: ${Math.round(totalPieceQty)}`,
                    barcode: barcode,
                    items: group.items
                };
                group.problems.push(problem);
                analysisData.problems.push(problem);
            }
        }
        
        group.items.forEach(item => {
            if ((item.paymentSubject === 'TM' || item.paymentSubject === 'ATM') && !item.codeForOfd) {
                const problem = {
                    type: 'MISSING_MARK',
                    severity: 'critical',
                    title: 'Нет марки',
                    description: `Маркированный товар без марки`,
                    barcode: barcode,
                    items: [item]
                };
                group.problems.push(problem);
                analysisData.problems.push(problem);
            }
        });
        
        const markCodes = group.marks.map(m => m.code).filter(c => c);
        const uniqueMarks = new Set(markCodes);
        if (markCodes.length !== uniqueMarks.size) {
            const problem = {
                type: 'DUPLICATE_MARKS',
                severity: 'critical',
                title: 'Дублирующиеся марки',
                description: `Повторяющиеся коды марок`,
                barcode: barcode,
                items: group.items
            };
            group.problems.push(problem);
            analysisData.problems.push(problem);
        }
        
        const vendorCodes = new Set(group.items.map(i => i.vendorCode));
        if (vendorCodes.size > 1) {
            const problem = {
                type: 'DIFFERENT_VENDOR_CODES',
                severity: 'critical',
                title: 'Чужой ШК',
                description: `Под ШК "${barcode}" разные артикулы: ${[...vendorCodes].join(', ')}`,
                barcode: barcode,
                items: group.items
            };
            group.problems.push(problem);
            analysisData.problems.push(problem);
        }
        
        group.items.forEach(item => {
            if (item.unitCode === 796 && !Number.isInteger(item.quantity)) {
                const problem = {
                    type: 'FRACTIONAL_PIECE',
                    severity: 'critical',
                    title: 'Дробное количество',
                    description: `Штучный товар с дробным количеством: ${item.quantity}`,
                    barcode: barcode,
                    items: [item]
                };
                group.problems.push(problem);
                analysisData.problems.push(problem);
            }
        });
    }
    
    const descriptionGroups = {};
    for (const barcode in groups) {
        const group = groups[barcode];
        const desc = group.items[0].description;
        if (!descriptionGroups[desc]) {
            descriptionGroups[desc] = [];
        }
        descriptionGroups[desc].push(barcode);
    }
    
    for (const desc in descriptionGroups) {
        if (descriptionGroups[desc].length > 1) {
            const barcodes = descriptionGroups[desc];
            const allItems = barcodes.flatMap(bc => groups[bc].items);
            
            const problem = {
                type: 'SAME_NAME_DIFFERENT_BARCODE',
                severity: 'critical',
                title: 'Один товар с разными ШК',
                description: `ШК: ${barcodes.join(', ')}`,
                barcode: barcodes.join(', '),
                items: allItems
            };
            analysisData.problems.push(problem);
            
            const isMarkedProduct = allItems.some(i => i.paymentSubject === 'TM' || i.paymentSubject === 'ATM');
            if (isMarkedProduct) {
                const itemsWithMark = allItems.filter(i => i.codeForOfd);
                const itemsWithoutMark = allItems.filter(i => !i.codeForOfd);
                const itemsWithoutCheck = allItems.filter(i => i.codeForOfd && !i.markCheck);
                
                if (itemsWithMark.length > 0 && itemsWithoutMark.length > 0) {
                    const problem2 = {
                        type: 'PARTIAL_MARKS_CROSS_BARCODE',
                        severity: 'critical',
                        title: 'Часть позиций без марки',
                        description: `${itemsWithMark.length} с маркой, ${itemsWithoutMark.length} без`,
                        barcode: barcodes.join(', '),
                        items: allItems
                    };
                    analysisData.problems.push(problem2);
                }
                
                if (itemsWithoutCheck.length > 0) {
                    const problem3 = {
                        type: 'MISSING_MARK_CHECK_CROSS_BARCODE',
                        severity: 'critical',
                        title: 'Нет проверки марки',
                        description: `${itemsWithoutCheck.length} поз. без проверки`,
                        barcode: barcodes.join(', '),
                        items: allItems
                    };
                    analysisData.problems.push(problem3);
                }
            }
        }
    }
}

function findSuspectItems(difference) {
    const suspects = [];
    const items = analysisData.items;
    const groups = analysisData.barcodeGroups;
    const tolerance = 0.015;
    const addedDescriptions = new Set();
    
    const descriptionGroups = {};
    items.forEach(item => {
        if (!descriptionGroups[item.description]) {
            descriptionGroups[item.description] = [];
        }
        descriptionGroups[item.description].push(item);
    });
    
    for (const desc in descriptionGroups) {
        const itemsWithSameName = descriptionGroups[desc];
        if (itemsWithSameName.length > 1) {
            const barcodes = new Set(itemsWithSameName.map(i => i.barcode));
            if (barcodes.size > 1) {
                const item = itemsWithSameName[0];
                const itemTotal = item.price * item.quantity;
                if (Math.abs(itemTotal - difference) < tolerance || Math.abs(item.price - difference) < tolerance) {
                    suspects.push({
                        item: item,
                        reason: `Дубль товара с разными ШК`,
                        priority: 0
                    });
                    addedDescriptions.add(desc);
                }
            }
        }
    }
    
    analysisData.problems.forEach(p => {
        const item = p.items[0];
        if (addedDescriptions.has(item.description)) return;
        
        const itemTotal = item.price * item.quantity;
        if (Math.abs(itemTotal - difference) < tolerance || Math.abs(item.price - difference) < tolerance) {
            suspects.push({
                item: item,
                reason: `Проблемная позиция`,
                priority: 1
            });
            addedDescriptions.add(item.description);
        }
    });
    
    items.forEach(item => {
        if (addedDescriptions.has(item.description)) return;
        
        const itemTotal = item.price * item.quantity;
        if (Math.abs(itemTotal - difference) < tolerance) {
            suspects.push({
                item: item,
                reason: `Сумма ${itemTotal.toFixed(2)} ₽`,
                priority: 5
            });
            addedDescriptions.add(item.description);
        } else if (Math.abs(item.price - difference) < tolerance) {
            suspects.push({
                item: item,
                reason: `Цена ${item.price.toFixed(2)} ₽`,
                priority: 6
            });
            addedDescriptions.add(item.description);
        }
    });
    
    suspects.sort((a, b) => a.priority - b.priority);
    return suspects;
}

function renderAmountAnalysis() {
    const order = analysisData.order;
    const items = analysisData.items;
    
    let calculatedTotal = 0;
    items.forEach(item => {
        calculatedTotal += item.price * item.quantity;
    });
    
    const declaredTotal = order.totalAmount || 0;
    const difference = calculatedTotal - declaredTotal;
    const absDiff = Math.abs(difference);
    const isMatch = absDiff < 0.01;
    
    let html = `
        <div class="sum-numbers">
            <div class="sum-row">
                <span class="sum-label">В заказе:</span>
                <span class="sum-value">${declaredTotal.toFixed(2)} ₽</span>
            </div>
            <div class="sum-row">
                <span class="sum-label">Расчёт:</span>
                <span class="sum-value">${calculatedTotal.toFixed(2)} ₽</span>
            </div>
            <div class="sum-row">
                <span class="sum-label">Разница:</span>
                <span class="sum-diff ${isMatch ? 'ok' : 'error'}">
                    ${difference > 0 ? '+' : ''}${difference.toFixed(2)} ₽
                </span>
            </div>
        </div>
    `;
    
    if (!isMatch) {
        const suspects = findSuspectItems(absDiff);
        
        if (suspects.length > 0) {
            html += `<div class="suspects-container">
                <div class="suspects-title">Вероятная причина (${absDiff.toFixed(2)} ₽):</div>`;
            suspects.slice(0, 3).forEach((s, idx) => {
                const isPrimary = idx === 0 && s.priority <= 1;
                const cardClass = isPrimary ? 'suspect-card primary' : 'suspect-card';
                html += `<div class="${cardClass}">
                    <div class="name">${s.item.description}</div>
                    <div class="price">Цена: ${s.item.price.toFixed(2)} ₽</div>
                    <div class="reason">${isPrimary ? '⚠ ' : ''}${s.reason}</div>
                </div>`;
            });
            html += `</div>`;
        }
    }
    
    document.getElementById('sumContent').innerHTML = html;
}

function renderProblems() {
    const problems = analysisData.problems;
    
    // Обновляем счётчик
    const countEl = document.getElementById('problemsCount');
    if (problems.length === 0) {
        countEl.style.display = 'none';
        document.getElementById('problemsList').innerHTML = `
            <div class="success-state">
                <span>✓</span> Проблем не обнаружено
            </div>
        `;
        return;
    }
    
    countEl.textContent = problems.length;
    countEl.style.display = 'inline';
    
    // Группируем по позициям
    const groupedByPosition = {};
    problems.forEach(problem => {
        problem.items.forEach(item => {
            const key = item._index;
            if (!groupedByPosition[key]) {
                groupedByPosition[key] = {
                    index: item._index,
                    description: item.description,
                    barcode: item.barcode,
                    vendorCode: item.vendorCode,
                    price: item.price,
                    quantity: item.quantity,
                    hasMark: !!item.codeForOfd,
                    hasCheck: !!item.markCheck,
                    problems: []
                };
            }
            if (!groupedByPosition[key].problems.find(p => p.type === problem.type)) {
                groupedByPosition[key].problems.push(problem);
            }
        });
    });
    
    const sortedPositions = Object.values(groupedByPosition).sort((a, b) => a.index - b.index);
    
    function findBarcodeOwner(barcode, currentDesc) {
        for (const item of analysisData.items) {
            if (item.vendorCode === barcode && item.description !== currentDesc) {
                return item.description;
            }
        }
        for (const item of analysisData.items) {
            if (item.barcode === barcode && item.description !== currentDesc) {
                return item.description;
            }
        }
        return null;
    }
    
    let html = '';
    sortedPositions.forEach(pos => {
        const hasCritical = pos.problems.some(p => p.severity === 'critical');
        const cardClass = hasCritical ? '' : 'warning';
        
        const hasWrongBarcode = pos.barcode && pos.vendorCode && pos.barcode !== pos.vendorCode;
        const barcodeOwner = hasWrongBarcode ? findBarcodeOwner(pos.barcode, pos.description) : null;
        
        let detailsHtml = '';
        
        if (hasWrongBarcode) {
            const ownerName = barcodeOwner || 'неизвестный товар';
            detailsHtml += `<div class="wrong-barcode">⚠ Чужой ШК от "${ownerName}"</div>`;
        }
        
        if (!pos.hasMark) {
            detailsHtml += `<div class="no-mark">✕ Нет марки</div>`;
        } else if (!pos.hasCheck) {
            detailsHtml += `<div class="no-mark">✕ Нет проверки марки</div>`;
        }
        
        const tags = pos.problems.map(p => `<div class="problem-tag">${p.title}</div>`).join('');
        
        const ownBarcode = pos.vendorCode || pos.barcode || '';
        
        html += `
            <div class="problem-card ${cardClass}">
                <div class="problem-header">
                    <div class="problem-icon">${hasCritical ? '!' : '?'}</div>
                    <div>
                        <span class="problem-name">${pos.description}</span>
                        <span class="problem-barcode">${ownBarcode}</span>
                    </div>
                </div>
                <div class="problem-details">
                    ${detailsHtml}
                    <div class="problem-tags">${tags}</div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('problemsList').innerHTML = html;
}

function clearAll() {
    document.getElementById('inputJson').value = '';
    document.getElementById('sumContent').innerHTML = '';
    document.getElementById('problemsList').innerHTML = `
        <div class="empty-state">
            <div class="icon">📋</div>
            <div>Вставьте запрос и нажмите "Анализировать"</div>
        </div>
    `;
    document.getElementById('problemsCount').style.display = 'none';
    analysisData = null;
}
