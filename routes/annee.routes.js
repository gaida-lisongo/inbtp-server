const express = require('express');
const router = express.Router();
const { Annee } = require('../models');

router.post('/', async (req, res) => {
    try {
        const { slogan, debut, fin } = req.body;

        if (!slogan || !debut || !fin) {
            return res.status(400).json({ error: 'Tous les champs sont requis.' });
        }
        
        // Utiliser le modèle avec la connexion établie
        const existingAnnee = await Annee.findOne({ debut, fin });

        if (existingAnnee) {
            return res.status(400).json({ 
                error: `L'année académique ${debut}-${fin} existe déjà.` 
            });
        }
        const nouvelleAnnee = new Annee({ slogan, debut, fin });
        const anneeCreee = await nouvelleAnnee.save();

        res.json({
            success: true,
            message: `Année académique ${debut}-${fin} créée avec succès`,
            data: anneeCreee
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }    
});

router.get('/', async (req, res) => {
    try {
        const annees = await Annee.find().sort({ debut: -1 });
        if (!annees || annees.length === 0) {
            return res.status(404).json({ error: 'Aucune année académique trouvée' });
        }
        res.json({
            success: true,
            count: annees.length,
            data: annees
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const annee = await Annee.findById(req.params.id);
        if (!annee) {
            return res.status(404).json({ error: 'Année académique non trouvée' });
        }
        res.json({ success: true, data: annee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { slogan, debut, fin } = req.body;
        
        if (!slogan || !debut || !fin) {
            return res.status(400).json({ error: 'Tous les champs sont requis.' });
        }

        const annee = await Annee.findByIdAndUpdate(
            req.params.id,
            { slogan, debut, fin },
            { new: true, runValidators: true }
        );

        if (!annee) {
            return res.status(404).json({ error: 'Année académique non trouvée' });
        }

        res.json({
            success: true,
            message: 'Année académique mise à jour avec succès',
            data: annee
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;