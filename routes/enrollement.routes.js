const express = require('express');
const router = express.Router();
const Enrollment = require('../models/enrollement.model');
const cache = require('../utils/cache');

// Lister les enrollements d'une promotion
router.get('/promotion/:promotionId', async (req, res) => {
    try {
        const cacheKey = `enrollements:promotion:${req.params.promotionId}`;
        const cached = await cache.get(cacheKey);
        console.log("Cache miss for enrollments, fetching from DB.", req.params.promotionId);
        
        if (cached && cached.length > 0) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }
        const enrollments = await Enrollment.find({ promotionId: req.params.promotionId })
            .populate('cours')
            .populate('promotionId', 'code designation')
            .lean();

        await cache.set(cacheKey, enrollments, 3600);

        res.json({
            success: true,
            data: enrollments
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Affecter des cours à un enrollment
router.put('/:id/cours', async (req, res) => {
    try {
        const { action, cours } = req.body;

        if (!['add', 'remove'].includes(action)) {
            throw new Error("L'action doit être 'add' ou 'remove'");
        }

        const updateOperation = action === 'add'
            ? { $addToSet: { cours: { $each: cours } } }
            : { $pull: { cours: { $in: cours } } };

        const enrollment = await Enrollment.findByIdAndUpdate(
            req.params.id,
            updateOperation,
            { new: true }
        ).populate('cours promotionId');

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                error: "Enrollment non trouvé"
            });
        }

        await cache.delete(`enrollment:${req.params.id}`);
        await cache.delete(`enrollments:promotion:${enrollment.promotionId}`);

        res.json({
            success: true,
            message: `Cours ${action === 'add' ? 'ajoutés' : 'retirés'} avec succès`,
            data: enrollment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier un enrollment
router.put('/:id', async (req, res) => {
    try {
        const enrollment = await Enrollment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('cours promotionId');

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                error: "Enrollment non trouvé"
            });
        }

        await cache.delete(`enrollment:${req.params.id}`);
        await cache.delete(`enrollments:promotion:${enrollment.promotionId}`);

        res.json({
            success: true,
            message: "Enrollment mis à jour avec succès",
            data: enrollment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un enrollment
router.delete('/:id', async (req, res) => {
    try {
        const enrollment = await Enrollment.findById(req.params.id);
        
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                error: "Enrollment non trouvé"
            });
        }

        await Enrollment.deleteOne({ _id: req.params.id });
        
        await cache.delete(`enrollment:${req.params.id}`);
        await cache.delete(`enrollments:promotion:${enrollment.promotionId}`);

        res.json({
            success: true,
            message: "Enrollment supprimé avec succès"
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Créer un nouvel enrollment
router.post('/', async (req, res) => {
    try {
        const enrollment = new Enrollment(req.body);
        await enrollment.save();

        await cache.delete(`enrollments:promotion:${req.body.promotionId}`);

        res.status(201).json({
            success: true,
            message: "Enrollment créé avec succès",
            data: enrollment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;