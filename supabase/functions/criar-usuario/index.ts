// Edge Function: cria (ou convida) usuário de cliente. Só admins podem chamar.
// Deploy: supabase functions deploy criar-usuario
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // 1. Quem está chamando é admin?
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Não autenticado" }, 401);
    const { data: perfil } = await admin.from("perfis").select("papel,ativo").eq("id", user.id).single();
    if (!perfil || perfil.papel !== "admin" || !perfil.ativo) return json({ error: "Apenas administradores" }, 403);

    // 2. Dados do novo usuário
    const { email, nome, cliente_id, papel = "cliente", redirectTo } = await req.json();
    if (!email) return json({ error: "E-mail obrigatório" }, 400);
    if (papel === "cliente" && !cliente_id) return json({ error: "Cliente obrigatório" }, 400);

    // 3. Convida por e-mail (o usuário define a própria senha pelo link)
    const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome }, redirectTo,
    });
    if (error) return json({ error: error.message }, 400);

    // 4. Vincula ao cliente (o trigger já criou o perfil)
    const { error: e2 } = await admin.from("perfis").upsert({
      id: inv.user.id, email, nome, papel, cliente_id: papel === "admin" ? null : cliente_id, ativo: true,
    });
    if (e2) return json({ error: e2.message }, 400);

    return json({ ok: true, id: inv.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
