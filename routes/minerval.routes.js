const express = require('express');
const router = express.Router();
const minervalController = require('../controllers/minerval.controller');
const cache = require('../utils/cache');

// Récupérer tous les minervals
router.get('/', async (req, res) => {
    try {
        const cacheKey = req.query.promotionId || req.query.anneeId ? 
            `minervals:${JSON.stringify(req.query)}` : 'minervals:all';
            
        const cached = await cache.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        
        const minervals = await minervalController.getAllMinervals(req.query);
        
        await cache.set(cacheKey, minervals, 3600);
        
        res.json({
            success: true,
            count: minervals.length,
            data: minervals
        });
    } catch (error) {
        console.error('Error fetching minervals:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Créer un nouveau minerval
router.post('/', async (req, res) => {
    try {
        const minerval = await minervalController.createMinerval(req.body);
        
        // Invalider le cache
        await cache.delete('minervals:all');
        
        res.status(201).json({
            success: true,
            message: "Minerval créé avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error creating minerval:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer un minerval par ID
router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `minerval:${req.params.id}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        
        const minerval = await minervalController.getMinervalById(req.params.id);
        
        if (!minerval) {
            return res.status(404).json({
                success: false,
                error: "Minerval non trouvé"
            });
        }
        
        await cache.set(cacheKey, minerval, 3600);
        
        res.json({
            success: true,
            data: minerval
        });
    } catch (error) {
        console.error('Error fetching minerval:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer les minervals d'une promotion
router.get('/promotion/:id', async (req, res) => {
    try {

        const minervals = await minervalController.getMinervalByPromotionId(req.params.id);

        if (!minervals || minervals.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Aucun minerval trouvé pour cette promotion"
            });
        }

        res.json({
            success: true,
            count: minervals.length,
            data: minervals
        });
    } catch (error) {
        console.error('Error fetching minervals by promotion ID:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer les minervals d'une année
router.get('/annee/:id', async (req, res) => {
    try {
        const cacheKey = `minervals:annee:${req.params.id}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const minervals = await minervalController.getMinervalByAnneeId(req.params.id);

        if (!minervals || minervals.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Aucun minerval trouvé pour cette année"
            });
        }

        await cache.set(cacheKey, minervals, 3600);

        res.json({
            success: true,
            count: minervals.length,
            data: minervals
        });
    } catch (error) {
        console.error('Error fetching minervals by year ID:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer les minervals d'un étudiant
router.get('/etudiant/:id', async (req, res) => {
    try {
        const cacheKey = `minervals:etudiant:${req.params.id}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const minervals = await minervalController.getMinervalByEtudiantId(req.params.id);

        if (!minervals || minervals.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Aucun minerval trouvé pour cet étudiant"
            });
        }

        await cache.set(cacheKey, minervals, 3600);

        res.json({
            success: true,
            count: minervals.length,
            data: minervals
        });
    } catch (error) {
        console.error('Error fetching minervals by student ID:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter une tranche à un minerval
router.post('/:id/tranches', async (req, res) => {
    try {
        const minerval = await minervalController.ajouterTranche(
            req.params.id,
            req.body
        );
        
        // Invalider le cache
        await cache.delete(`minerval:${req.params.id}`);
        
        res.status(201).json({
            success: true,
            message: "Tranche ajoutée avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error adding tranche:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une tranche d'un minerval
router.delete('/:id/tranches/:trancheId', async (req, res) => {
    try {
        const minerval = await minervalController.supprimerTranche(
            req.params.id,
            req.params.trancheId
        );

        if (!minerval) {
            return res.status(404).json({
                success: false,
                error: "Tranche non trouvée"
            });
        }

        // Invalider le cache
        await cache.delete(`minerval:${req.params.id}`);

        res.json({
            success: true,
            message: "Tranche supprimée avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error deleting tranche:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier une tranche d'un minerval
router.put('/:id/tranches/:trancheId', async (req, res) => {
    try {
        const minerval = await minervalController.modifierTranche(
            req.params.id,
            req.params.trancheId,
            req.body
        );
        
        // Invalider le cache
        await cache.delete(`minerval:${req.params.id}`);
        
        res.json({
            success: true,
            message: "Tranche modifiée avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error updating tranche:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter un paiement
router.post('/:id/paiements', async (req, res) => {
    try {
        const minerval = await minervalController.ajouterPaiement(
            req.params.id,
            req.body
        );
        
        // Invalider les caches associés
        await cache.delete(`minerval:${req.params.id}`);
        if (req.body.etudiantId) {
            await cache.delete(`minerval:${req.params.id}:etudiant:${req.body.etudiantId}`);
        }
        
        res.status(201).json({
            success: true,
            message: "Paiement enregistré avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer les paiements d'un étudiant
router.get('/:id/etudiants/:etudiantId', async (req, res) => {
    try {
        const cacheKey = `minerval:${req.params.id}:etudiant:${req.params.etudiantId}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        
        const paiements = await minervalController.getPaiementsEtudiant(
            req.params.id,
            req.params.etudiantId
        );
        
        await cache.set(cacheKey, paiements, 3600);
        
        res.json({
            success: true,
            data: paiements
        });
    } catch (error) {
        console.error('Error fetching student payments:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour le statut d'un paiement
router.patch('/:id/paiements/:paiementId', async (req, res) => {
    try {
        const { statut } = req.body;
        
        if (!['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'].includes(statut)) {
            return res.status(400).json({
                success: false,
                error: "Statut invalide. Valeurs autorisées: 'PENDING', 'COMPLETED', 'FAILED', 'CANCELED'"
            });
        }
        
        const minerval = await minervalController.updatePaiementStatus(
            req.params.id,
            req.params.paiementId,
            statut
        );
        
        // Invalider le cache
        await cache.delete(`minerval:${req.params.id}`);
        
        res.json({
            success: true,
            message: "Statut du paiement mis à jour avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Générer un rapport sur les minervals
router.get('/rapport/promotion/:promotionId/annee/:anneeId', async (req, res) => {
    try {
        const cacheKey = `minerval:rapport:${req.params.promotionId}:${req.params.anneeId}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        
        const rapport = await minervalController.genererRapport(
            req.params.promotionId,
            req.params.anneeId
        );
        
        await cache.set(cacheKey, rapport, 1800); // Cache pour 30 minutes
        
        res.json({
            success: true,
            data: rapport
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier un minerval
router.put('/:id', async (req, res) => {
    try {
        const minerval = await minervalController.updateMinerval(
            req.params.id,
            req.body
        );
        
        // Invalider le cache
        await cache.delete(`minerval:${req.params.id}`);
        
        res.json({
            success: true,
            message: "Minerval modifié avec succès",
            data: minerval
        });
    } catch (error) {
        console.error('Error updating minerval:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});


module.exports = router;