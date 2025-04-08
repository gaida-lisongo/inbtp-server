const Socket = require('./Socket');
const Etudiant = require('../models/etudiant.model');

/**
 * Socket pour la gestion des étudiants
 */
class EtudiantSocket extends Socket {
    /**
     * Initialisation des événements étudiants
     */
    init() {
        // Appel de la méthode d'initialisation du parent
        super.init();
        
        this.io.on('connection', (socket) => {
            // Événements de mise à jour du profil
            socket.on('etudiant:get-profile', () => this.handleGetProfile(socket));
            socket.on('etudiant:update-profile', (data) => this.handleUpdateProfile(socket, data));
            socket.on('etudiant:update-avatar', (data) => this.handleUpdateAvatar(socket, data));
            
            // Événements de gestion du solde
            socket.on('etudiant:get-solde', () => () => this.handleGetSolde(socket));
            socket.on('etudiant:recharge-solde', (data) => this.handleRechargeSolde(socket, data));
            
            // Événements de gestion des actifs
            socket.on('etudiant:get-actifs', (data) => this.handleGetActifs(socket, data));
        });
    }

    /**
     * Récupère le profil étudiant
     */
    async handleGetProfile(socket) {
        try {
            const etudiantId = socket.etudiantId;
            
            const etudiant = await this.getFromCache(
                `etudiant:${etudiantId}:profile`, 
                async () => await Etudiant.findById(etudiantId)
                    .populate('infoAcad.promotionId')
                    .populate('infoAcad.anneeId')
            );
            
            this.emitSuccess(socket, 'etudiant:profile', this.sanitizeEtudiantData(etudiant));
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:get-profile');
        }
    }

    /**
     * Met à jour le profil étudiant
     */
    async handleUpdateProfile(socket, data) {
        try {
            // Mise à jour
            const etudiant = await Etudiant.findByIdAndUpdate(
                data._id,
                data,
                { new: true, runValidators: true }
            );
            
            // Invalider le cache
            await this.invalidateCache(`etudiant:${etudiant._id}:profile`);
            
            this.emitSuccess(socket, 'etudiant:profile-updated', etudiant);
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:update-profile');
        }
    }

    /**
     * Met à jour l'avatar étudiant
     */
    async handleUpdateAvatar(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.avatar) {
                throw new Error('Avatar requis');
            }
            
            // Mise à jour
            const etudiant = await Etudiant.findByIdAndUpdate(
                etudiantId,
                { 'infoSec.avatar': data.avatar },
                { new: true }
            );
            
            // Invalider le cache
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'etudiant:avatar-updated', {
                avatar: etudiant.infoSec.avatar
            });
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:update-avatar');
        }
    }

    /**
     * Récupère le solde étudiant
     */
    async handleGetSolde(socket) {
        try {
            const etudiantId = socket.etudiantId;
            
            const etudiant = await Etudiant.findById(etudiantId)
                .select('infoSec.solde');
            
            this.emitSuccess(socket, 'etudiant:solde', {
                solde: etudiant.infoSec.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:get-solde');
        }
    }

    /**
     * Recharge le solde étudiant
     */
    async handleRechargeSolde(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.montant || isNaN(data.montant) || data.montant <= 0) {
                throw new Error('Montant invalide');
            }
            
            // Mise à jour
            const etudiant = await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': data.montant } },
                { new: true }
            ).select('infoSec.solde');
            
            // Invalider le cache
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'etudiant:solde-updated', {
                solde: etudiant.infoSec.solde,
                recharge: data.montant
            });
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:recharge-solde');
        }
    }

    /**
     * Récupère les actifs d'un étudiant pour une année
     */
    async handleGetActifs(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.anneeId) {
                throw new Error('ID de l\'année requis');
            }
            
            const etudiant = await Etudiant.findById(etudiantId)
                .populate('infoAcad.promotionId')
                .populate('infoAcad.anneeId')
                .populate('infoAcad.actifs.travaux')
                .populate('infoAcad.actifs.bulletins')
                .populate('infoAcad.actifs.enrollments');
            
            // Recherche des informations académiques pour l'année spécifiée
            const anneeAcad = etudiant.infoAcad.find(
                info => info.anneeId && info.anneeId._id.toString() === data.anneeId
            );
            
            if (!anneeAcad) {
                throw new Error('Année académique non trouvée pour cet étudiant');
            }
            
            this.emitSuccess(socket, 'etudiant:actifs', {
                annee: anneeAcad.anneeId,
                promotion: anneeAcad.promotionId,
                actifs: anneeAcad.actifs || {}
            });
            
        } catch (error) {
            this.handleError(error, socket, 'etudiant:get-actifs');
        }
    }
}

module.exports = EtudiantSocket;