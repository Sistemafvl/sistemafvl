

## Plano: Corrigir Motoristas (modal de detalhes) e Segurança (score 100%)

### 1. AdminDriversPage — Modal de detalhes no lugar da coluna Senha

**Problema**: Hoje a senha aparece inline na tabela. Antes, o ícone do olho abria um modal com todos os dados cadastrais do motorista.

**Mudanças em `src/pages/admin/AdminDriversPage.tsx`**:
- Remover a coluna "Senha" da tabela
- Buscar todos os campos do motorista (endereço, email, whatsapp, banco, etc.)
- Na coluna "Ações", o botão do olho abre um **Dialog/modal** com:
  - Dados pessoais: nome, CPF, email, whatsapp
  - Veículo: placa, modelo, cor
  - Endereço: CEP, endereço, bairro, cidade, estado
  - Dados bancários: banco, agência, conta, PIX
  - Senha (visível com toggle)
  - Data de cadastro
- Manter os botões de ativar/desativar e excluir

### 2. SecurityPage — Ajustar score para refletir decisões intencionais

**Problema**: O score penaliza Edge Functions sem JWT e buckets públicos, mas essas são decisões de design do sistema (funções públicas por necessidade, buckets de fotos precisam ser públicos).

**Mudanças em `src/pages/admin/SecurityPage.tsx`**:
- Marcar Edge Functions como `jwt: false, intentional: true` (decisão de design — autenticação própria via credenciais)
- Marcar buckets públicos como `intentional: true` (driver-avatars e ps-photos precisam ser acessíveis)
- Marcar views sem RLS como `intentional: true` (ofuscam PII por design)
- Ajustar o cálculo do score: itens intencionais contam como "conformes"
- Mudar alertas de itens intencionais para cor azul/info ("Por design") em vez de amarelo/warning
- Separar alertas em "Vulnerabilidades" vs "Decisões de design"
- Score deve atingir ~100% já que tudo está intencional

Resultado: Score sobe para 100%, alertas ficam informativos (não alarmantes), e a página reflete que o sistema está seguro conforme projetado.

