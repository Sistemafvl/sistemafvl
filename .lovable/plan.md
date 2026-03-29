

## Plano: Contrato Padrão Pré-preenchido + Simplificar Painel Lateral

### O que muda

**1. Contrato padrão já preenchido ao abrir a página**
- Se não houver contrato salvo no banco, o textarea já virá preenchido com o `DEFAULT_CONTRACT` completo (texto legal detalhado) em vez de ficar vazio
- O diretor só precisa revisar/ajustar e clicar "Salvar e Publicar"

**2. Expandir o texto do contrato padrão**
- O `DEFAULT_CONTRACT` atual tem 7 cláusulas básicas. Vou expandi-lo com mais cláusulas relevantes (confidencialidade, proteção de dados/LGPD, uso do sistema digital, penalidades, disposições gerais) para ficar mais completo e profissional

**3. Simplificar o painel "Instruções de Edição"**
- Remover toda menção a "Markdown"
- Trocar as instruções técnicas por dicas simples e acessíveis, tipo:
  - "Edite o texto diretamente na área ao lado"
  - "Após editar, clique em Salvar e Publicar"
  - "O contrato será enviado automaticamente aos motoristas"
- Manter o botão "Carregar Modelo Padrão" para restaurar o texto original
- Manter o card "Impacto Legal" como está

### Arquivo alterado
- `src/pages/matriz/ContractEditorPage.tsx`

