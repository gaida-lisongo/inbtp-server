const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeconSchema = new Schema({
    titre: {
        type: String,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Etudiant',
        required: true
    },
    description: String,
    url: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Lecon', LeconSchema);