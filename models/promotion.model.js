const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UniteSchema = new Schema({
    code: {
        type: String,
        required: true
    },
    designation: {
        type: String,
        required: true
    },
    categorie: {
        type: String,
        required: true
    },
    matieres: [{
        type: Schema.Types.ObjectId,
        ref: 'Matiere'
    }]
});

const PromotionSchema = new Schema({
    description: String,
    sectionId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    niveau: {
        type: String,
        required: true
    },
    mention: String,
    orientation: String,
    statut: {
        type: String,
        enum: ['ACTIF', 'INACTIF'],
        default: 'ACTIF'
    },
    unites: [UniteSchema]
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Promotion', PromotionSchema);