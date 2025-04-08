const express = require('express');
const router = express.Router();
const Jury = require('../models/jury.model');
const cache = require('../utils/cache');


// Créer un jury
router.post('/', async (req, res) => {
    try {
        const jury = new Jury(req.body);
        await jury.save();
        
        await cache.delete('jurys:all');
        
        res.status(201).json({
            success: true,
            message: 'Jury créé avec succès',
            data: jury
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour un jury
router.put('/:id', async (req, res) => {
    try {
        const jury = await Jury.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        
        await cache.delete(`jury:${req.params.id}`);
        await cache.delete('jurys:all');
        
        res.json({
            success: true,
            message: 'Jury mis à jour avec succès',
            data: jury
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Ajouter des membres au bureau
router.post('/:id/bureaux', async (req, res) => {
    try {
        const jury = await Jury.findByIdAndUpdate(
            req.params.id,
            { $push: { bureaux: { $each: req.body } } },
            { new: true }
        );
        
        await cache.delete(`jury:${req.params.id}`);
        
        res.json({
            success: true,
            message: 'Membres ajoutés au bureau avec succès',
            data: jury
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Affecter des promotions
router.post('/:id/promotions', async (req, res) => {
    try {
        const jury = await Jury.findByIdAndUpdate(
            req.params.id,
            { $set: { promotions: req.body.promotions } },
            { new: true }
        );
        
        await cache.delete(`jury:${req.params.id}`);
        
        res.json({
            success: true,
            message: 'Promotions affectées avec succès',
            data: jury
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister tous les jurys
router.get('/', async (req, res) => {
    try {
        const cached = await cache.get('jurys:all');
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const jurys = await Jury.find()
            .populate('promotions')
            .populate('annees')
            .lean();
            
        await cache.set('jurys:all', jurys, 3600);
        
        res.json({
            success: true,
            data: jurys
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un jury par ID
router.get('/:id', async (req, res) => {
    try {
        const cached = await cache.get(`jury:${req.params.id}`);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const jury = await Jury.findById(req.params.id)
            .populate('promotions')
            .populate('annees')
            .lean();
            
        if (!jury) {
            return res.status(404).json({
                success: false,
                error: 'Jury non trouvé'
            });
        }

        await cache.set(`jury:${req.params.id}`, jury, 3600);
        
        res.json({
            success: true,
            data: jury
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un jury
router.delete('/:id', async (req, res) => {
    try {
        await Jury.findByIdAndDelete(req.params.id);
        
        await cache.delete(`jury:${req.params.id}`);
        await cache.delete('jurys:all');
        
        res.json({
            success: true,
            message: 'Jury supprimé avec succès'
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;