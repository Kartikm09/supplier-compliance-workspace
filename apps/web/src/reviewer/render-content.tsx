import { useState } from "react";
import { renderToString } from "react-dom/server";

export function RenderComparison() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>Supplier review rendering comparison</h1>
      <p role="status">Review count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Review again</button>
    </main>
  );
}
export function render() {
  return renderToString(<RenderComparison />);
}
