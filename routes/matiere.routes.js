const express = require('express');
const router = express.Router();
const Matiere = require('../models/matiere.model');
const Travail = require('../models/travaux.model');
const Note = require('../models/note.model');
const cache = require('../utils/cache');
const matiereController = require('../controllers/matiere.controller');

// Créer une matière
router.post('/', async (req, res) => {
    try {
        const matiere = await matiereController.createMatiere(req.body);
        res.status(201).json({
            success: true,
            message: "Matière créée avec succès",
            data: matiere
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des matières depuis CSV
router.post('/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await matiereController.importMatieres(fileName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter une charge horaire
router.post('/:id/charges', async (req, res) => {
    try {
        const matiere = await matiereController.addChargeHoraire(
            req.params.id, 
            req.body
        );
        res.status(201).json({
            success: true,
            message: "Charge horaire ajoutée avec succès",
            data: matiere
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour une charge horaire
router.put('/:id/charges/:chargeId', async (req, res) => {
    try {
        const matiere = await matiereController.updateChargeHoraire(
            req.params.id,
            req.params.chargeId,
            req.body
        );
        res.json({
            success: true,
            message: "Charge horaire modifiée avec succès",
            data: matiere
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une charge horaire
router.delete('/:id/charges/:chargeId', async (req, res) => {
    try {
        const matiere = await matiereController.deleteChargeHoraire(
            req.params.id,
            req.params.chargeId
        );
        res.json({
            success: true,
            message: "Charge horaire supprimée avec succès",
            data: matiere
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir les charges horaires d'une matière
router.get('/:id/charges', async (req, res) => {
    try {
        const charges = await matiereController.getChargesHoraires(req.params.id);
        res.json({
            success: true,
            count: charges.length,
            data: charges
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lister toutes les matières
router.get('/', async (req, res) => {
    try {
        const matieres = await matiereController.listMatieres();
        res.json({
            success: true,
            count: matieres.length,
            data: matieres
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir une matière par ID d'unité
router.get('/unite/:uniteId', async (req, res) => {
    try {
        const matiere = await matiereController.getMatiereByCodeUnite(req.params.uniteId);
        console.log("Matière trouvée:", matiere);
        res.json({
            success: true,
            data: matiere
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});
// Obtenir une matière par ID
router.get('/:id', async (req, res) => {
    try {
        const matiere = await matiereController.getMatiereById(req.params.id);
        if (!matiere) {
            return res.status(404).json({
                success: false,
                error: "Matière non trouvée"
            });
        }
        res.json({
            success: true,
            data: matiere
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir matiere par id promotion
router.get('/promotion/:id', async (req, res) => {
    try {
        const matiere = await matiereController.getMatieresByPromotion(req.params.id);
        if (!matiere) {
            return res.status(404).json({
                success: false,
                error: "Matière non trouvée"
            });
        }
        res.json({
            success: true,
            data: matiere
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour une matière
router.put('/:id', async (req, res) => {
    try {
        const matiere = await matiereController.updateMatiere(req.params.id, req.body);
        if (!matiere) {
            return res.status(404).json({
                success: false,
                error: "Matière non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Matière modifiée avec succès",
            data: matiere
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une matière
router.delete('/:id', async (req, res) => {
    try {
        const matiere = await matiereController.deleteMatiere(req.params.id);
        if (!matiere) {
            return res.status(404).json({
                success: false,
                error: "Matière non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Matière supprimée avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/travaux/:matiereId', async (req, res) => {
    try {
        const { matiereId } = req.params;
        const travaux = await Travail.find({ matiereId })
            .populate('matiereId')
            .populate('promotionId')
            .populate('anneeId')
            .lean();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
        
    }
})

module.exports = router;