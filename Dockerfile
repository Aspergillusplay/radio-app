# Используем официальный образ Node.js
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json в контейнер
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта в контейнер
COPY . .

# Сборка приложения
RUN npm run build

# Устанавливаем сервер для обслуживания статических файлов
RUN npm install -g serve

# Открываем порт для приложения
EXPOSE 3000

# Запускаем сервер, указывая правильный путь к файлу
CMD ["sh", "./start.sh"]