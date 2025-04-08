const Section = require('../models/section.model');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class SectionController {
    // Créer une section avec les champs de base
    async createSection(sectionData) {
        try {
            const { titre, description, url, email, telephone } = sectionData;

            // Validation des champs requis
            if (!titre || !url || !email) {
                throw new Error("Le titre, l'url et l'email sont obligatoires");
            }

            const nouvelleSection = new Section({
                titre,
                description,
                url,
                email,
                telephone
            });

            return await nouvelleSection.save();
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
                        // Ne prendre que les champs de base
                        const formattedData = {
                            titre: data.titre,
                            description: data.description,
                            url: data.url,
                            email: data.e_mail, // Notez le changement ici pour matcher le CSV
                            telephone: data.telephone
                        };
                        results.push(formattedData);
                    })
                    .on('end', async () => {
                        try {
                            const sections = await Promise.all(
                                results.map(row => this.createSection(row))
                            );
                            resolve({
                                success: true,
                                count: sections.length,
                                data: sections
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

    // Lister les sections
    async listSections(query = {}) {
        try {
            return await Section.find(query);
        } catch (error) {
            throw error;
        }
    }

    // Obtenir une section par ID
    async getSectionById(id) {
        try {
            return await Section.findById(id);
        } catch (error) {
            throw error;
        }
    }

    // Mettre à jour les informations de base d'une section
    async updateSection(id, updateData) {
        try {
            // Ne permettre que la mise à jour des champs de base
            const { titre, description, url, email, telephone } = updateData;
            
            return await Section.findByIdAndUpdate(
                id,
                { titre, description, url, email, telephone },
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw error;
        }
    }

    // Supprimer une section
    async deleteSection(id) {
        try {
            return await Section.findByIdAndDelete(id);
        } catch (error) {
            throw error;
        }
    }

    // Ajouter un bureau à une section
    async addBureau(sectionId, bureauData) {
        try {
            const { fonction, agentId } = bureauData;
            console.log('Bureau Data:', bureauData);
            if (!fonction || !agentId) {
                throw new Error("La fonction et l'agent sont requis");
            }

            const section = await Section.findById(sectionId);
            if (!section) {
                throw new Error("Section non trouvée");
            }

            // Vérifier si l'agent n'est pas déjà dans le bureau
            const bureauExistant = section.bureaux.find(
                b => b.agentId.toString() === agentId
            );
            
            if (bureauExistant) {
                throw new Error("Cet agent fait déjà partie du bureau");
            }

            section.bureaux.push({ grade: fonction, agentId: agentId });
            await section.save();

            return await Section.findById(sectionId)
                .populate('bureaux.agent', 'nom prenom email -_id');
        } catch (error) {
            throw error;
        }
    }

    // Retirer un membre du bureau
    async removeBureau(sectionId, bureauId) {
        try {
            const section = await Section.findById(sectionId);
            if (!section) {
                throw new Error("Section non trouvée");
            }

            section.bureaux = section.bureaux.filter(
                bureau => bureau._id.toString() !== bureauId
            );

            await section.save();
            return section;
        } catch (error) {
            throw error;
        }
    }

    // Modifier un membre du bureau
    async updateBureau(sectionId, bureauId, updateData) {
        try {
            const section = await Section.findById(sectionId);
            if (!section) {
                throw new Error("Section non trouvée");
            }

            const bureauIndex = section.bureaux.findIndex(
                bureau => bureau._id.toString() === bureauId
            );

            if (bureauIndex === -1) {
                throw new Error("Membre du bureau non trouvé");
            }

            // Mise à jour des champs du bureau
            Object.assign(section.bureaux[bureauIndex], updateData);
            await section.save();

            return await Section.findById(sectionId)
                .populate('bureaux.agent', 'nom prenom email -_id');
        } catch (error) {
            throw error;
        }
    }

    // Lister les membres du bureau d'une section
    async listBureaux(sectionId) {
        try {
            return await Section.findById(sectionId)
                .populate('bureaux.agent', 'nom prenom email -_id')
                .select('bureaux');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Récupère toutes les sections où un agent est membre
     * @param {string} agentId - ID de l'agent
     * @returns {Promise<Array>} - Liste des sections avec le rôle de l'agent
     */
    async getAgentSections(agentId) {
        try {
            if (!agentId) {
                throw new Error("ID de l'agent requis");
            }

            // Rechercher dans le cache d'abord
            const cachedSections = await cache.get(`agent:${agentId}:sections`);
            if (cachedSections) {
                console.log("Sections trouvées dans le cache");
                return cachedSections;
            }

            console.log("Cache vide, recherche dans la base de données");
            
            // Rechercher toutes les sections où l'agent apparaît dans les bureaux
            const sections = await Section.find({
                'bureaux.agent': agentId
            }).select('designation code bureaux');

            // Si aucune section trouvée, retourner un tableau vide
            if (!sections || sections.length === 0) {
                console.log("Aucune section trouvée pour cet agent");
                // Mettre en cache le tableau vide pour éviter des requêtes répétées
                await cache.set(`agent:${agentId}:sections`, [], 300);
                return [];
            }

            // Formatter les résultats pour inclure le rôle de l'agent dans chaque section
            const formattedSections = sections.map(section => {
                const bureau = section.bureaux.find(b => 
                    b.agent.toString() === agentId.toString()
                );
                
                if (!bureau) return null; // Skip si le bureau n'est pas trouvé

                return {
                    sectionId: section._id,
                    designation: section.designation,
                    code: section.code,
                    role: bureau.role || 'Membre',
                    dateDebut: bureau.dateDebut || new Date()
                };
            }).filter(Boolean); // Enlever les résultats null

            // Mettre en cache pour 5 minutes
            await cache.set(`agent:${agentId}:sections`, formattedSections, 300);

            return formattedSections;

        } catch (error) {
            console.error("Erreur dans getAgentSections:", error);
            return []; // Retourner un tableau vide en cas d'erreur
        }
    }
    
}

module.exports = new SectionController();