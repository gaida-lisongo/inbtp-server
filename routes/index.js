const express = require('express');
const router = express.Router();
const anneeRoutes = require('./annee.routes');
const agentRoutes = require('./agent.routes');
const sectionRoutes = require('./section.routes');
const promotionRoutes = require('./promotion.routes');
const matiereRoutes = require('./matiere.routes');
const etudiantRoutes = require('./etudiant.routes');
// Routes
router.use('/annees', anneeRoutes);
router.use('/agents', agentRoutes);
router.use('/sections', sectionRoutes);
router.use('/promotions', promotionRoutes);
router.use('/matieres', matiereRoutes);
router.use('/etudiants', etudiantRoutes);

module.exports = router;