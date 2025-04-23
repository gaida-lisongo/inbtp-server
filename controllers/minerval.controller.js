const Minerval = require('../models/minerval.model');
const Promotion = require('../models/promotion.model');
const Annee = require('../models/annee.model');
const Etudiant = require('../models/etudiant.model');
const mongoose = require('mongoose');

class MinervalController {
    // Créer un nouveau minerval
    async createMinerval(minervalData) {
        try {
            const { promotionId, anneeId, montant } = minervalData;
            
            // Vérification des données requises
            if (!promotionId || !anneeId || !montant) {
                throw new Error("Promotion, année académique et montant sont requis");
            }
            
            // Vérifier si la promotion existe
            const promotionExists = await Promotion.exists({ _id: promotionId });
            if (!promotionExists) {
                throw new Error("Promotion non trouvée");
            }
            
            // Vérifier si l'année existe
            const anneeExists = await Annee.exists({ _id: anneeId });
            if (!anneeExists) {
                throw new Error("Année académique non trouvée");
            }
            
            // Vérifier si un minerval existe déjà pour cette promotion/année
            const exists = await Minerval.exists({ promotionId, anneeId });
            if (exists) {
                throw new Error("Un minerval existe déjà pour cette promotion et année académique");
            }
            
            // Créer le minerval
            const nouveauMinerval = new Minerval(minervalData);
            return await nouveauMinerval.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Récupérer tous les minervals
    async getAllMinervals(query = {}) {
        try {
            let filtres = {};
            
            // Appliquer des filtres optionnels
            if (query.promotionId) {
                filtres.promotionId = query.promotionId;
            }
            
            if (query.anneeId) {
                filtres.anneeId = query.anneeId;
            }
            
            // Récupérer les minervals avec leurs relations
            const minervals = await Minerval.find(filtres)
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'designation')
                .select('-paiements') // Exclure les paiements pour alléger la réponse
                .lean();
                
            return minervals;
        } catch (error) {
            throw error;
        }
    }
    
    // Récupérer un minerval par ID
    async getMinervalById(id) {
        try {
            const minerval = await Minerval.findById(id)
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'designation');
                
            return minerval;
        } catch (error) {
            throw error;
        }
    }

    // Recuperer les minvarels d'une promotion
    async getMinervalByPromotionId(promotionId) {
        try {
            const minerval = await Minerval.find({ promotionId })
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'slogan')
                .lean();

            if (!minerval) {
                throw new Error("Minerval non trouvé pour cette promotion");
            }

            return minerval;
        } catch (error) {
            throw error;
        }
    }

    // Récupérer les minervals d'une année académique
    async getMinervalByAnneeId(anneeId) {
        try {
            const minerval = await Minerval.find({ anneeId })
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'slogan')
                .lean();

            if (!minerval) {
                throw new Error("Minerval non trouvé pour cette année académique");
            }

            return minerval;
        } catch (error) {
            throw error;
        }
    }

    // Récupérer les minervals d'un étudiant
    async getMinervalByEtudiantId(etudiantId) {
        try {
            const minerval = await Minerval.find({ 'paiements.etudiantId': etudiantId })
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'slogan')
                .lean();

            if (!minerval) {
                throw new Error("Minerval non trouvé pour cet étudiant");
            }

            return minerval;
        } catch (error) {
            throw error;
        }
    }
    
    // Ajouter une tranche à un minerval
    async ajouterTranche(minervalId, trancheData) {
        try {
            const minerval = await Minerval.findById(minervalId);
            if (!minerval) {
                throw new Error("Minerval non trouvé");
            }
            
            // Vérifier que la somme des tranches ne dépasse pas le montant total
            const totalTranches = minerval.tranches.reduce(
                (sum, tranche) => sum + tranche.montant, 0
            ) + trancheData.montant;
            
            if (totalTranches > minerval.montant) {
                throw new Error("La somme des tranches ne peut pas dépasser le montant total du minerval");
            }
            
            // Ajouter la tranche
            minerval.tranches.push(trancheData);
            return await minerval.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Supprimer une tranche d'un minerval
    async supprimerTranche(minervalId, trancheId) {
        try {
            // Utiliser l'opérateur $pull pour retirer la tranche du tableau
            const result = await Minerval.findByIdAndUpdate(
                minervalId,
                { $pull: { tranches: { _id: trancheId } } },
                { new: true }
            );
            
            if (!result) {
                throw new Error("Minerval non trouvé");
            }
            
            return result;
        } catch (error) {
            throw error;
        }
    }

    // Modifier une tranche d'un minerval
    async modifierTranche(minervalId, trancheId, trancheData) {
        try {
            const minerval = await Minerval.findById(minervalId);
            if (!minerval) {
                throw new Error("Minerval non trouvé");
            }

            // Vérifier que la tranche existe
            const tranche = minerval.tranches.id(trancheId);
            if (!tranche) {
                throw new Error("Tranche non trouvée");
            }

            // Vérifier que la somme des tranches ne dépasse pas le montant total
            const totalTranches = minerval.tranches.reduce(
                (sum, t) => sum + t.montant, 0
            ) - tranche.montant + trancheData.montant; // Soustraire l'ancien montant de la tranche


            if (totalTranches > minerval.montant) {
                throw new Error("La somme des tranches ne peut pas dépasser le montant total du minerval");
            }

            // Mettre à jour la tranche
            tranche.montant = trancheData.montant || tranche.montant;

            tranche.dateLimite = trancheData.dateLimite || tranche.dateLimite;

            tranche.date_created = new Date(); // Mettre à jour la date de création

            tranche.designation = trancheData.designation || tranche.designation;

            // Enregistrer les modifications
            return await minerval.save();
        } catch (error) {
            throw error;
        }
    }

    // Ajouter un paiement
    async ajouterPaiement(minervalId, paiementData) {
        try {
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                const { etudiantId, montant, trancheId } = paiementData;
                
                // Vérifier que le minerval existe
                const minerval = await Minerval.findById(minervalId).session(session);
                if (!minerval) {
                    throw new Error("Minerval non trouvé");
                }
                
                // Vérifier que l'étudiant existe
                const etudiant = await Etudiant.findById(etudiantId).session(session);
                if (!etudiant) {
                    throw new Error("Étudiant non trouvé");
                }
                
                // Vérifier si l'étudiant est inscrit dans cette promotion/année
                const estInscrit = etudiant.infoAcad.some(
                    info => info.promotionId.equals(minerval.promotionId) && 
                           info.anneeId.equals(minerval.anneeId)
                );
                
                if (!estInscrit) {
                    throw new Error("Cet étudiant n'est pas inscrit dans cette promotion pour l'année académique spécifiée");
                }
                
                // Si une tranche est spécifiée, vérifier qu'elle existe
                if (trancheId) {
                    const trancheExiste = minerval.tranches.some(
                        t => t._id.toString() === trancheId
                    );
                    
                    if (!trancheExiste) {
                        throw new Error("La tranche spécifiée n'existe pas");
                    }
                }
                
                // Vérifier que le montant ne dépasse pas le reste à payer
                const totalDejaPayé = minerval.getTotalPayeEtudiant(etudiantId);
                if (totalDejaPayé + montant > minerval.montant) {
                    throw new Error("Le montant dépasse le reste à payer");
                }
                
                // Ajouter le paiement
                minerval.ajouterPaiement({
                    ...paiementData,
                    date_created: new Date(),
                    reference: `PAY-${Date.now()}-${etudiantId.toString().substring(0, 6)}`
                });
                
                const result = await minerval.save({ session });
                
                await session.commitTransaction();
                return result;
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        } catch (error) {
            throw error;
        }
    }
    
    // Récupérer les paiements d'un étudiant
    async getPaiementsEtudiant(minervalId, etudiantId) {
        try {
            const minerval = await Minerval.findById(minervalId)
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'designation')
                .lean();
                
            if (!minerval) {
                throw new Error("Minerval non trouvé");
            }
            
            // Filtrer les paiements de l'étudiant
            const paiements = minerval.paiements.filter(
                p => p.etudiantId.toString() === etudiantId
            );
            
            // Calculer les totaux
            const totalPaye = paiements
                .filter(p => p.statut === 'COMPLETED')
                .reduce((sum, p) => sum + p.montant, 0);
                
            const resteAPayer = Math.max(0, minerval.montant - totalPaye);
            
            return {
                etudiantId,
                minerval: {
                    _id: minerval._id,
                    montant: minerval.montant,
                    promotion: minerval.promotionId,
                    annee: minerval.anneeId
                },
                paiements,
                statistiques: {
                    totalPaye,
                    resteAPayer,
                    pourcentagePaye: minerval.montant > 0 ? Math.round((totalPaye / minerval.montant) * 100) : 0
                }
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Mettre à jour le statut d'un paiement
    async updatePaiementStatus(minervalId, paiementId, statut) {
        try {
            const minerval = await Minerval.findOne({
                _id: minervalId,
                'paiements._id': paiementId
            });
            
            if (!minerval) {
                throw new Error("Minerval ou paiement non trouvé");
            }
            
            // Trouver le paiement et mettre à jour son statut
            const paiement = minerval.paiements.id(paiementId);
            if (!paiement) {
                throw new Error("Paiement non trouvé");
            }
            
            paiement.statut = statut;
            
            return await minerval.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Générer un rapport sur les minervals
    async genererRapport(promotionId, anneeId) {
        try {
            const minerval = await Minerval.findOne({ promotionId, anneeId })
                .populate('promotionId', 'niveau mention orientation')
                .populate('anneeId', 'designation')
                .lean();
                
            if (!minerval) {
                throw new Error("Minerval non trouvé");
            }
            
            // Récupérer tous les étudiants de cette promotion/année
            const etudiants = await Etudiant.find({
                'infoAcad': {
                    $elemMatch: {
                        promotionId,
                        anneeId
                    }
                }
            })
            .select('infoPerso.nom infoPerso.postNom infoPerso.preNom infoSec.etudiantId')
            .lean();
            
            // Préparer les statistiques par étudiant
            const statistiquesEtudiants = etudiants.map(etudiant => {
                const paiementsEtudiant = minerval.paiements.filter(
                    p => p.etudiantId.toString() === etudiant._id.toString() && 
                         p.statut === 'COMPLETED'
                );
                
                const totalPaye = paiementsEtudiant.reduce((sum, p) => sum + p.montant, 0);
                const resteAPayer = Math.max(0, minerval.montant - totalPaye);
                
                return {
                    etudiant: {
                        _id: etudiant._id,
                        nom: etudiant.infoPerso.nom,
                        postNom: etudiant.infoPerso.postNom,
                        preNom: etudiant.infoPerso.preNom,
                        matricule: etudiant.infoSec.etudiantId
                    },
                    totalPaye,
                    resteAPayer,
                    pourcentagePaye: minerval.montant > 0 ? Math.round((totalPaye / minerval.montant) * 100) : 0,
                    statut: resteAPayer === 0 ? 'COMPLET' : 'PARTIEL'
                };
            });
            
            // Statistiques globales
            const totalPercu = minerval.paiements
                .filter(p => p.statut === 'COMPLETED')
                .reduce((sum, p) => sum + p.montant, 0);
                
            const totalAttendu = minerval.montant * etudiants.length;
            
            return {
                minerval: {
                    _id: minerval._id,
                    promotion: minerval.promotionId,
                    annee: minerval.anneeId,
                    montant: minerval.montant
                },
                statistiques: {
                    totalEtudiants: etudiants.length,
                    etudiantsAJour: statistiquesEtudiants.filter(s => s.statut === 'COMPLET').length,
                    etudiantsPartiels: statistiquesEtudiants.filter(s => s.statut === 'PARTIEL').length,
                    totalPercu,
                    totalAttendu,
                    pourcentagePerception: totalAttendu > 0 ? Math.round((totalPercu / totalAttendu) * 100) : 0
                },
                details: statistiquesEtudiants
            };
        } catch (error) {
            throw error;
        }
    }

    // Mettre à jour un minerval
    async updateMinerval(id, updateData) {
        try {
            const minerval = await Minerval.findById(id);
            if (!minerval) {
                throw new Error("Minerval non trouvé");
            }

            // Vérifier que le montant total n'est pas modifié à moins que ce soit la première fois
            if (updateData.montant && minerval.paiements.length > 0) {
                throw new Error("Impossible de modifier le montant total après la création des paiements");
            }

            // Mettre à jour le minerval devise, montant, promotionId, anneeId
            minerval.devise = updateData.devise || minerval.devise;
            minerval.montant = updateData.montant || minerval.montant;
            minerval.promotionId = updateData.promotionId || minerval.promotionId;
            minerval.anneeId = updateData.anneeId || minerval.anneeId;

            // Mettre à jour les tranches si présentes
            if (updateData.tranches && Array.isArray(updateData.tranches)) {
                minerval.tranches = updateData.tranches.map(tranche => ({
                    ...tranche,
                    date_created: new Date()
                }));
            }

            // Enregistrer les modifications
            return await minerval.save();
        

        } catch (error) {
            throw error;
        }
    }
}

module.exports = new MinervalController();