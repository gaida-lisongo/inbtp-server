const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResolutionSchema = new Schema({
    etudiantId: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    travailId: {
        type: Schema.Types.ObjectId,
        ref: 'Travail',
        required: true
    },
    url: {
        type: String
    },
    date_created: {
        type: Date,
        default: Date.now
    },
    note: {
        type: Number,
        min: 0,
        max: 20
    },
    comment: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes pour optimiser les performances
ResolutionSchema.index({ etudiantId: 1, travailId: 1 }, { unique: true });
ResolutionSchema.index({ date_created: -1 });

module.exports = mongoose.model('Resolution', ResolutionSchema);