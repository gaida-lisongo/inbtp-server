const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for individual purchases/commands
const commandeSchema = new Schema({
    date_created: {
        type: Date,
        default: Date.now
    },
    statut: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'canceled'],
        default: 'pending'
    },
    description: {
        type: String,
    },
    title: {
        type: String,
    },
    monnaie: {
        type: String,
        enum: ['FC', 'USD', 'EUR'],
        default: 'FC'
    },
    product: {
        type: String,
    },
    montant: {
        type: Number,
    },
    ref: {
        type: String,
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
    },
    ref: {
        type: String,
    },
    description: {
        type: String,
    },
    title: {
        type: String,
    },
    monnaie: {
        type: String,
        enum: ['FC', 'USD', 'EUR'],
        default: 'FC'
    },
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
    commandes: {
        type: [commandeSchema],
        default: [] // Initialiser avec un tableau vide
    },
    recharges: {
        type: [rechargeSchema],
        default: [] // Initialiser avec un tableau vide
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual to calculate total amount spent
transactionSchema.virtual('totalDepense').get(function() {
    if (!this.commandes || !Array.isArray(this.commandes)) {
        return 0;
    }
    return this.commandes.reduce((sum, commande) => sum + commande.montant, 0);
});

transactionSchema.virtual('totalRecharge').get(function() {
    if (!this.recharges || !Array.isArray(this.recharges)) {
        return 0;
    }
    return this.recharges
        .filter(recharge => recharge.statut === 'completed')
        .reduce((sum, recharge) => sum + recharge.montant, 0);
});

// Create index for faster lookup by student
transactionSchema.index({ etudiantId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;