const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/section.controller');

// Créer une section
router.post('/create', async (req, res) => {
    try {
        const section = await sectionController.createSection(req.body);
        res.status(201).json({
            success: true,
            message: "Section créée avec succès",
            data: section
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des sections depuis un fichier CSV
router.post('/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await sectionController.createFromCSV(fileName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister toutes les sections
router.get('/', async (req, res) => {
    try {
        const sections = await sectionController.listSections();
        res.json({
            success: true,
            count: sections.length,
            data: sections
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir une section par ID
router.get('/:id', async (req, res) => {
    try {
        const section = await sectionController.getSectionById(req.params.id);
        if (!section) {
            return res.status(404).json({
                success: false,
                error: "Section non trouvée"
            });
        }
        res.json({
            success: true,
            data: section
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour une section
router.put('/:id', async (req, res) => {
    try {
        const sectionModifiee = await sectionController.updateSection(req.params.id, req.body);
        if (!sectionModifiee) {
            return res.status(404).json({
                success: false,
                error: "Section non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Section modifiée avec succès",
            data: sectionModifiee
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une section
router.delete('/:id', async (req, res) => {
    try {
        const sectionSupprimee = await sectionController.deleteSection(req.params.id);
        if (!sectionSupprimee) {
            return res.status(404).json({
                success: false,
                error: "Section non trouvée"
            });
        }
        res.json({
            success: true,
            message: "Section supprimée avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter un membre au bureau
router.post('/:id/bureaux', async (req, res) => {
    try {
        const section = await sectionController.addBureau(req.params.id, req.body);
        res.status(201).json({
            success: true,
            message: "Membre ajouté au bureau avec succès",
            data: section
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister les membres du bureau
router.get('/:id/bureaux', async (req, res) => {
    try {
        const bureaux = await sectionController.listBureaux(req.params.id);
        res.json({
            success: true,
            data: bureaux
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier un membre du bureau
router.put('/:id/bureaux/:bureauId', async (req, res) => {
    try {
        const section = await sectionController.updateBureau(
            req.params.id,
            req.params.bureauId,
            req.body
        );
        res.json({
            success: true,
            message: "Membre du bureau modifié avec succès",
            data: section
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Retirer un membre du bureau
router.delete('/:id/bureaux/:bureauId', async (req, res) => {
    try {
        const section = await sectionController.removeBureau(
            req.params.id,
            req.params.bureauId
        );
        res.json({
            success: true,
            message: "Membre retiré du bureau avec succès",
            data: section
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vérifier les sections où un agent est membre du staff
router.get('/agent/:agentId/sections', async (req, res) => {
    try {
        console.log("Agent ID:", req.params.agentId);
        const sections = await sectionController.getAgentSections(req.params.agentId);
        res.json({
            success: true,
            data: sections,
            message: sections.length > 0 
                ? `L'agent est membre de ${sections.length} section(s)` 
                : "L'agent n'est membre d'aucune section"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;