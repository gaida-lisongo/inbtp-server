const express = require('express');
const router = express.Router();
const etudiantController = require('../controllers/etudiant.controller');

// Créer un étudiant
router.post('/', async (req, res) => {
    try {
        const etudiant = await etudiantController.createEtudiant(req.body);
        res.status(201).json({
            success: true,
            message: "Étudiant créé avec succès",
            data: etudiant
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des étudiants depuis CSV
router.post('/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await etudiantController.importEtudiants(fileName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister tous les étudiants avec filtres optionnels
router.get('/', async (req, res) => {
    try {
        const etudiants = await etudiantController.listEtudiants(req.query);
        res.json({
            success: true,
            count: etudiants.length,
            data: etudiants
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un étudiant par ID
router.get('/:id', async (req, res) => {
    try {
        const etudiant = await etudiantController.getEtudiantById(req.params.id);
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            data: etudiant
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour un étudiant
router.put('/:id', async (req, res) => {
    try {
        const etudiant = await etudiantController.updateEtudiant(
            req.params.id,
            req.body
        );
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            message: "Étudiant modifié avec succès",
            data: etudiant
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un étudiant
router.delete('/:id', async (req, res) => {
    try {
        const etudiant = await etudiantController.deleteEtudiant(req.params.id);
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            message: "Étudiant supprimé avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;