# Freedom

Freedom — це fullstack соціальна мережа з авторизацією, постами, фото, лайками, коментарями, друзями, чатом у реальному часі та системою сповіщень.

## На чому побудований проєкт

### Frontend

- React
- Vite
- Axios
- Socket.io Client
- React Icons
- CSS

### Backend

- Node.js
- Express.js
- PostgreSQL
- Socket.io
- JWT
- Multer
- Nodemon
- PM2

### Production / Deploy

- VPS сервер
- nginx
- PM2
- GitHub Actions
- PostgreSQL

---

## Основний функціонал

### Авторизація

- Реєстрація
- Логін по email або username
- JWT авторизація
- Email verification
- Forgot password
- Reset password
- Remember me:
  - без галочки — токен на 7 днів
  - з галочкою — токен на 30 днів

---

### Пости

- Створення постів
- Редагування постів
- Видалення постів
- Лайки
- Коментарі
- Вкладки:
  - My posts
  - Following
- Realtime оновлення постів через Socket.io

---

### Фото

- Завантаження фото
- Опис фото
- Лайки
- Коментарі
- Відкриття фото у модальному вікні

---

### Чат

- Realtime повідомлення
- Автоматичне створення діалогу
- Відправка тексту
- Відправка зображень
- Reply
- Edit
- Delete
- Forward
- Infinite scroll старих повідомлень
- Popup при новому повідомленні
- Sound notification

---

### Friends / Follow

- Follow
- Unfollow
- Friend requests
- Badge з кількістю запитів
- Realtime friend request через Socket.io

---

### Notifications / Actions

Сторінка Actions показує:

- лайки постів
- лайки фото
- коментарі до постів
- коментарі до фото
- friend requests
- нові пости користувачів, на яких підписаний

Підтримується:

- infinite scroll
- unread підсвітка
- час типу `2m ago`
- видалення notification
- відкриття конкретного поста або фото

---

## Структура проєкту

```txt
Freedom/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── db.js
│   │   └── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── socket.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── .env
│   └── .env.production
│
└── .github/
    └── workflows/
        └── deploy.yml
```

## Backend запуск

1. Перейти в backend
cd backend
2. Встановити залежності
npm install
3. Створити .env
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=freedom_db

JWT_SECRET=supersecret

CLIENT_URL=http://localhost:5173

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
4. Запустити backend
npm run dev


## Backend буде працювати:

http://localhost:5000

API:

http://localhost:5000/api

``
## Frontend запуск

1. Перейти в frontend
cd frontend
2. Встановити залежності
npm install
3. Створити .env
VITE_API_URL=http://localhost:5000/api
VITE_SERVER_URL=http://localhost:5000
4. Запустити frontend
npm run dev

Frontend буде працювати:

http://localhost:5173
Важливі Socket.io події
Client -> Server
joinUser
joinConversation
Server -> Client
newMessage
newLike
newComment
newFriendRequest
newPost
Як зробити production build frontend
cd frontend
npm run build

Після build створюється папка:

frontend/dist

Саме її віддає nginx на VPS.
``
## Деплой на VPS

Production шлях на сервері:

/var/www/Freedom

Backend працює через PM2:

freedom-backend

Frontend віддається nginx з:

/var/www/Freedom/frontend/dist
GitHub Actions Deploy
``
## Проєкт має автоматичний деплой через GitHub Actions.

Після push у гілку main GitHub Actions підключається до VPS через SSH і виконує команди деплою.

Workflow файл:

.github/workflows/deploy.yml

Приклад workflow:

name: Deploy Freedom

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy on VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd /var/www/Freedom
            git fetch origin
            git reset --hard origin/main
            git log -1 --oneline

            cd backend
            npm install
            pm2 restart freedom-backend --update-env

            cd ../frontend
            npm install
            npm run build
            systemctl reload nginx
GitHub Secrets

У GitHub потрібно додати secrets:

VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_PORT

Шлях:

GitHub Repository → Settings → Secrets and variables → Actions
Як вручну задеплоїти на VPS
ssh root@SERVER_IP
cd /var/www/Freedom
git fetch origin
git reset --hard origin/main

``
## Backend:

cd backend
npm install
pm2 restart freedom-backend --update-env
``
## Frontend:

cd ../frontend
npm install
npm run build
systemctl reload nginx


Як перевірити на VPS, що код підтягнувся
Перевірити останній commit


cd /var/www/Freedom
git log -1
``
## Важливо
``
## Не редагувати .js файли напряму на VPS через nano, якщо ці зміни не будуть закомічені.

Правильний workflow:

локально змінив код
git add .
git commit -m "message"
git push
GitHub Actions автоматично деплоїть на VPS

Якщо код на сервері випадково змінювався вручну, можна синхронізувати його з GitHub:

cd /var/www/Freedom
git fetch origin
git reset --hard origin/main
Production URLs

Frontend:

https://freedom.viktorromanchenko.netxi.in

API:

https://freedom.viktorromanchenko.netxi.in/api