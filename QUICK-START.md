# Início rápido — Coletor de alinhamentos

## O caminho que vamos usar

A conta de serviço já existe e foi compartilhada com a planilha. O bot será executado em uma VM do Compute Engine com essa conta anexada. Assim, o Google fornece credenciais temporárias e não precisamos baixar uma chave JSON.

## 1. Preparar a planilha

Na aba configurada, use estes cabeçalhos na primeira linha:

`Data/hora | Grupo | ID do grupo | Remetente | ID do remetente | Medidas | Mensagem original | ID da mensagem`

A conta de serviço `bot-whatsapp-sheets` precisa ter acesso de Editor à planilha.

## 2. Criar a VM (faremos juntos no Console)

Para tentar permanecer dentro do Free Tier, a documentação do Google lista uma VM e2-micro não preemptiva nas regiões `us-west1`, `us-central1` ou `us-east1`, com limites mensais de disco e tráfego. Não crie em outra região nem adicione recursos pagos sem conferir o custo estimado.

Na criação da VM, vamos anexar a conta `bot-whatsapp-sheets` e habilitar o escopo `cloud-platform`. Não alteraremos a política que bloqueia chaves privadas.

## 3. Instalar e configurar o bot

Na VM:

1. Instale Node.js 18+.
2. Clone o repositório e entre na pasta.
3. Rode `npm install`.
4. Configure `SPREADSHEET_ID`, `SHEETS_RANGE` e, se quiser, `ALLOWED_GROUP_JIDS` como variáveis de ambiente do serviço.
5. Rode `npm start` e escaneie o QR Code com a conta WhatsApp que participa do grupo.

O serviço deve ser configurado para iniciar novamente após reinicialização da VM. A sessão WhatsApp fica em `auth_info_baileys/`; mantenha essa pasta no disco persistente.

## O que o bot faz

- Registra somente mensagens novas de grupo que contenham a palavra inteira `alinhamento`.
- Não responde nem inclui mensagens enviadas depois que não contenham a palavra.
- Guarda o texto original e medidas que estiverem explicitamente escritas.
- Não cria chave privada de conta de serviço.

## Custos

O Free Tier tem limites. Disco, tráfego ou configurações fora deles podem gerar cobrança. Antes de criar a VM, confira a estimativa no Console e o painel de faturamento.
