const express = require('express');
const router = express.Router();
const Matiere = require('../models/matiere.model');
const Travail = require('../models/travaux.model');
const Note = require('../models/note.model');
const cache = require('../utils/cache');

// Get teacher's course load
router.get('/charges/:titulaireId', async (req, res) => {
    try {
        console.log('Fetching course load for teacher:', req.params.titulaireId);
        const cacheKey = `charges:titulaire:${req.params.titulaireId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        // Find all subjects where the teacher has course load
        const matieres = await Matiere.find({
            'charges_horaires.titulaire': req.params.titulaireId
        })
        .select('designation code credit semestre codeUnite charges_horaires')
        .populate([
            {
                path: 'charges_horaires.lecons',
                select: 'date contenu statut'
            },
            {
                path: 'charges_horaires.travaux',
                select: 'titre description dateRemise'
            },
            // {
            //     path: 'charges_horaires.examens',
            //     select: 'date type statut'
            // },
            // {
            //     path: 'charges_horaires.rattrapages',
            //     select: 'date motif statut'
            // },
            {
                path: 'charges_horaires.anneeId',
                select: 'designation'
            }
        ])
        .lean();

        // Filter charges_horaires to only show this teacher's assignments
        const chargesFiltered = matieres.map(matiere => ({
            ...matiere,
            charges_horaires: matiere.charges_horaires.filter(
                ch => ch.titulaire.toString() === req.params.titulaireId
            )
        }));

        await cache.set(cacheKey, chargesFiltered, 3600); // Cache for 1 hour

        res.json({
            success: true,
            count: chargesFiltered.length,
            data: chargesFiltered
        });

    } catch (error) {
        console.error('Error fetching teacher charges:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Liste des travaux par matière et auteur
router.get('/travaux/:matiereId/:auteurId', async (req, res) => {
    try {
        const { matiereId, auteurId } = req.params;
        const cacheKey = `travaux:matiere:${matiereId}:auteur:${auteurId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const travaux = await Travail.find({ 
            matiereId, 
            auteurId 
        })
        .populate('matiereId', 'designation code')
        .sort('-date_created')
        .lean();

        await cache.set(cacheKey, travaux, 3600);

        res.json({
            success: true,
            count: travaux.length,
            data: travaux
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Création d'un travail
router.post('/travaux', async (req, res) => {
    try {
        console.log('Creating a new work:', req.body);
        const travail = new Travail({
            titre: req.body.titre,
            description: req.body.description,
            date_fin: req.body.date_fin,
            montant: req.body.montant,
            matiereId: req.body.matiereId,
            auteurId: req.body.auteurId,
            statut: req.body.statut || 'EN ATTENTE',
            type: req.body.type || 'REPONSE',
            questions: [] // Initialize with empty array
        });
        await travail.save();

        await cache.delete(`travaux:matiere:${travail.matiereId}:auteur:${travail.auteurId}`);

        res.status(201).json({
            success: true,
            message: 'Travail créé avec succès',
            data: travail
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Ajout de questions à un travail
router.post('/travaux/:id/questions', async (req, res) => {
    try {
        const travail = await Travail.findById(req.params.id);
        
        if (!travail) {
            return res.status(404).json({
                success: false,
                error: 'Travail non trouvé'
            });
        }

        travail.questions.push(...req.body.questions);
        await travail.save();

        await cache.delete(`travaux:matiere:${travail.matiereId}:auteur:${travail.auteurId}`);

        res.json({
            success: true,
            message: 'Questions ajoutées avec succès',
            data: travail
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Modification des questions
router.put('/travaux/:id/questions/:questionId', async (req, res) => {
    try {
        const travail = await Travail.findOneAndUpdate(
            { 
                _id: req.params.id,
                "questions._id": req.params.questionId 
            },
            { 
                $set: { "questions.$": req.body }
            },
            { new: true }
        );

        if (!travail) {
            return res.status(404).json({
                success: false,
                error: 'Travail ou question non trouvé'
            });
        }

        await cache.delete(`travaux:matiere:${travail.matiereId}:auteur:${travail.auteurId}`);

        res.json({
            success: true,
            message: 'Question modifiée avec succès',
            data: travail
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Modification d'un travail
router.put('/travaux/:id', async (req, res) => {
    try {
        const travail = await Travail.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!travail) {
            return res.status(404).json({
                success: false,
                error: 'Travail non trouvé'
            });
        }

        await cache.delete(`travaux:matiere:${travail.matiereId}:auteur:${travail.auteurId}`);

        res.json({
            success: true,
            message: 'Travail modifié avec succès',
            data: travail
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Suppression d'un travail
router.delete('/travaux/:id', async (req, res) => {
    try {
        const travail = await Travail.findById(req.params.id);
        
        if (!travail) {
            return res.status(404).json({
                success: false,
                error: 'Travail non trouvé'
            });
        }

        await Travail.deleteOne({ _id: req.params.id });
        await cache.delete(`travaux:matiere:${travail.matiereId}:auteur:${travail.auteurId}`);

        res.json({
            success: true,
            message: 'Travail supprimé avec succès'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Créer une note
router.post('/notes', async (req, res) => {
    try {
        const note = new Note({
            ...req.body,
            createdBy: req.body.auteurId // assuming auteurId is the teacher's ID
        });
        await note.save();

        await cache.delete(`notes:matiere:${note.matiereId}`);
        await cache.delete(`notes:etudiant:${note.etudiantId}`);

        res.status(201).json({
            success: true,
            message: 'Note créée avec succès',
            data: note
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier une note
router.put('/notes/:id', async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { 
                $set: {
                    ...req.body,
                    updatedBy: req.body.auteurId
                }
            },
            { new: true, runValidators: true }
        ).populate(['etudiantId', 'matiereId']);

        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note non trouvée'
            });
        }

        await cache.delete(`notes:matiere:${note.matiereId}`);
        await cache.delete(`notes:etudiant:${note.etudiantId}`);

        res.json({
            success: true,
            message: 'Note modifiée avec succès',
            data: note
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lire les notes d'un cours
router.get('/notes/matiere/:matiereId', async (req, res) => {
    try {
        const cacheKey = `notes:matiere:${req.params.matiereId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const notes = await Note.find({ 
            matiereId: req.params.matiereId 
        })
        .populate('etudiantId', 'nom prenom code')
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .sort('etudiantId')
        .lean();

        await cache.set(cacheKey, notes, 3600);

        res.json({
            success: true,
            count: notes.length,
            data: notes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lire les notes d'un étudiant
router.get('/notes/etudiant/:etudiantId', async (req, res) => {
    try {
        const cacheKey = `notes:etudiant:${req.params.etudiantId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const notes = await Note.find({ 
            etudiantId: req.params.etudiantId 
        })
        .populate('matiereId', 'designation code credit')
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .sort('matiereId')
        .lean();

        await cache.set(cacheKey, notes, 3600);

        res.json({
            success: true,
            count: notes.length,
            data: notes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lire les notes créées par un enseignant
router.get('/notes/createdby/:auteurId', async (req, res) => {
    try {
        const cacheKey = `notes:auteur:${req.params.auteurId}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const notes = await Note.find({ 
            createdBy: req.params.auteurId 
        })
        .populate('etudiantId', 'nom prenom code')
        .populate('matiereId', 'designation code')
        .sort('-createdAt')
        .lean();

        await cache.set(cacheKey, notes, 3600);

        res.json({
            success: true,
            count: notes.length,
            data: notes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer une note
router.delete('/notes/:id', async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        
        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note non trouvée'
            });
        }

        await Note.deleteOne({ _id: req.params.id });
        await cache.delete(`notes:matiere:${note.matiereId}`);
        await cache.delete(`notes:etudiant:${note.etudiantId}`);
        await cache.delete(`notes:auteur:${note.createdBy}`);

        res.json({
            success: true,
            message: 'Note supprimée avec succès'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;