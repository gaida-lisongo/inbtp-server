const express = require('express');
const router = express.Router();
const etudiantController = require('../controllers/etudiant.controller');
const Etudiant = require('../models/etudiant.model');
const Transaction = require('../models/transaction.model');
const mail = require('../utils/mail');
const cache = require('../utils/cache');
const jwt = require('jsonwebtoken');
const { paymentService } = require('../utils/flexpay');

// Créer un étudiant
router.post('/', async (req, res) => {
    try {
        const etudiant = await etudiantController.createEtudiant(req.body);
        res.status(201).json({
            success: true,
            message: "Étudiant créé avec succès",
            data: etudiant
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Importer des étudiants depuis CSV
router.post('/import', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: "Nom du fichier requis"
            });
        }

        const result = await etudiantController.importEtudiants(fileName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Lister tous les étudiants avec filtres optionnels
router.post('/find', async (req, res) => {
    console.log("Request body:", req.body);
    try {
        const etudiants = await etudiantController.listEtudiants(req.body);
        res.json({
            success: true,
            count: etudiants.length,
            data: etudiants
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un étudiant par ID
router.get('/:id', async (req, res) => {
    try {
        const etudiant = await etudiantController.getEtudiantById(req.params.id);
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            data: etudiant
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer un étudiant avec toutes ses transactions
router.get('/:etudiantId/transactions', async (req, res) => {
    try {

        // Récupérer les informations de l'étudiant
        const etudiant = await Etudiant.findById(req.params.etudiantId)
            .select('infoPerso.nom infoPerso.postNom infoPerso.preNom infoSec.etudiantId infoSec.email')
            .lean();

        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: 'Étudiant non trouvé'
            });
        }

        // Récupérer les transactions de l'étudiant
        const transaction = await Transaction.findOne({ 
            etudiantId: req.params.etudiantId 
        })
        .lean();

        // Préparer la réponse avec les données combinées
        const response = {
            etudiant: {
                _id: etudiant._id,
                nom: etudiant.infoPerso.nom,
                postNom: etudiant.infoPerso.postNom,
                preNom: etudiant.infoPerso.preNom,
                matricule: etudiant.infoSec.etudiantId,
                email: etudiant.infoSec.email
            },
            finances: transaction ? {
                solde: transaction.solde,
                fraisAcad: transaction.fraisAcad,
                totalDepense: transaction.commandes.reduce((sum, cmd) => sum + cmd.montant, 0),
                totalRecharge: transaction.recharges
                    .filter(r => r.statut === 'completed')
                    .reduce((sum, r) => sum + r.montant, 0),
                commandes: transaction.commandes.sort((a, b) => 
                    new Date(b.date_created) - new Date(a.date_created)
                ).slice(0, 10), // dernières 10 commandes
                recharges: transaction.recharges.sort((a, b) => 
                    new Date(b.date_created) - new Date(a.date_created)
                ).slice(0, 10)  // dernières 10 recharges
            } : {
                solde: 0,
                fraisAcad: 0,
                totalDepense: 0,
                totalRecharge: 0,
                commandes: [],
                recharges: []
            }
        };

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error fetching student transactions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mettre à jour un étudiant
router.put('/:id', async (req, res) => {
    try {
        console.log("Updating student with ID:", req.params.id);
        console.log("Request body:", req.body);
        
        const etudiant = await etudiantController.updateEtudiant(
            req.params.id,
            req.body
        );
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            message: "Étudiant modifié avec succès",
            data: etudiant
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Supprimer un étudiant
router.delete('/:id', async (req, res) => {
    try {
        const etudiant = await etudiantController.deleteEtudiant(req.params.id);
        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }
        res.json({
            success: true,
            message: "Étudiant supprimé avec succès"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Récupérer les commandes par promotion et produit
router.post('/commandes/product/:promotion', async (req, res) => {
    try {
        const { promotion } = req.params;
        const { product } = req.body;

        const commandes = await etudiantController.getCommandesByProduit(
            promotion,
            product
        );

        res.json({
            success: true,
            count: commandes.length,
            data: commandes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtenir un étudiant par matricule
router.get('/matricule/:matricule', async (req, res) => {
    try {
        const cacheKey = `etudiant:matricule:${req.params.matricule}`;
        const cached = await cache.get(cacheKey);

        if (cached) {
            return res.json({
                success: true,
                data: cached,
                fromCache: true
            });
        }

        const etudiant = await Etudiant.findOne({ 
            'infoSec.etudiantId': req.params.matricule 
        }).lean();

        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Aucun étudiant trouvé avec ce matricule"
            });
        }

        await cache.set(cacheKey, etudiant, 3600); // Cache pour 1 heure

        res.json({
            success: true,
            data: etudiant
        });
    } catch (error) {
        console.error('Error fetching student by matricule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generer OTP 
router.get('/otp/:etudiantId', async (req, res) => {
    try {
        const etudiantId = req.params.etudiantId;
        const etudiant = await Etudiant.findById(etudiantId).lean();

        //Delete in cache if exists
        await cache.delete(`otp:${etudiantId}`);

        if (!etudiant) {
            return res.status(404).json({
                success: false,
                error: "Étudiant non trouvé"
            });
        }

        // const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Générer un OTP à 6 chiffres
        // OTP with 4 digits 
        const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Générer un OTP à 4 chiffres
        const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes à partir de maintenant
        const otpData = new Map();

        cache.set(`otp:${etudiantId}`, otp, 600); // Cache pour 10 minutes
        console.log("Generated OTP:", otp, "for student ID:", etudiantId);

        await mail.otpEtudiant(
            etudiant,
            otp,
        )

        return res.json({
            success: true,
            message: "OTP envoyé avec succès",
            data: {
                etudiantId: etudiantId,
                expirationTime: expirationTime
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vérifier OTP
router.post('/otp', async (req, res) => {
    try {
        const { etudiantId, otp } = req.body;
        const cachedOtp = await cache.get(`otp:${etudiantId}`);

        if (!cachedOtp) {
            return res.status(400).json({
                success: false,
                error: "OTP invalide ou expiré"
            });
        }

        if (cachedOtp !== otp) {
            return res.status(400).json({
                success: false,
                error: "OTP incorrect"
            });
        }

        // Invalider le cache de l'OTP après vérification
        await cache.delete(`otp:${etudiantId}`);
        const token = jwt.sign(
            {
                etudiantId: etudiantId,
                role: "etudiant"
            },
            process.env.JWT_SECRET || 'secret-key',
            {
                expiresIn: '8h'
            }
        )

        res.json({
            success: true,
            message: "OTP vérifié avec succès",
            data: {
                token: token
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/add-recharge/:etudiantId',
    async (req, res) => {
        const { etudiantId } = req.params;
        const { phone, amount, ref, description, currency } = req.body;
        try {
            const paymentResponse = await paymentService.collect({
                phone,
                amount,
                ref,
                description: `Recharge de ${amount} FC sur le compte de l'étudiant ${etudiantId}: libellé ${description}`,
                currency
            });

            if (!paymentResponse || !paymentResponse.orderNumber) {
                throw new Error('Échec de l\'initiation du paiement: ' + (paymentResponse?.message || 'Erreur inconnue'));
            }

            let newRecharge = {
                montant: amount,
                ref: paymentResponse.orderNumber,
                statut: 'pending',
                description: description,
                title: `RECH-${ref}-${etudiantId}`,
                monnaie: currency,
            }

            const transaction = await Transaction.findOneAndUpdate(
                { etudiantId: etudiantId },
                { $push: { recharges: newRecharge } },
                { new: true, upsert: true }
            ).select('recharges solde');

            console.log("Transaction after update:", transaction);
            if (!transaction) {
                throw new Error('Échec de la mise à jour de la transaction');
            }

            return res.json({
                success: true,
                message: "Recharge initiée avec succès",
                data: transaction
            });

        } catch (error) {
            console.error('Error initiating recharge:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
)
module.exports = router;