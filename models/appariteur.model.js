const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sous-schéma pour les souscriptions
const SouscriptionSchema = new Schema({
    date_created: {
        type: Date,
        default: Date.now
    },
    matricule: {
        type: String,
        required: true
    },
    etudiantId: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    statut: {
        type: String,
        enum: ['En attente', 'OK', 'NO'],
        default: 'En attente'
    },
    dossier: {
        type: String
    }
});

// Sous-schéma pour les inscriptions
const InscriptionSchema = new Schema({
    titre: {
        type: String,
        required: true
    },
    benefices: {
        type: String
    },
    banner: {
        type: String
    },
    montant: {
        type: Number,
        required: true
    },
    promotionId: {
        type: Schema.Types.ObjectId,
        ref: 'Promotion',
        required: true
    },
    souscriptions: {
        type: [SouscriptionSchema],
        default: []
    }
});

// Sous-schéma pour les retraits
const RetraitSchema = new Schema({
    date_created: {
        type: Date,
        default: Date.now
    },
    montant: {
        type: Number,
        required: true
    },
    telephone: {
        type: String,
        required: true
    },
    orderNumber: {
        type: String
    },
    currency: {
        type: String,
        default: 'FC'
    },
    statut: {
        type: String,
        enum: ['En attente', 'OK', 'NO'],
        default: 'En attente'
    }
});

// Schéma principal de l'appariteur
const AppariteurSchema = new Schema({
    agentId: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    anneeId: {
        type: Schema.Types.ObjectId,
        ref: 'Annee',
        required: true
    },
    sectionId: {
        type: Schema.Types.ObjectId,
        ref: 'Section',
        required: true
    },
    inscriptions: {
        type: [InscriptionSchema],
        default: []
    },
    balance: {
        type: Number,
        default: 0
    },
    retraits: {
        type: [RetraitSchema],
        default: []
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals pour les statistiques
AppariteurSchema.virtual('totalSouscriptions').get(function() {
    return this.inscriptions.reduce((sum, inscription) => {
        return sum + inscription.souscriptions.length;
    }, 0);
});

AppariteurSchema.virtual('totalInscriptions').get(function() {
    return this.inscriptions.length;
});

AppariteurSchema.virtual('totalRetraits').get(function() {
    return this.retraits.length;
});

AppariteurSchema.virtual('montantRetraits').get(function() {
    return this.retraits
        .filter(retrait => retrait.statut === 'OK')
        .reduce((sum, retrait) => sum + retrait.montant, 0);
});

AppariteurSchema.virtual('revenus').get(function() {
    return this.inscriptions.reduce((sum, inscription) => {
        const souscriptionsOK = inscription.souscriptions.filter(s => s.statut === 'OK').length;
        return sum + (souscriptionsOK * inscription.montant);
    }, 0);
});

// Méthode pour ajouter une inscription
AppariteurSchema.methods.addInscription = async function(inscriptionData) {
    this.inscriptions.push(inscriptionData);
    return this.save();
};

// Méthode pour ajouter une souscription à une inscription
AppariteurSchema.methods.addSouscription = async function(inscriptionId, souscriptionData) {
    const inscription = this.inscriptions.id(inscriptionId);
    if (!inscription) {
        throw new Error("Inscription non trouvée");
    }
    inscription.souscriptions.push(souscriptionData);
    return this.save();
};

// Méthode pour effectuer un retrait
AppariteurSchema.methods.addRetrait = async function(retraitData) {
    if (retraitData.montant > this.balance) {
        throw new Error("Solde insuffisant pour effectuer ce retrait");
    }
    this.retraits.push(retraitData);
    return this.save();
};

module.exports = mongoose.model('Appariteur', AppariteurSchema);