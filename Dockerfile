FROM node:latest

# Installation de Memcached
RUN apt-get update && \
    apt-get install -y memcached && \
    apt-get clean

WORKDIR /usr/src/app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code
COPY . .

# Expose le port pour Node.js
EXPOSE 3000
# Expose le port pour Memcached
EXPOSE 11211

# Script de démarrage
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]