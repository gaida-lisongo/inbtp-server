const Retrait = require('../models/retrait.model');
const Agent = require('../models/agent.model');
const crypto = require('crypto');
const cache = require('../utils/cache');
const mongoose = require('mongoose'); // Ajout de l'import mongoose
const { sendOtpEmail } = require('./agent.controller');
const { sendMail } = require('../utils/mail');

class RetraitController {
    /**
     * Créer un nouveau retrait
     */
    async createRetrait(data) {
        try {
            const { agentId, montant, type, description } = data;

            // Validation de base
            if (!agentId || !montant || !type || !description) {
                throw new Error('Données incomplètes pour le retrait');
            }

            // Vérifier que l'agent existe
            const agent = await Agent.findById(agentId);
            if (!agent) {
                throw new Error('Agent non trouvé');
            }

            const messageHtml = `
                <p>Bonjour ${agent.nom},</p>
                <p>Votre retrait de ${montant} FC a été créé avec succès.</p>
                <p> Vous serez crediter au numéro : ${agent.telephone} </p>
            `;

            // Générer une référence unique
            const ref = `RET-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

            // Créer le retrait
            const retrait = new Retrait({
                agentId,
                montant,
                type,
                description,
                ref
            });

            await retrait.save();

            // Invalider le cache
            await cache.delete(`retraits:${agentId}`);
            
            await sendMail(agent.email, "Retrait de fonds", messageHtml);

            return {
                success: true,
                retrait
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Lister les retraits avec filtres
     */
    async listRetraits(filters = {}) {
        try {
            const query = { ...filters };
            const retraits = await Retrait.find(query)
                .populate('agentId', 'nom prenom email')
                .sort({ date_created: -1 });

            return {
                success: true,
                data: retraits
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Mettre à jour le statut d'un retrait
     */
    async updateStatus(retraitId, newStatus) {
        try {
            const retrait = await Retrait.findByIdAndUpdate(
                retraitId,
                { statut: newStatus },
                { new: true }
            );

            if (!retrait) {
                throw new Error('Retrait non trouvé');
            }

            // Invalider le cache
            await cache.delete(`retraits:${retrait.agentId}`);

            return {
                success: true,
                retrait
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtenir les statistiques des retraits par type
     */
    async getStats(agentId) {
        try {
            // Vérifier si l'agent existe
            const agentExists = await Agent.exists({ _id: agentId });
            if (!agentExists) {
                throw new Error('Agent non trouvé');
            }
            
            // Convertir agentId en ObjectId pour l'utiliser dans l'agrégation
            const objectId = new mongoose.Types.ObjectId(agentId);
            
            // Obtenir les statistiques par type
            const statsByType = await Retrait.aggregate([
                { $match: { agentId: objectId } },
                { $group: {
                    _id: '$type',
                    total: { $sum: '$montant' },
                    count: { $sum: 1 }
                }},
                { $sort: { total: -1 } }
            ]);
            
            // Obtenir le total global
            const globalStats = await Retrait.aggregate([
                { $match: { agentId: objectId } },
                { $group: {
                    _id: null,
                    totalAmount: { $sum: '$montant' },
                    totalCount: { $sum: 1 },
                    pendingCount: {
                        $sum: { $cond: [{ $eq: ["$statut", "EN ATTENTE"] }, 1, 0] }
                    },
                    completedCount: {
                        $sum: { $cond: [{ $eq: ["$statut", "COMPLETED"] }, 1, 0] }
                    },
                    rejectedCount: {
                        $sum: { $cond: [{ $eq: ["$statut", "REJECTED"] }, 1, 0] }
                    }
                }}
            ]);
            
            // Récupérer les derniers retraits de l'agent
            const recentRetraits = await Retrait.find({ agentId: objectId })
                .sort({ date_created: -1 })
                .limit(5)
                .populate('agentId', 'nom prenom email')
                .lean();
            
            return {
                success: true,
                stats: {
                    byType: statsByType,
                    global: globalStats.length > 0 ? globalStats[0] : {
                        totalAmount: 0,
                        totalCount: 0,
                        pendingCount: 0,
                        completedCount: 0,
                        rejectedCount: 0
                    },
                    recent: recentRetraits
                }
            };
        } catch (error) {
            console.error('Erreur dans getStats:', error);
            throw error;
        }
    }
}

module.exports = new RetraitController();