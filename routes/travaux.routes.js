const express = require('express');
const router = express.Router();
const Travaux = require('../models/travaux.model');
const Transaction = require('../models/transaction.model');
const Etudiant = require('../models/etudiant.model');
const Agent = require('../models/agent.model');

router.get('/', async (req, res) => {
    try {
        const { auteurId } = req.query;

        /**
         * Si l'ID de l'auteur est fourni, on filtre les travaux par auteur.
         * Sinon, on récupère tous les travaux.
         */

        const travaux = auteurId
            ? await Travaux.find({ auteurId }).populate('auteurId', 'nom prenom')
            : await Travaux.find().populate('auteurId', 'nom prenom');
        res.status(200).json(travaux);
    } catch (error) {
        console.error('Error fetching travaux:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/commandes/:travailId', async (req, res) => {
    try {
        const { travailId } = req.params;
        
        if (!travailId) {
            return res.status(400).json({ message: 'Travail ID is required' });
        }

        // Find ALL transactions associated with the travailId, not just one
        const transactions = await Transaction.find({ 'commandes.product': travailId })
            .populate('commandes.product', 'titre description montant type');

        if (!transactions || transactions.length === 0) {
            return res.status(404).json({ message: 'No commandes found for this travail' });
        }
            
        // Collect all relevant commandes from all transactions
        let allFilteredCommandes = [];
        transactions.forEach(transaction => {
            const filtered = transaction.commandes.filter(
                commande => commande.product && commande.product.toString() === travailId
            );
            allFilteredCommandes = [...allFilteredCommandes, ...filtered];
        });

        // Utiliser Promise.all pour attendre toutes les requêtes asynchrones
        const commandesWithEtudiant = await Promise.all(
            allFilteredCommandes.map(async (commande) => {
                // Sécuriser le parsing de ref en vérifiant sa présence
                let etudiantId;
                if (commande.ref) {
                    const parts = commande.ref.split('-');
                    etudiantId = parts.length >= 4 ? parts[3] : null;
                }
                
                // Trouver l'étudiant si on a un ID valide
                let etudiant = null;
                if (etudiantId) {
                    try {
                        etudiant = await Etudiant.findById(etudiantId)
                            .select('infoSec.etudiantId infoSec.telephone infoSec.email infoPerso.nom infoPerso.postNom infoPerso.preNom infoPerso.profile');
                    } catch (err) {
                        console.error(`Erreur lors de la récupération de l'étudiant ${etudiantId}:`, err);
                    }
                }
                
                // Retourner la commande enrichie avec les données de l'étudiant
                return {
                    ...commande.toObject(), // Convertir en objet simple pour éviter les problèmes de sérialisation
                    etudiant: etudiant
                };
            })
        );
        
        // Retourner les données finalisées
        res.status(200).json({
            success: true,
            count: commandesWithEtudiant.length,
            data: commandesWithEtudiant
        });
    } catch (error) {
        console.error('Error fetching commandes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;