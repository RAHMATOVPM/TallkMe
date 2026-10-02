# 📱 Capacitor v7 Setup Guide

Этот проект использует **Capacitor v7** для сборки Android APK из React веб-приложения.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Сборка веб-приложения
```bash
npm run build
```

### 3. Инициализация Capacitor
```bash
npm run cap:init
```

### 4. Добавление Android платформы
```bash
npm run cap:add:android
```

### 5. Синхронизация кода
```bash
npm run cap:sync
```

### 6. Открытие проекта в Android Studio
```bash
npm run cap:open:android
```

## 📋 Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev сервера |
| `npm run build` | Сборка для production |
| `npm run cap:init` | Инициализация Capacitor |
| `npm run cap:add:android` | Добавление Android платформы |
| `npm run cap:sync` | Синхронизация веб-кода с native |
| `npm run cap:copy` | Копирование веб-кода в native |
| `npm run cap:open:android` | Открытие в Android Studio |

## 🔧 Конфигурация

Конфигурация Capacitor находится в файле `capacitor.config.ts`:

```typescript
{
  appId: 'com.talkme.app',
  appName: 'TalkMe Chat',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}
```

## 📦 Версии

- **Capacitor**: v7.0.0+
- **Node.js**: 20+
- **Java**: 17+
- **Android API**: 34
- **Gradle**: 8.7+

## 🔄 GitHub Actions CI/CD

При каждом push в `main` ветку автоматически:
1. Устанавливаются зависимости
2. Собирается веб-приложение
3. Собирается Android Debug APK
4. Создается GitHub Release с APK файлом

### Ручной запуск workflow

Зайдите в репозиторий → Actions → "Build Android APK and publish Release" → "Run workflow"

## 📲 Сборка APK

### Локально (требуется Android SDK & Java)
```bash
npm run build
npm run cap:copy android
cd android
./gradlew assembleDebug
```

APK будет расположен в: `android/app/build/outputs/apk/debug/app-debug.apk`

### Через GitHub Actions (рекомендуется)
1. Перейдите в Actions
2. Выберите workflow "Build Android APK and publish Release"
3. Нажмите "Run workflow"
4. APK будет доступна в разделе Releases

## ⚠️ Требования

### Локальная разработка
- Node.js 20+
- npm или yarn
- JDK 17+
- Android SDK (API 34+)
- Android Studio (опционально)

### CI/CD (GitHub Actions)
- Автоматически использует ubuntu-latest с необходимыми инструментами

## 🐛 Troubleshooting

### Проблема: "gradlew not found"
```bash
npm run cap:add:android
```

### Проблема: "Capacitor not initialized"
```bash
npm run cap:init
```

### Проблема: Ошибки при синхронизации
```bash
# Очистите Capacitor и пересинхронизируйте
rm -rf android/
npm run cap:add:android
npm run cap:sync
```

## 📝 Разработка

### Workflow для разработки

1. **Веб-разработка**
   ```bash
   npm run dev
   ```

2. **После изменений**
   ```bash
   npm run build
   npm run cap:copy android
   ```

3. **Откройте в Android Studio**
   ```bash
   npm run cap:open:android
   ```

4. **Запустите на эмуляторе/устройстве**
   - Через Android Studio или `adb install android/app/build/outputs/apk/debug/app-debug.apk`

## 📚 Дополнительно

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Android Development Setup](https://developer.android.com/studio)

## 📄 Лицензия

MIT
