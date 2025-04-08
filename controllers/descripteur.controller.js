const Descripteur = require('../models/descripteur.model');
const cache = require('../utils/cache');

class DescripteurController {
    /**
     * Créer un nouveau descripteur
     */
    async createDescripteur(data) {
        try {
            // Vérifier si un descripteur existe déjà pour cette unité
            const existingDescripteur = await Descripteur.findOne({ uniteId: data.uniteId });
            if (existingDescripteur) {
                throw new Error('Un descripteur existe déjà pour cette unité');
            }

            const descripteur = new Descripteur(data);
            await descripteur.save();

            // Invalider le cache
            await cache.delete(`descripteur:${data.uniteId}`);

            return {
                success: true,
                message: 'Descripteur créé avec succès',
                data: descripteur
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtenir un descripteur par ID d'unité
     */
    async getDescripteurByUniteId(uniteId) {
        try {
            if (!uniteId) {
                throw new Error("ID de l'unité requis");
            }

            // Vérifier le cache
            const cacheKey = `descripteur:${uniteId}`;
            const cached = await cache.get(cacheKey);
            if (cached) {
                console.log("Descripteur trouvé dans le cache");
                return cached;
            }

            // Récupérer depuis la base de données
            const descripteur = await Descripteur.findOne({ uniteId }).lean();

            if (!descripteur) {
                console.log("Aucun descripteur trouvé pour l'unité:", uniteId);
                return null;
            }

            await cache.set(cacheKey, descripteur, 3600);
            console.log("Descripteur mis en cache");

            return descripteur;
        } catch (error) {
            console.error("Erreur dans getDescripteurByUniteId:", error);
            throw error;
        }
    }

    /**
     * Mettre à jour un descripteur
     */
    async updateDescripteur(uniteId, updateData) {
        try {
            const descripteur = await Descripteur.findOneAndUpdate(
                { uniteId },
                updateData,
                { new: true }
            );

            if (!descripteur) {
                throw new Error('Descripteur non trouvé');
            }

            // Invalider le cache
            await cache.delete(`descripteur:${uniteId}`);

            return {
                success: true,
                message: 'Descripteur mis à jour avec succès',
                data: descripteur
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Supprimer un descripteur
     */
    async deleteDescripteur(uniteId) {
        try {
            const descripteur = await Descripteur.findOneAndDelete({ uniteId });

            if (!descripteur) {
                throw new Error('Descripteur non trouvé');
            }

            // Invalider le cache
            await cache.delete(`descripteur:${uniteId}`);

            return {
                success: true,
                message: 'Descripteur supprimé avec succès'
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new DescripteurController();