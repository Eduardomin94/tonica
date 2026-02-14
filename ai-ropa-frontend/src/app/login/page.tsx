export default function LoginPage({
  searchParams,
}: {
  searchParams?: { reason?: string };
}) {
  const reason = searchParams?.reason;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>

        {reason === "demo_used" && (
          <p className="mt-3 text-sm text-yellow-200">
            Ya usaste tu demo gratis. Registrate para seguir generando y comprar
            créditos.
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button className="w-full rounded-xl bg-white text-black py-3 font-semibold hover:opacity-90">
            Continuar con Google (próximamente)
          </button>

          <button className="w-full rounded-xl border border-white/15 py-3 font-semibold hover:bg-white/10">
            Entrar con email (próximamente)
          </button>
        </div>

        <p className="mt-6 text-xs text-white/50">
          (Ahora es placeholder. Después lo conectamos a tu auth real.)
        </p>
      </div>
    </main>
  );
}
