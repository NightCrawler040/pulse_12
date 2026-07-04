# 🐧 Руководство по развертыванию Pulse 12 на Ubuntu Linux (vSphere VM)

Данное руководство поможет вам развернуть корпоративный трекер задач **Pulse 12** на выделенной виртуальной машине **Ubuntu Linux 22.04 / 24.04** в вашем корпоративном облаке **vSphere** для 12–15 сотрудников.

---

## 🛠 Вариант 1: Запуск через Docker Compose (Рекомендуемый и самый простой)

Если на вашей Ubuntu машине установлен Docker, развертывание займет всего 1 минуту:

1. **Установите Docker (если не установлен):**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt-get install -y docker-compose-plugin
   ```

2. **Скопируйте проект на сервер:**
   Скопируйте папку с проектом `jira-clone` на вашу виртуальную машину (например, через `scp` или Git в папку `/opt/pulse12`).

3. **Запустите контейнер в фоновом режиме:**
   Перейдите в директорию проекта и выполните:
   ```bash
   cd /opt/pulse12
   sudo docker compose up --build -d
   ```

4. **Готово!**
   Сервер запустится на 80-м порту. Все сотрудники в офисе могут открыть в браузере адрес вашей vSphere машины:
   `http://IP_АДРЕС_МАШИНЫ/` (например, `http://192.168.10.50/`).
   Вся база данных (`db.json`) и загруженные аватары будут надежно сохраняться в Docker-volume `pulse12_corporate_data`.

---

## ⚙️ Вариант 2: Классический запуск через Node.js и Systemd службу (Без Docker)

Если вы предпочитаете запускать сервис напрямую в ОС Ubuntu через Systemctl:

1. **Установите Node.js 20+ на Ubuntu:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Разместите файлы проекта:**
   Скопируйте проект в `/opt/pulse12`:
   ```bash
   sudo mkdir -p /opt/pulse12
   # Скопируйте файлы в эту директорию
   cd /opt/pulse12
   ```

3. **Установите зависимости и соберите продакшн-билд:**
   ```bash
   sudo npm install
   sudo npm run build
   ```

4. **Создайте системную службу Systemd (`/etc/systemd/system/pulse12.service`):**
   ```bash
   sudo nano /etc/systemd/system/pulse12.service
   ```
   Вставьте следующую конфигурацию (для работы на 80-м порту или 3001 порту — укажите нужный `PORT`):
   ```ini
   [Unit]
   Description=Pulse 12 Corporate Task Tracker
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/opt/pulse12
   Environment=NODE_ENV=production
   Environment=PORT=80
   ExecStart=/usr/bin/node /opt/pulse12/server/index.js
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

5. **Активируйте и запустите службу:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pulse12
   sudo systemctl start pulse12
   ```

6. **Проверка статуса:**
   ```bash
   sudo systemctl status pulse12
   ```

---

## 🔒 Настройка брандмауэра (UFW) в Ubuntu
Не забудьте открыть порт 80 (или 3001, если вы используете его):
```bash
sudo ufw allow 80/tcp
sudo ufw allow 3001/tcp
sudo ufw reload
```

Теперь ваши 12–15 сотрудников подключаются по адресу `http://IP_МАШИНЫ_VSPHERE/`, а все маршруты (включая `/admin`, `/profile`, `/board`) обрабатываются автоматически!
