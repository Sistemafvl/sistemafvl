

# Resumo das Alteracoes

Dois arquivos serao editados para criar um fluxo de aprovacao na fila de motoristas.

## Arquivo 1: `src/components/dashboard/QueuePanel.tsx` (Painel do Gerente)

- Botao "+" reposicionado ao lado do titulo "Fila de Motoristas"
- Botao "Programar" substituido por "Aprovar" (faz UPDATE do status para `approved`)
- Apos aprovar, o botao vira "Programar" (abre o modal de rota/login/senha)
- Botoes de seta (subir/descer) ao lado de cada motorista para reordenar a fila (troca os `joined_at` entre entradas adjacentes)
- Cards mais compactos (menor padding, avatar e texto reduzidos)

## Arquivo 2: `src/pages/driver/DriverQueue.tsx` (Tela do Motorista)

- Apos clicar "ENTRAR NA FILA", o botao muda para "AGUARDANDO APROVACAO" (desabilitado, estilo amarelo)
- Posicao na fila, tempo estimado e cronometro so aparecem apos o gerente aprovar (status `approved`)
- Busca na fila inclui tanto `waiting` quanto `approved`, mas posicao conta so os `approved`

## Fluxo Resumido

```text
Motorista clica "ENTRAR NA FILA"
       |
       v
Status = waiting --> Motorista ve "AGUARDANDO APROVACAO"
       |
       v
Gerente clica "Aprovar" --> Status = approved
       |
       v
Motorista ve posicao, tempo e cronometro
       |
       v
Gerente clica "Programar" --> Modal rota/login/senha --> Finaliza
```

