const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QuestionSchema = new Schema({
    enonce: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['QCM', 'LIBRE', 'FICHIER'],
        required: true
    },
    choix: [{
        type: String
    }],
    reponse: {
        type: String
    },
    url: {
        type: String
    }
}, {
    _id: true
});

const TravailSchema = new Schema({
    titre: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    matiereId: {
        type: Schema.Types.ObjectId,
        ref: 'Matiere',
        required: true
    },
    date_created: {
        type: Date,
        default: Date.now
    },
    date_fin: {
        type: Date,
        required: true
    },
    auteurId: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    montant: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        enum: ['EN ATTENTE', 'EN COURS', 'TERMINE'],
        default: 'EN ATTENTE'
    },
    questions: [QuestionSchema]
}, {
    timestamps: true,
    versionKey: false
});

// Indexes pour optimiser les performances
TravailSchema.index({ matiereId: 1, date_fin: 1 });
TravailSchema.index({ auteurId: 1 });
TravailSchema.index({ date_created: -1 });

// Validation personnalisée pour les questions
TravailSchema.path('questions').validate(function(questions) {
    if (questions.length === 0) {
        return false;
    }
    return questions.every(question => {
        if (question.type === 'QCM') {
            return Array.isArray(question.choix) && question.choix.length > 0;
        }
        if (question.type === 'FICHIER') {
            return typeof question.url === 'string';
        }
        return true;
    });
}, 'Questions validation failed');

module.exports = mongoose.model('Travail', TravailSchema);