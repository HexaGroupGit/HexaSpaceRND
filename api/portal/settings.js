// GET /api/portal/settings
// Returns ONLY the deliberately-public subset of the global settings row (company
// identity, the bank details that already appear on invoices, a couple of public
// URLs). The full settings row (adminUsers allow-list, outbound-email config,
// billing rules, xero mappings, email templates) is admin/service-role only and
// never leaves the server. Public by design — no auth required.
import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../_cors.js';
import { publicSettings } from '../_publicSettings.js';

const SUPABASE_URL = process.env.SUPABASE_URL;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' });

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
    const { data } = await supabase.from('settings').select('data').eq('id', 'global');
    return res.status(200).json({ settings: publicSettings(data?.[0]?.data) });
  } catch (err) {
    console.error('portal/settings error:', err);
    return res.status(500).json({ error: 'error' });
  }
}
