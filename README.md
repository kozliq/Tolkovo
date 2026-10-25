<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.svg">
    <img alt="Tolkovo — голосовой ввод для macOS" src=".github/assets/banner-dark.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/kozliq/Tolkovo/releases/latest"><img alt="Последний релиз" src="https://img.shields.io/github/v/release/kozliq/Tolkovo?style=for-the-badge&label=%D1%80%D0%B5%D0%BB%D0%B8%D0%B7&color=8e2138"></a>
  <a href="https://github.com/kozliq/Tolkovo/releases"><img alt="Скачивания" src="https://img.shields.io/github/downloads/kozliq/Tolkovo/total?style=for-the-badge&label=%D1%81%D0%BA%D0%B0%D1%87%D0%B8%D0%B2%D0%B0%D0%BD%D0%B8%D0%B9&color=1b1b20"></a>
  <img alt="macOS 14+" src="https://img.shields.io/badge/macOS-14%2B-1b1b20?style=for-the-badge&logo=apple&logoColor=white">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D1%8F-MIT-1b1b20?style=for-the-badge"></a>
</p>

<h3 align="center">Нажал <kbd>⌥ Space</kbd>, сказал — текст уже там, где курсор.</h3>

<p align="center">
  В Telegram, в браузере, в ChatGPT и Claude. Без интернета, по-русски, бесплатно. Код открыт.
</p>

<p align="center">
  <a href="https://github.com/kozliq/Tolkovo/releases/latest"><b>⬇ Скачать для Mac</b></a>
  &nbsp;·&nbsp;
  <a href="#установка">Установка</a>
  &nbsp;·&nbsp;
  <a href="#приватность">Приватность</a>
  &nbsp;·&nbsp;
  <a href="#вопросы">Вопросы</a>
  &nbsp;·&nbsp;
  <a href="#english">English</a>
</p>

<br>

<p align="center">
  <img src=".github/assets/demo.svg" width="100%" alt="Демонстрация: нажата ⌥ Space, пилюля наливается бордовым, слова появляются в пузыре, после отпускания текст вставляется в чат">
</p>

<br>

<p align="center">
  <img src=".github/assets/how.svg" width="100%" alt="Три движения: нажми ⌥ Space, говори, отпусти">
</p>

<p align="center">
  <img src=".github/assets/speed.svg" width="100%" alt="Печать около 40 слов в минуту, голос около 130">
</p>

<p align="center">
  <img src=".github/assets/dictionary.svg" width="100%" alt="Словарь: гитхаб → GitHub, телега → Telegram, пул реквест → pull request">
</p>

## Приватность

<p align="center">
  <img src=".github/assets/privacy.svg" width="100%" alt="0 байт твоего голоса уходит в интернет">
</p>

Звук живёт в памяти, пока распознаётся, и сразу стирается. Ни звук, ни текст не сохраняются на диск и никуда не отправляются. На Маке остаётся только статистика: счётчики и самые частые слова, без самих диктовок. Записи и текст, которые хранили версии до 0.2.1, программа удаляет сама при запуске. Нет аккаунтов, телеметрии, аналитики и облака — программа ничего о тебе не собирает. Единственное обращение в сеть за всё время: один раз скачать модель распознавания.

Разрешение «Универсальный доступ» нужно ровно для одного действия — нажать «вставить» за тебя в активном окне. Tolkovo не читает, что ты печатаешь, и не видит содержимое других программ.

**Не верь на слово — проверь.** Код открыт, а каждый релиз собирается на серверах GitHub прямо из этого репозитория и подтверждается криптографической подписью происхождения:

```bash
gh attestation verify ~/Downloads/Tolkovo-*.dmg --repo kozliq/Tolkovo
```

## Установка

1. Скачай **[Tolkovo для Mac](https://github.com/kozliq/Tolkovo/releases/latest)** (файл `Tolkovo-…-apple-silicon.dmg`), открой его и перетащи значок в «Программы».
2. Один раз выполни в Терминале:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Tolkovo.app
   ```
   Программа пока не подписана платным сертификатом Apple. Команда снимает пометку «скачано из интернета» — после этого macOS запускает её как обычно.
3. Открой Tolkovo, разреши микрофон и вставку текста. Модель скачается сама — и можно говорить.

Нужен Mac на Apple Silicon (M1 и новее) с macOS 14 или свежее.

## Что дальше

<p align="center">
  <img src=".github/assets/wrapped.svg" width="100%" alt="Итоги месяца: сколько слов наговорил, сколько времени сэкономил и сколько раз сказал «короче»">
</p>

- [x] Распознавание русской речи прямо на Mac
- [x] Работа в любом приложении
- [x] Первый запуск без единой настройки и стеклянная пилюля
- [x] Личный словарь англицизмов
- [x] Статистика и «Итоги месяца» — всё считается только у тебя
- [ ] Живой текст — слова видно прямо во время речи
- [ ] Голосовые команды: «новая строка», «точка»

Есть идея или нашёл баг — [открой issue](https://github.com/kozliq/Tolkovo/issues/new/choose).

## Вопросы

<details>
<summary><b>Правда бесплатно? Где подвох?</b></summary>
<br>
Подвоха нет. Программа работает на твоём компьютере, серверов у проекта нет — брать деньги не за что. Платных функций нет. Если хочется сказать спасибо — есть <a href="DONATE.md">добровольная поддержка</a>, но она ни на что не влияет.
</details>

<details>
<summary><b>Нужен ли интернет?</b></summary>
<br>
Только один раз — чтобы скачать модель. Дальше можно хоть в самолёте.
</details>

<details>
<summary><b>А английские слова понимает?</b></summary>
<br>
Модель заточена под русский, поэтому английские слова иногда пишет по-русски. Для этого есть словарь: «гитхаб» сам станет GitHub. Свои замены добавляются в настройках.
</details>

<details>
<summary><b>Будет версия для Windows?</b></summary>
<br>
Ядро кроссплатформенное, так что технически это возможно. Сейчас главное — сделать идеальную версию для Mac.
</details>

<details>
<summary><b>На чём это сделано?</b></summary>
<br>
Tolkovo — форк открытого проекта <a href="https://github.com/cjpais/Handy">Handy</a> от CJ Pais. От него — надёжное ядро записи и распознавания, от нас — всё, что ты видишь и трогаешь.
</details>

## Новости

Следить за разработкой: [Telegram-канал](https://t.me/Tolkovo0)

## Поддержать

Tolkovo бесплатный, код открыт. Больше всего помогает ⭐ этому репозиторию и рассказ друзьям. А если хочется поблагодарить иначе — [страница поддержки](DONATE.md).

## Благодарности

Tolkovo — форк **[Handy](https://github.com/cjpais/Handy)** от CJ Pais: всё ядро записи, распознавания и вставки текста сделано ими, и без их открытого кода этого проекта бы не было. Если нужна англоязычная кроссплатформенная версия — иди к ним.

Спасибо командам **GigaAM** (SberDevices) за открытую русскую модель, **transcribe.cpp** и **Tauri**.

## Лицензия

[MIT](LICENSE). Копирайт оригинального Handy сохранён, как того требует лицензия.

---

<a name="english"></a>
<details>
<summary><b>English</b></summary>
<br>

**Tolkovo** is a free, offline, privacy-first voice typing app for macOS, made for Russian speakers. Press <kbd>⌥ Space</kbd>, speak, and the text appears wherever your cursor is. Runs GigaAM v3 locally — a model trained on Russian speech. No cloud, no telemetry, no accounts.

A fork of the excellent [Handy](https://github.com/cjpais/Handy) — for the original cross-platform, English-first experience, go there.
</details>

<p align="center">
  <a href="https://www.star-history.com/#kozliq/Tolkovo&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=kozliq/Tolkovo&type=Date&theme=dark">
      <img alt="История звёзд" src="https://api.star-history.com/svg?repos=kozliq/Tolkovo&type=Date" width="600">
    </picture>
  </a>
</p>
