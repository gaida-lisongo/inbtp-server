const Socket = require('./Socket');
const Etudiant = require('../models/etudiant.model');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();
/**
 * Socket pour la gestion de l'authentification
 */
class AuthSocket extends Socket {
    /**
     * Constructeur
     * @param {Object} io - Instance de Socket.IO
     */
    constructor(io) {
        super(io);
        // Stockage des OTP en mémoire
        this.otpStore = new Map();
        // Stockage des étudiants connectés
        this.connectedStudents = new Map();
        const userMail = {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }

        console.log('User mail:', userMail);
        // Configuration de nodemailer avec ignoreSSL
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE || false, // true pour 465, false pour d'autres ports
            auth: {...userMail},
            tls: {
                // Désactiver la vérification des certificats
                rejectUnauthorized: false
            }
        });
        
        // Vérifier la connexion au serveur de messagerie
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('Erreur de configuration du serveur SMTP:', error);
            } else {
                console.log('Serveur SMTP prêt à envoyer des emails');
            }
        });
        
        // Démarrer le nettoyage périodique
        this.startCleanupTask();
    }

    /**
     * Initialisation des événements d'authentification
     */
    init() {
        this.io.on('connection', (socket) => {
            console.log('[AUTH] Nouveau client connecté:', socket.id);
            
            // Demande d'OTP
            socket.on('auth:request-otp', (data) => this.handleRequestOtp(socket, data));
            
            // Vérification OTP
            socket.on('auth:verify-otp', (data) => this.handleVerifyOtp(socket, data));
            
            // Déconnexion
            socket.on('auth:logout', (data) => this.handleLogout(socket, data));
            
            // Recherche par nom
            socket.on('auth:search-by-name', (data) => this.handleSearchByName(socket, data));
        });
    }

    /**
     * Demande d'OTP
     */
    async handleRequestOtp(socket, data) {
        try {
            const { matricule, email } = data;
            console.log('Demande OTP:', data);
            if (!matricule || !email) {
                throw new Error('Matricule et email requis');
            }
            
            // Recherche de l'étudiant
            const etudiant = await Etudiant.findOne({
                'infoSec.etudiantId': matricule,
                'infoSec.email': email
            });
            
            if (!etudiant) {
                throw new Error('Étudiant non trouvé avec ces identifiants');
            }
            
            // Génération de l'OTP (6 chiffres)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Stockage de l'OTP
            const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes
            this.otpStore.set(matricule, {
                otp,
                expirationTime,
                studentId: etudiant._id.toString()
            });

            console.log(`[OTP] Code généré pour ${matricule}: ${otp}`);
            
            // Envoi de l'email
            await this.sendOtpEmail(etudiant.infoSec.email, otp, etudiant);
            
            this.emitSuccess(socket, 'auth:otp-sent', {
                message: 'Code OTP envoyé à votre adresse email',
                expiresIn: '5 minutes'
            });
            
        } catch (error) {
            this.handleError(error, socket, 'auth:request-otp');
        }
    }

    /**
     * Vérification de l'OTP
     */
    async handleVerifyOtp(socket, data) {
        try {
            const { matricule, otp } = data;
            
            if (!matricule || !otp) {
                throw new Error('Matricule et OTP requis');
            }
            
            // Vérification
            const otpData = this.otpStore.get(matricule);
            
            if (!otpData) {
                throw new Error('Aucun code OTP trouvé pour ce matricule');
            }
            
            if (Date.now() > otpData.expirationTime) {
                this.otpStore.delete(matricule);
                throw new Error('Code OTP expiré');
            }
            
            if (otpData.otp !== otp) {
                throw new Error('Code OTP incorrect');
            }
            
            // Récupération de l'étudiant
            const etudiant = await Etudiant.findById(otpData.studentId)
                .populate('infoAcad.promotionId')
                .populate('infoAcad.anneeId');
            
            // Génération du token JWT
            const token = jwt.sign(
                { 
                    id: etudiant._id,
                    matricule: etudiant.infoSec.etudiantId,
                    role: 'etudiant'
                },
                process.env.JWT_SECRET || 'secret-key',
                { expiresIn: '24h' }
            );
            // Ajout aux connectés
            this.connectedStudents.set(etudiant._id.toString(), {
                matricule: etudiant.infoSec.etudiantId,
                socketId: socket.id,
                lastActivity: Date.now()
            });
            
            // Suppression OTP
            this.otpStore.delete(matricule);
            
            // Association au socket
            socket.etudiantId = etudiant._id.toString();
            socket.join(`etudiant:${etudiant._id}`);
            
            // Envoi
            this.emitSuccess(socket, 'auth:logged-in', {
                token,
                etudiant: this.sanitizeEtudiantData(etudiant),
                message: `Bienvenue ${etudiant.infoPerso.preNom || etudiant.infoPerso.nom}`
            });
            
        } catch (error) {
            this.handleError(error, socket, 'auth:verify-otp');
        }
    }

    /**
     * Déconnexion
     */
    handleLogout(socket, data) {
        try {
            const etudiantId = data.etudiantId;
            console.log('Déconnexion de l\'étudiant:', etudiantId);

            if (etudiantId) {
                this.connectedStudents.delete(etudiantId);
                socket.etudiantId = null;
                socket.leave(`etudiant:${etudiantId}`);
                
                this.emitSuccess(socket, 'auth:logged-out', {
                    message: 'Déconnexion réussie'
                });
            } else {
                throw new Error('Aucune session active');
            }
        } catch (error) {
            this.handleError(error, socket, 'auth:logout');
        }
    }

    /**
     * Recherche par nom
     */
    async handleSearchByName(socket, data) {
        console.log('Recherche par nom:', data);
        try {
            const { nom, postNom, preNom } = data;
            
            if (!nom && !postNom && !preNom) {
                throw new Error('Au moins un critère de recherche est requis');
            }
            
            // Construction filtre
            const filter = {};
            
            if (nom) filter['infoPerso.nom'] = new RegExp(nom, 'i');
            if (postNom) filter['infoPerso.postNom'] = new RegExp(postNom, 'i');
            if (preNom) filter['infoPerso.preNom'] = new RegExp(preNom, 'i');
            
            // Recherche
            const etudiants = await Etudiant.find(filter)
                .select('infoPerso.nom infoPerso.postNom infoPerso.preNom infoSec.etudiantId infoSec.email infoSec.telephone');
            this.emitSuccess(socket, 'auth:search-results', {
                count: etudiants.length,
                etudiants: etudiants.map(e => ({
                    nom: e.infoPerso.nom,
                    postNom: e.infoPerso.postNom,
                    preNom: e.infoPerso.preNom,
                    matricule: e.infoSec.etudiantId,
                    email: e.infoSec.email,
                    telephone: e.infoSec.telephone
                }))
            });
            
        } catch (error) {
            this.handleError(error, socket, 'auth:search-by-name');
        }
    }

    /**
     * Envoi email OTP
     */
    async sendOtpEmail(email, otp, etudiant) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                cc: 'inbtpkinshasa@gmail.com', // Ajout de l'adresse en copie
                subject: 'Code de connexion à l\'application étudiant',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
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
            };
            
            // Vous pouvez également ajouter des informations supplémentaires pour l'administrateur
            if (process.env.NODE_ENV !== 'production') {
                mailOptions.html += `
                    <div style="margin-top: 20px; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
                        <p><strong>Note pour l'administrateur:</strong> Ce message a été envoyé en mode développement.</p>
                        <p><strong>Détails:</strong></p>
                        <ul>
                            <li>Matricule: ${etudiant.infoSec.etudiantId}</li>
                            <li>OTP: ${otp}</li>
                            <li>Date: ${new Date().toLocaleString()}</li>
                        </ul>
                    </div>
                `;
            }
            
            await this.transporter.sendMail(mailOptions);
            console.log(`[EMAIL] OTP envoyé à ${email} (cc: inbtpkinshasa@gmail.com)`);
        } catch (error) {
            console.error(`[EMAIL ERROR] Envoi OTP à ${email}`, error);
            throw new Error('Erreur lors de l\'envoi de l\'email OTP');
        }
    }

    /**
     * Nettoie les données sensibles de l'étudiant
     */
    sanitizeEtudiantData(etudiant) {
        const etudiantObj = etudiant.toObject();
        
        // Supprimer les informations sensibles
        if (etudiantObj.infoSec) {
            delete etudiantObj.infoSec.password;
        }
        
        return etudiantObj;
    }

    /**
     * Nettoyage périodique
     */
    startCleanupTask() {
        setInterval(() => {
            const now = Date.now();
            
            // OTP expirés
            this.otpStore.forEach((value, key) => {
                if (now > value.expirationTime) {
                    this.otpStore.delete(key);
                }
            });
            
            // Sessions inactives (12h)
            const inactivityThreshold = now - (12 * 60 * 60 * 1000);
            this.connectedStudents.forEach((value, key) => {
                if (value.lastActivity < inactivityThreshold) {
                    this.connectedStudents.delete(key);
                }
            });
        }, 5 * 60 * 1000); // 5 minutes
    }

    /**
     * Vérifie si un étudiant est connecté
     */
    isStudentConnected(etudiantId) {
        return this.connectedStudents.has(etudiantId.toString());
    }

    /**
     * Vérifie si un socket est authentifié
     */
    isAuthenticated(socket) {
        return !!socket.etudiantId;
    }

    /**
     * Middleware d'authentification
     */
    requireAuth(socket, callback) {
        console.log('Vérification de l\'authentification du socket:',);
        if (this.isAuthenticated(socket)) {
            callback();
        } else {
            this.emitError(socket, 'error', 'Authentification requise');
        }
    }
}

module.exports = AuthSocket;