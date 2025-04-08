const Retrait = require('../models/retrait.model');
const Agent = require('../models/agent.model');
const crypto = require('crypto');
const cache = require('../utils/cache');

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
            const stats = await Retrait.aggregate([
                { $match: { agentId: mongoose.Types.ObjectId(agentId) } },
                { $group: {
                    _id: '$type',
                    total: { $sum: '$montant' },
                    count: { $sum: 1 }
                }}
            ]);

            return {
                success: true,
                stats
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new RetraitController();