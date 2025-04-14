const express = require('express');
const router = express.Router();
const etudiantController = require('../controllers/etudiant.controller');
const Etudiant = require('../models/etudiant.model');
const Transaction = require('../models/transaction.model');
const Travail = require('../models/travaux.model');
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
);

// Vérifier le statut de la recharge
router.get('/recharge-status/:etudiantId/:ref', async (req, res) => {
    const { etudiantId, ref } = req.params;
    console.log("Checking recharge status for ref:", ref, "and student ID:", etudiantId);
    try {
        // vérifier si le statut de la recharge depuis l'API de paiement
        const paymentStatus = await paymentService.check({orderNumber: ref});
        console.log("Payment status response:", paymentStatus);
        // Si le paiement est confirmé comme réussi
        if (paymentStatus.status == 0) {
            console.log('Paiement réussi pour la commande:', paymentStatus.transaction);
            // Mettre à jour le statut de la recharge et le solde de l'étudiant
            const newSolde = paymentStatus.currency === 'CDF' ? paymentStatus.amount : paymentStatus.amount * 2850; // Exemple de conversion, ajuster selon le taux de change réel
            const transactions = await Transaction.findOneAndUpdate(
                { etudiantId: etudiantId, 'recharges.ref': ref },
                {
                    $set: {
                        'recharges.$.statut': 'completed'
                    },
                    $inc: {
                        solde: newSolde,
                    }
                },
                { new: true }
            ).select('recharges solde');

            console.log("Transaction après mise à jour:", transactions);
            if (!transactions) {
                return res.status(404).json({
                    success: false,
                    error: "Recharge non trouvée"
                });
            }

            return res.json({
                success: true,
                message: "Recharge réussie",
                data: transactions
            });
        } else {
            // Si nous avons atteint le nombre maximal de tentatives, marquer comme expiré
            return res.json({
                success: false,
                message: "Recharge échouée",
                data: paymentStatus
            });
        }

        // const transaction = await Transaction.findOne({
        //     etudiantId: etudiantId,
        //     'recharges.ref': ref
        // }).select('recharges solde');

        // if (!transaction) {
        //     return res.status(404).json({
        //         success: false,
        //         error: "Recharge non trouvée"
        //     });
        // }

        // const recharge = transaction.recharges.find(r => r.ref === ref);
        // if (!recharge) {
        //     return res.status(404).json({
        //         success: false,
        //         error: "Recharge non trouvée"
        //     });
        // }

        // return res.json({
        //     success: true,
        //     message: "Statut de la recharge récupéré avec succès",
        //     data: recharge
        // });

    } catch (error) {
        console.error('Error fetching recharge status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/recharge/:etudiantId/:ref', async (req, res) => {
    const { etudiantId, ref } = req.params;
    try {
        // Supprimer la recharge de la base de données
        const transaction = await Transaction.findOneAndUpdate(
            { etudiantId: etudiantId },
            { $pull: { recharges: { ref: ref } } },
            { new: true }
        ).select('recharges solde');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: "Recharge non trouvée"
            });
        }

        return res.json({
            success: true,
            message: "Recharge supprimée avec succès",
            data: transaction
        });

    } catch (error) {
        console.error('Error deleting recharge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

//Débit solde étudiant pour commande
router.put('/add-commande/:etudiantId', async (req, res) => {
    const { etudiantId } = req.params;
    const { 
        montant, 
        ref,
        _id,
        isTravail,
        isBulletin,
        isEnrollement,
        anneeId,
        description,
        title
    } = req.body;
    
    console.log("Débit solde étudiant pour commande:", etudiantId, "Montant:", montant, "Référence:", ref, "ID produit:", _id);
    console.log("Détails de la commande:", req.body);
    try {
        // 1. Vérifier d'abord le solde actuel
        const currentTransaction = await Transaction.findOne({ etudiantId })
            .select('solde')
            .lean();

        if (!currentTransaction || currentTransaction.solde < montant) {
            return res.status(400).json({
                success: false,
                error: "Solde insuffisant"
            });
        }

        // 2. Créer l'objet commande selon le schéma
        const newCommand = {
            date_created: new Date(),
            statut: 'completed',
            montant,
            ref: ref || `CMD-${Date.now()}-${etudiantId.substring(0, 6)}`,
            description: description || (isTravail ? "Achat d'un travail" : isBulletin ? "Achat d'un bulletin" : "Achat d'un service"),
            title: title || (isTravail ? "Travail" : isBulletin ? "Bulletin" : "Service"),
            monnaie: 'FC',
            product: _id // Assurer qu'on stocke une référence valide
        };

        // 3. Mise à jour atomique: débit du solde et ajout de la commande
        const transaction = await Transaction.findOneAndUpdate(
            { etudiantId },
            { 
                $inc: { solde: -montant },
                $push: { 
                    commandes: {
                        $each: [newCommand],
                        $position: 0 // Placer en première position pour un accès rapide
                    }
                }
            },
            { 
                new: true,
                select: 'commandes solde', // Limiter les champs retournés
                runValidators: true // Valider les données selon le schéma
            }
        );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: "Transaction non trouvée pour cet étudiant"
            });
        }

        // 4. Invalidation du cache pour cet étudiant
        await cache.delete(`etudiant:${etudiantId}:finances`);
        
        let updateResult = null;
        const itemId = _id; // Utiliser l'ID fourni pour la mise à jour

        // 5. Mise à jour des actifs de l'étudiant en fonction du type d'achat
        if (anneeId && itemId) {
            // Déterminer le type d'actif à mettre à jour
            let updateField;
            
            if (isTravail) updateField = 'travaux';
            else if (isBulletin) updateField = 'bulletins';
            else if (isEnrollement) updateField = 'enrollments';
            
            if (updateField) {
                // Mise à jour ciblée pour l'année académique spécifique
                updateResult = await Etudiant.findOneAndUpdate(
                    { 
                        _id: etudiantId, 
                        'infoAcad.anneeId': anneeId
                    },
                    { 
                        $addToSet: { 
                            [`infoAcad.$.actifs.${updateField}`]: itemId 
                        } 
                    },
                    { new: true }
                ).select('infoAcad');
                
                // Si aucune correspondance exacte pour l'année n'est trouvée
                if (!updateResult) {
                    // Fallback: tenter de mettre à jour via les méthodes du modèle
                    const etudiant = await Etudiant.findById(etudiantId);
                    if (etudiant) {
                        etudiant.addActif(anneeId, updateField, itemId);
                        await etudiant.save();
                        updateResult = etudiant;
                    }
                }
            }
        }

        // 6. Si achat de travail, mettre à jour le statut
        if (isTravail && itemId) {
            await Travail.findByIdAndUpdate(
                itemId,
                { $set: { statut: 'EN COURS' } }
            );
        }

        return res.json({
            success: true,
            message: "Commande effectuée avec succès",
            data: {
                transaction: {
                    _id: transaction._id,
                    solde: transaction.solde,
                    commande: newCommand
                },
                actifsMisAJour: updateResult ? true : false
            }
        });

    } catch (error) {
        console.error('Erreur lors du débit du solde étudiant:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;