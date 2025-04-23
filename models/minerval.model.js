const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sous-schéma pour les tranches de paiement
const TrancheSchema = new Schema({
    designation: {
        type: String,
        required: true,
        trim: true
    },
    date_fin: {
        type: Date,
        required: true
    },
    montant: {
        type: Number,
        required: true,
        min: 0
    }
});

// Sous-schéma pour les paiements effectués par les étudiants
const PaiementSchema = new Schema({
    etudiantId: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    montant: {
        type: Number,
        required: true,
        min: 0
    },
    date_created: {
        type: Date,
        default: Date.now
    },
    reference: {
        type: String,
        trim: true
    },
    mode: {
        type: String,
        enum: ['CASH', 'MOBILE', 'BANQUE'],
        default: 'CASH'
    },
    trancheId: {
        type: Schema.Types.ObjectId,
        ref: 'Minerval.tranches'
    },
    statut: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'],
        default: 'COMPLETED'
    }
});

// Schéma principal du Minerval
const MinervalSchema = new Schema({
    promotionId: {
        type: Schema.Types.ObjectId,
        ref: 'Promotion',
        required: true
    },
    anneeId: {
        type: Schema.Types.ObjectId,
        ref: 'Annee',
        required: true
    },
    montant: {
        type: Number,
        required: true,
        min: 0
    },
    devise: {
        type: String,
        enum: ['USD', 'FC', 'EUR'],
        default: 'USD'
    },
    description: {
        type: String,
        trim: true
    },
    tranches: [TrancheSchema],
    paiements: [PaiementSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index pour optimiser les recherches
MinervalSchema.index({ promotionId: 1, anneeId: 1 }, { unique: true });
MinervalSchema.index({ 'paiements.etudiantId': 1, 'paiements.trancheId': 1 });

// Définir des propriétés virtuelles
MinervalSchema.virtual('totalPaye').get(function() {
    if (!this.paiements || !Array.isArray(this.paiements)) {
        return 0;
    }
    return this.paiements
        .filter(p => p.statut === 'COMPLETED')
        .reduce((total, paiement) => total + paiement.montant, 0);
});

MinervalSchema.virtual('pourcentagePerception').get(function() {
    if (this.montant === 0) return 0;
    return Math.round((this.totalPaye / this.montant) * 100);
});

MinervalSchema.virtual('nombreEtudiants').get(function() {
    if (!this.paiements || !Array.isArray(this.paiements)) {
        return 0;
    }
    // Compter les étudiants uniques qui ont effectué au moins un paiement complété
    const etudiantsUniques = new Set(
        this.paiements
            .filter(p => p.statut === 'COMPLETED')
            .map(p => p.etudiantId.toString())
    );
    return etudiantsUniques.size;
});

// Méthodes d'instance
MinervalSchema.methods.ajouterPaiement = function(paiementData) {
    this.paiements.push(paiementData);
    return this;
};

MinervalSchema.methods.getPaiementsEtudiant = function(etudiantId) {
    return this.paiements.filter(
        p => p.etudiantId.toString() === etudiantId.toString()
    );
};


MinervalSchema.methods.getTotalPayeEtudiant = function(etudiantId) {
    return this.paiements
        .filter(p => 
            p.etudiantId.toString() === etudiantId.toString() && 
            p.statut === 'COMPLETED'
        )
        .reduce((total, p) => total + p.montant, 0);
};

MinervalSchema.methods.resteAPayer = function(etudiantId) {
    const totalPaye = this.getTotalPayeEtudiant(etudiantId);
    return Math.max(0, this.montant - totalPaye);
};

// Méthodes statiques
MinervalSchema.statics.findByPromotion = function(promotionId, anneeId) {
    return this.findOne({ promotionId, anneeId })
        .populate('promotionId', 'niveau mention orientation')
        .populate('anneeId', 'designation');
};

module.exports = mongoose.model('Minerval', MinervalSchema);