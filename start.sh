#!/bin/sh
# start.sh

# Запуск скрипта инициализации базы данных
node server/init-db.js

# Запуск сервера
node server/server.js