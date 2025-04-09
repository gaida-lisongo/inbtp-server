router.post('/', async (req, res) => {
    try {
        // Create initial travail without questions
        const travail = new Travail({
            titre: req.body.titre,
            description: req.body.description,
            date_fin: req.body.date_fin,
            montant: req.body.montant,
            matiereId: req.body.matiereId,
            auteurId: req.body.auteurId,
            statut: req.body.statut || 'EN ATTENTE',
            questions: [] // Initialize with empty array
        });

        await travail.save();

        // If type is provided, create initial question
        if (req.body.type) {
            const initialQuestion = {
                enonce: "Question initiale",
                type: req.body.type,
                choix: req.body.type === 'QCM' ? ["Option 1"] : [],
                reponse: ""
            };

            travail.questions.push(initialQuestion);
            await travail.save();
        }

        res.status(201).json({
            success: true,
            message: 'Travail créé avec succès',
            data: travail
        });

    } catch (error) {
        console.error('Erreur création travail:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});