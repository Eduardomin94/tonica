import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const form = new FormData();

// CAMBIÁ esta ruta por una imagen real tuya
form.append("front", fs.createReadStream("./test.jpg"));

form.append("category", "Remera/Top");
form.append("pockets", "no");
form.append("model_type", "Mujer");
form.append("ethnicity", "Latinos");
form.append("age_range", "25 a 34 años");
form.append("background", "estudio blanco minimalista");
form.append("pose", "Parado/a");


const res = await fetch("http://localhost:3000/generate", {
  method: "POST",
  body: form,
});

const data = await res.json();
console.log("STATUS:", res.status);
console.log(data);
