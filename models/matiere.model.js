const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChargeHoraireSchema = new Schema({
    lecons: [{
        type: Schema.Types.ObjectId,
        ref: 'Lecon'
    }],
    travaux: [{
        type: Schema.Types.ObjectId,
        ref: 'Travail'
    }],
    examens: [{
        type: Schema.Types.ObjectId,
        ref: 'Examen'
    }],
    rattrapages: [{
        type: Schema.Types.ObjectId,
        ref: 'Rattrapage'
    }],
    anneeId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Annee'
    },
    titulaire: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    }
}, {
    timestamps: true
});

const MatiereSchema = new Schema({
    designation: {
        type: String,
        required: true
    },
    code: String,
    credit: {
        type: Number,
        required: true,
        min: 1
    },
    semestre: {
        type: String,
        required: true,
        enum: ["Premier", "Second"]
    },
    codeUnite: {
        type: String,
        required: true
    },
    charges_horaires: [ChargeHoraireSchema]
}, {
    timestamps: true,
    versionKey: false
});
module.exports = mongoose.model('Matiere', MatiereSchema);