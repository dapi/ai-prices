// ===== Global State =====
let allModels = [];
let filteredModels = [];
let selectedModels = new Set();
let currentView = 'table';

// ===== Load and Parse CSV =====
async function loadModels() {
    try {
        const response = await fetch('../models.csv');
        const csvText = await response.text();

        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');

        allModels = lines.slice(1).map(line => {
            const values = parseCSVLine(line);
            const model = {};

            headers.forEach((header, index) => {
                model[header.trim()] = values[index]?.trim() || '';
            });

            // Convert numeric fields
            model['Цена за 1M input токенов'] = parseFloat(model['Цена за 1M input токенов']) || 0;
            model['Цена за 1M output токенов'] = parseFloat(model['Цена за 1M output токенов']) || 0;
            model['Контекстное окно'] = parseInt(model['Контекстное окно']) || 0;

            return model;
        });

        filteredModels = [...allModels];
        initializeFilters();
        updateStats();
        renderModels();
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);

    return values;
}

// ===== Initialize Filters =====
function initializeFilters() {
    // Providers
    const providers = [...new Set(allModels.map(m => m['Компания']))].sort();
    const providerContainer = document.getElementById('providerFilters');
    providerContainer.innerHTML = providers.map(p =>
        `<label><input type="checkbox" class="provider-filter" value="${p}"> ${p}</label>`
    ).join('');

    // Modalities
    const modalities = [...new Set(allModels.map(m => m['Модальность']))].sort();
    const modalityContainer = document.getElementById('modalityFilters');
    modalityContainer.innerHTML = modalities.map(m =>
        `<label><input type="checkbox" class="modality-filter" value="${m}"> ${m}</label>`
    ).join('');

    // Attach event listeners
    document.querySelectorAll('.provider-filter, .modality-filter, .rf-filter, .speed-filter, .quality-filter')
        .forEach(checkbox => {
            checkbox.addEventListener('change', applyFilters);
        });

    document.getElementById('priceMin').addEventListener('input', updatePriceLabels);
    document.getElementById('priceMax').addEventListener('input', updatePriceLabels);
    document.getElementById('priceMin').addEventListener('change', applyFilters);
    document.getElementById('priceMax').addEventListener('change', applyFilters);

    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

// ===== Filters Logic =====
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedProviders = getCheckedValues('.provider-filter');
    const selectedModalities = getCheckedValues('.modality-filter');
    const selectedRF = getCheckedValues('.rf-filter');
    const selectedSpeed = getCheckedValues('.speed-filter');
    const selectedQuality = getCheckedValues('.quality-filter');
    const priceMin = parseFloat(document.getElementById('priceMin').value);
    const priceMax = parseFloat(document.getElementById('priceMax').value);

    filteredModels = allModels.filter(model => {
        // Search
        if (searchTerm) {
            const searchableText = `${model['Компания']} ${model['Название модели']} ${model['Кодовое название']}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }

        // Provider
        if (selectedProviders.length > 0 && !selectedProviders.includes(model['Компания'])) {
            return false;
        }

        // Modality
        if (selectedModalities.length > 0 && !selectedModalities.includes(model['Модальность'])) {
            return false;
        }

        // RF Availability
        if (selectedRF.length > 0 && !selectedRF.includes(model['Доступность в РФ'])) {
            return false;
        }

        // Speed
        if (selectedSpeed.length > 0 && !selectedSpeed.includes(model['Скорость'])) {
            return false;
        }

        // Quality
        if (selectedQuality.length > 0 && !selectedQuality.includes(model['Качество'])) {
            return false;
        }

        // Price
        const inputPrice = model['Цена за 1M input токенов'];
        if (inputPrice < priceMin || inputPrice > priceMax) {
            return false;
        }

        return true;
    });

    renderModels();
    updateResultCount();
}

function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector + ':checked'))
        .map(cb => cb.value);
}

function resetFilters() {
    document.querySelectorAll('.filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('priceMin').value = 0;
    document.getElementById('priceMax').value = 10;
    document.getElementById('searchInput').value = '';
    updatePriceLabels();
    applyFilters();
}

function updatePriceLabels() {
    const min = document.getElementById('priceMin').value;
    const max = document.getElementById('priceMax').value;
    document.getElementById('priceMinLabel').textContent = `$${min}`;
    document.getElementById('priceMaxLabel').textContent = `$${max}`;
}

// ===== Stats =====
function updateStats() {
    // Calculate max savings (difference between most expensive and cheapest)
    const prices = allModels.map(m => m['Цена за 1M input токенов']).filter(p => p > 0);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const savingsPercent = Math.round(((maxPrice - minPrice) / maxPrice) * 100);
    document.getElementById('maxSavings').textContent = `${savingsPercent}%`;

    // Popular models (top 3 by quality)
    const topModels = allModels
        .filter(m => m['Качество'] === 'Very High' || m['Качество'] === 'High')
        .slice(0, 3)
        .map(m => m['Кодовое название'])
        .join(', ');
    document.getElementById('popularModels').textContent = topModels || '-';

    // Best deals (top 3 by ROI)
    const modelsWithROI = allModels.map(m => ({
        ...m,
        roi: calculateROI(m)
    })).sort((a, b) => b.roi - a.roi);

    const bestDeals = modelsWithROI
        .slice(0, 3)
        .map(m => m['Кодовое название'])
        .join(', ');
    document.getElementById('bestDeals').textContent = bestDeals || '-';
}

function calculateROI(model) {
    const qualityScore = {
        'Very High': 10,
        'High': 7,
        'Medium': 4,
        'Low': 2
    }[model['Качество']] || 1;

    const avgPrice = (model['Цена за 1M input токенов'] + model['Цена за 1M output токенов']) / 2;
    return avgPrice > 0 ? (qualityScore / avgPrice) * 100 : 0;
}

function updateResultCount() {
    document.getElementById('resultCount').textContent = filteredModels.length;
}

// ===== Render Models =====
function renderModels() {
    if (currentView === 'table') {
        renderTable();
    } else if (currentView === 'cards') {
        renderCards();
    } else if (currentView === 'chart') {
        renderChart();
    }
}

function renderTable() {
    const tbody = document.getElementById('modelsTableBody');

    // Calculate ROI for each model and find max price for savings calculation
    const modelsWithROI = filteredModels.map(m => ({
        ...m,
        roi: calculateROI(m)
    }));

    const maxPrice = Math.max(...allModels.map(m => m['Цена за 1M input токенов']).filter(p => p > 0));

    // Sort models by ROI to determine best deals
    const sortedByROI = [...modelsWithROI].sort((a, b) => b.roi - a.roi);
    const top3ROI = sortedByROI.slice(0, 3).map(m => `${m['Компания']}-${m['Кодовое название']}`);

    // Find fastest models
    const fastestModels = allModels.filter(m => m['Скорость'] === 'Fast').map(m => `${m['Компания']}-${m['Кодовое название']}`);

    tbody.innerHTML = modelsWithROI.map(model => {
        const modelId = `${model['Компания']}-${model['Кодовое название']}`;
        const isSelected = selectedModels.has(modelId);
        const avgPrice = (model['Цена за 1M input токенов'] + model['Цена за 1M output токенов']) / 2;
        const savings = Math.round(((maxPrice - model['Цена за 1M input токенов']) / maxPrice) * 100);

        // Determine badges
        let badges = [];
        if (top3ROI.includes(modelId)) badges.push('🏆 Best Deal');
        if (fastestModels.includes(modelId)) badges.push('⚡ Fastest');
        if (model['Качество'] === 'Very High') badges.push('💎 Premium');

        // Use case tags based on modality
        const useCases = getUseCaseTags(model['Модальность']);

        // ROI color
        const roiClass = model.roi > 150 ? 'roi-high' : model.roi > 75 ? 'roi-medium' : 'roi-low';

        return `
            <tr data-model-id="${modelId}">
                <td><input type="checkbox" class="model-checkbox" ${isSelected ? 'checked' : ''} data-model-id="${modelId}"></td>
                <td class="provider-cell">${model['Компания']}</td>
                <td class="model-cell">
                    ${badges.length > 0 ? `<div class="badges">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>` : ''}
                    ${model['Название модели']}<br><small>${model['Кодовое название']}</small>
                </td>
                <td class="price-cell">
                    <div class="price-info">
                        <span class="price-main">$${model['Цена за 1M input токенов'].toFixed(2)}</span>
                        <small class="price-output">out: $${model['Цена за 1M output токенов'].toFixed(2)}</small>
                        ${savings > 0 ? `<span class="savings">💰 -${savings}%</span>` : ''}
                    </div>
                </td>
                <td>${model['Скорость']}</td>
                <td>${model['Качество']}</td>
                <td>${getRFBadge(model['Доступность в РФ'])}</td>
                <td><span class="roi-value ${roiClass}">${model.roi.toFixed(0)}</span></td>
                <td><div class="use-cases">${useCases}</div></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon" onclick="window.open('${model['API документация URL']}', '_blank')" title="API Docs">📚</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach checkbox listeners
    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleModelSelection);
    });
}

function getUseCaseTags(modality) {
    const tags = [];
    if (modality.includes('Text')) {
        tags.push('<span class="use-case-tag">✍️ Текст</span>');
        tags.push('<span class="use-case-tag">💬 Чат</span>');
        tags.push('<span class="use-case-tag">📊 Данные</span>');
    }
    if (modality.includes('Vision')) {
        tags.push('<span class="use-case-tag">🖼️ Изображения</span>');
    }
    return tags.join('');
}

function renderCards() {
    const container = document.getElementById('cardsView');
    container.innerHTML = filteredModels.map(model => {
        const modelId = `${model['Компания']}-${model['Кодовое название']}`;
        const isSelected = selectedModels.has(modelId);

        return `
            <div class="model-card">
                <div class="model-card-header">
                    <div class="model-card-title">
                        <h3>${model['Название модели']}</h3>
                        <p>${model['Кодовое название']}</p>
                    </div>
                    <div class="model-card-price">
                        <div class="input-price">$${model['Цена за 1M input токенов'].toFixed(2)}</div>
                        <div class="output-price">out: $${model['Цена за 1M output токенов'].toFixed(2)}</div>
                    </div>
                </div>
                <div class="model-card-details">
                    <div class="model-card-detail">
                        <span>Провайдер</span>
                        <strong>${model['Компания']}</strong>
                    </div>
                    <div class="model-card-detail">
                        <span>Контекст</span>
                        <strong>${formatContext(model['Контекстное окно'])}</strong>
                    </div>
                    <div class="model-card-detail">
                        <span>Модальность</span>
                        <strong>${model['Модальность']}</strong>
                    </div>
                    <div class="model-card-detail">
                        <span>РФ</span>
                        <strong>${model['Доступность в РФ']}</strong>
                    </div>
                    <div class="model-card-detail">
                        <span>Скорость</span>
                        <strong>${model['Скорость']}</strong>
                    </div>
                    <div class="model-card-detail">
                        <span>Качество</span>
                        <strong>${model['Качество']}</strong>
                    </div>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <input type="checkbox" class="model-checkbox" ${isSelected ? 'checked' : ''} data-model-id="${modelId}">
                    <button class="btn-icon" onclick="window.open('${model['API документация URL']}', '_blank')" style="flex: 1">📚 API Docs</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach checkbox listeners
    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleModelSelection);
    });
}

function renderChart() {
    // Placeholder for chart implementation
    const container = document.getElementById('chartView');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
            <p style="color: var(--text-secondary); font-size: 1.2rem;">
                📊 График будет добавлен в следующей версии
            </p>
        </div>
    `;
}

// ===== Helper Functions =====
function formatContext(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
}

function getRFBadge(status) {
    if (status === 'Да') {
        return '<span class="rf-badge available">✓ Да</span>';
    } else if (status === 'VPN') {
        return '<span class="rf-badge vpn">🔒 VPN</span>';
    }
    return status;
}

// ===== Model Selection =====
function handleModelSelection(event) {
    const modelId = event.target.dataset.modelId;

    if (event.target.checked) {
        selectedModels.add(modelId);
    } else {
        selectedModels.delete(modelId);
    }

    updateComparisonBar();
}

function updateComparisonBar() {
    const bar = document.getElementById('comparisonBar');
    const count = document.getElementById('comparisonCount');

    if (selectedModels.size > 0) {
        bar.classList.remove('hidden');
        count.textContent = `${selectedModels.size} выбрано`;
    } else {
        bar.classList.add('hidden');
    }
}

document.getElementById('clearComparison').addEventListener('click', () => {
    selectedModels.clear();
    document.querySelectorAll('.model-checkbox').forEach(cb => cb.checked = false);
    updateComparisonBar();
});

document.getElementById('compareBtn').addEventListener('click', () => {
    if (selectedModels.size < 2) {
        alert('Выберите минимум 2 модели для сравнения');
        return;
    }
    showComparisonModal();
});

// ===== View Switching =====
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        currentView = view;

        // Update active state
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/hide views
        document.getElementById('tableView').classList.toggle('hidden', view !== 'table');
        document.getElementById('cardsView').classList.toggle('hidden', view !== 'cards');
        document.getElementById('chartView').classList.toggle('hidden', view !== 'chart');

        renderModels();
    });
});

// ===== Quick Filters =====
document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        // Remove active class from all buttons
        document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        switch(filter) {
            case 'cheapest':
                filteredModels.sort((a, b) => a['Цена за 1M input токенов'] - b['Цена за 1M input токенов']);
                break;
            case 'fastest':
                filteredModels = allModels.filter(m => m['Скорость'] === 'Fast');
                break;
            case 'best-roi':
                filteredModels = allModels.map(m => ({...m, roi: calculateROI(m)}))
                    .sort((a, b) => b.roi - a.roi);
                break;
            case 'rf-available':
                filteredModels = allModels.filter(m => m['Доступность в РФ'] === 'Да');
                break;
        }
        renderModels();
        updateResultCount();
    });
});

// ===== Calculator =====
document.getElementById('calcToggle').addEventListener('click', () => {
    document.getElementById('calculatorModal').classList.remove('hidden');
    calculateCosts();
});

document.getElementById('calcClose').addEventListener('click', () => {
    document.getElementById('calculatorModal').classList.add('hidden');
});

document.getElementById('calcInputTokens').addEventListener('input', calculateCosts);
document.getElementById('calcOutputTokens').addEventListener('input', calculateCosts);

// ===== Mini Calculator =====
const miniCalcTask = document.getElementById('miniCalcTask');
const miniCalcVolume = document.getElementById('miniCalcVolume');
const tokenVolume = document.getElementById('tokenVolume');
const miniCalcResults = document.getElementById('miniCalcResults');

function updateTokenVolume() {
    const value = miniCalcVolume.value;
    tokenVolume.textContent = `${value}M`;
    calculateMiniCalc();
}

function calculateMiniCalc() {
    const task = miniCalcTask.value;
    const volume = parseInt(miniCalcVolume.value) * 1000000;

    // Filter by modality based on task
    const modalityMap = {
        'text': ['Text'],
        'chat': ['Text'],
        'data': ['Text'],
        'vision': ['Text & Vision', 'Vision']
    };

    const relevantModels = allModels.filter(m => {
        const modalities = modalityMap[task] || ['Text'];
        return modalities.some(mod => m['Модальность'].includes(mod));
    });

    // Calculate costs and ROI
    const modelsWithCosts = relevantModels.map(m => {
        const inputCost = (volume / 1000000) * m['Цена за 1M input токенов'];
        const outputCost = (volume / 1000000) * m['Цена за 1M output токенов'];
        const totalCost = inputCost + outputCost;
        const roi = calculateROI(m);

        return {
            model: m,
            totalCost,
            roi
        };
    }).sort((a, b) => b.roi - a.roi).slice(0, 3);

    // Render results
    miniCalcResults.innerHTML = modelsWithCosts.map(item => `
        <div class="mini-calc-card">
            <div class="mini-calc-header">
                <span class="mini-calc-model">${item.model['Кодовое название']}</span>
                <span class="mini-calc-provider">${item.model['Компания']}</span>
            </div>
            <div class="mini-calc-details">
                <span class="mini-calc-cost">$${item.totalCost.toFixed(4)}</span>
                <span class="mini-calc-quality">${item.model['Скорость']} | ${item.model['Качество']}</span>
            </div>
            <div class="mini-calc-footer">
                <span class="mini-calc-rf">${getRFBadge(item.model['Доступность в РФ'])}</span>
                <span class="mini-calc-roi">ROI: ${item.roi.toFixed(0)}</span>
            </div>
        </div>
    `).join('');
}

miniCalcTask.addEventListener('change', calculateMiniCalc);
miniCalcVolume.addEventListener('input', updateTokenVolume);

// Initialize mini calculator on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for models to load
    setTimeout(() => {
        if (allModels.length > 0) {
            calculateMiniCalc();
        }
    }, 500);
});

function calculateCosts() {
    const inputTokens = parseInt(document.getElementById('calcInputTokens').value) || 0;
    const outputTokens = parseInt(document.getElementById('calcOutputTokens').value) || 0;

    const results = filteredModels.map(model => {
        const inputCost = (inputTokens / 1000000) * model['Цена за 1M input токенов'];
        const outputCost = (outputTokens / 1000000) * model['Цена за 1M output токенов'];
        const total = inputCost + outputCost;

        return {
            model,
            inputCost,
            outputCost,
            total
        };
    }).sort((a, b) => a.total - b.total);

    const container = document.getElementById('calcResults');
    container.innerHTML = results.map(r => `
        <div class="calc-result-item">
            <div class="calc-result-info">
                <h4>${r.model['Название модели']}</h4>
                <p>${r.model['Компания']} • ${r.model['Доступность в РФ']}</p>
            </div>
            <div class="calc-result-price">
                <div class="total">$${r.total.toFixed(4)}</div>
                <div class="breakdown">in: $${r.inputCost.toFixed(4)} + out: $${r.outputCost.toFixed(4)}</div>
            </div>
        </div>
    `).join('');
}

// ===== Comparison Modal =====
function showComparisonModal() {
    const selectedModelIds = Array.from(selectedModels);
    const models = selectedModelIds.map(id =>
        allModels.find(m => `${m['Компания']}-${m['Кодовое название']}` === id)
    ).filter(m => m);

    const container = document.getElementById('comparisonTable');

    const fields = [
        'Компания',
        'Название модели',
        'Кодовое название',
        'Цена за 1M input токенов',
        'Цена за 1M output токенов',
        'Контекстное окно',
        'Модальность',
        'Доступность в РФ',
        'Скорость',
        'Качество',
        'Специализация'
    ];

    let html = '<table class="models-table"><thead><tr><th>Параметр</th>';
    models.forEach(m => {
        html += `<th>${m['Название модели']}</th>`;
    });
    html += '</tr></thead><tbody>';

    fields.forEach(field => {
        html += `<tr><td><strong>${field}</strong></td>`;
        models.forEach(m => {
            let value = m[field];
            if (field === 'Контекстное окно') {
                value = formatContext(value);
            } else if (field.includes('Цена')) {
                value = `$${parseFloat(value).toFixed(2)}`;
            }
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    document.getElementById('comparisonModal').classList.remove('hidden');
}

document.getElementById('compClose').addEventListener('click', () => {
    document.getElementById('comparisonModal').classList.add('hidden');
});

// ===== Theme Toggle =====
document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const btn = document.getElementById('themeToggle');
    btn.textContent = document.body.classList.contains('light-theme') ? '🌙' : '☀️';
});

// ===== Close modals on outside click =====
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
});

// ===== Initialize App =====
loadModels();
