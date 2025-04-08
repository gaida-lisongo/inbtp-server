const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');

// Créer un agent
router.post('/create', async (req, res) => {
    try {
        const agent = await agentController.createAgent(req.body);
        res.status(201).json({
            success: true,
            message: "Agent créé avec succès",
            data: agent
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des agents depuis un fichier CSV
router.post('/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        console.log('Current', fileName)
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await agentController.createFromCSV(fileName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister tous les agents
router.get('/', async (req, res) => {
    try {
        const { type, search } = req.query;
        let query = {};

        // Filtrage par type d'agent
        if (type) {
            query.typeAgent = type;
        }

        // Recherche par nom, prénom ou matricule
        if (search) {
            query = {
                ...query,
                $or: [
                    { nom: new RegExp(search, 'i') },
                    { prenom: new RegExp(search, 'i') },
                    { matricule: new RegExp(search, 'i') }
                ]
            };
        }

        const agents = await agentController.listAgents(query);
        res.json({
            success: true,
            count: agents.length,
            data: agents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un agent par ID
router.get('/:id', async (req, res) => {
    try {
        const agent = await agentController.getAgentById(req.params.id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: "Agent non trouvé"
            });
        }
        res.json({
            success: true,
            data: agent
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modifier un agent
router.put('/:id', async (req, res) => {
    try {
        const agentModifie = await agentController.updateAgent(req.params.id, req.body);
        if (!agentModifie) {
            return res.status(404).json({
                success: false,
                error: "Agent non trouvé"
            });
        }
        res.json({
            success: true,
            message: "Agent modifié avec succès",
            data: agentModifie
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un agent
router.delete('/:id', async (req, res) => {
    try {
        const agentSupprime = await agentController.deleteAgent(req.params.id);
        
        if (!agentSupprime) {
            return res.status(404).json({
                success: false,
                error: "Agent non trouvé"
            });
        }

        res.json({
            success: true,
            message: "Agent supprimé avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    console.log('Login', req.body)
    try {
        const { matricule } = req.body;
        console.log('Login', req.body)
        if (!matricule ) {
            return res.status(400).json({
                success: false,
                error: "Matricule requis"
            });
        }

        const response = await agentController.initiateAuth({matricule});
        
        if (!response) {
            return res.status(401).json({
                success: false,
                error: "Identifiants invalides"
            });
        }

        res.json({
            success: true,
            message: "Connexion réussie",
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/verify', async (req, res) => {
    try {
        const { id, otp } = req.body;
        console.log('Verify', req.body)

        if (!id || !otp) {
            return res.status(400).json({
                success: false,
                error: "Matricule et code requis"
            });
        }
        const agentId = id;

        const response = await agentController.verifyOTP(agentId, otp);
        
        if (!response) {
            return res.status(401).json({
                success: false,
                error: "Identifiants invalides"
            });
        }

        res.json({
            success: true,
            message: "Vérification réussie",
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;