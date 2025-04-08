const mongoose = require('mongoose');
const { Schema } = mongoose;

const retraitSchema = new Schema({
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    date_created: {
        type: Date,
        default: Date.now
    },
    montant: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'canceled'],
        default: 'pending'
    },
    ref: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['enseignant', 'jury', 'departement'],
        required: true
    },
    description: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Index pour une recherche rapide
retraitSchema.index({ agentId: 1 });
retraitSchema.index({ ref: 1 }, { unique: true });
retraitSchema.index({ type: 1 });
retraitSchema.index({ statut: 1 });

const Retrait = mongoose.model('Retrait', retraitSchema);

module.exports = Retrait;