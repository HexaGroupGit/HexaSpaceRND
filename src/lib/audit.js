import { supabase } from './supabase.js'

export async function logAudit(action, entityType, entityId, entityName = '', details = '') {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    await supabase.from('audit_log').insert({
      id,
      data: {
        id,
        action,          // 'create' | 'update' | 'delete' | 'send' | 'sign' | 'void'
        entityType,      // 'tenant' | 'lease' | 'invoice' | 'space' | 'maintenance' | etc.
        entityId,
        entityName,
        details,
        userEmail: user?.email ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    })
  } catch {
    // Never block the main action due to audit log failure
  }
}
