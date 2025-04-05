const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AgentSchema = new Schema({
    solde: {
        type: Number
    },
    nom: {
        type: String,
        required: true
    },
    prenom: {
        type: String
    },
    postnom: {
        type: String
    },
    sexe: String,
    grade: String,
    matricule: {
        type: String,
        required: true,
        unique: true
    },
    nationalite: {
        type: String
    },
    typeAgent: {
        type: String,
        enum: ['enseignant', 'administratif']
    },
    lieuNaissance: {
        type: String
    },
    mdp: String,
    telephone: {
        type: String,
        unique: true,
    },
    adresse: {
        type: String
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir un email valide']
    },
    avatar: String,
    dateNaissance: {
        type: Date
    },
    niveau: String
}, {
    timestamps: true,
    versionKey: false
});

// Indexes pour optimiser les recherches
AgentSchema.index({ email: 1 }, { unique: true });
AgentSchema.index({ matricule: 1 }, { unique: true });
AgentSchema.index({ typeAgent: 1 });
AgentSchema.index({ nom: 1, prenom: 1 });

// Méthode pour masquer le mot de passe dans les réponses
AgentSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.mdp;
    return obj;
};

module.exports = mongoose.model('Agent', AgentSchema);