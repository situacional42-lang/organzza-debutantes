# Organzza Debutantes

Site responsivo com sete vestidos e doze fotos reais agrupadas por modelo, filtros por cor, favoritos, galerias e sacola. A cliente reúne vestidos, informa seus dados e solicita uma prova. O pedido aparece no painel e o WhatsApp abre com o resumo pronto para ela enviar.

Repositório: https://github.com/situacional42-lang/organzza-debutantes

## Hospedagem

**Adaptado para Vercel com Firebase Cloud Firestore**, no projeto informado `siteteste-dcdca`. `vercel.json` usa o preset Other: `npm run build` prepara a vitrine estática em `public` e `api/index.mjs` atende os agendamentos. O script do navegador se chama `storefront.js` para não ser confundido com uma entrada de servidor. Configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_PASSWORD` e `SESSION_SECRET` na Vercel e faça o deploy. Os pedidos ficam no banco; o cookie assinado funciona entre instâncias e após reinícios. A chave privada fica somente no servidor.

Veja o [guia completo de hospedagem e migração](docs/HOSPEDAGEM.md). Há também configuração para Render e Docker. Fora da Vercel, o modo com arquivo JSON permanece disponível sem as variáveis Firebase; requer uma instância e disco permanente.

## Executar localmente

Use Node 24, execute `npm ci` e `npm start`. Vitrine: http://localhost:4173. Painel: http://localhost:4173/admin.html. Sem variáveis, escuta em `127.0.0.1` e guarda provas em `data/appointments.json`. Com credenciais Firebase, usa Firestore. `.env.example` é um modelo e não é carregado automaticamente; configure as variáveis no ambiente.

## Agendamentos

O painel reúne pedidos de todas as datas com busca e filtros. A loja aceita, recusa com motivo, remarca, conclui ou cancela a visita. Links do WhatsApp abrem mensagens prontas; o sistema não envia mensagens automaticamente. Pedidos antigos do navegador podem ser importados sem duplicação. `npm run migrate:bookings -- /caminho/appointments.json` importa um arquivo anterior para Firestore.

Pendentes ou confirmados ocupam o horário. Recusar, cancelar ou concluir libera a prova. A API pública mostra só horários ocupados. Transações no Firestore coordenam escritores e revalidam alterações simultâneas para impedir sobreposições e perda de pedidos. Cada pedido fica em um documento da coleção `organzzaAppointments`.

A grade segue a loja: segunda a sexta, 09h–18h; sábado, 08h–16h; domingo fechado. Provas duram uma hora; último início às 17h nos dias úteis e 15h aos sábados. A equipe pode combinar horários personalizados no painel, sujeitos à verificação de conflitos. A configuração está em `business-info.js`.

## Catálogo e marca

O painel permite editar vestidos, fotos, preços, promoções, tamanhos e disponibilidade. **Essas alterações ainda são salvas no navegador utilizado e não se propagam para outros dispositivos.** A adaptação para Vercel compartilha os agendamentos. Para publicar alterações do acervo na versão atual, atualize os padrões em `catalog-store.js` e publique o código.

Preços e promoções demonstrativos, conforme solicitado: Aurora 1.000/850; Céu 1.100/930; Lavanda 950/800; Aqua 1.400/1.190; Rosé 1.200/1.020; Rubi 1.300/1.100; Jardim 1.150/980. Valores em reais. Nomes e referências foram atribuídos para organizar o acervo. Substitua pelos dados oficiais e remova o aviso de demonstração antes do uso comercial.

Fotos fornecidas em `assets`, com cópias WebP. A logo SVG foi recriada a partir da referência pequena e cortada. O tema usa vinho, creme e dourado.

Instagram: https://www.instagram.com/organzzadebutantes/ · WhatsApp: +55 27 99907-3556.

Endereço informado: Av. Nossa Sra. da Penha, 817 — Santa Lucia, Vitória — ES, CEP 29056-245. O site inclui mapa, rotas e horários de funcionamento.

## Verificações e materiais comerciais

- `npm run check`: layout em 320/390/768/1440 px, galerias, favoritos, sacola, WhatsApp e painel.
- `npm run check:static`: arquivos públicos, referências de scripts e entrada explícita da API na Vercel.
- `npm run check:bookings`: pedidos entre navegadores, login, aceite, recusa, remarcação e persistência local.
- `npm run check:vercel`: emulador oficial do Firestore, duas instâncias, sessões após reinício, conflitos simultâneos, importação, regras de acesso e nenhuma gravação local no modo Vercel. Requer Java 21 no PATH.

Os testes usam servidores e dados temporários isolados. O PDF comercial, seu HTML e capturas de tela ficam na pasta local e fora do repositório.
