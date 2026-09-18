# Hospedar a Organzza Debutantes

O site foi adaptado para **Vercel com PostgreSQL**, incluindo Neon pelo Marketplace. O layout continua igual. Os agendamentos ficam no banco e o login usa sessões assinadas, válidas entre instâncias e após reinícios.

## Vercel com Neon

1. Importe o repositório [situacional42-lang/organzza-debutantes](https://github.com/situacional42-lang/organzza-debutantes) na Vercel.
2. Use a raiz como **Root Directory**, framework **Node.js** e Node **24.x**. `vercel.json` já configura o servidor, a instalação e a inclusão das páginas, estilos, scripts e imagens. Não defina uma pasta de saída estática.
3. Em **Storage → Marketplace**, conecte um banco **Neon PostgreSQL** ao projeto. Use a conexão com pooling fornecida pela integração e confira se ela criou `DATABASE_URL`.
4. Em **Settings → Environment Variables**, configure:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL com pooling e SSL fornecida pelo Neon |
| `ADMIN_PASSWORD` | Senha escolhida para o painel da loja |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |

Gere o segredo no seu terminal, guarde o resultado em local privado e copie para a Vercel:

```sh
node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
```

Configure as três variáveis em **Production**. Para deploys de **Preview**, configure-as também nesse ambiente e use um banco separado para não misturar demonstrações com pedidos reais. Nunca envie senhas ou a conexão do banco por commit no GitHub.

5. Faça **Deploy** ou **Redeploy** após salvar as variáveis. A tabela `organzza_booking_state` é criada automaticamente na primeira consulta, preservando registros existentes. O usuário do banco precisa poder criar essa tabela. A Vercel não precisa de disco permanente, `HOST`, `PORT` ou `ORGANZZA_DATA_DIR`.
6. Abra `/api/health` e confirme `{"ok":true}`. Entre em `/admin.html` com a senha e teste um pedido em outro navegador.

Escolha planos da Vercel e do banco compatíveis com uso comercial e confira preços e limites antes da contratação. O código não cria contas, contrata planos nem publica um deploy automaticamente.

Documentação oficial: [servidores Node](https://vercel.com/docs/functions/runtimes/node-js), [bancos pelo Marketplace](https://vercel.com/docs/marketplace-storage), [Neon para Vercel](https://vercel.com/marketplace/neon/neon), [pool de conexões](https://vercel.com/kb/guide/connection-pooling-with-functions), [variáveis](https://vercel.com/docs/environment-variables).

## Persistência e login

Na Vercel, não há fallback para arquivos locais. Sem o banco ou as credenciais obrigatórias, a API retorna **503** e não informa sucesso sem salvar o pedido.

As gravações conferem uma revisão no PostgreSQL. Se outra instância alterou a agenda desde a leitura, a operação relê os pedidos e verifica os conflitos novamente. Isso impede pedidos duplicados no mesmo horário e perda de alterações simultâneas.

O cookie do painel é assinado, HttpOnly, SameSite=Strict e Secure na Vercel. Expira após oito horas. Use o mesmo `SESSION_SECRET` em todas as instâncias; trocar o segredo ou a senha invalida os cookies anteriores. Não coloque essas variáveis em scripts enviados ao navegador.

Os horários seguem a loja: segunda a sexta, 09h–18h; sábado, 08h–16h; domingo fechado. Cada prova ocupa uma hora. A equipe pode combinar horários personalizados no painel, sujeitos à verificação de sobreposições.

## Importar pedidos existentes

Pedidos antigos do navegador continuam sendo importados uma vez ao entrar no painel, sem duplicação entre dispositivos ou tentativas simultâneas.

Para migrar `data/appointments.json` de uma hospedagem anterior, defina a conexão de **destino** em `DATABASE_URL` no seu ambiente privado e execute:

```sh
npm ci
npm run migrate:bookings -- /caminho/privado/appointments.json
```

O importador preserva o arquivo de origem, mantém os dados dos pedidos, ignora IDs já existentes e recusa a importação se houver conflito de provas. Pode ser repetido sem duplicar registros. Confira no painel os pedidos importados. Pedidos recebidos na hospedagem antiga depois da importação precisam ser migrados também. Não publique dados de clientes no GitHub.

## Render, Docker e uso local

Execute `npm ci --omit=dev` e `npm start`. Fora da Vercel, use `HOST=0.0.0.0`, `ADMIN_PASSWORD` e a porta da plataforma. Com `DATABASE_URL`, usa PostgreSQL e pode executar em múltiplas instâncias; configure o mesmo `SESSION_SECRET` em todas elas.

Sem `DATABASE_URL`, **somente fora da Vercel**, o modo anterior com arquivo JSON permanece disponível. Configure `ORGANZZA_DATA_DIR` em volume permanente e execute uma instância. `render.yaml` mantém essa opção com disco de 1 GB em `/var/data`. Faça backups e confira os custos na plataforma.

O Dockerfile continua disponível:

```sh
docker build -t organzza-debutantes .
docker volume create organzza-data
docker run -d --name organzza -p 4173:4173 --mount source=organzza-data,target=/app/data --env-file /caminho/privado/organzza.env organzza-debutantes
```

Defina as variáveis no arquivo externo privado e publique atrás de um proxy HTTPS. `.env.example` é um modelo, não é carregado automaticamente.

## O que fica compartilhado

Pedidos de prova, aceite, recusa, remarcação e histórico ficam no PostgreSQL. A API pública exibe apenas horários ocupados, sem dados pessoais.

**O catálogo ainda é salvo no navegador.** Alterações de preços, imagens e disponibilidade feitas no painel aparecem nesse mesmo navegador e não se propagam para clientes de outros dispositivos. Para publicar alterações do acervo na versão atual, atualize os padrões em `catalog-store.js` e publique o código. Uma gestão de catálogo compartilhada requer evolução do backend.

Os preços são demonstrativos e a marca foi recriada a partir da referência enviada. Substitua valores e tamanhos pelos oficiais e aprove a marca antes da divulgação.

## Verificações

`npm run check` verifica o site, `npm run check:bookings` verifica a agenda local e `npm run check:vercel` verifica PostgreSQL e sessões em duas instâncias. O último usa um PostgreSQL local via PGlite/socket e o mesmo driver `pg` da produção, com dados isolados; não utiliza credenciais reais.

Após publicar, teste pedidos entre navegadores, aceite, recusa, remarcação e WhatsApp. Faça um novo deploy e confira se os registros e o login permanecem disponíveis. Configure backups no provedor do banco.
