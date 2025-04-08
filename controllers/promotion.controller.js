const Promotion = require('../models/promotion.model');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class PromotionController {
    // Créer une promotion
    async createPromotion(promotionData) {
        try {
            const { sectionId, niveau, mention, orientation} = promotionData;

            // Validation des champs requis
            if (!mention || !sectionId || !niveau) {
                throw new Error("La mention, la section et le niveau sont requis");
            }

            const nouvellePromotion = new Promotion(promotionData);
            return await nouvellePromotion.save();
        } catch (error) {
            throw error;
        }
    }

    // Lister toutes les promotions
    async listPromotions(query = {}) {
        try {
            return await Promotion.find(query)
                .populate('sectionId', 'titre')
                .populate('unites.matieres', 'designation');
        } catch (error) {
            throw error;
        }
    }

    // Obtenir une promotion par ID
    async getPromotionById(id) {
        try {
            return await Promotion.findById(id)
                .populate('sectionId', 'titre')
                .populate('unites.matieres', 'designation');
        } catch (error) {
            throw error;
        }
    }

    // Obtenir une promotion par ID de la section
    async getPromotionBySectionId(sectionId) {
        try {
            return await Promotion.find({ sectionId })
                .populate('sectionId', 'titre')
                .populate('unites.matieres', 'designation');
        } catch (error) {
            throw error;
        }
    
    }
    
    // Mettre à jour une promotion
    async updatePromotion(id, updateData) {
        try {
            return await Promotion.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).populate('sectionId', 'titre')
             .populate('unites.matieres', 'designation');
        } catch (error) {
            throw error;
        }
    }

    // Supprimer une promotion
    async deletePromotion(id) {
        try {
            return await Promotion.findByIdAndDelete(id);
        } catch (error) {
            throw error;
        }
    }

    // Ajouter une unité à une promotion
    async addUnite(promotionId, uniteData) {
        try {
            const { code, designation, categorie } = uniteData;

            if (!code || !designation || !categorie) {
                throw new Error("Le code, la désignation et la catégorie sont requis");
            }

            const promotion = await Promotion.findById(promotionId);
            if (!promotion) {
                throw new Error("Promotion non trouvée");
            }

            // Vérifier si une unité avec le même code existe déjà
            const uniteExistante = promotion.unites.find(u => u.code === code);
            if (uniteExistante) {
                throw new Error(`Une unité avec le code ${code} existe déjà`);
            }

            promotion.unites.push({
                code,
                designation,
                categorie,
                matieres: []
            });

            await promotion.save();
            return promotion;
        } catch (error) {
            throw error;
        }
    }

    // Mettre à jour une unité
    async updateUnite(promotionId, uniteId, updateData) {
        try {
            const promotion = await Promotion.findById(promotionId);
            if (!promotion) {
                throw new Error("Promotion non trouvée");
            }

            const uniteIndex = promotion.unites.findIndex(
                u => u._id.toString() === uniteId
            );

            if (uniteIndex === -1) {
                throw new Error("Unité non trouvée");
            }

            // Vérifier si le nouveau code n'existe pas déjà
            if (updateData.code) {
                const codeExists = promotion.unites.some(
                    u => u.code === updateData.code && u._id.toString() !== uniteId
                );
                if (codeExists) {
                    throw new Error(`Une unité avec le code ${updateData.code} existe déjà`);
                }
            }

            // Mise à jour des champs de l'unité
            Object.assign(promotion.unites[uniteIndex], updateData);
            await promotion.save();

            return promotion;
        } catch (error) {
            throw error;
        }
    }

    // Supprimer une unité
    async removeUnite(promotionId, uniteId) {
        try {
            const promotion = await Promotion.findById(promotionId);
            if (!promotion) {
                throw new Error("Promotion non trouvée");
            }

            promotion.unites = promotion.unites.filter(
                u => u._id.toString() !== uniteId
            );

            await promotion.save();
            return promotion;
        } catch (error) {
            throw error;
        }
    }

    // Lister les unités d'une promotion
    async listUnites(promotionId) {
        try {
            const promotion = await Promotion.findById(promotionId);
            if (!promotion) {
                throw new Error("Promotion non trouvée");
            }

            return promotion.unites;
        } catch (error) {
            throw error;
        }
    }

    // Importer des unités depuis un fichier CSV
    async importUnites(promotionId, fileName) {
        try {
            const promotion = await Promotion.findById(promotionId);
            if (!promotion) {
                throw new Error("Promotion non trouvée");
            }

            const results = [];
            const filePath = path.join(__dirname, '../assets', fileName);

            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({
                        separator: ';',
                        mapHeaders: ({ header }) => header.trim(),
                        mapValues: ({ value }) => value.trim()
                    }))
                    .on('data', (data) => {
                        const unite = {
                            code: data.code,
                            designation: data.designation,
                            categorie: data.categorie
                        };
                        results.push(unite);
                    })
                    .on('end', async () => {
                        try {
                            // Vérifier les doublons avant l'insertion
                            for (const unite of results) {
                                const uniteExistante = promotion.unites.find(
                                    u => u.code === unite.code
                                );
                                if (uniteExistante) {
                                    throw new Error(
                                        `Une unité avec le code ${unite.code} existe déjà`
                                    );
                                }
                            }

                            // Ajouter toutes les unités
                            promotion.unites.push(...results);
                            await promotion.save();

                            resolve({
                                success: true,
                                count: results.length,
                                data: promotion
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => reject(error));
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new PromotionController();