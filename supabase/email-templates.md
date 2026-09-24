# Templates de e-mail — Supabase

Onde colar: **Authentication → Emails → Templates** (em versões antigas do painel: *Authentication → Email Templates*).
Em cada template, preencha **Subject** e cole o HTML em **Message body** → *Save*.

---

## 1. Invite user (convite)

**Subject:**
```
Seu acesso ao Portal de Relatórios — Éllu Ambiental
```

**Message body:**
```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c2733">
  <div style="background:#0b4f8a;padding:18px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:bold">ÉLLU <span style="color:#9fd356">AMBIENTAL</span></span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 12px;font-size:18px">Bem-vindo ao Portal de Relatórios</h2>
    <p>Você recebeu acesso ao portal onde ficam disponíveis os relatórios de ensaio emitidos pela Éllu Ambiental.</p>
    <p>Clique no botão abaixo para criar sua senha:</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#6aa51e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Criar minha senha</a>
    </p>
    <p style="font-size:12px;color:#66727f">Se você não esperava este convite, ignore este e-mail.<br>Dúvidas: relatorios@elluambiental.com.br</p>
  </div>
</div>
```

---

## 2. Reset password (recuperar senha)

**Subject:**
```
Redefinição de senha — Portal de Relatórios Éllu Ambiental
```

**Message body:**
```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c2733">
  <div style="background:#0b4f8a;padding:18px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:bold">ÉLLU <span style="color:#9fd356">AMBIENTAL</span></span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 12px;font-size:18px">Redefinir senha</h2>
    <p>Recebemos um pedido para redefinir a senha do seu acesso ao Portal de Relatórios.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#0b4f8a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Criar nova senha</a>
    </p>
    <p style="font-size:12px;color:#66727f">Se não foi você, ignore este e-mail — sua senha atual continua valendo.<br>Dúvidas: relatorios@elluambiental.com.br</p>
  </div>
</div>
```

---

## 3. SMTP próprio (opcional)

Onde: **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*.

| Campo | Google Workspace | Microsoft 365 |
|---|---|---|
| Host | `smtp.gmail.com` | `smtp.office365.com` |
| Port | `587` | `587` |
| Username | e-mail completo (ex.: relatorios@elluambiental.com.br) | e-mail completo |
| Password | **senha de app** (não a senha normal) | senha da conta (SMTP AUTH precisa estar habilitado no admin do 365) |
| Sender email | relatorios@elluambiental.com.br | idem |
| Sender name | Éllu Ambiental | idem |

- Google: senha de app em myaccount.google.com → Segurança → Verificação em duas etapas → Senhas de app.
- Alternativa sem depender do e-mail corporativo: Resend ou Brevo (gratuitos para volume baixo; exigem validar o domínio no DNS).
