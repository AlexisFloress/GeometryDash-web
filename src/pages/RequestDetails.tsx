export type Operation = {
  summary?: string;
  description?: string;
  requestBody?: { content?: Record<string, { example?: unknown }> };
  parameters?: { name: string; in: string; required?: boolean; description?: string; example?: unknown }[];
  responses?: unknown;
  'x-request-guide'?: { access?: string; headers?: Record<string, string>; fields?: Record<string, string>; notes?: string[] };
};

export default function RequestDetails({ operation }: { operation: Operation }) {
  const guide = operation['x-request-guide'];
  const example = operation.requestBody?.content?.['application/json']?.example;
  const headers = Object.entries(guide?.headers ?? {});
  const parameters = (operation.parameters ?? []).filter(p => p.in === 'path' || p.in === 'query');
  return <>
    <p>{guide?.access}</p>
    {headers.length > 0 && <><h4>Encabezados que debes enviar</h4><pre>{headers.map(([name, value]) => `${name}: ${value}`).join('\n')}</pre></>}
    {parameters.length > 0 && <><h4>Datos de la ruta y filtros</h4><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>¿Es necesario?</th><th>Qué debes enviar</th></tr></thead><tbody>{parameters.map(p => <tr key={p.in + p.name}><td><code>{p.name}</code></td><td>{p.required ? 'Obligatorio' : 'Opcional'}</td><td>{p.description}{p.example !== undefined && <> Ejemplo: <code>{String(p.example)}</code>.</>}</td></tr>)}</tbody></table></div></>}
    <h4>JSON de la solicitud</h4>
    {example === undefined ? <p>No lleva cuerpo JSON. Deja vacío el campo de datos.</p> : <>
      <pre>{JSON.stringify(example, null, 2)}</pre>
      <div className="table-wrap"><table><thead><tr><th>Campo</th><th>Qué debes enviar</th></tr></thead><tbody>{Object.entries(guide?.fields ?? {}).map(([name, description]) => <tr key={name}><td><code>{name}</code></td><td>{description}</td></tr>)}</tbody></table></div>
    </>}
    {guide?.notes?.map((note, index) => <p key={index}>{note}</p>)}
  </>;
}
