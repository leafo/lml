import { useState } from 'react'
import { JsonTree } from './JsonTree'

interface OutputTabsProps {
  ast: unknown
  song: unknown
  error: string | null
}

type Tab = 'ast' | 'song'

export function OutputTabs({ ast, song, error }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ast')

  return (
    <div className="output-panel">
      <div className="panel-header">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'ast' ? 'active' : ''}`}
            onClick={() => setActiveTab('ast')}
          >
            AST
          </button>
          <button
            className={`tab ${activeTab === 'song' ? 'active' : ''}`}
            onClick={() => setActiveTab('song')}
          >
            Song
          </button>
        </div>
      </div>
      <div className="output-content">
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <JsonTree data={activeTab === 'ast' ? ast : song} />
        )}
      </div>
    </div>
  )
}
