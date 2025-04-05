const cache = require('../utils/cache');

/**
 * Classe de base pour tous les sockets
 */
class Socket {
    /**
     * Constructeur
     * @param {Object} io - Instance de Socket.IO
     * @param {String} namespace - Namespace du socket (optionnel)
     */
    constructor(io, namespace = null) {
        this.io = namespace ? io.of(namespace) : io;
        this.cache = cache;
        this.defaultCacheTime = 3600; // 1 heure par défaut
        
        // Initialisation du socket
        this.init();
    }

    /**
     * Méthode d'initialisation à surcharger dans les classes enfants
     */
    init() {
        console.log('Socket de base initialisé');
    }

    /**
     * Émet un événement avec succès
     * @param {Object} socket - Socket client
     * @param {String} event - Nom de l'événement
     * @param {Object} data - Données à envoyer
     */
    emitSuccess(socket, event, data) {
        socket.emit(event, {
            success: true,
            data: data
        });
    }

    /**
     * Émet un événement avec erreur
     * @param {Object} socket - Socket client
     * @param {String} event - Nom de l'événement
     * @param {Error} error - Erreur à envoyer
     */
    emitError(socket, event, error) {
        socket.emit(event, {
            success: false,
            error: error.message || error
        });
    }

    /**
     * Récupère les données du cache ou de la fonction fournie
     * @param {String} key - Clé de cache
     * @param {Function} fetchFunction - Fonction pour récupérer les données si non en cache
     * @param {Number} expiration - Durée d'expiration en secondes
     * @returns {Promise<Object>} - Données du cache ou de la fonction
     */
    async getFromCache(key, fetchFunction, expiration = this.defaultCacheTime) {
        try {
            // Essayer de récupérer du cache
            const cachedData = await this.cache.get(key);
            
            if (cachedData) {
                console.log(`[CACHE HIT] ${key}`);
                return cachedData;
            }
            
            // Si pas en cache, exécuter la fonction
            console.log(`[CACHE MISS] ${key}`);
            const freshData = await fetchFunction();
            
            // Stocker en cache pour les prochaines requêtes
            await this.cache.set(key, freshData, expiration);
            
            return freshData;
        } catch (error) {
            console.error(`[CACHE ERROR] ${key}`, error);
            // En cas d'erreur, exécuter la fonction sans mise en cache
            return await fetchFunction();
        }
    }

    /**
     * Invalide une entrée de cache
     * @param {String} key - Clé de cache à invalider
     */
    async invalidateCache(key) {
        try {
            await this.cache.delete(key);
            console.log(`[CACHE INVALIDATE] ${key}`);
        } catch (error) {
            console.error(`[CACHE ERROR] Invalidation ${key}`, error);
        }
    }

    /**
     * Gère les erreurs de socket
     * @param {Error} error - Erreur à gérer
     * @param {Object} socket - Socket client
     * @param {String} event - Nom de l'événement
     */
    handleError(error, socket, event) {
        console.error(`[ERROR] ${event}:`, error);
        this.emitError(socket, event, error);
    }

    // Méthode pour vérifier l'authentification d'un socket
    isAuthenticated(socket) {
        return !!socket.etudiantId;
    }

    // Middleware d'authentification pour les événements protégés
    requireAuth(socket, callback) {
        if (this.isAuthenticated(socket)) {
            callback();
        } else {
            this.emitError(socket, 'error', 'Authentification requise');
        }
    }
}

module.exports = Socket;