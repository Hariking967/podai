export interface ColumnRef {
  table?: string;
  column: string;
}

export function extractColumnReferences(query: string): ColumnRef[] {
  const refs: ColumnRef[] = [];
  const pattern = /(?:(?:(\w+)\.)?(\w+))\b/g;
  const keywords = new Set([
    "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
    "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "AS",
    "AND", "OR", "NOT", "IN", "EXISTS", "CASE", "WHEN", "THEN", "ELSE",
    "END", "DISTINCT", "ALL", "UNION", "EXCEPT", "INTERSECT"
  ]);

  let match;
  while ((match = pattern.exec(query)) !== null) {
    const [, table, col] = match;
    if (col && !keywords.has(col.toUpperCase())) {
      refs.push({ table, column: col });
    }
  }

  return refs;
}
