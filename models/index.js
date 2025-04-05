const database = require('../config/database');
const Agent = require('./agent.model');
const Annee = require('./annee.model');
const Bulletin = require('./bulletin.model');
const Enrollment = require('./enrollement.model');
const Etudiant = require('./etudiant.model');
const Jury = require('./jury.model');
const Lecon = require('./lecon.model');
const Matiere = require('./matiere.model');
const Note = require('./note.model');
const Promotion = require('./promotion.model');
const Section = require('./section.model');
const Travaux = require('./travaux.model');
const Transaction = require('./transaction.model');

module.exports = {
    Agent,
    Annee,
    Bulletin,
    Enrollment,
    Etudiant,
    Jury,
    Lecon,
    Matiere,
    Note,
    Promotion,
    Section,
    Travaux,
    Transaction
};