const mongoose = require('mongoose');
const Matiere = require('../models/matiere.model');
const Promotion = require('../models/promotion.model');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class MatiereController {
    // Créer une matière
    async createMatiere(matiereData) {
        try {
            const matiere = new Matiere(matiereData);
            return await matiere.save();
        } catch (error) {
            throw error;
        }
    }

    // Importer des matières depuis CSV
    async importMatieres(fileName) {
        try {
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
                        const matiere = {
                            designation: data.designation,
                            credit: parseFloat(data.credit),
                            code: data.code,
                            semestre: data.semestre,
                            codeUnite: data.code_unite || data.code.split('_')[0],
                            chargesHoraires: []
                        };
                        results.push(matiere);
                    })
                    .on('end', async () => {
                        try {
                            const matieres = await Promise.all(
                                results.map(data => this.createMatiere(data))
                            );
                            resolve({
                                success: true,
                                count: matieres.length,
                                data: matieres
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

    // Ajouter une charge horaire à une matière
    async addChargeHoraire(matiereId, chargeData) {
        try {
            const matiere = await Matiere.findById(matiereId);
            if (!matiere) {
                throw new Error("Matière non trouvée");
            }

            matiere.charges_horaires.push(chargeData);
            return await matiere.save();
        } catch (error) {
            throw error;
        }
    }

    // Mettre à jour une charge horaire
    async updateChargeHoraire(matiereId, chargeId, updateData) {
        try {
            const matiere = await Matiere.findById(matiereId);
            if (!matiere) {
                throw new Error("Matière non trouvée");
            }

            const chargeIndex = matiere.charges_horaires.findIndex(
                ch => ch._id.toString() === chargeId
            );

            if (chargeIndex === -1) {
                throw new Error("Charge horaire non trouvée");
            }

            Object.assign(matiere.charges_horaires[chargeIndex], updateData);
            return await matiere.save();
        } catch (error) {
            throw error;
        }
    }

    // Supprimer une charge horaire
    async deleteChargeHoraire(matiereId, chargeId) {
        try {
            const matiere = await Matiere.findById(matiereId);
            if (!matiere) {
                throw new Error("Matière non trouvée");
            }

            matiere.charges_horaires = matiere.charges_horaires.filter(
                ch => ch._id.toString() !== chargeId
            );

            return await matiere.save();
        } catch (error) {
            throw error;
        }
    }
    /**
     * Obtenir les charges horaires d'une matière
     */
    async getChargesHoraires(matiereId) {
        try {
            const matiere = await Matiere.findById(matiereId)
                .populate('charges_horaires.titulaire', 'nom prenom email')
                .populate('charges_horaires.anneeId')
                .select('charges_horaires')
                .lean();
            
            if (!matiere) {
                throw new Error("Matière non trouvée");
            }

            return {
                success: true,
                data: matiere.charges_horaires || [],
                count: matiere.charges_horaires?.length || 0
            };
        } catch (error) {
            console.error("Erreur dans getChargesHoraires:", error);
            throw error;
        }
    }

    // Mettre à jour une matière
    async updateMatiere(id, updateData) {
        try {
            return await Matiere.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw error;
        }
    }

    // Supprimer une matière
    async deleteMatiere(id) {
        try {
            return await Matiere.findByIdAndDelete(id);
        } catch (error) {
            throw error;
        }
    }

    // Lister les matières
    async listMatieres(query = {}) {
        try {
            return await Matiere.find(query);
        } catch (error) {
            throw error;
        }
    }

    // Obtenir une matière par ID
    async getMatiereById(id) {
        try {
            return await Matiere.findById(id);
        } catch (error) {
            throw error;
        }
    }

    // Obtenir une matière par codeUnite
    async getMatiereByCodeUnite(codeUnite) {
        try {
            return await Matiere.find({ codeUnite });
        } catch (error) {
            throw error;
        }
    }

    async getMatieresByIdPromotion(id) {
        try {
            return await Matiere.find({ id });
        } catch (error) {
            throw error;
        }
    }

    async getMatieresByPromotion(promotionId) {
        try {
            // 1. Récupérer la promotion avec ses unités
            const promotion = await Promotion.findById(promotionId)
                .select('unites')
                .lean();

            if (!promotion) {
                throw new Error('Promotion non trouvée');
            }

            // 2. Récupérer toutes les matières liées aux codes unités
            const uniteCodes = promotion.unites.map(u => u.code);
            const matieres = await Matiere.find({
                codeUnite: { $in: uniteCodes }
            })
            .populate([
                {
                    path: 'charges_horaires.titulaire',
                    select: 'nom prenom email'
                },
                {
                    path: 'charges_horaires.anneeId',
                    select: 'designation'
                }
            ])
            .lean();

            // 3. Organiser les matières par unité
            const unitesMatieres = promotion.unites.map(unite => {
                const materiesUnite = matieres.filter(m => m.codeUnite === unite.code);
                
                // Grouper par semestre dans chaque unité
                const materiesBySemestre = materiesUnite.reduce((acc, matiere) => {
                    if (!acc[matiere.semestre]) {
                        acc[matiere.semestre] = [];
                    }
                    acc[matiere.semestre].push(matiere);
                    return acc;
                }, {});

                return {
                    code: unite.code,
                    designation: unite.designation,
                    categorie: unite.categorie,
                    semestres: {
                        Premier: materiesBySemestre["Premier"] || [],
                        Second: materiesBySemestre["Second"] || []
                    },
                    totalCredits: materiesUnite.reduce((sum, m) => sum + m.credit, 0),
                    totalMatieres: materiesUnite.length
                };
            });

            return {
                success: true,
                data: {
                    unites: unitesMatieres,
                    stats: {
                        totalUnites: unitesMatieres.length,
                        totalMatieres: matieres.length,
                        totalCredits: unitesMatieres.reduce((sum, u) => sum + u.totalCredits, 0)
                    }
                }
            };

        } catch (error) {
            console.error('Erreur dans getMatieresByPromotion:', error);
            throw error;
        }
    }
}

module.exports = new MatiereController();