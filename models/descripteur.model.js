const mongoose = require('mongoose');
const { Schema } = mongoose;

const descripteurSchema = new Schema({
    uniteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unite',
        required: true,
        unique: true
    },
    objectifs: [{
        type: String,
        required: true
    }],
    contenu: [{
        type: String,
        required: true
    }],
    competences: [{
        type: String,
        required: true
    }],
    approchePed: [{
        type: String,
        required: true
    }],
    evaluation: [{
        type: String,
        required: true
    }]
}, {
    timestamps: true
});

// Index pour une recherche rapide par unité
descripteurSchema.index({ uniteId: 1 });

const Descripteur = mongoose.model('Descripteur', descripteurSchema);
module.exports = Descripteur;