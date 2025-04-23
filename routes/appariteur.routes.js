const express = require('express');
const router = express.Router();
const appariteurController = require('../controllers/appariteur.controller');
const cache = require('../utils/cache');

// Obtenir tous les appariteurs
router.get('/', async (req, res) => {
    try {
        // const cacheKey = 'appariteurs:all';
        // const cached = await cache.get(cacheKey);
        
        // if (cached) {
        //     return res.json({
        //         success: true,
        //         data: cached,
        //         fromCache: true
        //     });
        // }
        
        const appariteurs = await appariteurController.getAllAppariteurs();
        
        // await cache.set(cacheKey, appariteurs, 3600);
        
        res.json({
            success: true,
            count: appariteurs.length,
            data: appariteurs
        });
    } catch (error) {
        console.error('Error fetching appariteurs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Créer un appariteur
router.post('/', async (req, res) => {
    try {
        const appariteur = await appariteurController.createAppariteur(req.body);
        
        await cache.delete('appariteurs:all');
        
        res.status(201).json({
            success: true,
            message: "Appariteur créé avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error creating appariteur:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un appariteur par ID
router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `appariteur:${req.params.id}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        
        const appariteur = await appariteurController.getAppariteurById(req.params.id);
        
        if (!appariteur) {
            return res.status(404).json({
                success: false,
                error: "Appariteur non trouvé"
            });
        }
        
        await cache.set(cacheKey, appariteur, 3600);
        
        res.json({
            success: true,
            data: appariteur
        });
    } catch (error) {
        console.error('Error fetching appariteur:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir les apparitorats d'un agent
router.get('/agent/:id', async (req, res) => {
    try {
        const appariteurs = await appariteurController.getAppariteursByAgentId(req.params.id);

        if (!appariteurs) {
            return res.status(404).json({
                success: false,
                error: "Aucun appariteur trouvé pour cet agent"
            });
        }

        res.json({
            success: true,
            count: appariteurs.length,
            data: appariteurs
        });
    } catch (error) {
        console.error('Error fetching appariteurs by agent ID:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Créer une inscription
router.post('/:id/inscriptions', async (req, res) => {
    try {
        const appariteur = await appariteurController.createInscription(
            req.params.id,
            req.body
        );
        
        await cache.delete(`appariteur:${req.params.id}`);
        
        res.status(201).json({
            success: true,
            message: "Inscription créée avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error creating inscription:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter une souscription
router.post('/:id/inscriptions/:inscriptionId/souscriptions', async (req, res) => {
    try {
        const appariteur = await appariteurController.addSouscription(
            req.params.id,
            req.params.inscriptionId,
            req.body
        );
        
        await cache.delete(`appariteur:${req.params.id}`);
        
        res.status(201).json({
            success: true,
            message: "Souscription ajoutée avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error adding souscription:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour le statut d'une souscription
router.patch('/:id/inscriptions/:inscriptionId/souscriptions/:souscriptionId', async (req, res) => {
    try {
        const { statut } = req.body;
        
        if (!['En attente', 'OK', 'NO'].includes(statut)) {
            return res.status(400).json({
                success: false,
                error: "Statut invalide. Valeurs autorisées: 'En attente', 'OK', 'NO'"
            });
        }
        
        const appariteur = await appariteurController.updateSouscriptionStatus(
            req.params.id,
            req.params.inscriptionId,
            req.params.souscriptionId,
            statut
        );
        
        await cache.delete(`appariteur:${req.params.id}`);
        
        res.json({
            success: true,
            message: "Statut de la souscription mis à jour avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error updating souscription status:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Effectuer un retrait
router.post('/:id/retraits', async (req, res) => {
    try {
        const appariteur = await appariteurController.makeRetrait(
            req.params.id,
            req.body
        );
        
        await cache.delete(`appariteur:${req.params.id}`);
        
        res.status(201).json({
            success: true,
            message: "Retrait effectué avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error making retrait:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour le statut d'un retrait
router.patch('/:id/retraits/:retraitId', async (req, res) => {
    try {
        const { statut, orderNumber } = req.body;
        
        if (!['En attente', 'OK', 'NO'].includes(statut)) {
            return res.status(400).json({
                success: false,
                error: "Statut invalide. Valeurs autorisées: 'En attente', 'OK', 'NO'"
            });
        }
        
        const appariteur = await appariteurController.updateRetraitStatus(
            req.params.id,
            req.params.retraitId,
            statut,
            orderNumber
        );
        
        await cache.delete(`appariteur:${req.params.id}`);
        
        res.json({
            success: true,
            message: "Statut du retrait mis à jour avec succès",
            data: appariteur
        });
    } catch (error) {
        console.error('Error updating retrait status:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;