const Appariteur = require('../models/appariteur.model');
const Agent = require('../models/agent.model');
const Etudiant = require('../models/etudiant.model');
const Promotion = require('../models/promotion.model');

class AppariteurController {
    // Créer un nouvel appariteur
    async createAppariteur(appariteurData) {
        try {
            const { agentId, anneeId, sectionId } = appariteurData;
            
            // Vérifier si l'agent existe
            const agentExists = await Agent.exists({ _id: agentId });
            if (!agentExists) {
                throw new Error("Agent non trouvé");
            }
            
            // Vérifier si un appariteur existe déjà pour cet agent/année/section
            const exists = await Appariteur.findOne({ agentId, anneeId, sectionId });
            if (exists) {
                throw new Error("Un appariteur existe déjà pour cet agent dans cette section et année académique");
            }
            
            const appariteur = new Appariteur(appariteurData);
            return await appariteur.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Obtenir tous les appariteurs
    async getAllAppariteurs() {
        try {
            return await Appariteur.find()
                .populate('agentId', 'nom prenom email matricule typeAgent avatar grade')
                .populate('anneeId', 'slogan')
                .populate('sectionId', 'titre')
                .select('-inscriptions.souscriptions -retraits')
                .lean();
        } catch (error) {
            throw error;
        }
    }
    
    // Obtenir un appariteur par ID
    async getAppariteurById(id) {
        try {
            return await Appariteur.findById(id)
                .populate('agentId', 'nom prenom email')
                .populate('anneeId', 'slogan')
                .populate('sectionId', 'titre')
                .populate('inscriptions.promotionId', 'niveau mention orientation');
        } catch (error) {
            throw error;
        }
    }

    // Obtenir les appariteurs par ID d'agent
    async getAppariteursByAgentId(agentId) {
        try {
            return await Appariteur.find({ agentId })
                .populate('agentId', 'nom prenom email')
                .populate('anneeId', 'slogan')
                .populate('sectionId', 'titre')
                .populate('inscriptions.promotionId', 'niveau mention orientation')
                .select('-inscriptions.souscriptions -retraits')
                .lean();
        } catch (error) {
            throw error;
        }
    }
    
    // Créer une nouvelle inscription
    async createInscription(appariteurId, inscriptionData) {
        try {
            const appariteur = await Appariteur.findById(appariteurId);
            if (!appariteur) {
                throw new Error("Appariteur non trouvé");
            }
            
            // Vérifier si la promotion existe
            const promotionExists = await Promotion.exists({ _id: inscriptionData.promotionId });
            if (!promotionExists) {
                throw new Error("Promotion non trouvée");
            }
            
            // Vérifier si une inscription existe déjà pour cette promotion
            const inscriptionExists = appariteur.inscriptions.some(
                insc => insc.promotionId.toString() === inscriptionData.promotionId
            );
            
            if (inscriptionExists) {
                throw new Error("Une inscription existe déjà pour cette promotion");
            }
            
            return await appariteur.addInscription(inscriptionData);
        } catch (error) {
            throw error;
        }
    }
    
    // Ajouter une souscription à une inscription
    async addSouscription(appariteurId, inscriptionId, souscriptionData) {
        try {
            const appariteur = await Appariteur.findById(appariteurId);
            if (!appariteur) {
                throw new Error("Appariteur non trouvé");
            }
            
            // Vérifier si l'étudiant existe
            const etudiantExists = await Etudiant.exists({ _id: souscriptionData.etudiantId });
            if (!etudiantExists) {
                throw new Error("Étudiant non trouvé");
            }
            
            // Vérifier si l'inscription existe
            const inscription = appariteur.inscriptions.id(inscriptionId);
            if (!inscription) {
                throw new Error("Inscription non trouvée");
            }
            
            // Vérifier si l'étudiant a déjà souscrit à cette inscription
            const souscriptionExists = inscription.souscriptions.some(
                s => s.etudiantId.toString() === souscriptionData.etudiantId
            );
            
            if (souscriptionExists) {
                throw new Error("Cet étudiant a déjà souscrit à cette inscription");
            }
            
            return await appariteur.addSouscription(inscriptionId, souscriptionData);
        } catch (error) {
            throw error;
        }
    }
    
    // Mettre à jour le statut d'une souscription
    async updateSouscriptionStatus(appariteurId, inscriptionId, souscriptionId, statut) {
        try {
            const appariteur = await Appariteur.findById(appariteurId);
            if (!appariteur) {
                throw new Error("Appariteur non trouvé");
            }
            
            const inscription = appariteur.inscriptions.id(inscriptionId);
            if (!inscription) {
                throw new Error("Inscription non trouvée");
            }
            
            const souscription = inscription.souscriptions.id(souscriptionId);
            if (!souscription) {
                throw new Error("Souscription non trouvée");
            }
            
            souscription.statut = statut;
            
            // Mettre à jour la balance si le statut est OK
            if (statut === 'OK' && souscription.statut !== 'OK') {
                appariteur.balance += inscription.montant;
            } else if (statut !== 'OK' && souscription.statut === 'OK') {
                appariteur.balance -= inscription.montant;
            }
            
            return await appariteur.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Effectuer un retrait
    async makeRetrait(appariteurId, retraitData) {
        try {
            const appariteur = await Appariteur.findById(appariteurId);
            if (!appariteur) {
                throw new Error("Appariteur non trouvé");
            }
            
            if (retraitData.montant > appariteur.balance) {
                throw new Error("Solde insuffisant pour effectuer ce retrait");
            }
            
            // Réduire la balance
            appariteur.balance -= retraitData.montant;
            appariteur.retraits.push(retraitData);
            
            return await appariteur.save();
        } catch (error) {
            throw error;
        }
    }
    
    // Mettre à jour le statut d'un retrait
    async updateRetraitStatus(appariteurId, retraitId, statut, orderNumber = null) {
        try {
            const appariteur = await Appariteur.findById(appariteurId);
            if (!appariteur) {
                throw new Error("Appariteur non trouvé");
            }
            
            const retrait = appariteur.retraits.id(retraitId);
            if (!retrait) {
                throw new Error("Retrait non trouvé");
            }
            
            // Si le retrait était déjà OK et devient non-OK, réajuster la balance
            if (retrait.statut === 'OK' && statut !== 'OK') {
                appariteur.balance += retrait.montant;
            }
            
            retrait.statut = statut;
            if (orderNumber) {
                retrait.orderNumber = orderNumber;
            }
            
            return await appariteur.save();
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new AppariteurController();