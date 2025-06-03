import React from 'react';

export const App: React.FC = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '2rem' }}>
      <h1>Hello, React + TypeScript!</h1>
      <p>You clicked {count} times.</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  );
};

export default App;
