// GET /api/stripe/status — configuration state for the Settings UI.
// Never returns keys.

export default function handler(req, res) {
  return res.status(200).json({
    configured: !!process.env.STRIPE_SECRET_KEY,
    webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    publishableKeySet: !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
  })
}
