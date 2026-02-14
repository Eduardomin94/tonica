"use client";

import React, { useMemo, useState } from "react";

/* ================== CONSTANTES ================== */

const CATEGORIES = [
  "Remera/Top",
  "Abrigo/Campera/Buzo",
  "Pantalón/Short/Pollera/Falda",
  "Vestido/Enterito",
  "Conjunto",
  "Traje de baño",
  "Body",
  "otro",
] as const;

const MODEL_TYPES = ["Bebé recién nacido", "Niño", "Niña", "Hombre", "Mujer"] as const;

const ETHNICITIES = ["Caucásico/a", "Latino/a", "Asiatico/a", "Negro/a", "Mediterraneo/a"] as const;

const POSES = ["Sentado/a", "Parado/a", "Caminando"] as const;

const BODY_TYPES = ["Estandar", "Plus Size"] as const;


function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}


/* ================== APP ================== */

export default function Home() {
  const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

  const [isMobile, setIsMobile] = useState(false);

React.useEffect(() => {
  const calc = () => setIsMobile(window.innerWidth < 640);
  calc();
  window.addEventListener("resize", calc);
  return () => window.removeEventListener("resize", calc);
}, []);


  const [mode, setMode] = useState<"model" | "product" | null>(null);

  // files
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);


  // form
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | "">("");
  const [otherCategory, setOtherCategory] = useState("");
  const [pockets, setPockets] = useState<"si" | "no" | "">("");

  const [measures, setMeasures] = useState({
    hombros: "",
    pecho: "",
    manga: "",
    cintura: "",
    cadera: "",
    largo: "",
  });

  const [modelType, setModelType] = useState<(typeof MODEL_TYPES)[number] | "">("");
  const [ethnicity, setEthnicity] = useState<(typeof ETHNICITIES)[number] | "">("");
  const [ageRange, setAgeRange] = useState("");
  const [background, setBackground] = useState("");
  const [scene, setScene] = useState("");
  const [pose, setPose] = useState<(typeof POSES)[number] | "">("");
  const [bodyType, setBodyType] = useState<(typeof BODY_TYPES)[number] | "">("");

  // ui
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [bgSuggestions, setBgSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrls: string[]; promptUsed?: string } | null>(null);

  const ageOptions = useMemo(() => {
    if (modelType === "Bebé recién nacido") return ["0 a 2 años"];
    if (modelType === "Niño" || modelType === "Niña") return ["3 a 6 años", "6 a 10 años", "10 a 16 años"];
    if (modelType === "Hombre" || modelType === "Mujer") return ["18 a 24 años", "25 a 34 años", "35 a 44 años"];
    return [];
  }, [modelType]);

  const steps = useMemo(() => {
  if (mode === "product") {
  return [
    { title: "Fotos", key: "upload" },
    { title: "Escena", key: "scene" },
    { title: "Generar", key: "generate" },
  ];
}


  return [
    { title: "Subir fotos", key: "upload" },
    { title: "Categoría", key: "category" },
    { title: "Bolsillos", key: "pockets" },
    { title: "Medidas (opcional)", key: "measures" },
    { title: "Modelo", key: "model" },
    { title: "Etnia", key: "ethnicity" },
    { title: "Edad", key: "age" },
    { title: "Fondo", key: "background" },
    { title: "Pose", key: "pose" },
    { title: "Tipo de cuerpo", key: "bodyType" },
    { title: "Generar", key: "generate" },
  ];
}, [mode]);


  

  React.useEffect(() => {
  if (!mode) return;
  setScene("");
  setStep(0);
  setError(null);
  setResult(null);

  // opcional pero recomendable: limpiar inputs cuando cambia el modo
  setFrontFile(null);
  setBackFile(null);
  setCategory("");
  setOtherCategory("");
  setPockets("");
  setMeasures({
    hombros: "",
    pecho: "",
    manga: "",
    cintura: "",
    cadera: "",
    largo: "",
  });
  setModelType("");
  setEthnicity("");
  setAgeRange("");
  setBackground("");
  setPose("");
  setBodyType("");
  setBgSuggestions([]);
  setProductFiles([]);

}, [mode]);


  // ============ VALIDACIÓN por paso ============
  const stepError = useMemo(() => {
  const key = steps[step]?.key;

  // upload
  if (key === "upload") {
  if (mode === "product") {
    return productFiles.length === 0 ? "Subí al menos 1 foto del producto." : null;
  }
  return !frontFile ? "Subí la foto FRONT (obligatorio)." : null;
}


  // category
  if (key === "category") {
    if (!category) return "Elegí una categoría.";
    if (category === "otro") {
      if (!otherCategory.trim()) return "Completá 'Otro' (máx 4 palabras).";
      if (wordCount(otherCategory) > 4) return "'Otro' debe tener máximo 4 palabras.";
    }
    return null;
  }

  // pockets
  if (key === "pockets") {
    return pockets ? null : "Indicá si tiene bolsillos (si/no).";
  }

  // measures optional
  if (key === "measures") return null;

  // scene (solo product)
  if (key === "scene") {
    if (!scene.trim()) return "Escribí la escena (máx 10 palabras).";
    if (wordCount(scene) > 10) return "La escena debe tener máximo 10 palabras.";
    return null;
  }

  // model-only steps
  if (key === "model") return modelType ? null : "Elegí el tipo de modelo.";
  if (key === "ethnicity") return ethnicity ? null : "Elegí la etnia.";
  if (key === "age") return ageRange ? null : "Elegí la edad.";
  if (key === "pose") return pose ? null : "Elegí la pose.";
  if (key === "bodyType") return bodyType ? null : "Elegí el tipo de cuerpo.";

  // background (en ambos modos)
  if (key === "background") {
    if (!background.trim()) return "Escribí el fondo (máx 10 palabras).";
    if (wordCount(background) > 10) return "El fondo debe tener máximo 10 palabras.";
    return null;
  }

  // generate
  return null;
}, [
  steps,
  step,
  mode,
  frontFile,
  productFiles,
  category,
  otherCategory,
  pockets,
  modelType,
  ethnicity,
  ageRange,
  background,
  pose,
  bodyType,
  scene,
]);


  const canGoNext = !stepError && !loading;
  const isLast = step === steps.length - 1;

  function next() {
    setError(null);
    if (!canGoNext) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function prev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }
 
  function goToFirstErrorStep() {
  for (let i = 0; i < steps.length - 1; i++) {
    switch (i) {
      case 0:
      return setStep(0);
        break;
      case 1:
        if (!category) return setStep(1);
        if (category === "otro" && (!otherCategory.trim() || wordCount(otherCategory) > 4))
          return setStep(1);
        break;
      case 2:
        if (!pockets) return setStep(2);
        break;
      case 4:
        if (!modelType) return setStep(4);
        break;
      case 5:
        if (!ethnicity) return setStep(5);
        break;
      case 6:
        if (!ageRange) return setStep(6);
        break;
      case 7:
        if (!background.trim() || wordCount(background) > 10)
          return setStep(7);
        break;
      case 8:
        if (!pose) return setStep(8);
        break;
      case 9:
        if (!bodyType) return setStep(9);
        break;
    }
  }
}

  async function handleSuggestBackground() {
    setError(null);
    if (!API) {
  setError("Falta NEXT_PUBLIC_API_BASE en .env.local");
  return;
}
    setHelpLoading(true);
    setBgSuggestions([]);
    try {
      const res = await fetch(`${API}/suggest-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category || "",
          model_type: modelType || "",
          vibe: "catálogo e-commerce premium",
        }),
      });
      const data = await res.json();
      const options: string[] = Array.isArray(data?.options) ? data.options : [];
      setBgSuggestions(options.slice(0, 3));
    } catch (e: any) {
      setError(`Error sugiriendo fondo: ${String(e?.message || e)}`);
    } finally {
      setHelpLoading(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setResult(null);

    if (!API) {
      setError("Falta NEXT_PUBLIC_API_BASE en .env.local");
      return;
    }

    // Validación total rápida (reutilizamos stepError navegando a donde falte)
    for (let i = 0; i < steps.length - 1; i++) {
      // fuerza chequeo setStep? mejor: replicar, pero ya tenemos stepError por step.
      // hacemos check por paso manual:
    }

    // chequeos obligatorios finales

    if (mode === "product") {
  if (productFiles.length === 0) {
    setStep(0);
    return setError("Subí al menos 1 foto del producto.");
  }

  if (!scene.trim() || wordCount(scene) > 10) {
    setStep(1);
    return setError("Escribí la escena (máx 10 palabras).");
  }
}

if (mode === "product") {
  // En modo producto no validamos campos de modelo
} else {

if (!frontFile) {
  goToFirstErrorStep();
  return setError("Falta foto FRONT.");
}

if (!category) {
  goToFirstErrorStep();
  return setError("Falta categoría.");
}

if (category === "otro" && (!otherCategory.trim() || wordCount(otherCategory) > 4)) {
  goToFirstErrorStep();
  return setError("Revisá 'Otro' (máx 4 palabras).");
}

if (!pockets) {
  goToFirstErrorStep();
  return setError("Falta bolsillos.");
}

if (!modelType) {
  goToFirstErrorStep();
  return setError("Falta modelo.");
}

if (!ethnicity) {
  goToFirstErrorStep();
  return setError("Falta etnia.");
}

if (!ageRange) {
  goToFirstErrorStep();
  return setError("Falta edad.");
}

if (!background.trim() || wordCount(background) > 10) {
  goToFirstErrorStep();
  return setError("Falta fondo o excede 10 palabras.");
}

if (!pose) {
  goToFirstErrorStep();
  return setError("Falta pose.");
}

if (!bodyType) {
  goToFirstErrorStep();
  return setError("Falta tipo de cuerpo.");
}
}

    setLoading(true);
    try {
      const fd = new FormData();

// ✅ siempre mandamos el modo
fd.append("mode", mode || "model");

if (mode === "product") {
  // ✅ muchas fotos
  productFiles.forEach((f) => fd.append("product_images", f));
  // ✅ escena
  fd.append("scene", scene.trim());
} else {
  // ✅ modo modelo (como antes)
  if (!frontFile) {
    goToFirstErrorStep();
    throw new Error("Falta foto FRONT.");
  }
  fd.append("front", frontFile);
  if (backFile) fd.append("back", backFile);

  fd.append("category", category);
  if (category === "otro") fd.append("other_category", otherCategory.trim());
  fd.append("pockets", pockets);

  fd.append("hombros", measures.hombros);
  fd.append("pecho", measures.pecho);
  fd.append("manga", measures.manga);
  fd.append("cintura", measures.cintura);
  fd.append("cadera", measures.cadera);
  fd.append("largo", measures.largo);

  fd.append("model_type", modelType);
  fd.append("ethnicity", ethnicity);
  fd.append("age_range", ageRange);
  fd.append("background", background.trim());
  fd.append("pose", pose);
  fd.append("body_type", bodyType);
}



      const res = await fetch(`${API}/generate`, { method: "POST", body: fd });

const text = await res.text();
let data: any = null;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!res.ok) {
  setError(data?.error || data?.message || `Error ${res.status}: ${String(text).slice(0, 200)}`);
  return;
}


      let urls: string[] = [];

if (Array.isArray(data?.imageUrls)) urls = data.imageUrls;
else if (typeof data?.imageUrl === "string") urls = [data.imageUrl];

if (!urls.length) {
  setError("El servidor no devolvió imágenes.");
  return;
}

const absolute = urls.map((u) =>
  u.startsWith("http") ? u : `${API}${u.startsWith("/") ? "" : "/"}${u}`
);

setResult({ imageUrls: absolute, promptUsed: data?.promptUsed });

    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ============ RENDER PANEL POR PASO ============
  const panel = useMemo(() => {
    switch (steps[step].key) {
      case "upload":
  return (
    <>
      <FieldTitle>1) Subí fotos</FieldTitle>

      {mode === "product" ? (
        <Box>
          <Label>Fotos del producto (cuantas más, mejor)</Label>
          <InputFiles onChange={setProductFiles} />
          {productFiles.length > 0 && (
            <SmallMuted>
              {productFiles.length} archivo(s): {productFiles.map((f) => f.name).join(", ")}
            </SmallMuted>
          )}
        </Box>
      ) : (
        <TwoCols>
          <Box>
            <Label>Delantera (obligatorio)</Label>
            <InputFile onChange={(f) => setFrontFile(f)} />
            {frontFile && <SmallMuted>{frontFile.name}</SmallMuted>}
          </Box>
          <Box>
            <Label>Espalda (opcional)</Label>
            <InputFile onChange={(f) => setBackFile(f)} />
            {backFile && <SmallMuted>{backFile.name}</SmallMuted>}
          </Box>
        </TwoCols>
      )}
    </>
  );


      case "category":
  return (
    <>
      <FieldTitle>2) Elegí la categoría</FieldTitle>
      <div style={isMobile ? styles.pillsGrid2Mobile : styles.pillsGrid2}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c as any)}
            style={{
  ...styles.pill,
  ...(isMobile ? styles.pillMobile : {}),
  ...(category === c ? styles.pillActive : {}),
}}

          >
            {c === "otro" ? "Otro" : c}
          </button>
        ))}
      </div>

      {category === "otro" && (
        <div style={{ marginTop: 12 }}>
          <Label>Especificá “Otro” (máx 4 palabras)</Label>
          <TextInput
            value={otherCategory}
            onChange={setOtherCategory}
            placeholder="Ej: Chaleco sastrero corto"
          />
          <SmallMuted>
            Palabras: {wordCount(otherCategory)} / 4
          </SmallMuted>
        </div>
      )}
    </>
  );


      case "pockets":
        return (
          <>
            <FieldTitle>3) ¿Tiene bolsillos?</FieldTitle>
            <RadioPills
              value={pockets}
              onChange={(v) => setPockets(v as any)}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </>
        );

      case "measures":
        return (
          <>
            <FieldTitle>4) Medidas (opcional)</FieldTitle>
            <SmallMuted>Podés poner cm. Ej: 52cm</SmallMuted>
            <Grid3>
              {Object.entries(measures).map(([k, v]) => (
                <div key={k}>
                  <Label style={{ textTransform: "capitalize" }}>{k}</Label>
                  <TextInput value={v} onChange={(nv) => setMeasures((m) => ({ ...m, [k]: nv }))} placeholder="Ej: 52cm" />
                </div>
              ))}
            </Grid3>
          </>
        );

      case "model":
        return (
          <>
            <FieldTitle>5) Tipo de modelo</FieldTitle>
            <RadioPills
            value={modelType}
            onChange={(v) => {
              setModelType(v as any);
              setAgeRange("");
            }}
            options={MODEL_TYPES.map((m) => ({
              value: m,
              label: m,
            }))}
          />
          </>
        );

      case "ethnicity":
        return (
          <>
            <FieldTitle>6) Etnia</FieldTitle>
            <div style={isMobile ? styles.pillsGrid2Mobile : styles.pillsGrid2}>
              {ETHNICITIES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEthnicity(e as any)}
                  style={{
  ...styles.pill,
  ...(isMobile ? styles.pillMobile : {}),
  ...(ethnicity === e ? styles.pillActive : {}),
}}

                >
                  {e}
                </button>
              ))}
            </div>
          </>
        );


      case "age":
        return (
          <>
            <FieldTitle>7) Edad</FieldTitle>
            {!modelType ? (
          <SmallMuted>Elegí primero el modelo</SmallMuted>
        ) : (
          <RadioPills
            value={ageRange}
            onChange={(v) => setAgeRange(v)}
            options={ageOptions.map((a) => ({ value: a, label: a }))}
          />
        )}

          </>
        );

      case "background":
        return (
          <>
            <FieldTitle>8) Fondo (máx 10 palabras)</FieldTitle>
            <TextInput
              value={background}
              onChange={setBackground}
              placeholder='Ej: "estudio gris con luz suave"'
            />
            <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
              <SmallMuted>Palabras: {wordCount(background)} / 10</SmallMuted>
              <Button
                variant="secondary"
                onClick={handleSuggestBackground}
                disabled={helpLoading || !category || !modelType}
              >
                {helpLoading ? "Buscando..." : "Ayudame a elegir el lugar"}
              </Button>
            </Row>

            {bgSuggestions.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {bgSuggestions.map((s, i) => (
                  <button key={i} onClick={() => setBackground(s)} style={styles.suggestionBtn}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        );

      case "pose":
        return (
          <>
          <FieldTitle>9) Pose</FieldTitle>
          <RadioPills
            value={pose}
            onChange={(v) => setPose(v as any)}
            options={POSES.map((p) => ({
              value: p,
              label: p,
            }))}
          />
        </>
      );


        case "bodyType":
  return (
    <>
      <FieldTitle>Tipo de cuerpo</FieldTitle>
      <RadioPills
        value={bodyType}
        onChange={(v) => setBodyType(v as any)}
        options={BODY_TYPES.map((b) => ({
          value: b,
          label: b,
        }))}
      />
    </>
  );

case "scene":
  return (
    <>
      <FieldTitle>Escena del producto (máx 10 palabras)</FieldTitle>

      <TextInput
        value={scene}
        onChange={setScene}
        placeholder='Ej: "colgado en percha de madera", "sobre arena húmeda"'
      />

      <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
        <SmallMuted>Palabras: {wordCount(scene)} / 10</SmallMuted>

        <Button
          variant="secondary"
          onClick={async () => {
            if (!API) return setError("Falta NEXT_PUBLIC_API_BASE");
            setHelpLoading(true);
            try {
              const res = await fetch(`${API}/suggest-background`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  category: "producto",
                  model_type: "sin modelo",
                  vibe: "foto producto e-commerce premium",
                }),
              });

              const data = await res.json();
              if (Array.isArray(data?.options) && data.options.length > 0) {
                setScene(data.options[0]);
              }
            } catch (err: any) {
              setError(String(err?.message || err));
            } finally {
              setHelpLoading(false);
            }
          }}
          disabled={helpLoading}
        >
          {helpLoading ? "Buscando..." : "Ayudame a elegir"}
        </Button>
      </Row>
    </>
  );

    

     case "generate":
  return (
    <>
      <FieldTitle>11) Generar imágenes</FieldTitle>

      <div style={styles.summaryCard}>
        <div style={styles.summaryTitle}>Resumen</div>

        {mode === "product" ? (
          <>
            <div style={{ ...styles.summaryGrid, gridTemplateColumns: "1fr" }}>
              <SummaryItem label="Escena" value={scene} />
              <SummaryItem
                label="Fotos cargadas"
                value={`${productFiles.length} archivo(s)`}
              />
            </div>

       {productFiles.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                }}
                >
          {productFiles.slice(0, 8).map((f, idx) => (
                  <div key={idx} style={styles.imgCard}>
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`prod-${idx}`}
                      style={{
  width: "100%",
  display: "block",
  height: 180,
  objectFit: "contain" as any,
  background: "#fff",
}}
                    />
                  </div>
                ))}
              </div>
            )}

      {productFiles.length > 8 && (
              <SmallMuted style={{ marginTop: 8 } as any}>
                Mostrando 8 de {productFiles.length} fotos.
              </SmallMuted>
            )}
          </>
        ) : (
          <>
            <div style={styles.summaryGrid}>
              <SummaryItem
                label="Categoría"
                value={category === "otro" ? `Otro: ${otherCategory}` : category}
              />
              <SummaryItem label="Bolsillos" value={pockets} />
              <SummaryItem label="Modelo" value={modelType} />
              <SummaryItem label="Etnia" value={ethnicity} />
              <SummaryItem label="Edad" value={ageRange} />
              <SummaryItem label="Fondo" value={background} />
              <SummaryItem label="Pose" value={pose} />
              <SummaryItem label="Tipo de cuerpo" value={bodyType} />
            </div>

    {(frontFile || backFile) && (
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                }}
              >
                {frontFile && (
                  <div style={styles.imgCard}>
                    <img
                      src={URL.createObjectURL(frontFile)}
                      alt="front"
                      style={{
  width: "100%",
  display: "block",
  height: 180,
  objectFit: "contain" as any,
  background: "#fff",
}}
                    />
                  </div>
                )}

            {backFile && (
                  <div style={styles.imgCard}>
                    <img
                      src={URL.createObjectURL(backFile)}
                        alt="back"
                          style={{
                            width: "100%",
                            display: "block",
                            height: 180,
                            objectFit: "contain" as any,
                            background: "#fff",
                          }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    <Button
        onClick={handleGenerate}
        disabled={loading}
        style={{ width: "100%", padding: "14px 16px" }}
      >
        {loading ? "Generando..." : "Generar (1 crédito)"}
      </Button>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Resultado</div>
          <div style={styles.resultGrid}>
            {result.imageUrls.map((u, idx) => (
              <div key={idx} style={styles.imgCard}>
                <img
                  src={u}
                  alt={`img-${idx}`}
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            ))}
          </div>

          {result.promptUsed && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer" }}>
                Ver prompt usado
              </summary>
              <pre
                style={{ whiteSpace: "pre-wrap", marginTop: 8 }}
              >
                {result.promptUsed}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );

      default:
        return null;
    }
  }, [
    steps,
    step,
    frontFile,
    backFile,
    productFiles,
    category,
    otherCategory,
    pockets,
    measures,
    modelType,
    ethnicity,
    ageRange,
    background,
    pose,
    bodyType,
    bgSuggestions,
    helpLoading,
    loading,
    result,
    handleSuggestBackground,
    handleGenerate,
  ]);

  if (!mode) {
  return (
    <div style={styles.page}>
      <div style={{ ...styles.shell, maxWidth: 600 }}>
        <div style={styles.header}>
          <div>
            <div style={styles.h1}>AI Ropa — Generador</div>
            <div style={styles.h2}>Elegí el tipo de imagen que querés generar</div>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={{ display: "grid", gap: 14 }}>
            <button
              type="button"
              onClick={() => setMode("model")}
              style={{ ...styles.btnPrimary, width: "100%", padding: "16px" }}
            >
              📸 Foto con modelo
            </button>

            <button
              type="button"
              onClick={() => setMode("product")}
              style={{ ...styles.btnSecondary, width: "100%", padding: "16px" }}
            >
              🛍 Foto producto (sin modelo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.h1}>AI Ropa — Generador</div>
            <div>
  {mode === "model" ? (
    <button
      onClick={() => setMode("product")}
      style={{ ...styles.btnSecondary, marginTop: 8 }}
    >
      🛍 Cambiar a Foto producto
    </button>
  ) : (
    <button
      onClick={() => setMode("model")}
      style={{ ...styles.btnSecondary, marginTop: 8 }}
    >
      📸 Cambiar a Foto con modelo
    </button>
  )}
</div>

            <div style={styles.h2}>1 crédito = 4 imágenes (frente / espalda / costados)</div>
          </div>
          <div style={styles.badge}>Demo local</div>
        </div>

        {/* Main */}
        <div style={styles.main}>
          {/* Sidebar */}
          <aside style={styles.sidebar}>
            <div style={styles.sidebarTitle}>Pasos</div>
            <div style={{ display: "grid", gap: 8 }}>
              {steps.map((s, i) => {
  const active = i === step;
  const done = i < step;
  

  return (
    <button
  key={s.key}
  onClick={() => setStep(i)}
  style={{
    ...styles.stepBtn,
    ...(active ? styles.stepBtnActive : {}),
  }}
>


                    <span style={{ ...styles.stepDot, ...(done ? styles.stepDotDone : active ? styles.stepDotActive : {}) }}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span style={{ fontWeight: active ? 700 : 600 }}>{s.title}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Panel */}
          <section style={styles.panel}>
            {stepError && <div style={styles.inlineWarn}>{stepError}</div>}
            {error && <div style={styles.inlineErr}>{error}</div>}

            {panel}

            {/* Footer actions */}
            <div style={styles.footer}>
              <Button variant="secondary" onClick={prev} disabled={step === 0 || loading}>
                Atrás
              </Button>

              <div style={{ flex: 1 }} />

              {!isLast ? (
                <Button onClick={next} disabled={!canGoNext}>
                  Siguiente
                </Button>
              ) : null}
            </div>

            {/* Small hint */}
            <div style={styles.hint}>
              Tip: si el backend no está corriendo en 3001, levantalo con{" "}
              <code style={styles.code}>node server.js</code>.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ================== UI COMPONENTS ================== */

function FieldTitle({ children }: { children: React.ReactNode }) {
  return <div style={styles.fieldTitle}>{children}</div>;
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...styles.label, ...(style || {}) }}>
      {children}
    </div>
  );
}

function SmallMuted({ children }: { children: React.ReactNode }) {
  return <div style={styles.smallMuted}>{children}</div>;
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...styles.row, ...(style || {}) }}>{children}</div>;
}

function TwoCols({ children }: { children: React.ReactNode }) {
  return <div style={styles.twoCols}>{children}</div>;
}

function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={styles.grid3}>{children}</div>;
}

function Box({ children }: { children: React.ReactNode }) {
  return <div style={styles.box}>{children}</div>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
    />
  );
}


function InputFile({ onChange }: { onChange: (f: File | null) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      onChange={(e) => onChange(e.target.files?.[0] || null)}
      style={styles.file}
    />
  );
}

function InputFiles({ onChange }: { onChange: (files: File[]) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      multiple
      onChange={(e) => onChange(Array.from(e.target.files || []))}
      style={styles.file}
    />
  );
}


function RadioPills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={styles.pills}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{ ...styles.pill, ...(active ? styles.pillActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  style?: React.CSSProperties;
}) {
  const base = variant === "primary" ? styles.btnPrimary : styles.btnSecondary;
  const dis = disabled ? styles.btnDisabled : {};
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...dis, ...(style || {}) }}>
      {children}
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value || "—"}</div>
    </div>
  );
}

/* ================== STYLES ================== */

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#ffffff",
    minHeight: "100vh",
    padding: 20,
    color: "#0f172a",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  shell: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: "10px 6px 18px 6px",
  },
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: -0.2 },
  h2: { marginTop: 6, color: "#475569" },
  badge: {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#bfdbfe",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
},
  main: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 16,
    alignItems: "start",
  },
  sidebar: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    background: "#f8fafc",
  },
  sidebarTitle: { fontWeight: 800, marginBottom: 10, color: "#0f172a" },

  stepBtn: {
    width: "100%",
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    color: "#0f172a",
  },
  stepBtnActive: {
    background: "#ffffff",
    borderColor: "#dbeafe",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)",
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#e2e8f0",
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 12,
    flex: "0 0 auto",
  },
  stepDotActive: {
    background: "#2563eb",
    color: "#ffffff",
  },
  stepDotDone: {
    background: "#16a34a",
    color: "#ffffff",
  },

  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    background: "#ffffff",
  },
  inlineWarn: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    padding: "10px 12px",
    borderRadius: 12,
    marginBottom: 12,
    fontWeight: 700,
  },
  inlineErr: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: "10px 12px",
    borderRadius: 12,
    marginBottom: 12,
    fontWeight: 700,
  },

  footer: {
    display: "flex",
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid #e5e7eb",
  },

  hint: { marginTop: 10, color: "#64748b", fontSize: 12 },
  code: { background: "#f1f5f9", padding: "2px 6px", borderRadius: 8, border: "1px solid #e2e8f0" },

  fieldTitle: { fontSize: 18, fontWeight: 900, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 800, marginBottom: 6, color: "#0f172a" },
  smallMuted: { fontSize: 12, color: "#64748b", marginTop: 6 },

  row: { display: "flex", alignItems: "center", gap: 10 },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  box: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
    fontSize: 14,
  },
  file: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
  },

  pills: { display: "flex", gap: 10, flexWrap: "wrap" as any },
  pill: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
    color: "#0f172a",
  },
  pillsGrid2: {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
},pillMobile: {
  width: "100%",
  justifyContent: "center",
},

pillsGrid2Mobile: {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
},
  pillActive: {
    background: "#2563eb",
    borderColor: "#2563eb",
    color: "#ffffff",
  },

  btnPrimary: {
    background: "#2563eb",
    color: "#ffffff",
    border: "1px solid #2563eb",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #d1d5db",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  suggestionBtn: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
  },

  summaryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    background: "#f8fafc",
    marginBottom: 12,
  },
  summaryTitle: { fontWeight: 900, marginBottom: 10 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  summaryItem: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  summaryValue: { fontSize: 13, color: "#0f172a", fontWeight: 900, marginTop: 4 },

  resultGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  imgCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    background: "#ffffff",
  },
};
