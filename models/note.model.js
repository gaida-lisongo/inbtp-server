const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NoteSchema = new Schema({
    anneeId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    etudiantId: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    matiereId: {
        type: Schema.Types.ObjectId,
        ref: 'Matiere',
        required: true
    },
    noteAnnuel: {
        type: Number,
        min: 0,
        max: 10
    },
    noteExamen: {
        type: Number,
        min: 0,
        max: 10
    },
    noteRattrapage: {
        type: Number,
        min: 0,
        max: 20
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Agent'
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Note', NoteSchema);