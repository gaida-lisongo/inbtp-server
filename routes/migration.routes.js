const express = require('express');
const router = express.Router();
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Import des modèles
const { Annee } = require('../models/annee.model');
const { Section } = require('../models/section.model');
const { Agent } = require('../models/agent.model');
const { Promotion } = require('../models/promotion.model');
const { Matiere } = require('../models/matiere.model');

// Migration des années
module.exports = router;