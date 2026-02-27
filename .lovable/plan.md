

# Plano: 3 Ajustes (Iniciar, Beep de Sucesso, Labels do Formulário)

## 1. Botão "Iniciar" só libera com conferente selecionado

No botão Iniciar (linha ~1509), adicionar `disabled={!ride.conferente_id}` para desabilitar quando nenhum conferente está selecionado.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` (linha 1509) | Adicionar `disabled={!ride.conferente_id}` e estilo visual de desabilitado |

## 2. Beep de sucesso ao gravar TBR com sucesso

O `playSuccessBeep` já existe (linha 227) mas só é chamado pela câmera. Adicionar a chamada dentro do `saveTbr` no caminho de sucesso (count === 0, após a inserção, linha ~764), para que tanto a câmera quanto o scanner manual emitam o som.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` (linha ~764) | Adicionar `playSuccessBeep()` após inserção bem-sucedida |

## 3. Labels do formulário de cadastro de motorista

Trocar "Placa do carro" → "Placa do Carro/Moto" e "Modelo do carro" → "Modelo do Carro/Moto".

| Arquivo | Alteração |
|---|---|
| `DriverRegistrationModal.tsx` (linhas 256, 260) | Alterar textos dos labels |

