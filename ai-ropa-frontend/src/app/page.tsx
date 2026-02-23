"use client";
import React, { useMemo, useState } from "react";
import { Inter } from "next/font/google";
import { translations, type Lang } from "@/app/i18n/translations";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/* ================== CONSTANTES ================== */

const CATEGORIES = [
  { value: "top", labelKey: "catTop" },
  { value: "outerwear", labelKey: "catOuterwear" },
  { value: "bottom", labelKey: "catBottom" },
  { value: "dress", labelKey: "catDress" },
  { value: "set", labelKey: "catSet" },
  { value: "swim", labelKey: "catSwim" },
  { value: "body", labelKey: "catBody" },
  { value: "other", labelKey: "catOther" },
] as const;

const MODEL_TYPES = [
  { value: "newborn", labelKey: "modelNewborn" },
  { value: "boy", labelKey: "modelBoy" },
  { value: "girl", labelKey: "modelGirl" },
  { value: "man", labelKey: "modelMan" },
  { value: "woman", labelKey: "modelWoman" },
] as const;

const ETHNICITIES = [
  { value: "caucasian", labelKey: "ethCaucasian" },
  { value: "latino", labelKey: "ethLatino" },
  { value: "asian", labelKey: "ethAsian" },
  { value: "black", labelKey: "ethBlack" },
  { value: "mediterranean", labelKey: "ethMediterranean" },
] as const;

const POSES = [
  { value: "sitting", labelKey: "poseSitting" },
  { value: "standing", labelKey: "poseStanding" },
  { value: "walking", labelKey: "poseWalking" },
] as const;

const BODY_TYPES = [
  { value: "standard", labelKey: "bodyStandard" },
  { value: "plus", labelKey: "bodyPlus" },
] as const;

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes whatsappPulse {
      0% { box-shadow: 0 0 0 0 rgba(37,211,102,0.6); }
      70% { box-shadow: 0 0 0 18px rgba(37,211,102,0); }
      100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
    }
  `;
  document.head.appendChild(style);
}


/* ================== APP ================== */
export default function Home() {
  const [language, setLanguage] = useState<"es" | "en" | "pt" | "ko" | "zh">("es");
 const t = (key: string, ...args: any[]) => {
  const dict = (translations as any)[language] || {};
  const fallbackEn = (translations as any).en || {};
  const fallbackEs = (translations as any).es || {};

  const val = dict?.[key] ?? fallbackEn?.[key] ?? fallbackEs?.[key];
  if (typeof val === "function") return val(...args);
  return String(val ?? key);
};

function appendProductFormData(fd: FormData) {
  productFiles.forEach((f) => fd.append("product_images", f));
  fd.append("scene", scene.trim());
}

function appendModelFormData(fd: FormData) {
  // ✅ NOMBRES DE ARCHIVOS (multer suele esperar estos)
  if (frontFile) fd.append("front", frontFile);
  if (backFile) fd.append("back", backFile);
  if (faceFile) fd.append("face", faceFile);

  // Campos (texto)
  fd.append("category", category || "");
  fd.append("other_category", otherCategory.trim());
  fd.append("pockets", pockets || "");

  fd.append("model_type", modelType || "");
  fd.append("ethnicity", ethnicity || "");
  fd.append("age_range", ageRange || "");
  fd.append("background", background.trim());
  fd.append("pose", pose || "");
  fd.append("body_type", bodyType || "");

  fd.append("measures", JSON.stringify(measures));
}

function labelFromList<T extends { value: string; labelKey: string }>(
  list: readonly T[],
  value: string | ""
) {
  if (!value) return "";
  const item = list.find((x) => x.value === value);
  return item ? t(item.labelKey) : "";
}

  const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  console.log("API URL:", API);
  const LAST_RESULT_KEY = "last_generation_result_v1";

  const [regenStartedAt, setRegenStartedAt] = useState<Record<string, number>>({});
  const regenLockRef = React.useRef<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState(false);
  
const [genProgress, setGenProgress] = useState<{ total: number; done: number; current?: string } | null>(null);
const [genStatuses, setGenStatuses] = useState<Record<string, "pending" | "ok" | "fail">>({});
  console.log("PAGE LOADED ✅", { isMobile });

  const [resultKeys, setResultKeys] = useState<Array<"front" | "back">>([]);
  const [regenLoading, setRegenLoading] = useState<Record<string, boolean>>({});

  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [loadingMe, setLoadingMe] = useState(false);
  const [topupStatus, setTopupStatus] = useState<string | null>(null);

  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesPage, setEntriesPage] = useState(1);
  const ENTRIES_PAGE_SIZE = 10;

  const [selectedPack, setSelectedPack] = useState<"emprendedor" | "pyme" | "empresa">("emprendedor");
  const [buyLoading, setBuyLoading] = useState(false);

  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);

  const [views, setViews] = useState({
  front: true,
  back: false,
  side: false,
  frontDetail: false,
  backDetail: false,
  pantFrontDetail: false,
  pantBackDetail: false,
  pantSideDetail: false,
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
  const [faceFile, setFaceFile] = useState<File | null>(null); // 👈 NUEVO (rostro opcional)
  const [productFiles, setProductFiles] = useState<File[]>([]);

  // refs rostro
  const faceCameraRef = React.useRef<HTMLInputElement | null>(null);
  const faceGalleryRef = React.useRef<HTMLInputElement | null>(null);

  const [faceGenLoading, setFaceGenLoading] = useState(false);
  
  // ===== PREVIEWS (con cleanup para no filtrar memoria) =====
const frontPreview = useMemo(() => (frontFile ? URL.createObjectURL(frontFile) : null), [frontFile]);
React.useEffect(() => {
  return () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
  };
}, [frontPreview]);

const backPreview = useMemo(() => (backFile ? URL.createObjectURL(backFile) : null), [backFile]);
React.useEffect(() => {
  return () => {
    if (backPreview) URL.revokeObjectURL(backPreview);
  };
}, [backPreview]);

const facePreview = useMemo(() => (faceFile ? URL.createObjectURL(faceFile) : null), [faceFile]);
React.useEffect(() => {
  return () => {
    if (facePreview) URL.revokeObjectURL(facePreview);
  };
}, [facePreview]);


const productPreviews = useMemo(
  () => productFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
  [productFiles]
);
React.useEffect(() => {
  return () => {
    productPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  };
}, [productPreviews]);

  // form
  type CategoryValue = (typeof CATEGORIES)[number]["value"];
const [category, setCategory] = useState<CategoryValue | "">("");
  React.useEffect(() => {
  if (category !== "bottom") {
    setViews((prev) => ({
      ...prev,
      pantFrontDetail: false,
      pantBackDetail: false,
      pantSideDetail: false,
    }));
  }
}, [category]);

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

            await fetchMe();
            await fetchEntries();
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

  type ModelTypeValue = (typeof MODEL_TYPES)[number]["value"];
const [modelType, setModelType] = useState<ModelTypeValue | "">("");
  type EthnicityValue = (typeof ETHNICITIES)[number]["value"];
const [ethnicity, setEthnicity] = useState<EthnicityValue | "">("");
  const [ageRange, setAgeRange] = useState("");
  const [background, setBackground] = useState("");
  const [scene, setScene] = useState("");
  type PoseValue = (typeof POSES)[number]["value"];
const [pose, setPose] = useState<PoseValue | "">("");
  type BodyTypeValue = (typeof BODY_TYPES)[number]["value"];
const [bodyType, setBodyType] = useState<BodyTypeValue | "">("");

  // ui
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [bgSuggestions, setBgSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [failedViews, setFailedViews] = useState<string[]>([]);
  const [result, setResult] = useState<{ imageUrls: string[]; promptUsed?: string } | null>(null);

 const isRegenBusy = useMemo(
  () => Object.values(regenLoading).some(Boolean),
  [regenLoading]
);


  const [bonusTick, setBonusTick] = useState(0);

React.useEffect(() => {
  const id = window.setInterval(() => setBonusTick((n) => n + 1), 1000);
  return () => window.clearInterval(id);
}, []);

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
      const payload = { result, resultKeys, mode, savedAt: Date.now() };
      localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(payload));
    } catch {}
  }, [result, resultKeys, mode]);

  const selectedCount = useMemo(() => Object.values(views).filter(Boolean).length, [views]);
  const creditsNeeded = selectedCount;
  const hasSelection = creditsNeeded > 0;

 const ageOptions = useMemo(() => {
  if (modelType === "newborn") return ["age_0_2"];
  if (modelType === "boy" || modelType === "girl") return ["age_3_6", "age_6_10", "age_10_16"];
  if (modelType === "man" || modelType === "woman") return ["age_18_24", "age_25_34", "age_35_44"];
  return [];
}, [modelType]);

 const steps = useMemo(() => {
  if (mode === "product") {
    return [
      { title: t("stepUpload"), key: "upload" },
      { title: t("stepScene"), key: "scene" },
      { title: t("stepGenerate"), key: "generate" },
    ];
  }

  return [
    { title: t("stepUpload"), key: "upload" },
    { title: t("stepCategory"), key: "category" },
    { title: t("stepPockets"), key: "pockets" },
    { title: t("stepMeasures"), key: "measures" },
    { title: t("stepModel"), key: "model" },
    { title: t("stepEthnicity"), key: "ethnicity" },
    { title: t("stepAge"), key: "age" },
    { title: t("stepFace"), key: "face" },
    { title: t("stepBackground"), key: "background" },
    { title: t("stepPose"), key: "pose" },
    { title: t("stepBodyType"), key: "bodyType" },
    { title: t("stepGenerate"), key: "generate" },
  ];
}, [mode, language]);

  React.useEffect(() => {
    // ✅ si estamos restaurando desde localStorage, NO borres el resultado
    if (hydratingRef.current) return;

    setScene("");
    setStep(0);
    setError(null);
    setResult(null);
    setFrontFile(null);
    setBackFile(null);
    setFaceFile(null);
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
    setViews({
  front: true,
  back: false,
  side: false,
  frontDetail: false,
  backDetail: false,
  pantFrontDetail: false,
  pantBackDetail: false,
  pantSideDetail: false,
  left: false,
  right: false,
});



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
      if (mode === "product") return productFiles.length === 0 ? t("errUploadProduct") : null;
return !frontFile ? t("errUploadFront") : null;
    }

    if (key === "category") {
  if (!category) return t("errChooseCategory");

  if (category === "other") {
  if (!otherCategory.trim()) return t("errOtherMissing");
  if (wordCount(otherCategory) > 5) return t("errOtherTooLong");
}

  return null;
}

    if (key === "pockets") return pockets ? null : t("errPockets");
    if (key === "measures") return null;

    if (key === "scene") {
  if (!scene.trim()) return t("errSceneMissing");
  if (wordCount(scene) > 10) return t("errSceneTooLong");
  return null;
}

    if (key === "model") return modelType ? null : t("errModel");
    if (key === "ethnicity") return ethnicity ? null : t("errEthnicity");
    if (key === "age") return ageRange ? null : t("errAge");
    if (key === "pose") return pose ? null : t("errPose");
    if (key === "bodyType") return bodyType ? null : t("errBodyType");

    if (key === "background") {
  if (!background.trim()) return t("errBgMissing");
  if (wordCount(background) > 10) return t("errBgTooLong");
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
          if (category === "other" && (!otherCategory.trim() || wordCount(otherCategory) > 4)) return setStep(1);
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
      const list = Array.isArray(data?.entries) ? data.entries : [];
setEntries(list);
setEntriesPage(1);
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
  viewKey:
    | "front"
    | "back"
    | "side"
    | "frontDetail"
    | "backDetail"
    | "pantFrontDetail"
    | "pantBackDetail"
    | "pantSideDetail"
    | "left"
    | "right",
  index: number
) {




  setError(null);

  const lockKey = `regen:${index}`;

  // Si ya hay uno corriendo para ese índice, no hagas nada
  if (regenLockRef.current[lockKey]) return;

  // Tomo el lock
  regenLockRef.current[lockKey] = true;

  // Helper para salir pero liberando lock
  const bail = (msg: string) => {
    setError(msg);
  };

  try {
    if (!API) {
      bail(t("missingApiBase"));
      return;
    }

    if (balance < 1) {
      bail(t("noCreditsRedo"));
      return;
    }

    // Validaciones mínimas
    if (mode === "product") {
      if (productFiles.length === 0) {
        bail(t("errUploadProduct"));
        return;
      }
      if (!scene.trim()) {
  bail(t("errSceneMissing"));
  return;
}
if (wordCount(scene) > 10) {
  bail(t("errSceneTooLong"));
  return;
}
    } else {
      if (!frontFile) {
  bail(t("errUploadFront"));
  return;
}
      if (!category) {
  bail(t("errChooseCategory"));
  return;
}
if (!pockets) {
  bail(t("errPockets"));
  return;
}
if (!modelType) {
  bail(t("errModel"));
  return;
}
if (!ethnicity) {
  bail(t("errEthnicity"));
  return;
}
if (!ageRange) {
  bail(t("errAge"));
  return;
}
if (!background.trim()) {
  bail(t("errBgMissing"));
  return;
}
if (wordCount(background) > 10) {
  bail(t("errBgTooLong"));
  return;
}
if (!pose) {
  bail(t("errPose"));
  return;
}
if (!bodyType) {
  bail(t("errBodyType"));
  return;
}
    }

    // Ahora sí: marcamos loading
    setRegenLoading((m) => ({ ...m, [lockKey]: true }));
    setRegenStartedAt((m) => ({ ...m, [lockKey]: Date.now() }));

   const oneView = { front: false, back: false, [viewKey]: true };


    const fd = new FormData();
    fd.append("mode", mode);
    fd.append("views", JSON.stringify(oneView));
    fd.append("language", language);
    fd.append("regen_variation", String(Date.now()));
    fd.append("regen_variation", String(Date.now()));

    if (mode === "product") {
      appendProductFormData(fd);
    } else {
      appendModelFormData(fd);
    }

    const token = localStorage.getItem("accessToken");
    console.log("=== FORM DATA DEBUG ===");
for (const [k, v] of fd.entries()) {
  if (v instanceof File) {
    console.log(k, `File(name=${v.name}, size=${v.size}, type=${v.type})`);
  } else {
    console.log(k, v);
  }
}
console.log("=== END FORM DATA DEBUG ===");
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

    void fetchMe();
void fetchEntries();

  } catch (e: any) {
    setError(String(e?.message || e));
  } finally {
    // ✅ esperar 2 frames para que el <img> pinte antes de sacar el overlay
    setTimeout(() => {
  setRegenLoading((m) => {
    const copy = { ...m };
    delete copy[lockKey];
    return copy;
  });

  setRegenStartedAt((m) => {
    const copy = { ...m };
    delete copy[lockKey];
    return copy;
  });

  delete regenLockRef.current[lockKey];
}, 80);
  }
}


  async function handleSuggestBackground() {
    setError(null);
    if (!API) return setError(t("missingApiBase"));
    setHelpLoading(true);
    setBgSuggestions([]);

    try {
      const fd = new FormData();
fd.append("category", category || "");
fd.append("model_type", modelType || "");
fd.append("vibe", "catálogo e-commerce premium");
fd.append("language", language);

if (frontFile) fd.append("front", frontFile); // 👈 clave

const res = await fetch(`${API}/suggest-background`, {
  method: "POST",
  body: fd,
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
  setFailedViews([]);
  
  if (!API) return setError(t("missingApiBase"));

  // Validaciones
  if (mode === "product") {
    if (productFiles.length === 0) {
      setStep(0);
      return setError(t("errUploadProduct"));
    }
    if (!scene.trim()) {
      setStep(1);
      return setError(t("errSceneMissing"));
    }
    if (wordCount(scene) > 10) {
      setStep(1);
      return setError(t("errSceneTooLong"));
    }
    if (selectedCount === 0) {
      setStep(2);
      return setError(t("chooseAtLeastOneView"));
    }
  } else {
    if (!frontFile) return (goToFirstErrorStep(), setError(t("errUploadFront")));
    if (!category) return (goToFirstErrorStep(), setError(t("errChooseCategory")));
    if (category === "other") {
      if (!otherCategory.trim()) return (goToFirstErrorStep(), setError(t("errOtherMissing")));
      if (wordCount(otherCategory) > 4) return (goToFirstErrorStep(), setError(t("errOtherTooLong")));
    }
    if (!pockets) return (goToFirstErrorStep(), setError(t("errPockets")));
    if (!modelType) return (goToFirstErrorStep(), setError(t("errModel")));
    if (!ethnicity) return (goToFirstErrorStep(), setError(t("errEthnicity")));
    if (!ageRange) return (goToFirstErrorStep(), setError(t("errAge")));
    if (!background.trim()) return (goToFirstErrorStep(), setError(t("errBgMissing")));
    if (wordCount(background) > 10) return (goToFirstErrorStep(), setError(t("errBgTooLong")));
    if (!pose) return (goToFirstErrorStep(), setError(t("errPose")));
    if (!bodyType) return (goToFirstErrorStep(), setError(t("errBodyType")));
  }

  const keysInOrder =
    mode === "product"
      ? (["front", "back", "left", "right"] as const).filter((k) => (views as any)[k])
      : ([
          "front",
          "back",
          "side",
          "frontDetail",
          "backDetail",
          "pantFrontDetail",
          "pantBackDetail",
          "pantSideDetail",
        ] as const).filter((k) => (views as any)[k]);

  setResultKeys(keysInOrder as any);

  setLoading(true);
  try {
    const fd = new FormData();
    fd.append("mode", mode);
    console.log("DEBUG FRONTEND views:", views);
    fd.append("views", JSON.stringify(views));
    fd.append("language", language);

    if (mode === "product") appendProductFormData(fd);
    else appendModelFormData(fd);

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
      setError(data?.error || data?.message || `Error ${res.status}: ${String(text).slice(0, 200)}`);
      return;
    }
    const failed = Array.isArray(data?.failedViews) ? data.failedViews : [];
setFailedViews(failed);

    let urls: string[] = [];
    if (Array.isArray(data?.imageUrls)) urls = data.imageUrls;
    else if (typeof data?.imageUrl === "string") urls = [data.imageUrl];

    if (!urls.length) {
      setError("El servidor no devolvió imágenes.");
      return;
    }

    const absolute = urls.map((u) => (u.startsWith("http") ? u : `${API}${u.startsWith("/") ? "" : "/"}${u}`));
    if (Array.isArray(data?.imageKeys)) {
  setResultKeys(data.imageKeys);
}
    setResult({ imageUrls: absolute, promptUsed: data?.promptUsed });

    await fetchMe();
    await fetchEntries();

    
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
            <FieldTitle>{t("uploadTitle")}</FieldTitle>

            {mode === "product" ? (
              <Box>
                <Label>{t("productPhotosLabel")}</Label>

                {/* Inputs ocultos */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    addProductFiles(files);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    addProductFiles(files);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />

                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{
                      ...styles.buyBtnFull,
                      height: 44,
                      boxShadow: "0 8px 20px rgba(34,197,94,0.22)",
                      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    }}
                  >
                    {t("takePhoto")}
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    style={{
                      ...styles.logoutBtnFull,
                      height: 44,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {t("pickFromGallery")}
                  </button>
                </div>

                {productFiles.length > 0 && (
                  <SmallMuted style={{ marginTop: 10 }}>
  {t("photosLoaded", productFiles.length)}
</SmallMuted>
                )}
                {productPreviews.length > 0 && (
  <div style={{ marginTop: 12 }}>
    <div style={{ fontWeight: 900, marginBottom: 10, color: "#0f172a" }}>
  {t("preview")}
</div>

    <div style={styles.previewGridCompact}>
      {productPreviews.map((p, i) => (
        <div key={`${p.file.name}-${p.file.size}-${p.file.lastModified}`} style={{ ...styles.previewCard, position: "relative" }}>
          <img src={p.url} alt={`producto-${i}`} 
          style={styles.previewImgCompact} />

          <button
            type="button"
            onClick={() => removeProductFile(i)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(15,23,42,0.85)",
              color: "#ffffff",
              fontWeight: 900,
              cursor: "pointer",
            }}
            aria-label="Quitar imagen"
            title="Quitar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  </div>
)}
              </Box>
            ) : (
              <TwoCols>
                {/* DELANTERA */}
                <Box>
                  <Label>{t("frontRequired")}</Label>

                  <input
                    ref={frontCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setFrontFile(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={frontGalleryRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setFrontFile(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                  />

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => frontCameraRef.current?.click()}
                      style={{
                        ...styles.buyBtnFull,
                        height: 44,
                        boxShadow: "0 8px 20px rgba(34,197,94,0.22)",
                        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                      }}
                    >
                       {t("takePhoto")}
                    </button>

                    <button
                      type="button"
                      onClick={() => frontGalleryRef.current?.click()}
                      style={{
                        ...styles.logoutBtnFull,
                        height: 44,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {t("pickFromGallery")}
                    </button>
                  </div>

                  {frontFile && (
  <div style={{ marginTop: 12 }}>
    <div style={{ ...styles.previewCard, position: "relative" }}>
      <img src={frontPreview || ""} alt={t("frontRequired")} style={styles.previewImg} />
      <button
        type="button"
        onClick={() => setFrontFile(null)}
       style={{
  position: "absolute",
  top: 10,
  right: 10,
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "rgba(255,255,255,0.95)",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 16,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
}}
        aria-label="Quitar delantera"
        title="Quitar"
      >
        ✕
      </button>
    </div>

    <SmallMuted style={{ marginTop: 8 }}>{frontFile.name}</SmallMuted>
  </div>
)}
                </Box>

                {/* ESPALDA */}
                <Box>
                  <Label>{t("backOptional")}</Label>

                  <input
                    ref={backCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setBackFile(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={backGalleryRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setBackFile(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                  />

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => backCameraRef.current?.click()}
                      style={{
                        ...styles.buyBtnFull,
                        height: 44,
                        boxShadow: "0 8px 20px rgba(34,197,94,0.22)",
                        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                      }}
                    >
                      {t("takePhoto")}
                    </button>

                    <button
                      type="button"
                      onClick={() => backGalleryRef.current?.click()}
                      style={{
                        ...styles.logoutBtnFull,
                        height: 44,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {t("pickFromGallery")}
                    </button>
                  </div>

                  {backFile && (
  <div style={{ marginTop: 12 }}>
    <div style={{ ...styles.previewCard, position: "relative" }}>
      <img src={backPreview || ""} alt={t("backOptional")} style={styles.previewImg} />
      <button
        type="button"
        onClick={() => setBackFile(null)}
        style={{
  position: "absolute",
  top: 10,
  right: 10,
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "rgba(255,255,255,0.95)",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 16,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
}}
        aria-label="Quitar espalda"
        title="Quitar"
      >
        ✕
      </button>
    </div>

    <SmallMuted style={{ marginTop: 8 }}>{backFile.name}</SmallMuted>
  </div>
)}
                </Box>
              </TwoCols>
            )}
          </>
        );

      case "category":
        return (
          <>
            <FieldTitle>{t("categoryTitle")}</FieldTitle>

            <div style={isMobile ? styles.pillsGrid2Mobile : styles.pillsGrid2}>
              {CATEGORIES.map((c) => (
  <button
    key={c.value}
    type="button"
    onClick={() => setCategory(c.value as any)}
    style={{
      ...styles.pill,
      ...(isMobile ? styles.pillMobile : {}),
      ...(category === c.value ? styles.pillActive : {}),
    }}
  >
    {t(c.labelKey)}
  </button>
))}
            </div>

            {category === "other" && (
              <div style={{ marginTop: 12 }}>
                <Label>{t("otherSpecify")}</Label>
                <TextInput
  value={otherCategory}
  onChange={setOtherCategory}
  placeholder={t("otherExample")}
/>
                <SmallMuted>
  {t("words", wordCount(otherCategory), 5)}
</SmallMuted>
              </div>
            )}
          </>
        );

      case "pockets":
        return (
          <>
            <FieldTitle>{t("pocketsTitle")}</FieldTitle>
            <RadioPills
              value={pockets}
              onChange={(v) => setPockets(v as any)}
              options={[
  { value: "si", label: t("yes") },
  { value: "no", label: t("no") },
]}
            />
          </>
        );

      case "measures":
        return (
          <>
            <FieldTitle>{t("measuresTitle")}</FieldTitle>
            <SmallMuted>{t("measuresHint")}</SmallMuted>

            <Grid3>
              {Object.entries(measures).map(([k, v]) => (
                <div key={k}>
                  <Label>{t(`m_${k}`)}</Label>
<TextInput
  value={v}
  onChange={(nv) => setMeasures((m) => ({ ...m, [k]: nv }))}
  placeholder={t("exampleCm")}
/>
                </div>
              ))}
            </Grid3>
          </>
        );

      case "model":
  return (
    <>
      <FieldTitle>{t("modelTitle")}</FieldTitle>
      <RadioPills
  value={modelType}
  onChange={(v) => {
    setModelType(v as any);
    setAgeRange("");
  }}
  options={MODEL_TYPES.map((m) => ({
    value: m.value,
    label: t(m.labelKey),
  }))}
/>
    </>
  );

  {faceFile && (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...styles.previewCard, position: "relative" }}>
        <img src={facePreview || ""} alt="rostro" style={styles.previewImg} />
        <button
          type="button"
          onClick={() => setFaceFile(null)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "1px solid rgba(15,23,42,0.15)",
            background: "rgba(255,255,255,0.95)",
            color: "#0f172a",
            fontWeight: 900,
            fontSize: 16,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
          }}
          aria-label="Quitar rostro"
          title="Quitar"
        >
          ✕
        </button>
      </div>

      <SmallMuted style={{ marginTop: 8 }}>{faceFile?.name}</SmallMuted>
    </div>
  )}

      case "ethnicity":
        return (
          <>
            <FieldTitle>{t("ethnicityTitle")}</FieldTitle>

            <div style={isMobile ? styles.pillsGrid2Mobile : styles.pillsGrid2}>
              {ETHNICITIES.map((e) => (
  <button
    key={e.value}
    type="button"
    onClick={() => setEthnicity(e.value as any)}
    style={{
      ...styles.pill,
      ...(isMobile ? styles.pillMobile : {}),
      ...(ethnicity === e.value ? styles.pillActive : {}),
    }}
  >
    {t(e.labelKey)}
  </button>
))}
            </div>
          </>
        );

      case "age":
  return (
    <>
      <FieldTitle>{t("ageTitle")}</FieldTitle>

      {!modelType ? (
        <SmallMuted>{t("chooseModelFirst")}</SmallMuted>
      ) : (
        <RadioPills
          value={ageRange}
          onChange={(v) => setAgeRange(v)}
          options={ageOptions.map((k) => ({ value: k, label: t(k) }))}
        />
      )}
    </>
  );

        case "face":
  return (
    <>
      <FieldTitle>{t("faceTitle")}</FieldTitle>

      <SmallMuted>
  {t("faceHint1")}
  <br />
  {t("faceHint2")}
</SmallMuted>

      {/* Inputs ocultos */}
      <input
        ref={faceCameraRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => {
          setFaceFile(e.target.files?.[0] || null);
          e.currentTarget.value = "";
        }}
        style={{ display: "none" }}
      />
      <input
        ref={faceGalleryRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          setFaceFile(e.target.files?.[0] || null);
          e.currentTarget.value = "";
        }}
        style={{ display: "none" }}
      />

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => faceCameraRef.current?.click()}
          style={{ ...styles.buyBtnFull, height: 44 }}
        >
          {t("takeFacePhoto")}
        </button>

        <button
          type="button"
          onClick={() => faceGalleryRef.current?.click()}
          style={{ ...styles.logoutBtnFull, height: 44, background: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          {t("pickFromGallery")}
        </button>

        <button
          type="button"
          disabled={faceGenLoading || !modelType || !ethnicity || !ageRange}
          onClick={async () => {
            try {
              setError(null);
              if (!API) return setError("Falta NEXT_PUBLIC_API_URL en .env.local");

              if (!modelType || !ethnicity || !ageRange) {
                return setError("Elegí tipo de modelo, etnia y edad antes de generar el rostro.");
              }

              setFaceGenLoading(true);

              const token = localStorage.getItem("accessToken");
              const res = await fetch(`${API}/generate-face`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  model_type: modelType,
                  ethnicity,
                  age_range: ageRange,
                  body_type: bodyType || "",
                }),
              });

              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || "Error generando rostro");

              const url = String(data?.imageUrl || "");
              if (!url) throw new Error("El servidor no devolvió imageUrl");

              const absolute = url.startsWith("http") ? url : `${API}${url.startsWith("/") ? "" : "/"}${url}`;

              const imgRes = await fetch(absolute);
              const blob = await imgRes.blob();
              const file = new File([blob], `face-${Date.now()}.png`, { type: blob.type || "image/png" });

              setFaceFile(file);
            } catch (e: any) {
              setError(String(e?.message || e));
            } finally {
              setFaceGenLoading(false);
            }
          }}
          style={{
            ...styles.buyBtnFull,
            height: 44,
            opacity: faceGenLoading || !modelType || !ethnicity || !ageRange ? 0.65 : 1,
            cursor: faceGenLoading || !modelType || !ethnicity || !ageRange ? "not-allowed" : "pointer",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        >
          {faceGenLoading ? t("genFaceLoading") : t("genFace")}
        </button>
      </div>

      {faceFile && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...styles.previewCard, position: "relative" }}>
            <img src={facePreview || ""} alt="rostro" style={styles.previewImg} />
            <button
              type="button"
              onClick={() => setFaceFile(null)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "rgba(255,255,255,0.95)",
                color: "#0f172a",
                fontWeight: 900,
                fontSize: 16,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
              }}
              aria-label="Quitar rostro"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );

      case "background":
        return (
          <>
            <FieldTitle>{t("backgroundTitle")}</FieldTitle>
            <TextInput value={background} onChange={setBackground} placeholder={t("bgPlaceholder")} />

            <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
              <SmallMuted>
  {t("words", wordCount(background), 10)}
</SmallMuted>
              <Button variant="secondary" onClick={handleSuggestBackground} disabled={helpLoading || !category || !modelType}>
                {helpLoading ? t("searching") : t("helpChoosePlace")}
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
            <FieldTitle>{t("poseTitle")}</FieldTitle>
            <RadioPills
  value={pose}
  onChange={(v) => setPose(v as any)}
  options={POSES.map((p) => ({
    value: p.value,
    label: t(p.labelKey),
  }))}
/>
          </>
        );

      case "bodyType":
        return (
          <>
            <FieldTitle>{t("bodyTypeTitle")}</FieldTitle>
            <RadioPills
  value={bodyType}
  onChange={(v) => setBodyType(v as any)}
  options={BODY_TYPES.map((b) => ({
    value: b.value,
    label: t(b.labelKey),
  }))}
/>
          </>
        );

      case "scene":
        return (
          <>
            <FieldTitle>{t("sceneTitle")}</FieldTitle>
            <TextInput
  value={scene}
  onChange={setScene}
  placeholder={t("scenePlaceholder")}
/>

            <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
              <SmallMuted>{t("words", wordCount(scene), 10)}</SmallMuted>

              <Button
                variant="secondary"
                onClick={async () => {
                  if (!API) return setError("Falta NEXT_PUBLIC_API_BASE");
                  setHelpLoading(true);
                  try {
                    const fd = new FormData();
fd.append("category", category || "");
fd.append("model_type", modelType || "");
fd.append("vibe", "catálogo e-commerce premium");
fd.append("language", language);

if (mode === "product" && productFiles.length > 0) {
  fd.append("front", productFiles[0]); // usa la primera foto del producto
} else if (frontFile) {
  fd.append("front", frontFile); // modo model
}

const res = await fetch(`${API}/suggest-background`, {
  method: "POST",
  body: fd,
});
                    const data = await res.json();
                    if (Array.isArray(data?.options) && data.options.length > 0) setScene(data.options[0]);
                  } catch (err: any) {
                    setError(String(err?.message || err));
                  } finally {
                    setHelpLoading(false);
                  }
                }}
                disabled={helpLoading}
              >
                {helpLoading ? t("searching") : t("helpChoose")}
              </Button>
            </Row>
          </>
        );

      case "generate":
        return (
          <>
            <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  }}
>
  <FieldTitle>{t("generateTitle")}</FieldTitle>

  <div
    style={{
      background: "rgba(251,191,36,0.15)",
      border: "1px solid rgba(251,191,36,0.4)",
      color: "#facc15",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      maxWidth: 360,
    }}
  >
    ⚠ {t("viewsDisclaimer")}
  </div>
</div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryTitle}>{t("summary")}</div>

              {/* ====== FOTOS PREVIEW ====== */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
  {t("uploadedPhotos")}
</div>

                {mode === "product" ? (
                  <div style={styles.previewGrid}>
                    {productFiles.map((file, i) => (
                      <div key={i} style={styles.previewCard}>
                        <img src={URL.createObjectURL(file)} alt={`producto-${i}`} style={styles.previewImg} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.previewGrid}>
                    {frontFile && (
                      <div style={styles.previewCard}>
                        <img src={URL.createObjectURL(frontFile)} alt="delantera" style={styles.previewImg} />
                      </div>
                    )}
                    {backFile && (
                      <div style={styles.previewCard}>
                        <img src={URL.createObjectURL(backFile)} alt="espalda" style={styles.previewImg} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ====== DATOS ====== */}
              {mode === "product" ? (
                <div style={{ ...styles.summaryGrid, gridTemplateColumns: "1fr" }}>
                  <SummaryItem label={t("sceneLabel")} value={scene} />
                </div>
              ) : (
                <ModelSummary
  t={t}
  category={category}
  otherCategory={otherCategory}
  pockets={pockets}
  modelType={modelType}
  ethnicity={ethnicity}
  ageRange={ageRange}
  background={background}
  pose={pose}
  bodyType={bodyType}
  labelFromList={labelFromList}
  CATEGORIES={CATEGORIES}
  MODEL_TYPES={MODEL_TYPES}
  ETHNICITIES={ETHNICITIES}
  POSES={POSES}
  BODY_TYPES={BODY_TYPES}
  styles={styles}
/>
              )}
            </div>

            {mode === "product" ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.85)" }}>
                  {t("viewsToGenerate")}
                </div>

                {[
  { key: "front", label: t("pFront") },
  { key: "back", label: t("pBack") },
  { key: "left", label: t("pLeft") },
  { key: "right", label: t("pRight") },
].map((v) => (
                  <label
                    key={v.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "#ffffff" }}>{v.label}</span>
                    <input
                      type="checkbox"
                      checked={(views as any)[v.key]}
                      onChange={(e) => setViews((prev) => ({ ...prev, [v.key]: e.target.checked }))}
                      style={{ width: 18, height: 18 }}
                    />
                  </label>
                ))}

                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 700 }}>
                  {t("creditsToConsume", selectedCount)}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.85)" }}>
                  {t("viewsToGenerate")}
                </div>

                {[
  { key: "front", label: t("vFront") },
  { key: "back", label: t("vBack") },
  { key: "side", label: t("vSide") },
  { key: "frontDetail", label: t("vFrontDetail") },
  { key: "backDetail", label: t("vBackDetail") },
  ...(category === "bottom"
  ? [
      { key: "pantFrontDetail", label: t("vPantFrontDetail") },
      { key: "pantBackDetail", label: t("vPantBackDetail") },
      { key: "pantSideDetail", label: t("vPantSideDetail") },
    ]
  : []),
].map((v) => (
                  <label
                    key={v.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "#ffffff" }}>{v.label}</span>
                    <input
                      type="checkbox"
                      checked={(views as any)[v.key]}
                      onChange={(e) => setViews((prev) => ({ ...prev, [v.key]: e.target.checked }))}
                      style={{ width: 18, height: 18 }}
                    />
                  </label>
                ))}

                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 700 }}>
                  {t("creditsToConsume", selectedCount)}
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isRegenBusy || loading || selectedCount === 0 || balance < selectedCount}
              style={{ width: "100%", padding: "14px 16px" }}
            >
              {loading
  ? t("generating")
  : selectedCount === 0
  ? t("chooseAtLeastOneView")
  : balance < selectedCount
  ? t("insufficientCredits", selectedCount)
  : t("generate", selectedCount)}
            </Button>
{failedViews.length > 0 && (
  <div style={styles.inlineWarn}>
    ⚠️ No se pudieron generar estas vistas:{" "}
    <b>
      {failedViews
        .map((k) =>
          mode === "product"
            ? k === "front"
              ? t("pFront")
              : k === "back"
              ? t("pBack")
              : k === "left"
              ? t("pLeft")
              : k === "right"
              ? t("pRight")
              : k
            : k === "front"
            ? t("vFront")
            : k === "back"
            ? t("vBack")
            : k === "side"
            ? t("vSide")
            : k === "frontDetail"
            ? t("vFrontDetail")
            : k === "backDetail"
            ? t("vBackDetail")
            : k === "pantFrontDetail"
            ? t("vPantFrontDetail")
            : k === "pantBackDetail"
            ? t("vPantBackDetail")
            : k === "pantSideDetail"
            ? t("vPantSideDetail")
            : k
        )
        .join(", ")}
    </b>
    . Se devolvieron los créditos de las vistas fallidas. Podés volver a generarlas.
  </div>
)}
            {result && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
  {t("result")}
</div>

                <div style={styles.resultGrid}>
                  {result.imageUrls.map((u, idx) => {
                    const viewKey = (resultKeys[idx] || "front") as
  | "front"
  | "back"
  | "side"
  | "frontDetail"
  | "backDetail"
  | "pantFrontDetail"
  | "pantBackDetail"
  | "pantSideDetail"
  | "left"
  | "right";





                    const loadKey = `regen:${idx}`;
                    void nowTick;

                    const label =
  mode === "product"
    ? viewKey === "front"
      ? t("pFront")
      : viewKey === "back"
      ? t("pBack")
      : viewKey === "left"
      ? t("pLeft")
      : viewKey === "right"
      ? t("pRight")
      : t("pFront")
    : viewKey === "front"
    ? t("vFront")
    : viewKey === "back"
    ? t("vBack")
    : viewKey === "side"
    ? t("vSide")
    : viewKey === "frontDetail"
    ? t("vFrontDetail")
    : viewKey === "backDetail"
    ? t("vBackDetail")
    : viewKey === "pantFrontDetail"
    ? t("vPantFrontDetail")
    : viewKey === "pantBackDetail"
    ? t("vPantBackDetail")
    : viewKey === "pantSideDetail"
    ? t("vPantSideDetail")
    : t("vBackDetail");

                    return (
                      <div key={idx} style={{ display: "grid", gap: 10 }}>
                        {/* Imagen */}
                        <div style={styles.imgCard}>
                          <img src={u} alt={`img-${idx}`} style={{ width: "100%", display: "block" }} />
                        </div>

                        {/* Botones */}
                        <div
                          style={{
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.06)",
                            padding: 12,
                          }}
                        >
                          <div style={{ fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.9)" }}>
                            {label}
                          </div>

                          <div style={{ display: "grid", gap: 10 }}>
                            <button
                              type="button"
                              onClick={() =>
                                downloadImage(u, `${mode}-${label.replace(/\s+/g, "-").toLowerCase()}.png`)
                              }
                              style={{
                                ...styles.logoutBtnFull,
                                height: 44,
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              {t("download")}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRegenerateOne(viewKey, idx)}
                              disabled={!!regenLoading[loadKey] || balance < 1}
                              style={{
                                ...styles.buyBtnFull,
                                height: 44,
                                opacity: !!regenLoading[loadKey] || balance < 1 ? 0.6 : 1,
                                cursor: !!regenLoading[loadKey] || balance < 1 ? "not-allowed" : "pointer",
                              }}
                            >
                              {regenLoading[loadKey] === true
  ? t(
      "redoing",
      Math.floor(
        (Date.now() - (regenStartedAt[loadKey] || Date.now())) / 1000
      )
    )
  : balance < 1
  ? t("noCreditsRedo")
  : t("redo")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
    mode,
    isMobile,
    // state
    frontFile,
    backFile,
    faceFile,
    faceGenLoading,
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
    scene,
    bgSuggestions,
    helpLoading,
    loading,
    result,
    error,
    // deps
    API,
    views,
    selectedCount,
    balance,
  ]);

  // ====== LOGIN ======
  if (!user && !accessToken) {
    return (
      <div style={styles.loginCard}>
        <div style={styles.loginTitle}>{t("signIn")}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <div id="googleLoginDiv" />
        </div>
        <div style={styles.loginSub}>{t("signInHint")}</div>
      </div>
    );
  }

  // ====== APP ======
  return (
    <div className={inter.className} style={styles.page}>
      {isRegenBusy && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 18,
              background: "#0b1220",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
              padding: 18,
              color: "#fff",
              textAlign: "center",
              fontWeight: 900,
            }}
          >
            {t("regenOverlayTitle")}<br />
            <span style={{ fontWeight: 700, opacity: 0.85, fontSize: 13 }}>{t("regenOverlayHint")}</span>
          </div>
        </div>
      )}
      <div style={styles.shell}>
        {topupStatus === "ok" && (
          <div
            style={{
              background: "#dcfce7",
              border: "1px solid #16a34a",
              color: "#166534",
              padding: "12px",
              borderRadius: "12px",
              marginBottom: "16px",
              fontWeight: 600,
            }}
          >
            {t("topupOk")}
          </div>
        )}

        {topupStatus === "fail" && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #dc2626",
              color: "#7f1d1d",
              padding: "12px",
              borderRadius: "12px",
              marginBottom: "16px",
              fontWeight: 600,
            }}
          >
            {t("topupFail")}
          </div>
        )}

        {/* Header */}
        <div style={{ ...styles.header, flexDirection: "column", alignItems: "stretch", gap: 14 }}>
          {/* WhatsApp (dentro del contenedor, NO sticky) */}
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <a
    href={`https://wa.me/5491125457111?text=${encodeURIComponent(t("whatsappPrefill"))}`}
    target="_blank"
    rel="noopener noreferrer"
    style={styles.whatsappInlineBtn}
    aria-label="WhatsApp Atención al cliente"
  onMouseEnter={(e) => {
  e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
  e.currentTarget.style.boxShadow =
    "0 16px 40px rgba(37,211,102,0.45), inset 0 1px 0 rgba(255,255,255,0.4)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = "translateY(0) scale(1)";
  e.currentTarget.style.boxShadow =
    "0 10px 30px rgba(37,211,102,0.35), inset 0 1px 0 rgba(255,255,255,0.35)";
}}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="20" height="20" fill="#ffffff">
      <path d="M19.11 17.36c-.27-.14-1.59-.78-1.84-.87-.25-.09-.43-.14-.61.14-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.56.13-.13.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.48-.84-2.03-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.34.98 2.64 1.12 2.82.14.18 1.93 2.95 4.67 4.13.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.59-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z"/>
      <path d="M16.02 3C8.83 3 3 8.83 3 16.02c0 2.82.9 5.44 2.43 7.58L3 29l5.53-2.4c2.06 1.12 4.41 1.76 6.97 1.76C23.17 28.36 29 22.53 29 15.34 29 8.83 23.17 3 16.02 3zm0 23.36c-2.36 0-4.54-.7-6.38-1.91l-.46-.3-3.28 1.42 1.43-3.2-.3-.48c-1.32-2.05-2.01-4.43-2.01-6.87 0-6.12 4.98-11.1 11.1-11.1 6.12 0 11.1 4.98 11.1 11.1 0 6.12-4.98 11.1-11.1 11.1z"/>
    </svg>
    <span style={{ fontWeight: 900, fontSize: 12 }}>
  {t("whatsapp")}
</span>
  </a>
</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
  <img
    src="/logo.png"
    alt="Logo"
    style={{
      height: 36,
      width: "auto",
      display: "block",
    }}
  />
  <div style={{ ...styles.h1, color: "#9495B5" }}>
    {t("title")}
  </div>
</div>

            <div
              style={{
                marginTop: 16,
                position: "relative",
                width: 360,
                maxWidth: "100%",
                height: 52,
                borderRadius: 999,
                padding: 6,
                background: "linear-gradient(90deg,#7c3aed,#9333ea,#a855f7)",
                boxShadow: "0 12px 30px rgba(124,58,237,0.35)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: mode === "model" ? 6 : "calc(50% + 0px)",
                  width: "calc(50% - 6px)",
                  height: 40,
                  borderRadius: 999,
                  background: "#ffffff",
                  transition: "left 0.25s ease",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                }}
              />

              <button
                type="button"
                onClick={() => setMode("model")}
                style={{
                  position: "relative",
                  zIndex: 2,
                  flex: 1,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  color: mode === "model" ? "#7c3aed" : "#ffffff",
                  transition: "color 0.25s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {t("modeModel")}
              </button>

              <button
                type="button"
                onClick={() => setMode("product")}
                style={{
                  position: "relative",
                  zIndex: 2,
                  flex: 1,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  color: mode === "product" ? "#7c3aed" : "#ffffff",
                  transition: "color 0.25s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {t("modeProduct")}
              </button>
            </div>

            <div style={{ ...styles.h2, color: "#cbd5e1" }}>{t("subtitle")}</div>
          </div>

          <div style={{ marginTop: 10 }}>
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
                width: isMobile ? "100%" : 140,
                boxSizing: "border-box",
              }}
            >
              <option value="es">🇪🇸 ES</option>
              <option value="en">🇺🇸 EN</option>
              <option value="pt">🇧🇷 PT</option>
              <option value="ko">🇰🇷 KO</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>
        </div>

        {/* User card (NO overflow) */}
        <div style={styles.userCard}>
          <div style={styles.userEmail}>{user?.email || user?.name}</div>
              {(() => {
  void bonusTick;

  const paid = user?.wallet?.paidBalance ?? 0;
  const hasBonus = balance > paid;

  const expIso = user?.wallet?.welcomeExpiresAt;
  const expMs = expIso ? new Date(expIso).getTime() : null;

  const diffMs = expMs ? expMs - Date.now() : 0;
const totalSec = Math.max(0, Math.floor(diffMs / 1000));

const hours = Math.floor(totalSec / 3600);
const minutes = Math.floor((totalSec % 3600) / 60);
const seconds = totalSec % 60;

const hh = String(hours).padStart(2, "0");
const mm = String(minutes).padStart(2, "0");
const ss = String(seconds).padStart(2, "0");

  if (!hasBonus || !expMs || totalSec <= 0) return null;

  return (
    <div
      style={{
        marginTop: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#fff7ed",
        border: "1px solid #fdba74",
        color: "#9a3412",
        fontSize: 12,
        fontWeight: 800,
        display: "inline-block",
      }}
    >
      {t("bonusExpiresIn", hh, mm, ss)}
    </div>
  );
})()}
          <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            <div style={styles.badgeClamp}>
  {loadingMe ? t("loading") : `${t("credits")}: ${balance}`}
</div>
          </div>

          <div style={styles.packCard}>
            <select value={selectedPack} onChange={(e) => setSelectedPack(e.target.value as any)} 
            style={styles.packSelect}>
                <option value="emprendedor">{t("packEntrepreneur")}</option>
                <option value="pyme">{t("packPyme")}</option>
                <option value="empresa">{t("packEnterprise")}</option>
            </select>

            <button
              type="button"
              disabled={buyLoading}
              onClick={async () => {
                try {
                  setBuyLoading(true);
                  const token = localStorage.getItem("accessToken");
                  const credits = selectedPack === "emprendedor" ? 50 : selectedPack === "pyme" ? 100 : 200;

                  const res = await fetch(`${API}/mp/create-preference`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ credits }),
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
              style={styles.buyBtnFull}
            >
              {buyLoading ? t("processing") : `💳 ${t("buyCredits")}`}
            </button>

            <button type="button" onClick={handleLogout} style={styles.logoutBtnFull}>
              🚪 {t("logout")}
            </button>
          </div>
        </div>

        {/* Historial */}
        <details
          style={{
            marginTop: 20,
            marginBottom: 20,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 800,
            }}
          >
            <span style={{ color: "#1e293b", fontWeight: 800 }}>📒 {t("history")}</span>
          </summary>

          <div style={{ padding: "0 16px 16px 16px" }}>
            {loadingEntries ? (
              <div style={{ color: "#64748b", paddingTop: 8 }}>{t("loading")}</div>
            ) : entries.length === 0 ? (
              <div style={{ color: "#64748b", paddingTop: 8 }}>{t("noMovements")}</div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  overflowX: "hidden",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  width: "100%",
                  maxWidth: "100%",
                }}
              >
                <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "10px 14px", color: "#475569", width: "40%" }}>{t("date")}</th>
                      <th style={{ padding: "10px 14px", color: "#475569", width: "35%" }}>{t("movement")}</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", color: "#475569", width: "25%" }}>
                        {t("amount")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
  {entries
    .slice((entriesPage - 1) * ENTRIES_PAGE_SIZE, entriesPage * ENTRIES_PAGE_SIZE)
    .map((e) => {
                      const isPlus = e.amount > 0;

const consumeMode = (e as any)?.metadata?.mode; // "model" | "product" | undefined
const consumeLabel =
  consumeMode === "model"
    ? t("consumeModel")
    : consumeMode === "product"
    ? t("consumeProduct")
    : t("consumeGeneric");
console.log("ENTRY:", e);
const label =
  e.refType === "WELCOME_BONUS_EXPIRE"
    ? t("expired")
    : e.type === "PURCHASE"
    ? t("purchase")
    : e.type === "CONSUME"
    ? consumeLabel
    : e.type === "REFUND"
    ? t("refund")
    : e.type === "GRANT"
    ? t("grant")
    : e.type;

                      return (
                        <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td
                            style={{
                              padding: "10px 10px",
                              color: "#0f172a",
                              whiteSpace: "normal",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              wordBreak: "break-word",
                            }}
                          >
                            {new Date(e.createdAt).toLocaleString()}
                          </td>

                          <td style={{ padding: "10px 10px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontWeight: 800,
                                fontSize: 12,
                                padding: "4px 10px",
                                borderRadius: 999,
                                border: "1px solid #e2e8f0",
                                background: "#ffffff",
                                color: "#0f172a",
                              }}
                            >
                              {label}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              fontWeight: 900,
                              color: isPlus ? "#16a34a" : "#dc2626",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isPlus ? `+${e.amount}` : e.amount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(() => {
  const totalPages = Math.max(1, Math.ceil(entries.length / ENTRIES_PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", padding: 10 }}>
      <button
        type="button"
        onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}
        disabled={entriesPage <= 1}
        style={{
  ...styles.pagerBtn,
  opacity: entriesPage <= 1 ? 0.5 : 1,
  cursor: entriesPage <= 1 ? "not-allowed" : "pointer",
}}
      >
        {t("previous")}
      </button>

      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
        {t("pageXofY", entriesPage, totalPages)}
      </div>

      <button
        type="button"
        onClick={() => setEntriesPage((p) => Math.min(totalPages, p + 1))}
        disabled={entriesPage >= totalPages}
        style={{
  ...styles.pagerBtn,
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  color: "#ffffff",
  border: "none",
  opacity: entriesPage >= totalPages ? 0.5 : 1,
  cursor: entriesPage >= totalPages ? "not-allowed" : "pointer",
}}
      >
        {t("following")}
      </button>
    </div>
  );
})()}
              </div>
            )}
          </div>
        </details>

        {/* Main */}
        <div style={isMobile ? styles.mainMobile : styles.main}>
          {/* Steps (mobile dropdown) */}
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
                boxSizing: "border-box",
              }}
            >
              <span>
                {t("stepOf", step + 1, steps.length)}
              </span>
              <span style={{ opacity: 0.9 }}>{mobileStepsOpen ? "▲" : "▼"}</span>
            </button>

            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
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

          {/* Panel */}
          <section style={styles.panel}>
            {stepError && <div style={styles.inlineWarn}>{stepError}</div>}
            {error && <div style={styles.inlineErr}>{error}</div>}

            {panel}

            <div style={styles.footer}>
              <Button variant="secondary" onClick={prev} disabled={isRegenBusy || step === 0 || loading}>
                {t("back")}
              </Button>

              <div style={{ flex: 1 }} />

              {!isLast ? (
                <Button onClick={next} disabled={isRegenBusy || !canGoNext}>
                  {t("next")}
                </Button>
              ) : null}
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

function InputFile({ onChange, isMobile }: { onChange: (f: File | null) => void; isMobile?: boolean }) {
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
          <button
  key={typeof o.value === "string" ? o.value : JSON.stringify(o.value)}
  onClick={() => onChange(String(o.value))}
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

function ModelSummary({
  t,
  category,
  otherCategory,
  pockets,
  modelType,
  ethnicity,
  ageRange,
  background,
  pose,
  bodyType,
  labelFromList,
  CATEGORIES,
  MODEL_TYPES,
  ETHNICITIES,
  POSES,
  BODY_TYPES,
  styles,
}: any) {
  return (
    <div style={styles.summaryGrid}>
      <SummaryItem
        label={t("stepCategory")}
        value={
          category === "other"
            ? `${t("catOther")}: ${otherCategory}`
            : labelFromList(CATEGORIES, category)
        }
      />

      <SummaryItem
        label={t("stepPockets")}
        value={pockets ? (pockets === "si" ? t("yes") : t("no")) : ""}
      />

      <SummaryItem label={t("stepModel")} value={labelFromList(MODEL_TYPES, modelType)} />

      <SummaryItem label={t("stepEthnicity")} value={labelFromList(ETHNICITIES, ethnicity)} />

      <SummaryItem label={t("stepAge")} value={ageRange ? t(ageRange) : ""} />

      <SummaryItem label={t("stepBackground")} value={background} />

      <SummaryItem label={t("stepPose")} value={labelFromList(POSES, pose)} />

      <SummaryItem label={t("stepBodyType")} value={labelFromList(BODY_TYPES, bodyType)} />
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
  pillActive: { background: "#2563eb", border: "1px solid #2563eb", color: "#ffffff" },

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
    marginBottom: 22,
  },
  summaryTitle: { fontWeight: 900, marginBottom: 10 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  summaryItem: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  summaryValue: { fontSize: 13, color: "#0f172a", fontWeight: 900, marginTop: 4 },

  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  imgCard: { border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#ffffff" },

 whatsappInlineBtn: {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px",
  borderRadius: 999,

  // Glass premium
  background: "linear-gradient(135deg, rgba(37,211,102,0.95) 0%, rgba(22,163,74,0.95) 100%)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",

  color: "#ffffff",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.28)",

  // Glow elegante (no exagerado)
  boxShadow: `
    0 10px 30px rgba(37,211,102,0.35),
    inset 0 1px 0 rgba(255,255,255,0.35)
  `,

  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 0.3,

  transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
  transform: "translateY(0)",
  userSelect: "none",
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
  previewGridCompact: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 160px))",
  gap: 10,
  justifyContent: "center",
},

previewImgCompact: {
  width: "100%",
  height: 160,
  objectFit: "cover",
  display: "block",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
},
  pagerBtn: {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
},

pagerBtnPrimary: {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  border: "none",
  color: "#ffffff",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  boxShadow: "0 10px 22px rgba(99,102,241,0.28)",
},

};
