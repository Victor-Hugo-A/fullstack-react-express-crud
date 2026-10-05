<div align="center">

# Portal institucional SENAPPEN

**Gestão de documentos, projetos e identidades em uma área de trabalho autenticada.**

<img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 20 ou superior">
<img src="https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 4.21">
<img src="https://img.shields.io/badge/SQLite-dados%20locais-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite para dados locais">
<img src="https://img.shields.io/badge/interface-HTML%20%7C%20CSS%20%7C%20JavaScript-1f6fb2?style=for-the-badge" alt="HTML, CSS e JavaScript">

<br><br>

<img src="docs/images/tela-login.png" alt="Tela de acesso ao Portal institucional SENAPPEN" width="900">

</div>

> O portal concentra contratos, projetos e identidades da Secretaria Nacional de Políticas Penais (SENAPPEN), disponibilizando os registros e seus indicadores em um só ambiente.

<p align="center">
  <a href="#visão-geral">Visão geral</a> ·
  <a href="#início-rápido">Início rápido</a> ·
  <a href="#operação-de-contas">Contas</a> ·
  <a href="#testes">Testes</a> ·
  <a href="#estrutura-do-repositório">Estrutura</a>
</p>

---

## Visão geral

| Acesso seguro | Registros centralizados | Indicadores acionáveis |
| :---: | :---: | :---: |
| Conta própria, JWT, senhas com hash e limitação de tentativas. | Contratos, projetos, anexos e identidades em módulos específicos. | Dashboard consolidado e análises filtradas por período. |

### Módulos do portal

- **Acesso e contas:** criação de conta com nome, CPF, e-mail, usuário e senha, seguida de aprovação administrativa; login por usuário e senha; sessão autenticada por JWT; alteração de senha e atualização de cargo e departamento no perfil. As senhas são armazenadas com hash e o login limita tentativas consecutivas.
- **Contratos:** cadastro de número, tipo, data, descrição e arquivo; consulta por tipo, ano, número ou descrição; visualização, download e edição do registro. Aceita PDF, DOC, DOCX, JPG e PNG de até 10 MB.
- **Projetos:** cadastro de código, responsável, período, situação e descrição; anexação de múltiplos documentos; filtros por situação, ano, período, nome, código ou responsável; consulta, edição e download dos anexos.
- **Identidades:** cadastro de nome, CPF, endereço, perfil e fotografia; listagem com visualização da foto e paginação.
- **Indicadores:** dashboard com totais, distribuição de contratos por tipo, projetos por situação, identidades por perfil e os cinco registros mais recentes. A tela de análises permite recortar os dados por período, comparar distribuições e consultar até dez registros recentes por categoria.
- **Permissões administrativas:** administradores aprovam ou rejeitam solicitações na página inicial e podem excluir contratos, projetos, anexos e identidades, além de sincronizar ou limpar os contratos. Eventos de login, upload, atualização, exclusão e decisão de conta ficam registrados no SQLite; somente administradores consultam o registro.

## Tecnologias e persistência

| Camada | Implementação |
| --- | --- |
| Interface | HTML, CSS e JavaScript, com Bootstrap, Chart.js, PDF.js e fontes carregados por CDN |
| API | Node.js, Express, CORS e compression |
| Autenticação | JWT, bcryptjs e limitação de tentativas de login |
| Uploads | Multer |
| Dados locais | SQLite para usuários, projetos, identidades, auditoria e arquivos de metadados de contratos |

Os anexos ficam em `BackEnd/uploads/`, os dados dos contratos em `BackEnd/data/contracts.json` e o banco local em `BackEnd/database.sqlite`. Esses caminhos são ignorados pelo Git para evitar o versionamento de arquivos enviados, dados pessoais e dados de desenvolvimento.

## Início rápido

### Pré-requisitos

- Node.js 20 ou superior e npm;
- portas `3000` (API) e `5500` (interface) disponíveis;
- acesso à internet durante o uso da interface, pois Bootstrap, Chart.js, PDF.js, jQuery e fontes são carregados por CDN.

Na raiz do repositório, conclua estes três passos:

| 1. Instalar a API | 2. Criar os segredos locais | 3. Iniciar o portal |
| --- | --- | --- |
| `npm.cmd ci` em `BackEnd` | Copie `.env.example` para `.env` | `npm.cmd run dev` na raiz |

Instale as dependências da API e crie a configuração local:

```powershell
cd BackEnd
npm.cmd ci
Copy-Item .env.example .env
cd ..
```

Abra `BackEnd/.env` e substitua os valores de `SECRET_KEY` e `SESSION_SECRET` por strings longas, aleatórias e diferentes. Mantenha esse arquivo fora do versionamento.

Em seguida, inicie a API e o servidor da interface juntos:

```powershell
npm.cmd run dev
```

<details>
<summary><strong>Endereços disponibilizados pelo ambiente local</strong></summary>

| Serviço | Endereço | Finalidade |
| --- | --- | --- |
| Interface | [http://localhost:5500](http://localhost:5500) | Redireciona para a tela de acesso do portal. |
| API | [http://localhost:3000](http://localhost:3000) | Endpoints consumidos pela interface autenticada. |
| Saúde da API | [http://localhost:3000/health](http://localhost:3000/health) | Confirma que o backend está disponível. |

</details>

No primeiro uso, crie uma conta pela própria tela de acesso. Cadastros novos ficam pendentes e não podem entrar até a aprovação administrativa. As contas que já existiam antes desta versão são preservadas como aprovadas pela migração SQLite.

Para habilitar o primeiro administrador, pare a API e conceda a permissão à conta cadastrada usando o script abaixo; ele também aprova a conta. Depois, inicie a API novamente. A partir daí, administradores aprovam ou rejeitam os demais pedidos na seção **Solicitações de acesso** da página inicial.

Para encerrar os dois processos, use `Ctrl+C` no terminal.

### Executar os serviços separadamente

Útil quando a API e a interface precisam ser acompanhadas em terminais distintos:

```powershell
# Terminal 1 — raiz do projeto
npm.cmd run back

# Terminal 2 — raiz do projeto
npm.cmd run front
```

Verifique a disponibilidade da API em [http://localhost:3000/health](http://localhost:3000/health).

## Operação de contas

Para conceder administração a uma conta existente, pare a API e execute, a partir da raiz:

```powershell
node .\scripts\manage-local-admin.js
```

Informe o e-mail cadastrado quando solicitado. Para remover a permissão, use:

```powershell
node .\scripts\manage-local-admin.js --revoke
```

O fluxo de administração também está disponível em `GET /api/admin/users/pending`, `POST /api/admin/users/:id/approve`, `POST /api/admin/users/:id/reject` e `GET /api/admin/audit`. Todas essas rotas exigem sessão autenticada e permissão administrativa; o endpoint de auditoria aceita `limit` entre 1 e 500 (padrão 200).

Para redefinir a senha de uma conta local, também com os servidores parados:

```powershell
node .\scripts\reset-local-password.js
```

O script solicita o e-mail, mostra uma senha temporária uma única vez e exige a troca posterior em **Perfil**.

## Testes

O teste de integração cria um banco temporário e cobre autenticação, controle de permissões, perfil, contratos, projetos, identidades, anexos e limpeza administrativa. Execute-o após instalar as dependências do backend:

```powershell
cd BackEnd
npm.cmd test
```

## Estrutura do repositório

```text
BackEnd/
  server.js                 # rotas HTTP, autenticação, regras de acesso e uploads
  database.js               # inicialização e acesso ao SQLite
  migrations/               # migrações transacionais de contas e auditoria
  test/server.test.js       # teste de integração da API
FrontEnd/
  login.*                   # acesso e criação de conta
  Sistema/                  # página inicial autenticada
  Documentos/               # contratos, projetos, identidades e gráficos
  Dashboard/                # indicadores consolidados
  Análises/                 # análises filtradas por período
  Perfil/                   # dados funcionais e troca de senha
scripts/
  dev.js                    # inicia API e interface
  manage-local-admin.js     # concede ou remove administração local
  reset-local-password.js   # gera senha temporária local
docs/images/
  tela-login.png            # captura usada nesta documentação
```

## Segurança e publicação

O projeto foi preparado para desenvolvimento local. Antes de publicá-lo em uma rede acessível, configure segredos fortes fora do repositório, HTTPS, origem CORS compatível com o domínio publicado, armazenamento adequado para uploads e uma estratégia de backup para o banco SQLite. As rotas experimentais `/seguro` e `/logout` dependem de uma instância Keycloak local na porta `8080`; elas não fazem parte do fluxo principal de login do portal.
