# Автоматическое обновление providers.csv

## Описание

Этот проект включает автоматическую синхронизацию файла `providers.csv` с данными из `models.csv`.

## Как это работает

### 1. Скрипт обновления (`update_providers.py`)

Python скрипт, который:
- Читает все модели из `models.csv`
- Извлекает уникальную информацию о каждом провайдере
- Агрегирует данные (модальности, валюты, документация)
- Обновляет `providers.csv` с актуальной информацией

### 2. GitHub Actions (`.github/workflows/update_providers.yml`)

Автоматически запускается когда:
- Изменяется файл `models.csv`
- Ручной запуск через GitHub Actions UI

Workflow:
1. Проверяет код из репозитория
2. Устанавливает Python 3.11
3. Запускает `update_providers.py`
4. Если `providers.csv` изменился, создаёт коммит и пушит изменения

### 3. Pre-commit hook (`.githooks/pre-commit`)

Локальная автоматизация для разработчиков:
- Срабатывает перед каждым коммитом
- Если `models.csv` изменён, автоматически обновляет `providers.csv`
- Добавляет обновлённый `providers.csv` в текущий коммит

## Установка pre-commit hook

```bash
# Настроить git на использование custom hooks директории
git config core.hooksPath .githooks

# Сделать hook исполняемым
chmod +x .githooks/pre-commit
```

## Ручной запуск

```bash
# Из корня проекта
python scripts/update_providers.py
```

## Структура providers.csv

| Поле | Описание |
|------|----------|
| Компания | Название провайдера |
| Доступность в РФ | Да/VPN |
| Валюта | Валюты расчётов (USD, RUB, CNY) |
| Поддерживаемые модальности | text, multimodal, image, video |
| API документация URL | Ссылка на документацию API |
| Официальный сайт | Главная страница компании |
| Страна регистрации | USA, China, Russia |
| Методы аутентификации | API key, OAuth и др. |
| Языковая поддержка | Количество поддерживаемых языков |
| Основная специализация | Ключевые направления компании |

## Добавление нового провайдера

1. Добавьте модели провайдера в `models.csv`
2. Обновите маппинги в `update_providers.py`:
   - `company_countries` - страна регистрации
   - `company_websites` - официальный сайт
   - `company_specializations` - основная специализация
3. Запустите скрипт или закоммитьте изменения (автоматически обновится)

## Логика обработки

- **Модальности**: Собираются все уникальные модальности из моделей провайдера
- **Валюты**: Агрегируются все используемые валюты
- **Доступность**: Берётся из первой модели провайдера
- **API документация**: Берётся из первой модели (обычно одинаковая для всех)

## Примеры использования

### Проверка изменений перед коммитом
```bash
# Изменили models.csv
git add models.csv
git commit -m "Add new models"
# Pre-commit hook автоматически обновит providers.csv
```

### Ручное обновление
```bash
python scripts/update_providers.py
# Проверяем изменения
git diff providers.csv
```

### Отключение pre-commit hook
```bash
# Временно для одного коммита
git commit --no-verify -m "message"

# Постоянно
git config --unset core.hooksPath
```

## Требования

- Python 3.8+
- Стандартная библиотека Python (csv, pathlib, typing)
- Git (для hooks)

## Troubleshooting

### Hook не запускается
```bash
# Проверьте настройку Git
git config core.hooksPath

# Проверьте права на исполнение
ls -la .githooks/pre-commit

# Исправьте права если нужно
chmod +x .githooks/pre-commit
```

### GitHub Actions не запускается
- Убедитесь что изменения в `models.csv` закоммичены
- Проверьте что workflow файл находится в `.github/workflows/`
- Проверьте логи в разделе Actions на GitHub

### Ошибки скрипта
```bash
# Запустите с выводом ошибок
python scripts/update_providers.py --verbose

# Проверьте формат CSV
head -n 5 models.csv
```
