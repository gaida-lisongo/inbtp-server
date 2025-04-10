const Agent = require('../models/agent.model');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cache = require('../utils/cache');

class AgentController {
    constructor() {
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
    }

    async createAgent(agentData) {
        try {
            const {
                nom, postnom, prenom, email, telephone,
                dateNaissance, adresse, matricule,
                lieuNaissance, nationalite, typeAgent, mdp
            } = agentData;

            // Validation des champs requis
            if (!nom || !matricule) {
                throw new Error("Le nom et le matricule sont obligatoires");
            }

            // Vérification des doublons
            const existingAgent = await Agent.findOne({
                $or: [
                    { matricule },
                    ...(email ? [{ email: email.toLowerCase() }] : []),
                    ...(telephone ? [{ telephone }] : [])
                ]
            });

            if (existingAgent) {
                if (existingAgent.matricule === matricule) {
                    throw new Error("Ce matricule est déjà utilisé");
                } else if (email && existingAgent.email === email.toLowerCase()) {
                    throw new Error("Cet email est déjà utilisé");
                } else if (telephone && existingAgent.telephone === telephone) {
                    throw new Error("Ce numéro de téléphone est déjà utilisé");
                }
            }

            const nouvelAgent = new Agent({
                nom,
                postnom,
                prenom,
                ...(email && { email: email.toLowerCase() }),
                ...(telephone && { telephone }),
                dateNaissance: this._parseFrenchDate(dateNaissance),
                adresse,
                matricule,
                lieuNaissance,
                nationalite,
                typeAgent,
                mdp: mdp || 'b2b2f104d32c638903e151a9b20d6e27b41d8c0c84cf8458738f83ca2f1dd892'
            });

            return await nouvelAgent.save();
        } catch (error) {
            throw error;
        }
    }

    // Importer depuis CSV
    async createFromCSV(fileName) {
        try {
            const results = [];
            const filePath = path.join(__dirname, '../assets', fileName);

            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({
                        separator: ';',
                        mapHeaders: ({ header }) => header.trim(),
                        mapValues: ({ value }) => value.trim()
                    }))
                    .on('data', (data) => {
                        const formattedData = {
                            nom: data.nom,
                            postnom: data.postnom,
                            prenom: data.prenom,
                            email: data.email,
                            telephone: data.telephone,
                            dateNaissance: data.dateNaissance,
                            adresse: data.adresse,
                            matricule: data.matricule,
                            lieuNaissance: data.lieuNaissance,
                            nationalite: data.nationalite,
                            typeAgent: data.typeAgent,
                            mdp: data.mdp
                        };
                        results.push(formattedData);
                    })
                    .on('end', async () => {
                        try {
                            const agents = await Promise.all(
                                results.map(row => this.createAgent(row))
                            );
                            resolve({
                                success: true,
                                count: agents.length,
                                data: agents
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => reject(error));
            });
        } catch (error) {
            throw error;
        }
    }

    // Lister les agents avec filtres
    async listAgents(query = {}) {
        try {
            return await Agent.find(query).select('-mdp');
        } catch (error) {
            throw error;
        }
    }

    // Obtenir un agent par ID
    async getAgentById(id) {
        try {
            return await Agent.findById(id).select('-mdp');
        } catch (error) {
            throw error;
        }
    }

    // Mettre à jour un agent
    async updateAgent(id, updateData) {
        try {
            // Supprimer matricule des données de mise à jour pour empêcher sa modification
            const { matricule, ...allowedUpdates } = updateData;

            // Vérifier les doublons pour email et téléphone
            if (allowedUpdates.email || allowedUpdates.telephone) {
                const existingAgent = await Agent.findOne({
                    _id: { $ne: id },
                    $or: [
                        ...(allowedUpdates.email ? [{ email: allowedUpdates.email.toLowerCase() }] : []),
                        ...(allowedUpdates.telephone ? [{ telephone: allowedUpdates.telephone }] : [])
                    ]
                });

                if (existingAgent) {
                    if (allowedUpdates.email && existingAgent.email === allowedUpdates.email.toLowerCase()) {
                        throw new Error("Cet email est déjà utilisé");
                    }
                    if (allowedUpdates.telephone && existingAgent.telephone === allowedUpdates.telephone) {
                        throw new Error("Ce numéro de téléphone est déjà utilisé");
                    }
                }
            }

            // Normalisation des données
            if (allowedUpdates.email) {
                allowedUpdates.email = allowedUpdates.email.toLowerCase();
            }

            // Conversion de la date de naissance si fournie
            if (allowedUpdates.dateNaissance) {
                allowedUpdates.dateNaissance = this._parseFrenchDate(allowedUpdates.dateNaissance);
            }

            // Validation des champs obligatoires
            if (!allowedUpdates.nom) {
                throw new Error("Le nom est obligatoire");
            }

            // Liste des champs modifiables
            const updatableFields = [
                'nom',
                'prenom',
                'postnom',
                'email',
                'telephone',
                'dateNaissance',
                'adresse',
                'lieuNaissance',
                'nationalite',
                'typeAgent',
                'sexe',
                'grade',
                'avatar'
            ];

            // Filtrer pour ne garder que les champs modifiables
            const filteredUpdates = Object.keys(allowedUpdates)
                .filter(key => updatableFields.includes(key))
                .reduce((obj, key) => {
                    obj[key] = allowedUpdates[key];
                    return obj;
                }, {});

            // Effectuer la mise à jour
            const updatedAgent = await Agent.findByIdAndUpdate(
                id,
                filteredUpdates,
                { 
                    new: true, 
                    runValidators: true,
                    select: '-mdp' // Exclure le mot de passe de la réponse
                }
            );

            if (!updatedAgent) {
                throw new Error("Agent non trouvé");
            }

            // Invalider le cache si nécessaire
            await cache.delete(`agent:${id}:profile`);

            return {
                success: true,
                message: "Informations mises à jour avec succès",
                agent: updatedAgent
            };

        } catch (error) {
            throw error;
        }
    }

    // Supprimer un agent
    async deleteAgent(id) {
        try {
            return await Agent.findByIdAndDelete(id);
        } catch (error) {
            throw error;
        }
    }

    // Helper pour parser les dates françaises
    _parseFrenchDate(dateStr) {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    }

    /**
     * Authentifie un agent avec email et mot de passe
     */
    async authenticateAgent(credentials) {
        try {
            const { matricule, password } = credentials;
            console.log('Authentification', { matricule, password });
            // Validation des champs requis
            if (!matricule || !password) {
                throw new Error('Matricule et mot de passe requis');
            }

            // Rechercher l'agent par email
            const agent = await Agent.findOne({ matricule: matricule });
            if (!agent) {
                throw new Error('Email ou mot de passe incorrect');
            }
            console.log('Agent trouvé:', agent);
            // Hasher le mot de passe fourni pour comparaison
            const hashedPassword = crypto
                .createHash('sha256')
                .update(password)
                .digest('hex');
            console.log('Mot de passe hashé:', hashedPassword);
            // Vérifier le mot de passe
            if (hashedPassword !== agent.mdp) {
                throw new Error('Matrcule ou mot de passe incorrect');
            }

            // Générer le token JWT
            const token = jwt.sign(
                {
                    id: agent._id,
                    email: agent.email,
                    typeAgent: agent.typeAgent
                },
                process.env.JWT_SECRET_KEY,
                { expiresIn: '24h' }
            );

            // Retourner les informations nécessaires
            return {
                success: true,
                token,
                agent: {
                    id: agent._id,
                    nom: agent.nom,
                    prenom: agent.prenom,
                    postnom: agent.postnom,
                    email: agent.email,
                    typeAgent: agent.typeAgent,
                    avatar: agent.avatar || (agent.sexe === 'F' ? process.env.AGENT_F : process.env.AGENT_M),
                    telephone: agent.telephone,
                    matricule: agent.matricule
                }
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Change le mot de passe d'un agent
     */
    async changePassword(agentId, { currentPassword, newPassword }) {
        try {
            // Trouver l'agent
            const agent = await Agent.findById(agentId);
            if (!agent) {
                throw new Error('Agent non trouvé');
            }

            // Hasher l'ancien mot de passe pour comparaison
            const hashedCurrentPassword = crypto
                .createHash('sha256')
                .update(currentPassword)
                .digest('hex');

            // Vérifier l'ancien mot de passe
            if (hashedCurrentPassword !== agent.mdp) {
                throw new Error('Mot de passe actuel incorrect');
            }

            // Hasher le nouveau mot de passe
            const hashedNewPassword = crypto
                .createHash('sha256')
                .update(newPassword)
                .digest('hex');

            // Mettre à jour le mot de passe
            agent.mdp = hashedNewPassword;
            await agent.save();

            return {
                success: true,
                message: 'Mot de passe modifié avec succès'
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Initie l'authentification d'un agent avec matricule et envoi d'OTP
     */
    async initiateAuth(credentials) {
        try {
            const { matricule } = credentials;

            // Validation du matricule
            if (!matricule) {
                throw new Error('Matricule requis');
            }

            // Rechercher l'agent
            const agent = await Agent.findOne({ matricule });
            if (!agent) {
                throw new Error('Aucun agent trouvé avec ce matricule');
            }

            if (!agent.email) {
                throw new Error('Cet agent n\'a pas d\'email enregistré');
            }

            // Générer l'OTP (6 chiffres)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Stocker l'OTP dans le cache avec une expiration de 5 minutes
            await cache.set(`agent:${agent._id}:otp`, otp, 3600);

            // Envoyer l'email avec l'OTP
            this.sendOtpEmail(agent.email, otp, agent);

            return {
                success: true,
                message: 'Code de vérification envoyé par email',
                agentId: agent._id
            };

        } catch (error) {
            throw error;
        }
    }

    async sendOtpEmail(email, otp, agent) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                cc: 'inbtpkinshasa@gmail.com', // Ajout de l'adresse en copie
                subject: 'Code de connexion',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                        <h2 style="color: #2c3e50; text-align: center;">Connexion à l'application étudiant</h2>
                        <p>Bonjour <strong>${agent.prenom} ${agent.nom} ${agent.postnom}</strong>,</p>
                        <p>Votre code de connexion est :</p>
                        <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p>Ce code est valable pendant 1 heures.</p>
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
                            <li>Matricule: ${agent.matricule}</li>
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
     * Vérifie l'OTP et authentifie l'agent
     */
    async verifyOTP(agentId, otp) {
        console.log('Vérification OTP', { agentId, otp });
        try {
            // Validation des entrées
            if (!agentId || !otp) {
                throw new Error('ID agent et OTP requis');
            }

            // Récupérer l'OTP stocké
            const storedOTP = await cache.get(`agent:${agentId}:otp`);
            console.log('OTP stocké:', storedOTP);
            if (!storedOTP) {
                throw new Error('Code expiré ou invalide');
            }

            // Vérifier l'OTP
            if (otp != storedOTP) {
                throw new Error('Code incorrect');
            }

            // Rechercher l'agent
            const agent = await Agent.findById(agentId);
            if (!agent) {
                throw new Error('Agent non trouvé');
            }

            // Supprimer l'OTP du cache après utilisation
            await cache.delete(`agent:${agentId}:otp`);

            // Générer le token JWT
            const token = jwt.sign(
                {
                    id: agent._id,
                    email: agent.email,
                    typeAgent: agent.typeAgent
                },
                process.env.JWT_SECRET_KEY,
                { expiresIn: '24h' }
            );

            // Retourner les informations nécessaires
            return {
                success: true,
                token,
                agent: {
                    id: agent._id,
                    nom: agent.nom,
                    prenom: agent.prenom,
                    postnom: agent.postnom,
                    email: agent.email,
                    typeAgent: agent.typeAgent,
                    avatar: agent.avatar || (agent.sexe === 'F' ? process.env.AGENT_F : process.env.AGENT_M),
                    telephone: agent.telephone,
                    matricule: agent.matricule,
                    dateNaissance: agent.dateNaissance,
                    lieuNaissance: agent.lieuNaissance,
                    nationalite: agent.nationalite,
                    adresse: agent.adresse
                }
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new AgentController();