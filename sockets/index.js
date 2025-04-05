const Socket = require('./Socket');
const AuthSocket = require('./AuthSocket');
const EtudiantSocket = require('./EtudiantSocket');
// const ResultatsSocket = require('./ResultatsSocket');
// const TravauxSocket = require('./TravauxSocket');
// const SessionsSocket = require('./SessionsSocket');

/**
 * Initialise tous les sockets avec l'héritage approprié
 * @param {Object} io - Instance Socket.IO du serveur
 * @returns {Object} - Object contenant les instances de sockets
 */
module.exports = function(io) {
    // Instancier le socket de plus haut niveau (SessionsSocket)
    // qui va hériter de toutes les autres classes dans la chaîne
    const etudiantSocket = new EtudiantSocket(io);
    
    // Démarrer la tâche de nettoyage (contenue dans AuthSocket)
    etudiantSocket.startCleanupTask();
    
    // Nous retournons toutes les instances pour accès éventuel aux méthodes spécifiques
    // mais elles font toutes partie de la même chaîne d'héritage
    return {
        Etudiant: etudiantSocket,
        // Resultats: sessionsSocket,
        // Travaux: sessionsSocket,
        // Sessions: sessionsSocket
    };
};