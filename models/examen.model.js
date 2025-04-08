const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExamenSchema = new Schema({
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Examen', 'Interrogation', 'TP']
    },
    statut: {
        type: String,
        default: 'pending',
        enum: ['pending', 'completed', 'canceled']
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Examen', ExamenSchema);