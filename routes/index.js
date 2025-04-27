const express = require('express');
const router = express.Router();
const anneeRoutes = require('./annee.routes');
const agentRoutes = require('./agent.routes');
const sectionRoutes = require('./section.routes');
const promotionRoutes = require('./promotion.routes');
const matiereRoutes = require('./matiere.routes');
const etudiantRoutes = require('./etudiant.routes');
const retraitRoutes = require('./retrait.routes');
const descripteurRoutes = require('./descripteur.routes');
const juryRoutes = require('./jury.routes');
const enrollementRoutes = require('./enrollement.routes');
const titulaireRoutes = require('./titulaire.routes');
const resolutionRoutes = require('./resolution.routes');
const appariteurRoutes = require('./appariteur.routes');
const minervalRoutes = require('./minerval.routes'); // Nouvelle ligne
const travauxRoutes = require('./travaux.routes');

// Routes
router.use('/annees', anneeRoutes);
router.use('/agents', agentRoutes);
router.use('/sections', sectionRoutes);
router.use('/promotions', promotionRoutes);
router.use('/matieres', matiereRoutes);
router.use('/etudiants', etudiantRoutes);
router.use('/retraits', retraitRoutes);
router.use('/descripteurs', descripteurRoutes);
router.use('/jurys', juryRoutes);
router.use('/enrollements', enrollementRoutes);
router.use('/titulaire', titulaireRoutes);
router.use('/resolution', resolutionRoutes);
router.use('/appariteurs', appariteurRoutes);
router.use('/minervals', minervalRoutes);
router.use('/travaux', travauxRoutes);

module.exports = router;