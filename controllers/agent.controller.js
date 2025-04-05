const Agent = require('../models/agent.model');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class AgentController {
    // Créer un agent
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
            const { email, telephone, matricule } = updateData;

            // Vérifier les doublons en excluant l'agent actuel
            if (email || telephone || matricule) {
                const existingAgent = await Agent.findOne({
                    _id: { $ne: id },
                    $or: [
                        ...(matricule ? [{ matricule }] : []),
                        ...(email ? [{ email: email.toLowerCase() }] : []),
                        ...(telephone ? [{ telephone }] : [])
                    ]
                });

                if (existingAgent) {
                    if (matricule && existingAgent.matricule === matricule) {
                        throw new Error("Ce matricule est déjà utilisé");
                    }
                    if (email && existingAgent.email === email.toLowerCase()) {
                        throw new Error("Cet email est déjà utilisé");
                    }
                    if (telephone && existingAgent.telephone === telephone) {
                        throw new Error("Ce numéro de téléphone est déjà utilisé");
                    }
                }
            }

            // Mise à jour avec conversion de la date si nécessaire
            if (updateData.dateNaissance) {
                updateData.dateNaissance = this._parseFrenchDate(updateData.dateNaissance);
            }

            return await Agent.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).select('-mdp');
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
}

module.exports = new AgentController();