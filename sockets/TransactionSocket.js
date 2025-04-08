const Socket = require('./Socket');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');
const Etudiant = require('../models/etudiant.model');            
// Importer le service de paiement avec require (compatible avec CommonJS)
const {paymentService} = require('../utils/flexpay');
console.log('Payment service imported:', paymentService);
/**
 * Socket pour la gestion des transactions financières des étudiants
 */
class TransactionSocket extends Socket {
    /**
     * Initialisation des événements de transactions
     */
    init() {
        console.log('TransactionSocket.init() appelé');
        // Appel de la méthode d'initialisation du parent
        super.init();
        
        this.io.on('connection', (socket) => {
            console.log('Nouvelle connexion détectée dans TransactionSocket');
            // Événements de gestion des transactions
            socket.on('transaction:get-all', (data) => this.handleGetTransactions(socket, data));
            
            socket.on('transaction:update-solde', (data) => this.handleUpdateSolde(socket, data));
            
            // Gestion des frais académiques
            socket.on('transaction:get-frais-acad', () => this.handleGetFraisAcad(socket));
                
            socket.on('transaction:update-frais-acad', (data) => this.handleUpdateFraisAcad(socket, data));
                
            socket.on('transaction:payer-frais-acad', (data) => this.handlePayerFraisAcad(socket, data));
            
            // Gestion des commandes
            socket.on('transaction:add-commande', (data) => this.handleAddCommande(socket, data));
            
            socket.on('transaction:update-commande', (data) => this.handleUpdateCommande(socket, data));
            
            socket.on('transaction:delete-commande', (data) => this.handleDeleteCommande(socket, data));
            
            // Gestion des recharges
            socket.on('transaction:add-recharge', (data) => this.handleAddRecharge(socket, data));
            
            socket.on('transaction:update-recharge', (data) => this.handleUpdateRecharge(socket, data));
            
            socket.on('transaction:delete-recharge', (data) => this.handleDeleteRecharge(socket, data));
            
            socket.on('transaction:check-payment-status', (data) => this.checkPaymentStatus(socket, data.etudiantId, data.orderNumber));
        });
    }
    /**
     * Récupère toutes les transactions d'un étudiant
     */
    async handleGetTransactions(socket, data) {
        const { etudiantId } = data;
        console.log('handleGetTransactions appelé', data);
        console.log('Handling get transactions for socket:', socket.id);
        console.log('Socket etudiantId:', etudiantId);
        try {
            
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
            
            this.emitSuccess(socket, 'transaction:get-all', transactions);
            
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
     * Ajoute une recharge à la transaction d'un étudiant et initie le processus de paiement
     */
    async handleAddRecharge(socket, data) {
        console.log('handleAddRecharge appelé', data);
        data.montant = data.amount
        try {
            // Validation des données requises
            if (!data || !data.montant || isNaN(data.montant) || data.montant <= 0) {
                throw new Error('Montant de recharge invalide');
            }

            if (!data.phone) {
                throw new Error('Numéro de téléphone requis pour la recharge');
            }

            // Utiliser l'ID de l'étudiant depuis les données ou le socket
            const etudiantId = data.etudiantId || socket.etudiantId;
            
            if (!etudiantId) {
                throw new Error('ID étudiant non spécifié');
            }

            // Créer une référence unique pour cette transaction
            const reference = data.ref || `RECH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            
            // Préparer les données pour le service de paiement
            const paymentData = {
                phone: data.phone,
                amount: data.montant,
                ref: reference,
                currency: data.currency || 'CDF',
                description: data.description || `Recharge de compte étudiant INBTP`
            };
            
            // Initier le paiement via le service de paiement
            const paymentResponse = await paymentService.collect(paymentData);
            
            // Vérifier si l'initiation du paiement a réussi
            if (!paymentResponse || !paymentResponse.orderNumber) {
                throw new Error('Échec de l\'initiation du paiement: ' + (paymentResponse?.message || 'Erreur inconnue'));
            }
            
            // Créer un objet de recharge selon le schéma exact
            let newRecharge = {
                montant: data.montant,
                ref: paymentResponse.orderNumber,
                statut: 'pending',
                date_created: new Date()
            };
            
            // Enregistrer la recharge avec statut pending dans la base de données
            let transaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { $push: { recharges: newRecharge } },
                { new: true, upsert: true }
            );
            newRecharge.montant = `${data.montant} ${data.currency}`;
            // Informer le client que la recharge a été initiée
            this.emitSuccess(socket, 'transaction:recharge-initiated', {
                recharge: newRecharge,
                orderNumber: paymentResponse.orderNumber,
                message: 'Paiement initialisé, veuillez confirmer sur votre téléphone'
            });
            
            // Démarrer le processus de vérification périodique du paiement
            this.checkPaymentStatus(socket, etudiantId, paymentResponse.orderNumber);
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout d\'une recharge:', error);
            this.handleError(error, socket, 'transaction:add-recharge');
        }
    }

    /**
     * Vérifie périodiquement le statut du paiement
     */
    async checkPaymentStatus(socket, etudiantId, orderNumber, attempts = 0) {
        // Limiter à 20 tentatives (10 minutes à raison d'une vérification toutes les 30 secondes)
        const maxAttempts = 10;
        
        try {
            // Importer le service de paiement
            const { paymentService } = require('../utils/flexpay');
            
            // Vérifier le statut du paiement
            const paymentStatus = await paymentService.check({ orderNumber });
            console.log(`Vérification de paiement #${attempts + 1} pour ${orderNumber}:`, paymentStatus.transaction.status == 1 ? 'Succès' : 'Échec');
            
            // Si le paiement est confirmé comme réussi
            if (paymentStatus.transaction.status == 0) {
                console.log('Paiement réussi pour la commande:', paymentStatus.transaction);
                // Mettre à jour le statut de la recharge et le solde de l'étudiant
                await this.completeRecharge(socket, etudiantId, orderNumber);
                return;
            } else {
                // Si nous avons atteint le nombre maximal de tentatives, marquer comme expiré
                if (attempts >= maxAttempts) {
                    await this.failRecharge(socket, etudiantId, orderNumber, 'failed');
                    return;
                }
            }
            
            
            // Programmer une nouvelle vérification dans 30 secondes
            setTimeout(() => {
                this.checkPaymentStatus(socket, etudiantId, orderNumber, attempts + 1);
            }, 5); // 30 secondes
            
        } catch (error) {
            console.error(`Erreur lors de la vérification du paiement ${orderNumber}:`, error);
            
            // En cas d'erreur de vérification, continuer à essayer si nous n'avons pas atteint la limite
            if (attempts < maxAttempts) {
                setTimeout(() => {
                    this.checkPaymentStatus(socket, etudiantId, orderNumber, attempts + 1);
                }, 30000);
            } else {
                await this.failRecharge(socket, etudiantId, orderNumber, 'failed');
            }
        }
    }

    /**
     * Finalise une recharge réussie
     */
    async completeRecharge(socket, etudiantId, orderNumber) {
        console.log('completeRecharge appelé', etudiantId, orderNumber);
        try {
            // Trouver la transaction et la recharge spécifique
            const transaction = await Transaction.findOne({ 
                etudiantId,
                'recharges.ref': orderNumber
            });
            console.log('Transaction trouvée:', transaction);
            if (!transaction) {
                console.error(`Recharge introuvable pour l'ordre ${orderNumber}`);
                return;
            }
            
            // Trouver l'index de la recharge dans le tableau
            const rechargeIndex = transaction.recharges.findIndex(r => r.ref === orderNumber);
            if (rechargeIndex === -1) return;
            
            const recharge = transaction.recharges[rechargeIndex];
            
            // Si la recharge est déjà complétée, ne rien faire
            if (recharge.statut === 'completed') return;
            
            // Mettre à jour le statut de la recharge
            await Transaction.updateOne(
                { etudiantId, 'recharges.ref': orderNumber },
                { 
                    $set: { 'recharges.$.statut': 'completed' },
                    $inc: { solde: recharge.montant }
                }
            );
            
            // Mettre à jour également le solde de l'étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': recharge.montant } }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            // Notifier le client que le paiement est terminé
            this.emitSuccess(socket, 'transaction:recharge-completed', {
                recharge: {
                    ...recharge,
                    statut: 'completed'
                },
                message: 'Votre compte a été rechargé avec succès!'
            });
            
        } catch (error) {
            console.error('Erreur lors de la finalisation de la recharge:', error);
        }
    }

    /**
     * Marque une recharge comme échouée
     */
    async failRecharge(socket, etudiantId, orderNumber, status) {
        try {
            // Mettre à jour le statut de la recharge
            await Transaction.updateOne(
                { etudiantId, 'recharges.ref': orderNumber },
                { $set: { 'recharges.$.statut': status === 'cancelled' ? 'canceled' : 'failed' } }
            );
            
            // Récupérer la transaction mise à jour
            const updatedTransaction = await Transaction.findOne({ 
                etudiantId,
                'recharges.ref': orderNumber
            });
            
            const recharge = updatedTransaction?.recharges.find(r => r.ref === orderNumber);
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            
            // Préparer un message approprié selon le statut
            let message = 'Échec de la recharge';
            if (status === 'cancelled' || status === 'canceled') message = 'La recharge a été annulée';
            if (status === 'expired') message = 'La session de paiement a expiré';
            if (status === 'failed') message = 'Le paiement a échoué';
            if (status === 'rejected') message = 'Le paiement a été rejeté';
            
            // Notifier le client que le paiement a échoué
            this.emitSuccess(socket, 'transaction:recharge-failed', {
                recharge: recharge || { ref: orderNumber, statut: status === 'cancelled' ? 'canceled' : 'failed' },
                message
            });
            
        } catch (error) {
            console.error('Erreur lors du marquage de la recharge comme échouée:', error);
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

    /**
     * Récupère les frais académiques d'un étudiant
     */
    async handleGetFraisAcad(socket) {
        try {
            const etudiantId = socket.etudiantId;
            
            const transaction = await this.getFromCache(
                `transaction:${etudiantId}:frais-acad`, 
                async () => {
                    // Trouver ou créer l'enregistrement de transaction pour l'étudiant
                    let transactionDoc = await Transaction.findOne({ etudiantId });
                    
                    if (!transactionDoc) {
                        // Si aucun enregistrement n'existe, en créer un nouveau
                        const etudiant = await this.getFromCache(
                            `etudiant:${etudiantId}:profile`, 
                            async () => await Etudiant.findById(etudiantId)
                        );
                        
                        transactionDoc = await Transaction.create({
                            etudiantId,
                            solde: etudiant?.infoSec?.solde || 0,
                            fraisAcad: 0
                        });
                    }
                    
                    return transactionDoc;
                }
            );
            
            this.emitSuccess(socket, 'transaction:frais-acad', {
                fraisAcad: transaction.fraisAcad
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:get-frais-acad');
        }
    }

    /**
     * Met à jour le montant des frais académiques (définir la valeur totale des frais)
     */
    async handleUpdateFraisAcad(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || data.fraisAcad === undefined || isNaN(data.fraisAcad) || data.fraisAcad < 0) {
                throw new Error('Montant des frais académiques invalide');
            }
            
            // Mise à jour des frais académiques
            const transaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { $set: { fraisAcad: data.fraisAcad } },
                { new: true, upsert: true }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`transaction:${etudiantId}:frais-acad`);
            
            this.emitSuccess(socket, 'transaction:frais-acad-updated', { 
                fraisAcad: transaction.fraisAcad 
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:update-frais-acad');
        }
    }

    /**
     * Effectue un paiement des frais académiques (déduit du solde étudiant)
     */
    async handlePayerFraisAcad(socket, data) {
        try {
            const etudiantId = socket.etudiantId;
            
            if (!data || !data.montant || isNaN(data.montant) || data.montant <= 0) {
                throw new Error('Montant du paiement invalide');
            }
            
            // Récupérer la transaction et vérifier le solde
            const transaction = await Transaction.findOne({ etudiantId });
            if (!transaction) {
                throw new Error('Aucun enregistrement de transaction trouvé');
            }
            
            if (transaction.solde < data.montant) {
                throw new Error('Solde insuffisant pour effectuer ce paiement');
            }
            
            // Générer une référence unique pour la commande
            const ref = `FRAIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            const newCommande = {
                product: 'Frais Académiques',
                montant: data.montant,
                ref,
                date_created: new Date()
            };
            
            // Mettre à jour la transaction
            const updatedTransaction = await Transaction.findOneAndUpdate(
                { etudiantId },
                { 
                    $push: { commandes: newCommande },
                    $inc: { solde: -data.montant }
                },
                { new: true }
            );
            
            // Mettre à jour également le solde de l'étudiant
            await Etudiant.findByIdAndUpdate(
                etudiantId,
                { $inc: { 'infoSec.solde': -data.montant } }
            );
            
            // Invalider les caches concernés
            await this.invalidateCache(`transaction:${etudiantId}:all`);
            await this.invalidateCache(`transaction:${etudiantId}:frais-acad`);
            await this.invalidateCache(`etudiant:${etudiantId}:profile`);
            
            this.emitSuccess(socket, 'transaction:frais-acad-paye', {
                paiement: newCommande,
                solde: updatedTransaction.solde
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:payer-frais-acad');
        }
    }

    /**
     * Vérifie si tous les frais académiques sont payés
     */
    async handleVerifierFraisPayes(socket) {
        try {
            const etudiantId = socket.etudiantId;
            
            // Récupérer la transaction
            const transaction = await Transaction.findOne({ etudiantId });
            if (!transaction) {
                throw new Error('Aucun enregistrement de transaction trouvé');
            }
            
            // Calculer le total des frais académiques payés
            const fraisPayes = transaction.commandes
                .filter(c => c.product === 'Frais Académiques')
                .reduce((total, commande) => total + commande.montant, 0);
            
            // Déterminer si tous les frais sont payés
            const fraisComplets = fraisPayes >= transaction.fraisAcad;
            const resteAPayer = Math.max(0, transaction.fraisAcad - fraisPayes);
            
            this.emitSuccess(socket, 'transaction:frais-acad-statut', {
                fraisTotal: transaction.fraisAcad,
                fraisPayes,
                resteAPayer,
                fraisComplets
            });
            
        } catch (error) {
            this.handleError(error, socket, 'transaction:verifier-frais-payes');
        }
    }
}

module.exports = TransactionSocket;