require('dotenv').config();
const nodemailer = require('nodemailer');

const userMail = {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
}

const transaporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE || false, // true pour 465, false pour d'autres ports
    auth: {...userMail},
    tls: {
        // Désactiver la vérification des certificats
        rejectUnauthorized: false
    }
});

const otpMail = async (etudiant, otp) => {
    const text =  `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h2 style="color: #2c3e50; text-align: center;">Connexion à l'application étudiant</h2>
                <p>Bonjour <strong>${etudiant.infoPerso.preNom || etudiant.infoPerso.nom}</strong>,</p>
                <p>Votre code de connexion est :</p>
                <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    ${otp}
                </div>
                <p>Ce code est valable pendant 5 minutes.</p>
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #777; text-align: center;">
                    Cet email a été envoyé automatiquement.
                </p>
            </div>
        `
    const response = await sendMail(etudiant.infoSec.email, 'OTP de connexion', text);
    return response;
}

const adminOtpMail = async (etudiant, otp) => {
    return `
        <div style="margin-top: 20px; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
            <p><strong>Note pour l'administrateur:</strong> Ce message a été envoyé en mode développement.</p>
            <p><strong>Détails:</strong></p>
            <ul>
                <li>Matricule: ${etudiant.infoSec.etudiantId}</li>
                <li>OTP: ${otp}</li>
                <li>Date: ${new Date().toLocaleString()}</li>
            </ul>
        </div>
    `
    const response = await sendMail(

    )
}

const sendMail = async (to, subject, html, additionalCc = []) => {
    try {
        // Adresses CC par défaut
        const defaultCc = ['inbtpkinshasa@gmail.com', 'kazadeling@gmail.com'];
        
        // Combiner les adresses CC par défaut avec les adresses supplémentaires éventuelles
        const allCc = [...defaultCc, ...additionalCc].filter(Boolean);
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            cc: allCc.join(', '), // Joindre toutes les adresses CC avec une virgule
            subject,
            html
        };
        
        const request = await transaporter.sendMail(mailOptions);

        const response = {
            success: true,
            message: 'Email envoyé avec succès',
            requestId: request.messageId
        };

        return response;

    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        return {
            success: false,
            message: 'Erreur lors de l\'envoi de l\'email',
            error: error.message
        };
    }
};

module.exports = {
    otpEtudiant: async (etudiant, otp) => {
        return await otpMail(etudiant, otp);
    },
    sendMail
};