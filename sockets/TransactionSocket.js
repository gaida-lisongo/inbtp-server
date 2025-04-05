const EtudiantSocket = require('./EtudiantSocket');
const { Transaction } = require('../models');
const mongoose = require('mongoose');

/**
 * Socket pour la gestion des transactions financières des étudiants
 */
class TransactionSocket extends EtudiantSocket {
    /**
     * Initialisation des événements de transactions
     */
    init() {
        // Appel de la méthode d'initialisation du parent
        super.init();
        
        this.io.on('connection', (socket) => {
            // Événements de gestion des transactions
            socket.on('transaction:get-all', () => 
                this.requireAuth(socket, () => this.handleGetTransactions(socket)));
            
            socket.on('transaction:update-solde', (data) => 
                this.requireAuth(socket, () => this.handleUpdateSolde(socket, data)));
            
            // Gestion des commandes
            socket.on('transaction:add-commande', (data) => 
                this.requireAuth(socket, () => this.handleAddCommande(socket, data)));
            
            socket.on('transaction:update-commande', (data) => 
                this.requireAuth(socket, () => this.handleUpdateCommande(socket, data)));
            
            socket.on('transaction:delete-commande', (data) => 
                this.requireAuth(socket, () => this.handleDeleteCommande(socket, data)));
            
            // Gestion des recharges
            socket.on('transaction:add-recharge', (data) => 
                this.requireAuth(socket, () => this.handleAddRecharge(socket, data)));
            
            socket.on('transaction:update-recharge', (data) => 
                this.requireAuth(socket, () => this.handleUpdateRecharge(socket, data)));
            
            socket.on('transaction:delete-recharge', (data) => 
                this.requireAuth(socket, () => this.handleDeleteRecharge(socket, data)));
        });
    }

    /**
     * Récupère toutes les transactions d'un étudiant
     */
    async handleGetTransactions(socket) {
        try {
            const etudiantId = socket.etudiantId;
            
            const transactions = await this.getFromCache(
                `transaction:${etudiantId}:all`, 
                async () => {
                    // Trouver ou créer l'enregistrement de transaction pour l'étudiant
                    let transaction = await Transaction.findOne({ etudiantId });
                    
                    if (!transaction) {
                        // Si aucun enregistrement n'existe, en créer un nouveau
                        const etudiant = await this.getFromCache(
                            `etudiant:${etudiantId}:profile`, 
                            async () => await Etudiant.findById(etudiantId)
                        );
                        
                        transaction = await Transaction.create({
                            etudiantId,
                            solde: etudiant?.infoSec?.solde || 0,
                            fraisAcad: 0
                        });
                    }
                    
                    return transaction;
                }
            );
            
            this.emitSuccess(socket, 'transaction:all', transactions);
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:get-all');
        }
    }

    /**
     * Met à jour le solde d'un étudiant
     */
    async handleUpdateSolde(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || data.solde === undefined || isNaN(data.solde)) {
                throw new Error('Solde invalide');
            }
            
            // Mise à jour du solde dans la transaction
            const transaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { $set: { solde: data.solde } },
                { new: true, upsert: true }
            );
            
            // Mise à jour du solde dans le profil étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { 'infoSec.solde': data.solde },
                { new: true }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:solde-updated', { 
                solde: transaction.solde 
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:update-solde');
        }
    }

    /**
     * Ajoute une commande à la transaction d'un étudiant
     */
    async handleAddCommande(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.product || !data.montant || isNaN(data.montant) || data.montant <= 0) {
                throw new Error('Données de commande invalides');
            }
            
            // Générer une référence unique pour la commande
            const ref = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            const newCommande = {
                product: data.product,
                montant: data.montant,
                ref,
                date_created: new Date()
            };
            
            // Rechercher la transaction et ajouter la commande
            let transaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { 
                    $push: { commandes: newCommande },
                    $inc: { solde: -data.montant }
                },
                { new: true, upsert: true }
            );
            
            // Mettre à jour également le solde de l'étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': -data.montant } }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:commande-added', {
                commande: newCommande,
                solde: transaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:add-commande');
        }
    }

    /**
     * Met à jour une commande existante
     */
    async handleUpdateCommande(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.commandeId || (!data.product && !data.montant)) {
                throw new Error('Données de mise à jour invalides');
            }
            
            if (!mongoose.Types.ObjectId.isValid(data.commandeId)) {
                throw new Error('ID de commande invalide');
            }
            
            // Rechercher d'abord la transaction et la commande
            const transaction = await Transaction.findOne({ 
                etudiantId,
                'commandes._id': data.commandeId 
            });
            
            if (!transaction) {
                throw new Error('Commande non trouvée');
            }
            
            // Trouver la commande spécifique
            const commande = transaction.commandes.find(
                c => c._id.toString() === data.commandeId
            );
            
            if (!commande) {
                throw new Error('Commande non trouvée');
            }
            
            // Calculer la différence de montant pour ajuster le solde
            const montantDiff = (data.montant || commande.montant) - commande.montant;
            
            // Mettre à jour la commande
            const updateFields = {};
            if (data.product) updateFields['commandes.$.product'] = data.product;
            if (data.montant) updateFields['commandes.$.montant'] = data.montant;
            
            // Mettre à jour la transaction
            const updatedTransaction = await Transaction.findOneAndUpdate(
                { etudiantId, 'commandes._id': data.commandeId },
                { 
                    $set: updateFields,
                    $inc: { solde: -montantDiff } 
                },
                { new: true }
            );
            
            // Mettre à jour également le solde de l'étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': -montantDiff } }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:commande-updated', {
                commande: updatedTransaction.commandes.find(c => c._id.toString() === data.commandeId),
                solde: updatedTransaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:update-commande');
        }
    }

    /**
     * Supprime une commande existante
     */
    async handleDeleteCommande(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.commandeId) {
                throw new Error('ID de commande requis');
            }
            
            if (!mongoose.Types.ObjectId.isValid(data.commandeId)) {
                throw new Error('ID de commande invalide');
            }
            
            // Rechercher d'abord la transaction et la commande
            const transaction = await Transaction.findOne({ 
                etudiantId,
                'commandes._id': data.commandeId 
            });
            
            if (!transaction) {
                throw new Error('Commande non trouvée');
            }
            
            // Trouver la commande spécifique
            const commande = transaction.commandes.find(
                c => c._id.toString() === data.commandeId
            );
            
            if (!commande) {
                throw new Error('Commande non trouvée');
            }
            
            // Supprimer la commande et ajuster le solde
            const updatedTransaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { 
                    $pull: { commandes: { _id: data.commandeId } },
                    $inc: { solde: commande.montant }
                },
                { new: true }
            );
            
            // Mettre à jour également le solde de l'étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': commande.montant } }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:commande-deleted', {
                commandeId: data.commandeId,
                solde: updatedTransaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:delete-commande');
        }
    }

    /**
     * Ajoute une recharge à la transaction d'un étudiant
     */
    async handleAddRecharge(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.montant || isNaN(data.montant) || data.montant <= 0) {
                throw new Error('Données de recharge invalides');
            }
            
            // Valeurs par défaut
            const statut = data.statut || 'completed';
            
            // Générer une référence unique pour la recharge
            const ref = `RECH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            const newRecharge = {
                montant: data.montant,
                statut,
                ref,
                date_created: new Date()
            };
            
            // Calculer l'augmentation du solde (seulement si la recharge est complétée)
            const soldeIncrement = statut === 'completed' ? data.montant : 0;
            
            // Rechercher la transaction et ajouter la recharge
            let transaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { 
                    $push: { recharges: newRecharge },
                    $inc: { solde: soldeIncrement }
                },
                { new: true, upsert: true }
            );
            
            // Mettre à jour également le solde de l'étudiant si la recharge est complétée
            if (statut === 'completed') {
                await Etudiant.findByIdAndUpdate(
                    etudiantId,
                    { $inc: { 'infoSec.solde': data.montant } }
                );
            }
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:recharge-added', {
                recharge: newRecharge,
                solde: transaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:add-recharge');
        }
    }

    /**
     * Met à jour une recharge existante
     */
    async handleUpdateRecharge(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.rechargeId || (!data.montant && !data.statut)) {
                throw new Error('Données de mise à jour invalides');
            }
            
            if (!mongoose.Types.ObjectId.isValid(data.rechargeId)) {
                throw new Error('ID de recharge invalide');
            }
            
            // Rechercher d'abord la transaction et la recharge
            const transaction = await Transaction.findOne({ 
                etudiantId,
                'recharges._id': data.rechargeId 
            });
            
            if (!transaction) {
                throw new Error('Recharge non trouvée');
            }
            
            // Trouver la recharge spécifique
            const recharge = transaction.recharges.find(
                r => r._id.toString() === data.rechargeId
            );
            
            if (!recharge) {
                throw new Error('Recharge non trouvée');
            }
            
            // Calculer l'ajustement du solde basé sur le changement de statut ou de montant
            let soldeAdjustment = 0;
            
            if (data.statut) {
                // Si on change le statut à "completed" depuis un autre statut
                if (data.statut === 'completed' && recharge.statut !== 'completed') {
                    soldeAdjustment += data.montant || recharge.montant;
                } 
                // Si on change le statut depuis "completed" vers un autre statut
                else if (data.statut !== 'completed' && recharge.statut === 'completed') {
                    soldeAdjustment -= recharge.montant;
                }
            }
            
            // Si le montant change et que le statut est (ou restera) "completed"
            if (data.montant && (data.statut === 'completed' || (!data.statut && recharge.statut === 'completed'))) {
                soldeAdjustment += (data.montant - recharge.montant);
            }
            
            // Mettre à jour la recharge
            const updateFields = {};
            if (data.montant) updateFields['recharges.$.montant'] = data.montant;
            if (data.statut) updateFields['recharges.$.statut'] = data.statut;
            
            // Mettre à jour la transaction
            const updatedTransaction = await Transaction.findOneAndUpdate(
                { etudiantId, 'recharges._id': data.rechargeId },
                { 
                    $set: updateFields,
                    $inc: { solde: soldeAdjustment } 
                },
                { new: true }
            );
            
            // Mettre à jour également le solde de l'étudiant
            if (soldeAdjustment !== 0) {
                await Etudiant.findByIdAndUpdate(
                    etudiantId,
                    { $inc: { 'infoSec.solde': soldeAdjustment } }
                );
            }
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:recharge-updated', {
                recharge: updatedTransaction.recharges.find(r => r._id.toString() === data.rechargeId),
                solde: updatedTransaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:update-recharge');
        }
    }

    /**
     * Supprime une recharge existante
     */
    async handleDeleteRecharge(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.rechargeId) {
                throw new Error('ID de recharge requis');
            }
            
            if (!mongoose.Types.ObjectId.isValid(data.rechargeId)) {
                throw new Error('ID de recharge invalide');
            }
            
            // Rechercher d'abord la transaction et la recharge
            const transaction = await Transaction.findOne({ 
                etudiantId,
                'recharges._id': data.rechargeId 
            });
            
            if (!transaction) {
                throw new Error('Recharge non trouvée');
            }
            
            // Trouver la recharge spécifique
            const recharge = transaction.recharges.find(
                r => r._id.toString() === data.rechargeId
            );
            
            if (!recharge) {
                throw new Error('Recharge non trouvée');
            }
            
            // Calculer l'ajustement du solde (seulement si la recharge était "completed")
            const soldeAdjustment = recharge.statut === 'completed' ? -recharge.montant : 0;
            
            // Supprimer la recharge et ajuster le solde
            const updatedTransaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { 
                    $pull: { recharges: { _id: data.rechargeId } },
                    $inc: { solde: soldeAdjustment }
                },
                { new: true }
            );
            
            // Mettre à jour également le solde de l'étudiant si nécessaire
            if (soldeAdjustment !== 0) {
                await Etudiant.findByIdAndUpdate(
                    etudiantId,
                    { $inc: { 'infoSec.solde': soldeAdjustment } }
                );
            }
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:recharge-deleted', {
                rechargeId: data.rechargeId,
                solde: updatedTransaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:delete-recharge');
        }
    }
}

module.exports = TransactionSocket;