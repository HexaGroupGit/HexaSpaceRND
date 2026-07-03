// Paginated full-table loader. PostgREST silently caps any un-paginated
// select at 1000 rows — with 1800+ invoice rows that truncation made the
// bill-run dedup blind to existing invoices (3 Jul incident: phantom gaps,
// duplicate invoices). ALWAYS use this for whole-table reads.

export async function selectAllRows(supabase, table, select = 'data') {
  const out = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < size) break
  }
  return out
}
