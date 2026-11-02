import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou registar — Fezada IA" },
      { name: "description", content: "Cria a tua conta Fezada IA ou entra com email ou Google." },
      { property: "og:title", content: "Entrar — Fezada IA" },
      { property: "og:description", content: "Cria a tua conta Fezada IA ou entra com email ou Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/app" }));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/app" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Falha no Google");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 font-display text-2xl font-bold">Fezada<span className="text-primary"> IA</span></Link>
      {sent ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h1 className="text-xl font-bold">Confirma o teu email</h1>
          <p className="text-sm text-muted-foreground">Enviámos um link para <b>{email}</b>. Depois de confirmar, entra e segue as instruções para ativar a conta.</p>
        </div>
      ) : (
        <>
          <h1 className="mb-1 text-2xl font-bold">{mode === "in" ? "Bem-vindo de volta" : "Cria a tua conta"}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{mode === "in" ? "Entra para ver as tuas fezadas." : "Regista-te e ativa a subscrição pelo WhatsApp."}</p>
          <Button variant="secondary" className="mb-4 w-full" onClick={google}>Continuar com o Google</Button>
          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && (
              <div><Label htmlFor="n">Nome</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            )}
            <div><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label htmlFor="p">Palavra-passe</Label><Input id="p" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarda…" : mode === "in" ? "Entrar" : "Registar"}</Button>
          </form>
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-muted-foreground">
            {mode === "in" ? "Ainda não tens conta? " : "Já tens conta? "}<span className="text-primary underline">{mode === "in" ? "Regista-te" : "Entra"}</span>
          </button>
        </>
      )}
    </div>
  );
}
