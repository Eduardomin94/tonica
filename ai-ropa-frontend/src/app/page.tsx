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
  const LAST_RESULT_KEY = "last_generation_result_v1";
  const [regenStartedAt, setRegenStartedAt] = useState<Record<string, number>>({});
  const regenLockRef = React.useRef<Record<string, boolean>>({});


  const [isMobile, setIsMobile] = useState(false);

  console.log("PAGE LOADED ✅", { isMobile });

  const [resultKeys, setResultKeys] = useState<Array<"front" | "back" | "left" | "right">>([]);
const [regenLoading, setRegenLoading] = useState<Record<string, boolean>>({});


  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [loadingMe, setLoadingMe] = useState(false);
  const [topupStatus, setTopupStatus] = useState<string | null>(null);

  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [selectedPack, setSelectedPack] = useState<"emprendedor" | "pyme" | "empresa">("emprendedor");
  const [buyLoading, setBuyLoading] = useState(false);

  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);

  const [views, setViews] = useState({
    front: true,
    back: false,
    left: false,
    right: false,
  });
const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
const frontCameraRef = React.useRef<HTMLInputElement | null>(null);
const frontGalleryRef = React.useRef<HTMLInputElement | null>(null);
const backCameraRef = React.useRef<HTMLInputElement | null>(null);
const backGalleryRef = React.useRef<HTMLInputElement | null>(null);
const hydratingRef = React.useRef(false);


function mergeFiles(prev: File[], incoming: File[]) {
  // evita duplicados por: name + size + lastModified
  const map = new Map<string, File>();
  for (const f of prev) map.set(`${f.name}-${f.size}-${f.lastModified}`, f);
  for (const f of incoming) map.set(`${f.name}-${f.size}-${f.lastModified}`, f);
  return Array.from(map.values());
}

function addProductFiles(files: File[]) {
  if (!files.length) return;
  setProductFiles((prev) => mergeFiles(prev, files));
}

function removeProductFile(index: number) {
  setProductFiles((prev) => prev.filter((_, i) => i !== index));
}


  const [language, setLanguage] = useState<"es" | "en" | "pt" | "ko" | "zh">("es");

  const translations = {
    es: {
      title: "Generador IA",
      subtitle: "Elegí el tipo de imagen que querés generar",
      buyCredits: "Comprar créditos",
      logout: "Cerrar sesión",
      credits: "Créditos",
      history: "Historial de movimientos",
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
      fetchMe();
      window.history.replaceState({}, "", "/");
      const timer = window.setTimeout(() => setTopupStatus(null), 5000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const [mode, setMode] = useState<"model" | "product">("model");

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

  // Google button init
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!(window as any).google) return;
      clearInterval(interval);

      const GOOGLE_CLIENT_ID =
        "177285831628-o6shn4e85ecub5jilj6tj02njbt9r6jf.apps.googleusercontent.com";

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
            if (!res.ok) throw new Error(data?.error || "Login error");

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
        el.innerHTML = "";
        (window as any).google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
        });
      }
    }, 300);

    return () => clearInterval(interval);
  }, [API]);

  React.useEffect(() => {
    if (user || accessToken) return;
    const w = window as any;
    if (!w.google?.accounts?.id) return;
    const el = document.getElementById("googleLoginDiv");
    if (!el) return;
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

  const isRegenBusy = useMemo(() => Object.keys(regenLoading).length > 0, [regenLoading]);

  const [nowTick, setNowTick] = useState(0);

React.useEffect(() => {
  if (!isRegenBusy) return;
  const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
  return () => window.clearInterval(id);
}, [isRegenBusy]);

  React.useEffect(() => {
  try {
    if (!result) {
      localStorage.removeItem(LAST_RESULT_KEY);
      return;
    }

    const payload = {
      result,
      resultKeys,
      mode,
      savedAt: Date.now(),
    };

    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(payload));
  } catch {}
}, [result, resultKeys, mode]);

  const selectedCount = useMemo(() => Object.values(views).filter(Boolean).length, [views]);
  const creditsNeeded = selectedCount;
  const hasSelection = creditsNeeded > 0;

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
  // ✅ si estamos restaurando desde localStorage, NO borres el resultado
  if (hydratingRef.current) return;

  setScene("");
  setStep(0);
  setError(null);
  setResult(null);

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
  setViews({ front: true, back: false, left: false, right: false });
}, [mode]);


  React.useEffect(() => {
    fetchMe();
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

    React.useEffect(() => {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed?.result?.imageUrls?.length) return;

    // ✅ activamos flag para que el reset por mode no borre el result
    hydratingRef.current = true;

    // setMode primero (si aplica)
    if (parsed?.mode === "model" || parsed?.mode === "product") {
      setMode(parsed.mode);
    }

    // restaurar result y keys
    setResult(parsed.result);
    if (Array.isArray(parsed.resultKeys)) setResultKeys(parsed.resultKeys);

    // ✅ desactivar flag en el próximo tick
    setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const stepError = useMemo(() => {
    const key = steps[step]?.key;

    if (key === "upload") {
      if (mode === "product") return productFiles.length === 0 ? "Subí al menos 1 foto del producto." : null;
      return !frontFile ? "Subí la foto Delantera (obligatorio)." : null;
    }

    if (key === "category") {
      if (!category) return "Elegí una categoría.";
      if (category === "otro") {
        if (!otherCategory.trim()) return "Completá 'Otro' (máx 4 palabras).";
        if (wordCount(otherCategory) > 4) return "'Otro' debe tener máximo 4 palabras.";
      }
      return null;
    }

    if (key === "pockets") return pockets ? null : "Indicá si tiene bolsillos (si/no).";
    if (key === "measures") return null;

    if (key === "scene") {
      if (!scene.trim()) return "Escribí la escena (máx 10 palabras).";
      if (wordCount(scene) > 10) return "La escena debe tener máximo 10 palabras.";
      return null;
    }

    if (key === "model") return modelType ? null : "Elegí el tipo de modelo.";
    if (key === "ethnicity") return ethnicity ? null : "Elegí la etnia.";
    if (key === "age") return ageRange ? null : "Elegí la edad.";
    if (key === "pose") return pose ? null : "Elegí la pose.";
    if (key === "bodyType") return bodyType ? null : "Elegí el tipo de cuerpo.";

    if (key === "background") {
      if (!background.trim()) return "Escribí el fondo (máx 10 palabras).";
      if (wordCount(background) > 10) return "El fondo debe tener máximo 10 palabras.";
      return null;
    }

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

  async function downloadImage(url: string, filename = "imagen.png") {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}
async function handleRegenerateOne(
  viewKey: "front" | "back" | "left" | "right",
  index: number
) {
  setError(null);

  const lockKey = `regen:${index}`;
  if (regenLockRef.current[lockKey]) return;
  regenLockRef.current[lockKey] = true;

  const loadKey = lockKey;

  if (!API) {
    delete regenLockRef.current[lockKey];
    return setError("Falta NEXT_PUBLIC_API_BASE en .env.local");
  }

  if (balance < 1) {
    delete regenLockRef.current[lockKey];
    return setError("Créditos insuficientes (rehacer cuesta 1 crédito).");
  }

  // Validaciones mínimas
  if (mode === "product") {
    if (productFiles.length === 0) {
      delete regenLockRef.current[lockKey];
      return setError("Subí al menos 1 foto del producto.");
    }
    if (!scene.trim() || wordCount(scene) > 10) {
      delete regenLockRef.current[lockKey];
      return setError("Escribí la escena (máx 10 palabras).");
    }
  } else {
    if (!frontFile) {
      delete regenLockRef.current[lockKey];
      return setError("Falta la foto delantera.");
    }
  }

  setRegenLoading((m) => ({ ...m, [loadKey]: true }));
  setRegenStartedAt((m) => ({ ...m, [loadKey]: Date.now() }));

  try {
    const oneView = { front: false, back: false, left: false, right: false, [viewKey]: true };

    const fd = new FormData();
    fd.append("mode", mode);
    fd.append("views", JSON.stringify(oneView));

    if (mode === "product") {
      productFiles.forEach((f) => fd.append("product_images", f));
      fd.append("scene", scene.trim());
    } else {
      fd.append("front", frontFile as File);
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || "Error rehaciendo");

    let url = "";
    if (Array.isArray(data?.imageUrls) && data.imageUrls[0]) url = data.imageUrls[0];
    else if (typeof data?.imageUrl === "string") url = data.imageUrl;

    if (!url) throw new Error("El servidor no devolvió imagen.");

    const absolute = url.startsWith("http") ? url : `${API}${url.startsWith("/") ? "" : "/"}${url}`;

    setResult((prev) => {
      if (!prev) return prev;
      const copy = [...prev.imageUrls];
      copy[index] = absolute;
      return { ...prev, imageUrls: copy };
    });

    await fetchMe();
    await fetchEntries();
  } catch (e: any) {
    setError(String(e?.message || e));
  } finally {

    console.log("FIN REGENERATE", { lockKey, loadKey });
    // ✅ limpiar loading
    setRegenLoading((m) => {
      const copy = { ...m };
      delete copy[loadKey];
      return copy;
    });

    setRegenStartedAt((m) => {
      const copy = { ...m };
      delete copy[loadKey];
      return copy;
    });

    // ✅ liberar lock
    delete regenLockRef.current[lockKey];
  }
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
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...styles.input,
        border: focused ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
      }}
    />
  );
}
function InputFile({
  onChange,
  isMobile,
}: {
  onChange: (f: File | null) => void;
  isMobile?: boolean;
}) {
  return (
    <input
      type="file"
      accept="image/*"
      {...(isMobile ? ({ capture: "environment" } as any) : {})}
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
          <button key={o.value} onClick={() => onChange(o.value)} style={{ ...styles.pill, ...(active ? styles.pillActive : {}) }}>
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
    background:
      'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(168,85,247,0.15), transparent 40%), linear-gradient(135deg, #0f172a 0%, #111827 100%)',
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    color: "#ffffff",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  shell: { width: "100%", maxWidth: 1100, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: "18px 24px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
    marginBottom: 30,
    boxSizing: "border-box",
    width: "100%",
    overflow: "hidden",
  },
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: -0.2 },
  h2: { marginTop: 6, color: "#475569" },

  userCard: {
  width: "100%",
  maxWidth: "100%",
  padding: "14px 16px",
  borderRadius: 18,
  background: "linear-gradient(145deg, #ffffff, #f1f5f9)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  color: "#0f172a",
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  alignItems: "stretch",
  overflow: "hidden",
  boxSizing: "border-box",
  marginBottom: 24,
},

  userEmail: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
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
  badgeClamp: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#bfdbfe",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  packCard: {
    width: "100%",
    maxWidth: "100%",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
    alignItems: "stretch",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  packSelect: {
    height: 40,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  buyBtnFull: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#ffffff",
    border: "none",
    height: 40,
    padding: "0 16px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(99,102,241,0.35)",
    transition: "all 0.2s ease",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    display: "block",
  },
  logoutBtnFull: {
    background: "transparent",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    height: 40,
    padding: "0 14px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s ease",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  main: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" },
  mainMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 16, alignItems: "start" },

  panel: {
    borderRadius: 24,
    padding: 28,
    paddingBottom: 36,
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
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
    borderTop: "1px solid rgba(255,255,255,0.15)",
  },

  fieldTitle: { fontSize: 18, fontWeight: 900, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#cbd5e1", letterSpacing: 0.3 },
  smallMuted: { fontSize: 12, color: "#94a3b8", marginTop: 6 },

  row: { display: "flex", alignItems: "center", gap: 10 },
  twoCols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },

  box: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    outline: "none",
    fontSize: 14,
    backdropFilter: "blur(6px)",
    transition: "all 0.25s ease",
    boxSizing: "border-box",
  },

  file: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    boxSizing: "border-box",
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
    boxSizing: "border-box",
  },

  summaryCard: {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
  marginBottom: 22, // <-- más espacio con lo de abajo
},

  summaryTitle: { fontWeight: 900, marginBottom: 10 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },

  summaryItem: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  summaryValue: { fontSize: 13, color: "#0f172a", fontWeight: 900, marginTop: 4 },

  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  imgCard: { border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#ffffff" },

  loginCard: {
    maxWidth: 420,
    margin: "80px auto",
    padding: 40,
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
    textAlign: "center",
    color: "#0f172a",
  },
  loginTitle: { fontSize: 24, fontWeight: 800, color: "#0f172a" },
  loginSub: { marginTop: 16, fontSize: 13, color: "#64748b" },
  previewGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
},

previewCard: {
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  padding: 8,
},


previewImg: {
  width: "100%",
  height: 180,
  objectFit: "contain",
  display: "block",
  background: "rgba(255,255,255,0.06)",
},

};
