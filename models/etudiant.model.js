const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ActifsSchema = new Schema({
    travaux: [{
        type: Schema.Types.ObjectId,
        ref: 'Travail'
    }],
    enrollments: [{
        type: Schema.Types.ObjectId,
        ref: 'Enrollment'
    }],
    bulletins: [{
        type: Schema.Types.ObjectId,
        ref: 'Bulletin'
    }]
});

const EtudiantSchema = new Schema({
  infoPerso: {
    profile: {
      type: String,
    },
    nom: { 
      type: String, 
      required: true,
      trim: true,
      uppercase: true
    },
    postNom: { 
      type: String, 
      required: true,
      trim: true,
      uppercase: true
    },
    preNom: { 
      type: String, 
      trim: true,
      uppercase: true
    },
    sexe: { 
      type: String, 
      enum: ['M', 'F'], 
    },
    dateNaissance: { 
      type: Date 
    },
    lieuNaissance: { 
      type: String,
      trim: true
    },
    adresse: { 
      type: String,
      trim: true
    }
  },
  infoSec: {
    etudiantId: { 
      type: String, 
      unique: true,
      trim: true
    },
    email: { 
      type: String, 
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,7})+$/, 'Email invalide']
    },
    telephone: { 
      type: String, 
      unique: true,
      trim: true
    },
    optId: {
      type: String
    },
    mdp: { 
      type: String 
    }
  },
  infoScol: {
    section: { 
      type: String,
      trim: true
    },
    option: { 
      type: String,
      trim: true
    },
    pourcentage: { 
      type: Number, 
      min: 0, 
      max: 100 
    }
  },
  infoAcad: [{
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
    actifs: ActifsSchema
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Index pour optimiser les recherches
EtudiantSchema.index({ 'infoSec.etudiantId': 1 }, { unique: true });
EtudiantSchema.index({ 'infoSec.email': 1 }, { sparse: true, unique: true });
EtudiantSchema.index({ 'infoSec.telephone': 1 }, { sparse: true, unique: true });
EtudiantSchema.index({ 'infoPerso.nom': 1, 'infoPerso.postNom': 1 });
EtudiantSchema.index({ 'infoAcad.promotionId': 1, 'infoAcad.anneeId': 1 });

// Méthode virtuelle pour le nom complet
EtudiantSchema.virtual('nomComplet').get(function() {
  return `${this.infoPerso.nom} ${this.infoPerso.postNom} ${this.infoPerso.preNom}`;
});

// Méthodes utiles
EtudiantSchema.methods.addActif = function(anneeId, type, produitId) {
    const anneeAcad = this.infoAcad.find(info => 
        info.anneeId.equals(anneeId)
    );
    
    if (anneeAcad) {
        if (!anneeAcad.actifs) {
            anneeAcad.actifs = {};
        }
        if (!anneeAcad.actifs[type]) {
            anneeAcad.actifs[type] = [];
        }
        if (!anneeAcad.actifs[type].includes(produitId)) {
            anneeAcad.actifs[type].push(produitId);
        }
    }
    return this;
};

EtudiantSchema.methods.hasActif = function(anneeId, type, produitId) {
    const anneeAcad = this.infoAcad.find(info => 
        info.anneeId.equals(anneeId)
    );
    
    return anneeAcad && 
           anneeAcad.actifs && 
           anneeAcad.actifs[type] && 
           anneeAcad.actifs[type].some(id => id.equals(produitId));
};

EtudiantSchema.methods.getActifs = function(anneeId, type) {
    const anneeAcad = this.infoAcad.find(info => 
        info.anneeId.equals(anneeId)
    );
    
    return anneeAcad?.actifs?.[type] || [];
};
module.exports = mongoose.model('Etudiant', EtudiantSchema);