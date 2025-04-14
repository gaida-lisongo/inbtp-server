const Promotion = require('../models/promotion.model');
const Matiere = require('../models/matiere.model');
const Travail = require('../models/travaux.model');
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

    // Fonction pour récupérer tous les travaux d'une promotion
    async getTravailsByPromotion(promotionId) {
        try {
            // 1. Récupérer la promotion avec ses unités
            const promotion = await Promotion.findById(promotionId)
                .select('unites')
                .lean();
            
            if (!promotion) {
                return {
                    success: false,
                    error: 'Promotion non trouvée'
                };
            }
            
            // 2. Extraire les codes d'unités de la promotion
            const codeUnites = promotion.unites.map(unite => unite.code);
            
            // 3. Trouver toutes les matières qui correspondent à ces codes d'unités
            const matieres = await Matiere.find({
                codeUnite: { $in: codeUnites }
            })
            .select('_id designation code codeUnite')
            .lean();
            
            if (!matieres.length) {
                return {
                    success: true,
                    message: 'Aucune matière trouvée pour cette promotion',
                    data: []
                };
            }
            
            // 4. Récupérer les IDs des matières
            const matiereIds = matieres.map(matiere => matiere._id);
            
            // 5. Trouver tous les travaux liés à ces matières
            const travaux = await Travail.find({
                matiereId: { $in: matiereIds }
            })
            .populate({
                path: 'matiereId',
                select: 'designation code codeUnite'
            })
            .populate('auteurId')
            .sort('-date_created')
            .lean();
            
            // 6. Organiser les travaux par unité d'enseignement
            const travauxParUnite = {};
            
            travaux.forEach(travail => {
                const codeUnite = travail.matiereId.codeUnite;
                if (!travauxParUnite[codeUnite]) {
                    // Trouver les informations de l'unité
                    const unite = promotion.unites.find(u => u.code === codeUnite);
                    travauxParUnite[codeUnite] = {
                        code: codeUnite,
                        designation: unite ? unite.designation : 'Inconnue',
                        categorie: unite ? unite.categorie : 'Inconnue',
                        travaux: []
                    };
                }
                
                travauxParUnite[codeUnite].travaux.push({
                    ...travail,
                    reste: travail.date_fin ? Math.max(0, Math.ceil((new Date(travail.date_fin) - new Date()) / (1000 * 60 * 60 * 24))) : 0
                });
            });
            
            return {
                success: true,
                count: travaux.length,
                data: {
                    promotion: {
                        _id: promotionId,
                        unites: Object.values(travauxParUnite)
                    },
                    travaux: travaux
                }
            };
            
        } catch (error) {
            console.error('Erreur lors de la récupération des travaux:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PromotionController();