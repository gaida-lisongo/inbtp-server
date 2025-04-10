const express = require('express');
const router = express.Router();
const Resolution = require('../models/resolution.model');
const cache = require('../utils/cache');

// Créer une résolution
router.post('/', async (req, res) => {
    try {
        const resolution = new Resolution(req.body);
        await resolution.save();

        await cache.delete(`resolutions:travail:${resolution.travailId}`);
        await cache.delete(`resolutions:etudiant:${resolution.etudiantId}`);

        res.status(201).json({
            success: true,
            message: 'Résolution créée avec succès',
            data: resolution
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Noter une résolution
router.put('/:id/note', async (req, res) => {
    try {
        const { note, comment } = req.body;
        
        const resolution = await Resolution.findByIdAndUpdate(
            req.params.id,
            { $set: { note, comment } },
            { new: true, runValidators: true }
        ).populate([
            { path: 'etudiantId', select: 'nom prenom' },
            { path: 'travailId', select: 'titre' }
        ]);

        if (!resolution) {
            return res.status(404).json({
                success: false,
                error: 'Résolution non trouvée'
            });
        }

        await cache.delete(`resolutions:travail:${resolution.travailId}`);
        await cache.delete(`resolutions:etudiant:${resolution.etudiantId}`);

        res.json({
            success: true,
            message: 'Note ajoutée avec succès',
            data: resolution
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lire les résolutions d'un travail
router.get('/travail/:travailId', async (req, res) => {
    try {
        const cacheKey = `resolutions:travail:${req.params.travailId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const resolutions = await Resolution.find({ 
            travailId: req.params.travailId 
        })
        .populate({
            path: 'etudiantId', 
            select: 'infoPerso.nom infoPerso.postNom infoPerso.preNom infoPerso.profile infoSec.etudiantId infoSec.email'
        })
        .sort('-date_created')
        .lean();

        await cache.set(cacheKey, resolutions, 3600);

        res.json({
            success: true,
            count: resolutions.length,
            data: resolutions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lire les résolutions d'un étudiant
router.get('/etudiant/:etudiantId', async (req, res) => {
    try {
        const cacheKey = `resolutions:etudiant:${req.params.etudiantId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const resolutions = await Resolution.find({ 
            etudiantId: req.params.etudiantId 
        })
        .populate('travailId', 'titre description date_fin')
        .sort('-date_created')
        .lean();

        await cache.set(cacheKey, resolutions, 3600);

        res.json({
            success: true,
            count: resolutions.length,
            data: resolutions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier une résolution
router.put('/:id', async (req, res) => {
    try {
        const resolution = await Resolution.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!resolution) {
            return res.status(404).json({
                success: false,
                error: 'Résolution non trouvée'
            });
        }

        await cache.delete(`resolutions:travail:${resolution.travailId}`);
        await cache.delete(`resolutions:etudiant:${resolution.etudiantId}`);

        res.json({
            success: true,
            message: 'Résolution modifiée avec succès',
            data: resolution
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une résolution
router.delete('/:id', async (req, res) => {
    try {
        const resolution = await Resolution.findById(req.params.id);
        
        if (!resolution) {
            return res.status(404).json({
                success: false,
                error: 'Résolution non trouvée'
            });
        }

        await Resolution.deleteOne({ _id: req.params.id });
        await cache.delete(`resolutions:travail:${resolution.travailId}`);
        await cache.delete(`resolutions:etudiant:${resolution.etudiantId}`);

        res.json({
            success: true,
            message: 'Résolution supprimée avec succès'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;