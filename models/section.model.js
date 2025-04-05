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

const OffreSchema = new Schema({
    titre: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    }
});

const SectionSchema = new Schema({
    titre: {
        type: String,
        required: true
    },
    description: String,
    url: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    telephone: {
        type: String,
    },
    bureaux: [BureauSchema],
    offres: [OffreSchema],
    jurys: [{
        type: Schema.Types.ObjectId,
        ref: 'Jury'
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Index pour optimiser les recherches
SectionSchema.index({ titre: 1 });
SectionSchema.index({ service: 1 });

module.exports = mongoose.model('Section', SectionSchema);