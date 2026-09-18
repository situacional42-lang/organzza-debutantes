# Hospedar a Organzza Debutantes

O site usa **Vercel com Firebase Cloud Firestore**. O projeto informado é `siteteste-dcdca`. O layout foi mantido; pedidos de prova, aceite, recusa, remarcação e histórico ficam no banco. O login funciona entre instâncias e após reinícios.

## Preparar o Firebase

1. Abra o projeto `siteteste-dcdca` no [console Firebase](https://console.firebase.google.com/).
2. Em **Criação → Firestore Database**, crie o banco **Cloud Firestore Standard**, no modo nativo, com ID `(default)`, se ainda não existir. Escolha a região conforme a operação da loja.
3. Em **Configurações do projeto → Contas de serviço → Firebase Admin SDK**, gere uma chave privada. O JSON contém `project_id`, `client_email` e `private_key`. Guarde esse arquivo fora do repositório e copie os valores diretamente para as variáveis privadas da Vercel.
4. Confira as regras do Firestore: o navegador não precisa acessar `organzzaAppointments` ou `organzzaSystem`. O arquivo `firestore.rules` nega acesso direto a essas coleções. O servidor usa a conta de serviço, enquanto a API verifica a senha e a sessão do administrador.

**Se o projeto já atende outros sites, preserve suas regras existentes.** Mescle as regras das duas coleções da Organzza no conjunto atual. Remova permissões abrangentes que também liberem essas coleções: uma regra que autoriza acesso prevalece mesmo quando outro bloco o nega. Não substitua regras de outros sistemas pelo arquivo deste site. Em um projeto exclusivo, o arquivo fornecido pode ser usado inteiro.

A configuração web enviada na imagem é pública e identifica o projeto. Ela não substitui a credencial privada necessária para o servidor. Não coloque a chave da conta de serviço no HTML, no JavaScript do navegador, no GitHub ou em mensagens.

Documentação oficial: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup), [Cloud Firestore no servidor](https://firebase.google.com/docs/firestore/quickstart-server), [regras de segurança](https://firebase.google.com/docs/firestore/security/rules-structure).

## Configurar a Vercel

1. Importe [situacional42-lang/organzza-debutantes](https://github.com/situacional42-lang/organzza-debutantes).
2. Use a raiz como **Root Directory**, preset **Other** e Node **24.x**. `vercel.json` define o build `npm run build`, a pasta pública `public` e a função `api/index.mjs`. O build copia somente páginas, CSS, JavaScript do navegador e imagens da vitrine. Os arquivos do servidor e credenciais não fazem parte da pasta pública.
3. Em **Settings → Environment Variables**, configure:

| Variável | Valor |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `siteteste-dcdca` |
| `FIREBASE_CLIENT_EMAIL` | Campo `client_email` do JSON da conta de serviço |
| `FIREBASE_PRIVATE_KEY` | Campo `private_key` do mesmo JSON |
| `ADMIN_PASSWORD` | Senha escolhida para o painel da loja |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |

A chave aceita quebras de linha reais ou a sequência literal `\n`. Copie apenas o valor, sem as aspas externas do JSON. As variáveis Firebase são exclusivas do servidor; não use prefixos que as exponham ao navegador.

Gere o segredo no terminal e copie o resultado para a variável privada:

```sh
node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
```

Configure as cinco variáveis em **Production**. Para **Preview**, use outro projeto Firebase para separar testes de pedidos reais. Remova `DATABASE_URL` se foi configurada na adaptação anterior; PostgreSQL não é mais utilizado.

4. Faça **Deploy** ou **Redeploy**. As coleções surgem ao salvar o primeiro pedido; não é preciso criar documentos manualmente. A Vercel não precisa de disco permanente, `HOST`, `PORT` ou `ORGANZZA_DATA_DIR`. A vitrine é estática e os agendamentos usam a função da API; uma indisponibilidade do banco não impede a página inicial de carregar.
5. Abra `/api/health` e confirme `{"ok":true}`. Entre em `/admin.html` e teste um pedido em outro navegador.

O código está preparado, mas não provisiona o Firestore, configura suas credenciais ou publica um deploy sozinho. Confira planos e limites das plataformas antes da contratação.

## Persistência e login

Cada pedido é um documento em `organzzaAppointments`. A transação lê também `organzzaSystem/appointments`, usada para coordenar alterações simultâneas. Se outra instância alterar a agenda, o Firestore repete a operação e a verificação de conflitos. Apenas documentos modificados são gravados, junto com a revisão da agenda.

Na Vercel não existe fallback para arquivos locais. Sem banco ou credenciais obrigatórias, a API retorna erro e o pedido não aparece como salvo. A API pública exibe somente horários ocupados, sem nomes, telefones ou observações.

O cookie do painel é assinado, HttpOnly, SameSite=Strict e Secure na Vercel, com validade de oito horas. Trocar a senha ou o segredo invalida sessões anteriores. Use os mesmos valores em todas as instâncias.

As provas duram uma hora. Segunda a sexta, 09h–18h; sábado, 08h–16h; domingo fechado. A equipe pode combinar horários personalizados pelo painel, sujeitos à verificação de sobreposições.

## Importar pedidos anteriores

Pedidos antigos do navegador são importados uma vez ao entrar no painel, sem duplicação. Para importar `data/appointments.json`, configure as credenciais Firebase de destino no ambiente privado e execute:

```sh
npm ci
npm run migrate:bookings -- /caminho/privado/appointments.json
```

O importador preserva o arquivo, mantém os dados e ignora IDs já existentes. Conflitos de provas interrompem a importação. A operação pode ser repetida. Importe novamente pedidos recebidos no sistema antigo após a migração. Não envie arquivos de clientes ao repositório.

## Uso local, Render e Docker

Use `npm ci` e `npm start`. Sem variáveis Firebase, fora da Vercel, os pedidos ficam em `data/appointments.json`. Esse modo requer uma instância e disco permanente; `render.yaml` mantém essa opção. Com credenciais Firebase, a aplicação usa Firestore em qualquer hospedagem Node. Configure `ADMIN_PASSWORD` e `SESSION_SECRET` ao publicar.

O Dockerfile continua disponível. Passe variáveis por um arquivo externo privado usando `--env-file` e publique atrás de HTTPS. `.env.example` é um modelo e não é carregado automaticamente.

## Catálogo

**O catálogo ainda é salvo no navegador utilizado.** Edições de vestidos, preços e imagens feitas no painel não se propagam para outros dispositivos. O Firestore desta versão compartilha os agendamentos. Para publicar mudanças do acervo, atualize os padrões em `catalog-store.js` e publique o código.

Os preços são demonstrativos e a marca foi recriada da referência enviada. Substitua valores e tamanhos pelos oficiais antes da divulgação.

## Verificação

`npm run check` verifica o site; `npm run check:bookings`, a agenda local. `npm run check:vercel` usa o emulador oficial do Firestore com dados isolados e duas instâncias. É necessário Java 21 no PATH; o teste não usa credenciais reais. Verifica concorrência, persistência após reinício, sessões, importação, decisões da loja e bloqueio de acesso direto às coleções.

Depois do deploy, teste pedidos entre navegadores, aceite, recusa, remarcação e WhatsApp. Faça outro deploy e confira a persistência. Organize backups no Firebase conforme a operação da loja.

## Erro CatalogStore na Vercel

Se um deploy antigo mostrar `ReferenceError: CatalogStore is not defined` em `app.mjs`, a Vercel escolheu o script do navegador como servidor. A versão corrigida usa `storefront.js`, vitrine estática em `public` e entrada `api/index.mjs`. Publique o commit mais recente; se houver configurações manuais no painel, use preset Other, build `npm run build` e saída `public`.
