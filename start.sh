#!/bin/bash

# Démarrage de Memcached en arrière-plan
service memcached start

# Démarrage de l'application Node.js
npm run dev