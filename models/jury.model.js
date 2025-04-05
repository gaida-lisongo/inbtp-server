const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BureauSchema = new Schema({
    grade: {
        type: String,
        required: true
    },
    agentId: {
        type: String,
        required: true
    }
});

const JurySchema = new Schema({
    titre: {
        type: String,
        required: true
    },
    secure: {
        type: String,
        required: true
    },
    bureaux: [BureauSchema],
    promotions: [{
        type: Schema.Types.ObjectId,
        ref: 'Promotion'
    }],
    annees: [{
        type: Schema.Types.ObjectId,
        ref: 'Annee'
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Index pour optimiser les recherches
JurySchema.index({ titre: 1 });
JurySchema.index({ secure: 1 });

module.exports = mongoose.model('Jury', JurySchema);