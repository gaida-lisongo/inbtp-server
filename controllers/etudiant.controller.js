const Etudiant = require('../models/etudiant.model');
const Transaction = require('../models/transaction.model'); // Add this import too
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cache = require('../utils/cache');

class EtudiantController {
    // Créer un étudiant
    async createEtudiant(etudiantData) {
        try {
            const nouvelEtudiant = new Etudiant(etudiantData);
            return await nouvelEtudiant.save();
        } catch (error) {
            throw error;
        }
    }

    // Importer des étudiants depuis CSV
    async importEtudiants(fileName) {
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
                        const etudiant = {
                            infoPerso: {
                                nom: data.nom,
                                postNom: data.postNom,
                                preNom: data.preNom,
                                sexe: data.sexe,
                                dateNaissance: this._parseFrenchDate(data.dateNaissance),
                                lieuNaissance: data.lieuNaissance,
                                adresse: data.adresse
                            },
                            infoSec: {
                                etudiantId: data.etudiantId,
                                email: data.email,
                                telephone: data.telephone,
                                optId: data.optId
                            },
                            infoScol: {
                                section: data.section,
                                option: data.option,
                                pourcentage: parseFloat(data.pourcentage)
                            },
                            infoAcad: [{
                                promotionId: data.promotionId,
                                anneeId: data.anneeId,
                                actifs: {}
                            }]
                        };
                        results.push(etudiant);
                    })
                    .on('end', async () => {
                        try {
                            const etudiants = await Promise.all(
                                results.map(data => this.createEtudiant(data))
                            );
                            resolve({
                                success: true,
                                count: etudiants.length,
                                data: etudiants
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

    // Mettre à jour un étudiant
    async updateEtudiant(id, updateData) {
        try {
            // Conversion de la date si présente
            // if (updateData.infoPerso?.dateNaissance) {
            //     updateData.infoPerso.dateNaissance = this._parseFrenchDate(
            //         updateData.infoPerso.dateNaissance
            //     );
            // }
            const result = await Etudiant.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );
            console.log("Updating student with ID:", result);
            return result;
        } catch (error) {
            throw error;
        }
    }

    // Supprimer un étudiant
    async deleteEtudiant(id) {
        try {
            return await Etudiant.findByIdAndDelete(id);
        } catch (error) {
            throw error;
        }
    }

    // Lister tous les étudiants avec filtres optionnels
    async listEtudiants(query = {}) {
        try {
            let filter = {};
            
            // Filtres sur les infos personnelles
            if (query.nom) {
                filter['infoPerso.nom'] = new RegExp(query.nom, 'i');
            }
            if (query.postnom) {
                filter['infoPerso.postNom'] = new RegExp(query.postnom, 'i');
            }
            if (query.prenom) {
                filter['infoPerso.preNom'] = new RegExp(query.prenom, 'i');
            }
            if (query.sexe) {
                filter['infoPerso.sexe'] = query.sexe;
            }

            // Filtres sur les infos scolaires
            if (query.section) {
                filter['infoScol.section'] = query.section;
            }
            if (query.option) {
                filter['infoScol.option'] = query.option;
            }

            // Filtres sur l'année académique
            if (query.anneeId) {
                filter['infoAcad.anneeId'] = query.anneeId;
            }
            if (query.promotionId) {
                filter['infoAcad.promotionId'] = query.promotionId;
            }

            if (query.matricule) {
                filter['infoSec.etudiantId'] = query.matricule;
            }

            if (query.opt) {
                filter['infoAcad.opt'] = query.opt;
            }

            if (query.email) {
                filter['infoSec.email'] = new RegExp(query.email, 'i');
            }

            if (query.telephone) {
                filter['infoSec.telephone'] = new RegExp(query.telephone, 'i');
            }

            console.log("Filter for listing students:", filter);
            return await Etudiant.find(filter)
                .populate('infoAcad.promotionId')
                .populate('infoAcad.anneeId');
                
        } catch (error) {
            throw error;
        }
    }

    // Obtenir un étudiant par ID
    async getEtudiantById(id) {
        try {
            return await Etudiant.findById(id)
                .populate('infoAcad.promotionId')
                .populate('infoAcad.anneeId')
                .populate('infoAcad.actifs.travaux')
                .populate('infoAcad.actifs.enrollments')
                .populate('infoAcad.actifs.bulletins');
        } catch (error) {
            throw error;
        }
    }

    // Helper pour parser les dates françaises
    _parseFrenchDate(dateStr) {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    }

    /**
     * Récupérer les commandes par promotion et produit
     */
    async getCommandesByProduit(promotionId, product) {
        try {
            // Utiliser le cache si disponible
            const cacheKey = `commandes:produit:${promotionId}:${product || 'all'}`;
            const cachedData = await cache.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }

            const commandes = await Transaction.aggregate([
                { $unwind: '$commandes' },
                {
                    $addFields: {
                        'refParts': {
                            $split: ['$commandes.ref', '=']
                        }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $eq: [{ $arrayElemAt: ['$refParts', 0] }, promotionId]
                        },
                        ...(product ? { 'commandes.product': product } : {})
                    }
                },
                {
                    $lookup: {
                        from: 'etudiants',
                        localField: 'etudiantId',
                        foreignField: '_id',
                        as: 'etudiant'
                    }
                },
                { $unwind: '$etudiant' },
                {
                    $project: {
                        _id: 1,
                        etudiant: {
                            nom: '$etudiant.infoPerso.nom',
                            postnom: '$etudiant.infoPerso.postNom',
                            prenom: '$etudiant.infoPerso.preNom',
                            matricule: '$etudiant.infoSec.etudiantId'
                        },
                        commande: {
                            product: '$commandes.product',
                            montant: '$commandes.montant',
                            date_created: '$commandes.date_created',
                            ref: '$commandes.ref'
                        }
                    }
                },
                { $sort: { 'commande.date_created': -1 } }
            ]);

            // Mettre en cache pour 5 minutes
            await cache.set(cacheKey, commandes, 300);

            return commandes;
        } catch (error) {
            console.error('Erreur dans getCommandesByProduit:', error);
            throw error;
        }
    }
}

module.exports = new EtudiantController();