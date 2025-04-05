const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for individual purchases/commands
const commandeSchema = new Schema({
    date_created: {
        type: Date,
        default: Date.now
    },
    product: {
        type: String,
        required: true
    },
    montant: {
        type: Number,
        required: true
    },
    ref: {
        type: String,
        required: true
    }
});

// Schema for account recharges
const rechargeSchema = new Schema({
    date_created: {
        type: Date,
        default: Date.now
    },
    statut: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'canceled'],
        default: 'pending'
    },
    montant: {
        type: Number,
        required: true
    },
    ref: {
        type: String,
        required: true
    }
});

// Main transaction schema
const transactionSchema = new Schema({
    etudiantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    solde: {
        type: Number,
        default: 0
    },
    fraisAcad: {
        type: Number,
        default: 0
    },
    commandes: [commandeSchema],
    recharges: [rechargeSchema]
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual to calculate total amount spent
transactionSchema.virtual('totalDepense').get(function() {
    return this.commandes.reduce((sum, commande) => sum + commande.montant, 0);
});

// Virtual to calculate total amount recharged
transactionSchema.virtual('totalRecharge').get(function() {
    return this.recharges
        .filter(recharge => recharge.statut === 'completed')
        .reduce((sum, recharge) => sum + recharge.montant, 0);
});

// Create index for faster lookup by student
transactionSchema.index({ etudiantId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;