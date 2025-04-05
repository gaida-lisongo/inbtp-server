import mongoose, { Schema, Document } from 'mongoose';

const EnrollmentSchema = new Schema({
  date_created: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  date_fin: { 
    type: Date, 
    required: true 
  },
  promotionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Promotion', 
    required: true 
  },
  designation: { 
    type: String, 
    required: true 
  },
  montant: { 
    type: Number, 
    required: true,
    min: 0 
  },
  description: { 
    type: String 
  },
  cours: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Cours' 
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Index pour optimiser les recherches
EnrollmentSchema.index({ promotionId: 1 });
EnrollmentSchema.index({ date_created: 1 });
EnrollmentSchema.index({ date_fin: 1 });

// Export du modèle
export const Enrollment = mongoose.model('Enrollment', EnrollmentSchema);