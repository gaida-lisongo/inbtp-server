const express = require('express');
const router = express.Router();
const descripteurController = require('../controllers/descripteur.controller');

// Créer un descripteur
router.post('/', async (req, res) => {
    try {
        const result = await descripteurController.createDescripteur(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un descripteur par ID d'unité
router.get('/:uniteId', async (req, res) => {
    try {
        const descripteur = await descripteurController.getDescripteurByUniteId(req.params.uniteId);
        res.json({
            success: true,
            data: descripteur
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour un descripteur ou le créer s'il n'existe pas
router.put('/:uniteId', async (req, res) => {
    try {
        console.log("Unité ID:", req.params.uniteId);
        console.log("Corps de la requête:", req.body);
        // Vérifier si le descripteur existe
        const existingDescripteur = await descripteurController.getDescripteurByUniteId(req.params.uniteId);
        console.log("Descripteur existant:", existingDescripteur);
        let result;
        
        if (!existingDescripteur) {
            // Si n'existe pas, créer un nouveau descripteur
            result = await descripteurController.createDescripteur({
                ...req.body,
                uniteId: req.params.uniteId
            });
            res.status(201); // Created
        } else {
            // Si existe, mettre à jour
            result = await descripteurController.updateDescripteur(
                req.params.uniteId,
                req.body
            );
            res.status(200); // OK
        }

        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un descripteur
router.delete('/:uniteId', async (req, res) => {
    try {
        const result = await descripteurController.deleteDescripteur(req.params.uniteId);
        res.json(result);
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;