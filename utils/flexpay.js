require("dotenv").config();

// Récupération des variables d'environnement
const FLEXPAY_TOKEN = process.env.FLEXPAY_TOKEN;
const FLEXPAY_API = process.env.FLEXPAY_API || "https://api.flexpay.cd";
const MERCHANT = process.env.MERCHANT || "INBTP";

const API_HEADERS = {
  'Authorization': `Bearer ${FLEXPAY_TOKEN}`,
  'Content-Type': 'application/json'
};

// Utilisation de module.exports au lieu de export (syntaxe CommonJS)
const paymentService = {
  collect: async ({ phone, amount, ref, description, currency = 'CDF' }) => {
    try {
      console.log(`Initialisation du paiement: ${amount} ${currency} depuis ${phone}, référence: ${ref}`);
      console.log(`URL API: ${FLEXPAY_API}/paymentService`);
      const payload = {
        merchant: MERCHANT,
        type: '1',
        phone: phone,
        reference: ref,
        amount: amount,
        description: description || `Recharge compte INBTP`,
        currency: currency || 'CDF',
        callbackUrl: `https://inbtp.net/api/payment/response`
      };
      
      console.log("Payload:", JSON.stringify(payload));
      
      const response = await fetch(`${FLEXPAY_API}/paymentService`, {
        method: 'POST',
        headers:     API_HEADERS,
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log("Réponse API:", data);
      
      return data;
    } catch (error) {
      console.error("Erreur lors de l'initialisation du paiement:", error);
      throw error;
    }
  },

  check: async ({orderNumber}) => {
    try {
      console.log(`Vérification du statut pour la commande: ${orderNumber}`);
      
      const request = await fetch(`${FLEXPAY_API}/check/${orderNumber}`, {
        headers: API_HEADERS
      });
      
      const data = await request.json();
      console.log(`Statut de la commande ${orderNumber}:`, data);
      const {message, transaction } = data;

      const response = {
        ...transaction,
        message: message
      };
      
      return response;
    } catch (error) {
      console.error(`Erreur lors de la vérification du statut de la commande ${orderNumber}:`, error);
      throw error;
    }
  }
};

// Export en syntaxe CommonJS
module.exports = {
  paymentService
};