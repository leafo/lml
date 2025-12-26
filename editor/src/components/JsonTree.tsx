import { useState } from 'react'

interface JsonTreeProps {
  data: unknown
  depth?: number
}

export function JsonTree({ data, depth = 0 }: JsonTreeProps) {
  if (data === null) {
    return <span className="json-null">null</span>
  }

  if (data === undefined) {
    return <span className="json-undefined">undefined</span>
  }

  if (typeof data === 'string') {
    return <span className="json-string">"{data}"</span>
  }

  if (typeof data === 'number') {
    return <span className="json-number">{data}</span>
  }

  if (typeof data === 'boolean') {
    return <span className="json-boolean">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    return <JsonArray data={data} depth={depth} />
  }

  if (typeof data === 'object') {
    return <JsonObject data={data as Record<string, unknown>} depth={depth} />
  }

  return <span>{String(data)}</span>
}

function JsonArray({ data, depth }: { data: unknown[]; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2)

  if (data.length === 0) {
    return <span className="json-bracket">[]</span>
  }

  // For small arrays with primitives, show inline
  const isSimple = data.length <= 5 && data.every(
    item => typeof item !== 'object' || item === null
  )

  if (isSimple && !collapsed) {
    return (
      <span className="json-inline-array">
        <span className="json-bracket">[</span>
        {data.map((item, i) => (
          <span key={i}>
            <JsonTree data={item} depth={depth + 1} />
            {i < data.length - 1 && <span className="json-comma">, </span>}
          </span>
        ))}
        <span className="json-bracket">]</span>
      </span>
    )
  }

  return (
    <span className="json-array">
      <span
        className="json-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? '▶' : '▼'}
      </span>
      <span className="json-bracket">[</span>
      {collapsed ? (
        <span className="json-collapsed" onClick={() => setCollapsed(false)}>
          {data.length} items
        </span>
      ) : (
        <div className="json-items">
          {data.map((item, i) => (
            <div key={i} className="json-item">
              <span className="json-index">{i}:</span>
              <JsonTree data={item} depth={depth + 1} />
              {i < data.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
        </div>
      )}
      <span className="json-bracket">]</span>
    </span>
  )
}

function JsonObject({
  data,
  depth,
}: {
  data: Record<string, unknown>
  depth: number
}) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const keys = Object.keys(data)

  if (keys.length === 0) {
    return <span className="json-bracket">{'{}'}</span>
  }

  return (
    <span className="json-object">
      <span
        className="json-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? '▶' : '▼'}
      </span>
      <span className="json-bracket">{'{'}</span>
      {collapsed ? (
        <span className="json-collapsed" onClick={() => setCollapsed(false)}>
          {keys.length} keys
        </span>
      ) : (
        <div className="json-items">
          {keys.map((key, i) => (
            <div key={key} className="json-item">
              <span className="json-key">{key}:</span>
              <JsonTree data={data[key]} depth={depth + 1} />
              {i < keys.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
        </div>
      )}
      <span className="json-bracket">{'}'}</span>
    </span>
  )
}
