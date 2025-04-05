const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnneeSchema = new Schema({
    slogan: {
        type: String,
        required: true
    },
    debut: {
        type: Number,
        required: true,
        min: 2000
    },
    fin: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const Annee = mongoose.model('Annee', AnneeSchema);
module.exports = Annee;