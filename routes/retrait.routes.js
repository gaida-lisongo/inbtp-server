const express = require('express');
const router = express.Router();
const retraitController = require('../controllers/retrait.controller');

// Create new withdrawal
router.post('/add', async (req, res) => {
    try {
        const result = await retraitController.createRetrait({
            ...req.body
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get all withdrawals for an agent
router.post('/', async (req, res) => {
    try {
        const { type, ref } = req.body;
        if (!type || !ref) {
            return res.status(400).json({
                success: false,
                message: "Type and reference are required"
            });
        }
        console.log("Type:", type, "Ref:", ref);
        const retraits = await retraitController.listRetraits({ type, ref });
        res.json(retraits);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update withdrawal status
router.patch('/:ref/status', async (req, res) => {
    try {
        const result = await retraitController.updateRetraitStatus(
            req.user.id,
            req.params.ref,
            req.body.status
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// get all withdrawals for an agent
router.get('/agent/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;

        const retraits = await retraitController.getStats(agentId);
        console.log("Retraits:", retraits);
        
        if (!retraits) {
            return res.status(404).json({
                success: false,
                message: "No withdrawals found for this agent"
            });
        }
        res.json(retraits);

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
        
    }
})

module.exports = router;