const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BulletinSchema = new Schema({
    montant: {
        type: Number,
        required: true,
        min: 0
    },
    promotionId: {
        type: Schema.Types.ObjectId,
        ref: 'Promotion',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['SEMESTRE', 'ANNUEL', 'RATTRAPAGE']
    },
    designation: {
        type: String,
        required: true
    },
    description: String
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Bulletin', BulletinSchema);