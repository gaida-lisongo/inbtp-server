const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion.controller');

// Créer une promotion
router.post('/', async (req, res) => {
    try {
        const promotion = await promotionController.createPromotion(req.body);
        res.status(201).json({
            success: true,
            message: "Promotion créée avec succès",
            data: promotion
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister toutes les promotions
router.get('/', async (req, res) => {
    try {
        const promotions = await promotionController.listPromotions();
        res.json({
            success: true,
            count: promotions.length,
            data: promotions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir une promotion par ID
router.get('/:id', async (req, res) => {
    try {
        const promotion = await promotionController.getPromotionById(req.params.id);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                error: "Promotion non trouvée"
            });
        }
        res.json({
            success: true,
            data: promotion
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Obtenir une promotion par ID de section
router.get('/section/:sectionId', async (req, res) => {
    try {
        const promotions = await promotionController.getPromotionBySectionId(req.params.sectionId);
        if (!promotions || promotions.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Aucune promotion trouvée pour cette section"
            });
        }
        res.json({
            success: true,
            count: promotions.length,
            data: promotions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Mettre à jour une promotion
router.put('/:id', async (req, res) => {
    try {
        const promotion = await promotionController.updatePromotion(
            req.params.id,
            req.body
        );
        if (!promotion) {
            return res.status(404).json({
                success: false,
                error: "Promotion non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Promotion modifiée avec succès",
            data: promotion
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une promotion
router.delete('/:id', async (req, res) => {
    try {
        const promotion = await promotionController.deletePromotion(req.params.id);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                error: "Promotion non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Promotion supprimée avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter une unité
router.post('/:id/unites', async (req, res) => {
    try {
        const promotion = await promotionController.addUnite(req.params.id, req.body);
        res.status(201).json({
            success: true,
            message: "Unité ajoutée avec succès",
            data: promotion
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister les unités d'une promotion
router.get('/:id/unites', async (req, res) => {
    try {
        const unites = await promotionController.listUnites(req.params.id);
        res.json({
            success: true,
            count: unites.length,
            data: unites
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier une unité
router.put('/:id/unites/:uniteId', async (req, res) => {
    try {
        console.log("data", req.body);
        const promotion = await promotionController.updateUnite(
            req.params.id,
            req.params.uniteId,
            req.body
        );
        res.json({
            success: true,
            message: "Unité modifiée avec succès",
            data: promotion
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une unité
router.delete('/:id/unites/:uniteId', async (req, res) => {
    try {
        const promotion = await promotionController.removeUnite(
            req.params.id,
            req.params.uniteId
        );
        res.json({
            success: true,
            message: "Unité supprimée avec succès",
            data: promotion
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des unités depuis un CSV
router.post('/:id/unites/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await promotionController.importUnites(req.params.id, fileName);
        res.status(201).json({
            success: true,
            message: `${result.count} unités importées avec succès`,
            data: result.data
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});



module.exports = router;