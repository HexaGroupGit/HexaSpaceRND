// POST /api/auth/login
// Env vars required: AUTH_EMAIL, AUTH_PASSWORD, AUTH_SECRET

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body ?? {}

  const validEmail = process.env.AUTH_EMAIL
  const validPassword = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET ?? 'hexahub-secret'

  if (!validEmail || !validPassword) {
    return res.status(500).json({ error: 'Auth not configured on server.' })
  }

  if (
    email?.toLowerCase().trim() === validEmail.toLowerCase().trim() &&
    password === validPassword
  ) {
    const token = Buffer.from(
      `${email}:${Date.now()}:${secret}`
    ).toString('base64')
    return res.status(200).json({ success: true, token, email })
  }

  return res.status(401).json({ error: 'Invalid email or password.' })
}
