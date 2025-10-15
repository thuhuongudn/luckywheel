// Simple test version
function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🎰 Lucky Wheel App</h1>
      <p>If you see this, React is working!</p>

      <div style={{ marginTop: '20px', padding: '20px', background: '#f0f0f0', borderRadius: '10px' }}>
        <h2>Status Check:</h2>
        <ul>
          <li>✅ React loaded</li>
          <li>✅ TypeScript compiled</li>
          <li>✅ Vite running</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => alert('Button works!')}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Test Button
        </button>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        <strong>Next Step:</strong> If this loads OK, the issue is with LuckyWheel component
      </div>
    </div>
  );
}

export default App;
