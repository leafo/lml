import { useState, useDeferredValue, memo } from 'react'
import { JsonTree } from './JsonTree'

interface OutputTabsProps {
  ast: unknown
  song: unknown
  error: string | null
  timing: { parse: number; compile: number } | null
}

type Tab = 'ast' | 'song'

export const OutputTabs = memo(function OutputTabs({ ast, song, error, timing }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ast')

  // Defer expensive JsonTree renders so typing stays responsive
  const deferredAst = useDeferredValue(ast)
  const deferredSong = useDeferredValue(song)

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
    return `${ms.toFixed(2)}ms`
  }

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
        <div className="header-right">
          {timing && (
            <span className="timing">
              parse: {formatTime(timing.parse)} | compile: {formatTime(timing.compile)}
            </span>
          )}
          <button
            className="log-btn"
            onClick={() => console.log(activeTab === 'ast' ? ast : song)}
            title="Log to console"
          >
            log
          </button>
        </div>
      </div>
      <div className="output-content">
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <JsonTree
            data={activeTab === 'ast' ? deferredAst : deferredSong}
            collapsedKeys={activeTab === 'song' ? ['notes', 'tracks'] : undefined}
          />
        )}
      </div>
    </div>
  )
})
