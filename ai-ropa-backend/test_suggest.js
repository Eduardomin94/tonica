import fetch from "node-fetch";

const res = await fetch("http://localhost:3000/suggest-background", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    category: "Remera/Top",
    model_type: "Mujer",
    vibe: "catálogo premium",
  }),
});

const data = await res.json();
console.log("STATUS:", res.status);
console.log(data);
