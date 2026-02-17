"use client";

import React, { useMemo, useState } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});


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
  console.log("API BASE:", API);

  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loadingMe, setLoadingMe] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [topupStatus, setTopupStatus] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(10);
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [language, setLanguage] = useState<"es" | "en" | "pt" | "ko" | "zh">("es");
  
  const translations = {
  es: {
    title: "Generador IA",
    subtitle: "Elegí el tipo de imagen que querés generar",
    buyCredits: "Comprar créditos",
    logout: "Cerrar sesión",
    credits: "Créditos",
    history: "Historial de movimientos",
    changeToModel: "Cambiar a Foto con modelo",
    changeToProduct: "Cambiar a Foto producto",
    next: "Siguiente",
    back: "Atrás",
    signIn: "Iniciar sesión",
    signInHint: "Accedé con tu cuenta de Google para usar el generador",
  },
  en: {
    title: "AI Generator",
    subtitle: "Choose the type of image you want to generate",
    buyCredits: "Buy credits",
    logout: "Log out",
    credits: "Credits",
    history: "Transaction history",
    changeToModel: "Switch to Model photos",
    changeToProduct: "Switch to Product photos",
    next: "Next",
    back: "Back",
    signIn: "Sign in",
    signInHint: "Sign in with Google to use the generator",
  },
  pt: {
    title: "Gerador AI",
    subtitle: "Escolha o tipo de imagem que deseja gerar",
    buyCredits: "Comprar créditos",
    logout: "Sair",
    credits: "Créditos",
    history: "Histórico de movimentos",
    changeToModel: "Mudar para fotos com modelo",
    changeToProduct: "Mudar para fotos do produto",
    next: "Próximo",
    back: "Voltar",
    signIn: "Entrar",
    signInHint: "Entre com Google para usar o gerador",
  },
  ko: {
    title: "AI 생성기",
    subtitle: "생성할 이미지 유형을 선택하세요",
    buyCredits: "크레딧 구매",
    logout: "로그아웃",
    credits: "크레딧",
    history: "거래 내역",
    changeToModel: "모델 사진으로 전환",
    changeToProduct: "상품 사진으로 전환",
    next: "다음",
    back: "뒤로",
    signIn: "로그인",
    signInHint: "Google로 로그인하여 사용하세요",
  },
  zh: {
    title: "AI 生成器",
    subtitle: "选择要生成的图片类型",
    buyCredits: "购买积分",
    logout: "退出登录",
    credits: "积分",
    history: "交易记录",
    changeToModel: "切换到模特图",
    changeToProduct: "切换到产品图",
    next: "下一步",
    back: "返回",
    signIn: "登录",
    signInHint: "使用 Google 登录以使用生成器",
  },
} as const;

const t = (key: keyof typeof translations.es) => translations[language][key];


  
function handleLogout() {
  localStorage.removeItem("accessToken");
  setUser(null);
  setAccessToken(null);
  setBalance(0);
}


  React.useEffect(() => {
    const calc = () => setIsMobile(window.innerWidth < 640);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  React.useEffect(() => {
  const url = new URL(window.location.href);
  const status = url.searchParams.get("topup");

  if (status) {
    setTopupStatus(status);

    // 🔄 refresca el balance automáticamente
    fetchMe();

    // 🧹 limpia la URL
    window.history.replaceState({}, "", "/");

    // ⏳ auto-oculta el mensaje en 5 segundos
    const t = window.setTimeout(() => setTopupStatus(null), 5000);
    return () => window.clearTimeout(t);
  }
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

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!(window as any).google) return;
      clearInterval(interval);

      const GOOGLE_CLIENT_ID =
        "177285831628-o6shn4e85ecub5jilj6tj02njbt9r6jf.apps.googleusercontent.com";
      console.log("GOOGLE CLIENT ID USED:", GOOGLE_CLIENT_ID);

      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            const res = await fetch(`${API}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.error || "Login error");
            }
            setUser(data.user);
            setAccessToken(data.accessToken);
            localStorage.setItem("accessToken", data.accessToken);
            setBalance(data?.wallet?.balance ?? 0);
            } catch (err: any) {
  console.error(err);
  alert(`Error login Google: ${err?.message || err}`);
}

        },
        ux_mode: "popup",
        auto_select: false,
      });
      const el = document.getElementById("googleLoginDiv");

if (el) {
  el.innerHTML = ""; // limpia el botón viejo

  (window as any).google.accounts.id.renderButton(
    el,
    {
      theme: "outline",
      size: "large",
    }
  );
}      
    }, 300);

    return () => clearInterval(interval);
  }, [API]);

  React.useEffect(() => {
  // Solo cuando estamos en pantalla de login
  if (user || accessToken) return;

  const w = window as any;
  if (!w.google?.accounts?.id) return;

  const el = document.getElementById("googleLoginDiv");
  if (!el) return;

  // Limpiar y volver a renderizar el botón
  el.innerHTML = "";
  w.google.accounts.id.renderButton(el, { theme: "outline", size: "large" });
}, [user, accessToken]);


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

  React.useEffect(() => {
  fetchMe();
  fetchEntries();
}, [API]);


  // ============ VALIDACIÓN por paso ============
  const stepError = useMemo(() => {
    const key = steps[step]?.key;

    // upload
    if (key === "upload") {
      if (mode === "product") {
        return productFiles.length === 0 ? "Subí al menos 1 foto del producto." : null;
      }
      return !frontFile ? "Subí la foto Delantera (obligatorio)." : null;
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
          if (category === "otro" && (!otherCategory.trim() || wordCount(otherCategory) > 4)) return setStep(1);
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
          if (!background.trim() || wordCount(background) > 10) return setStep(7);
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

  async function fetchMe() {
    if (!API) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setAccessToken(token);

    setLoadingMe(true);
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;
      setUser(data);
setBalance(data?.wallet?.balance ?? 0);
setEntries(data?.wallet?.entries ?? []);

    } finally {
      setLoadingMe(false);
    }
  }

  async function fetchEntries() {
  if (!API) return;
  const token = localStorage.getItem("accessToken");
  if (!token) return;

  setLoadingEntries(true);
  try {
    const res = await fetch(`${API}/wallet/entries`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) return;

    setEntries(Array.isArray(data?.entries) ? data.entries : []);
  } finally {
    setLoadingEntries(false);
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

      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        setError(
          data?.error ||
            data?.message ||
            `Error ${res.status}: ${String(text).slice(0, 200)}`
        );
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
      await fetchMe();

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
                <TextInput value={otherCategory} onChange={setOtherCategory} placeholder="Ej: Chaleco sastrero corto" />
                <SmallMuted>Palabras: {wordCount(otherCategory)} / 4</SmallMuted>
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
                  <TextInput
                    value={v}
                    onChange={(nv) => setMeasures((m) => ({ ...m, [k]: nv }))}
                    placeholder="Ej: 52cm"
                  />
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
              options={MODEL_TYPES.map((m) => ({ value: m, label: m }))}
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
            <TextInput value={background} onChange={setBackground} placeholder='Ej: "estudio gris con luz suave"' />

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
            <RadioPills value={pose} onChange={(v) => setPose(v as any)} options={POSES.map((p) => ({ value: p, label: p }))} />
          </>
        );

      case "bodyType":
        return (
          <>
            <FieldTitle>Tipo de cuerpo</FieldTitle>
            <RadioPills value={bodyType} onChange={(v) => setBodyType(v as any)} options={BODY_TYPES.map((b) => ({ value: b, label: b }))} />
          </>
        );

      case "scene":
        return (
          <>
            <FieldTitle>Escena del producto (máx 10 palabras)</FieldTitle>
            <TextInput value={scene} onChange={setScene} placeholder='Ej: "colgado en percha de madera", "sobre arena húmeda"' />

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
                    <SummaryItem label="Fotos cargadas" value={`${productFiles.length} archivo(s)`} />
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
                    <SmallMuted style={{ marginTop: 8 } as any}>Mostrando 8 de {productFiles.length} fotos.</SmallMuted>
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
              disabled={loading || balance < 1}
              style={{ width: "100%", padding: "14px 16px" }}
            >
              {loading ? "Generando..." : balance < 1 ? "Sin créditos" : "Generar (1 crédito)"}
            </Button>

            {result && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Resultado</div>
                <div style={styles.resultGrid}>
                  {result.imageUrls.map((u, idx) => (
                    <div key={idx} style={styles.imgCard}>
                      <img src={u} alt={`img-${idx}`} style={{ width: "100%", display: "block" }} />
                    </div>
                  ))}
                </div>

                {result.promptUsed && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: "pointer" }}>Ver prompt usado</summary>
                    <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{result.promptUsed}</pre>
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
    isMobile,
    mode,
    scene,
    balance,
    error,
    loadingMe,
    API,
  ]);

  if (!user && !accessToken) {
    return (
      <div style={styles.loginCard}>
  <div style={styles.loginTitle}>Iniciar sesión</div>

  <div
  style={{
    display: "flex",
    justifyContent: "center",
    marginTop: 20,
  }}
>
  <div id="googleLoginDiv" />
</div>


  <div style={styles.loginSub}>
    Accedé con tu cuenta de Google para usar el generador
  </div>
</div>

    );
  }

  if (!mode) {
    return (
      <div className={inter.className} style={styles.page}>
        <div style={{ ...styles.shell, maxWidth: 600 }}>
            <div
              style={{
                ...styles.header,
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "flex-end",
                gap: isMobile ? 14 : 0,
              }}
>

            <div>
              <div style={{ ...styles.h1, color: "#ffffff" }}>
  {t("title")}

</div>

<div style={{ ...styles.h2, color: "#cbd5e1" }}>
  Elegí el tipo de imagen que querés generar
</div>

            </div>
          </div>

          <div style={styles.panel}>
            <div style={{ display: "grid", gap: 14 }}>
              <button
                type="button"
                onClick={() => setMode("model")}
                style={{ ...styles.btnPrimary, width: "100%", padding: "16px" }}
              >
                📸 Foto con modelo (vestimenta)
              </button>

              <button
                type="button"
                onClick={() => setMode("product")}
                style={{ ...styles.btnSecondary, width: "100%", padding: "16px" }}
              >
                🛍 Foto producto
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

      {topupStatus === "ok" && (
        <div style={{
          background: "#dcfce7",
          border: "1px solid #16a34a",
          color: "#166534",
          padding: "12px",
          borderRadius: "12px",
          marginBottom: "16px",
          fontWeight: 600
        }}>
          ✅ Créditos agregados correctamente
        </div>
      )}

      {topupStatus === "fail" && (
        <div style={{
          background: "#fee2e2",
          border: "1px solid #dc2626",
          color: "#7f1d1d",
          padding: "12px",
          borderRadius: "12px",
          marginBottom: "16px",
          fontWeight: 600
        }}>
          ❌ El pago fue rechazado
        </div>
      )}
        {/* Header */}
        <div
  style={{
    ...styles.header,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
    gap: isMobile ? 12 : 0,
  }}
>

          <div>
            <div style={{ ...styles.h1, color: "#9495B5" }}>
  {t("title")}

</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
  {mode === "model" ? (
    <button onClick={() => setMode("product")} style={{ ...styles.btnSecondary }}>
      ⚛️ Cambiar a Foto producto
    </button>
  ) : (
    <button onClick={() => setMode("model")} style={{ ...styles.btnSecondary }}>
      📸 Cambiar a Foto con modelo
    </button>
  )}

  <select
    value={language}
    onChange={(e) => setLanguage(e.target.value as any)}
    style={{
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid #e2e8f0",
      background: "#ffffff",
      color: "#000000",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    <option value="es">🇪🇸 ES</option>
    <option value="en">🇺🇸 EN</option>
    <option value="pt">🇧🇷 PT</option>
    <option value="ko">🇰🇷 KO</option>
    <option value="zh">🇨🇳 中文</option>
  </select>
</div>

            <div style={{ ...styles.h2, color: "#ffffff" }}>
  1 crédito = 4 imágenes (frente / espalda / costados)
</div>
 </div> 
<div
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
    gap: 16,
    padding: "16px 20px",
    borderRadius: 18,
    background: "linear-gradient(145deg, #ffffff, #f1f5f9)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    color: "#0f172a",
    width: "100%",
  }}
>

  {/* email */}
  <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap" }}>
    {user?.email || user?.name}
  </div>

  {/* badge créditos actuales */}
  <div style={styles.badge}>
    {loadingMe ? "Cargando..." : `Créditos: ${balance}`}
  </div>

  {/* ✅ caja premium: cantidad + comprar */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      borderRadius: 16,
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
      width: isMobile ? "100%" : "auto",
      justifyContent: isMobile ? "space-between" : "flex-start",

    }}
  >
    <input
      type="number"
      min={1}
      value={creditAmount}
      onChange={(e) => setCreditAmount(Number(e.target.value))}
      style={{
        width: 64,
        height: 36,
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        color: "#0f172a",
        fontWeight: 900,
        textAlign: "center",
        outline: "none",
      }}
    />

    <button
      type="button"
      disabled={buyLoading}
      onClick={async () => {
        try {
          setBuyLoading(true);

          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API}/mp/create-preference`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ credits: creditAmount }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Error creando preferencia");
          if (!data?.init_point) throw new Error("No init_point recibido");
          window.location.href = data.init_point;
        } catch (e: any) {
          alert(String(e?.message || e));
        } finally {
          setBuyLoading(false);
        }
      }}
      style={styles.btnPremium}
    >
      {buyLoading ? (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="spinner" />
          Procesando...
        </span>
      ) : (
        "💳 Comprar créditos"
      )}
    </button>
  </div>

  {/* logout */}
  <button
  type="button"
  onClick={handleLogout}
  style={{
  ...styles.btnGhostPremium,
  width: isMobile ? "100%" : "auto",
  marginTop: isMobile ? 8 : 0,
}}
>
  🚪 Cerrar sesión
</button>
</div>
        </div>

        {/* Main */}
        <div
  style={{
    ...styles.main,
    gridTemplateColumns: isMobile ? "1fr" : "280px 1fr",
  }}
>
          {/* Sidebar */}
          {isMobile && (
  <div style={{ marginBottom: 16 }}>
    <button
      type="button"
      onClick={() => setMobileStepsOpen((v) => !v)}
      style={{
        width: "100%",
        padding: "10px 14px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      <span>Paso {step + 1} de {steps.length}</span>
      <span style={{ opacity: 0.9 }}>{mobileStepsOpen ? "▲" : "▼"}</span>
    </button>

    <div
      style={{
        marginTop: 10,
        height: 6,
        borderRadius: 999,
        background: "rgba(255,255,255,0.2)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${((step + 1) / steps.length) * 100}%`,
          height: "100%",
          background: "linear-gradient(90deg,#6366f1,#22d3ee)",
          transition: "width 0.25s ease",
        }}
      />
    </div>

    {mobileStepsOpen && (
      <div
        style={{
          marginTop: 12,
          borderRadius: 14,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          overflow: "hidden",
        }}
      >
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setStep(i);
                setMobileStepsOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                border: "none",
                background: active ? "rgba(255,255,255,0.10)" : "transparent",
                color: "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: active ? 900 : 700,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    background: done
                      ? "rgba(34,197,94,0.9)"
                      : active
                      ? "rgba(99,102,241,0.9)"
                      : "rgba(255,255,255,0.18)",
                    color: "#0f172a",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>

                <span>{s.title}</span>
              </span>

              <span style={{ opacity: 0.7 }}>{active ? "●" : ""}</span>
            </button>
          );
        })}
      </div>
    )}
  </div>
)}


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

            {/* Historial de movimientos */}
<div style={{ marginTop: 40 }}>

</div>
          </section>        
        </div>      
          <details style={{
  marginTop: 20,
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(15,23,42,0.03)"
}}>
  <summary style={{
    cursor: "pointer",
    listStyle: "none",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontWeight: 800
  }}>
    <span style={{ color: "#1e293b", fontWeight: 800 }}>
  📒 Historial de movimientos
</span>


  </summary>

  <div style={{
    padding: "0 16px 16px 16px"
  }}>
    {!loadingEntries && entries.length === 0 ? (
      <div style={{ color: "#64748b", paddingTop: 8 }}>Sin movimientos</div>
    ) : (
      <div style={{
  marginTop: 8,
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  width: "100%",
  maxWidth: "100%",
}}>

        <table style={{ 
  width: "100%", 
  minWidth: isMobile ? 0 : 700,
  borderCollapse: "collapse", 
  fontSize: 13 
}}>

          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 10px", color: "#475569" }}>Fecha</th>
              <th style={{ padding: "10px 10px", color: "#475569" }}>Movimiento</th>
              <th style={{ padding: "10px 10px", textAlign: "right", color: "#475569" }}>Cantidad</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((e) => {
              const isPlus = e.amount > 0;

              const label =
                e.type === "PURCHASE" ? "Compra" :
                e.type === "CONSUME" ? "Consumo" :
                e.type === "REFUND" ? "Reintegro" :
                e.type === "GRANT" ? "Bonificación" :
                e.type;

              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "#0f172a" }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>

                  <td style={{ padding: "10px 10px" }}>
                    <span style={{
                      display: "inline-block",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#0f172a"
                    }}>
                      {label}
                    </span>
                  </td>

                  <td style={{
                    padding: "10px 10px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: isPlus ? "#16a34a" : "#dc2626",
                    whiteSpace: "nowrap"
                  }}>
                    {isPlus ? `+${e.amount}` : e.amount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
</details>
      </div>      
    </div>
    );
}

/* ================== UI COMPONENTS ================== */
function FieldTitle({ children }: { children: React.ReactNode }) {
  return <div style={styles.fieldTitle}>{children}</div>;
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...styles.label, ...(style || {}) }}>{children}</div>;
}

function SmallMuted({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...styles.smallMuted, ...(style || {}) }}>{children}</div>;
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
  minHeight: "100vh",
  padding: 20,
  background: `
    radial-gradient(circle at 20% 20%, rgba(59,130,246,0.15), transparent 40%),
    radial-gradient(circle at 80% 0%, rgba(168,85,247,0.15), transparent 40%),
    linear-gradient(135deg, #0f172a 0%, #111827 100%)
  `,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  color: "#ffffff",
},
  shell: { maxWidth: 1100, margin: "0 auto" },
  header: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 24px",
  borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
  marginBottom: 30,
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
mainMobile: {
  display: "grid",
  gridTemplateColumns: "1fr",
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
    border: "1px solid #dbeafe",

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
  stepDotActive: { background: "#2563eb", color: "#ffffff" },
  stepDotDone: { background: "#16a34a", color: "#ffffff" },
  panel: {
  borderRadius: 24,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  width: "100%",
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
  code: {
    background: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  fieldTitle: { fontSize: 18, fontWeight: 900, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 800, marginBottom: 6, color: "#0f172a" },
  smallMuted: { fontSize: 12, color: "#64748b", marginTop: 6 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  box: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
  },
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
  pillsGrid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  pillMobile: { width: "100%", justifyContent: "center" },
  pillsGrid2Mobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  pillActive: { background: "#2563eb", borderColor: "#2563eb", color: "#ffffff" },
  btnPrimary: {
  background: "linear-gradient(135deg, #3b82f6 0%, #22c55e 100%)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "10px 14px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 28px rgba(59,130,246,0.25)",
},

btnSecondary: {
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.14)",
  padding: "10px 14px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
},

  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
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
  summaryItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    background: "#ffffff",
  },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  summaryValue: { fontSize: 13, color: "#0f172a", fontWeight: 900, marginTop: 4 },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  imgCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    background: "#ffffff",
  },
  loginCard: {
  maxWidth: 420,
  margin: "80px auto",
  padding: 40,
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  textAlign: "center",
},

loginTitle: {
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
},

loginSub: {
  marginTop: 16,
  fontSize: 13,
  color: "#64748b",
},
btnPremium: {
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  color: "#ffffff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(99,102,241,0.35)",
  transition: "all 0.2s ease",
},
btnGhostPremium: {
  background: "transparent",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  padding: "12px 18px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.2s ease",
},

};
