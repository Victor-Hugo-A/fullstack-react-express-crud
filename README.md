<div align="center">

# Portal Institucional SENAPPEN

### Gestão segura e organizada de contratos, projetos e identidades

<p>
  <img src="https://img.shields.io/badge/Acesso-controlado-0B3B6E?style=for-the-badge" alt="Acesso controlado">
  <img src="https://img.shields.io/badge/Perfis-Visualizador%20%7C%20Editor%20%7C%20Administrador-C99A2E?style=for-the-badge" alt="Perfis de acesso">
  <img src="https://img.shields.io/badge/Registros-organizados-1A5A96?style=for-the-badge" alt="Registros organizados">
</p>

<img src="docs/images/tela-login.png" alt="Nova tela de login do Portal Institucional SENAPPEN" width="900">

*Tela de entrada do portal.*

[Recursos](#recursos-do-portal) · [Acesso](#acesso-e-permissões) · [Como iniciar](#como-iniciar) · [Verificações](#verificações)

</div>

---

## Sobre o portal

O Portal Institucional SENAPPEN reúne, em uma área de acesso controlado, as informações usadas no acompanhamento das atividades da instituição. Ele facilita a consulta e a manutenção de contratos, projetos, identidades, documentos e indicadores de gestão.

Após entrar, cada pessoa vê as opções compatíveis com sua permissão. A navegação foi organizada para manter as informações acessíveis, com telas adaptadas para celular e computador, pesquisa, filtros, ordenação e avisos claros durante cada ação.

## Recursos do portal

| Área | O que é possível fazer |
| --- | --- |
| **Início** | Acessar os módulos disponíveis e visualizar o resumo das informações do portal. |
| **Contratos** | Consultar, pesquisar, ordenar, visualizar e baixar contratos e documentos relacionados. Pessoas com permissão também podem cadastrar, alterar e excluir registros. |
| **Projetos** | Acompanhar responsáveis, prazos, situação, descrição e anexos de cada projeto. |
| **Identidades** | Consultar dados de identificação e fotografias, com registro e manutenção conforme a permissão da conta. |
| **Dashboard e análises** | Acompanhar totais, distribuições, registros recentes e comparações por período. Administradores também consultam o histórico de criação e edição dos projetos. |
| **Perfil** | Atualizar CPF, departamento, cargo e senha. O CPF precisa ser válido e exclusivo para cada conta. |
| **Administração** | Criar contas, consultar usuários, ajustar dados e alterar permissões de acesso. Disponível somente para administradores. |
| **Normativos** | Consultar orientações de uso responsável, controle de acesso, registros e arquivos do portal. |
| **Manuais** | Seguir guias rápidos para as tarefas mais comuns, com atalhos compatíveis com a permissão da conta. |

As listas de contratos, projetos e identidades exibem **seis registros por página**, informam a quantidade de resultados e apresentam uma orientação quando não há dados para mostrar.

## Acesso e permissões

Não há cadastro público na tela de entrada. Uma conta é criada por um administrador na área **Administração**, acessada pelo botão no canto superior direito do portal.

| Perfil | Permissões |
| --- | --- |
| **Visualizador** | Consulta registros, documentos, indicadores, análises e seu próprio perfil. |
| **Editor** | Possui as permissões de visualização e também pode cadastrar e editar contratos, projetos e identidades. |
| **Administrador** | Possui todas as permissões, incluindo exclusões, gestão de usuários, permissões e consulta ao histórico de ações. |

As principais ações — entradas no portal, envios de arquivos, alterações e exclusões — ficam registradas para acompanhamento administrativo. Nas Análises, administradores visualizam o nome do projeto, a pessoa responsável e a data e hora das criações e edições recentes.

## Como iniciar

### 1. Preparar o projeto

Instale o Node.js 20 ou superior. Na pasta principal do projeto, execute:

```powershell
npm.cmd ci
cd BackEnd
npm.cmd ci
Copy-Item .env.example .env
cd ..
```

Abra o arquivo `BackEnd/.env` e preencha `SECRET_KEY` e `SESSION_SECRET` com valores longos, aleatórios e diferentes. Não envie esse arquivo para o repositório.

### 2. Iniciar o portal

```powershell
npm.cmd run dev
```

| Endereço | Finalidade |
| --- | --- |
| [http://localhost:5500](http://localhost:5500) | Tela de login e navegação do portal. |
| [http://localhost:3000/health](http://localhost:3000/health) | Verificação de disponibilidade do serviço. |

Para encerrar a execução, use `Ctrl+C` no terminal.

### 3. Criar o primeiro administrador

Após iniciar o serviço pelo menos uma vez, encerre-o e execute:

```powershell
node .\scripts\manage-local-admin.js --create
```

Informe os dados solicitados. O comando cria a primeira conta administrativa e apresenta uma senha inicial uma única vez. Entre no portal e altere a senha no perfil.

Para conceder ou remover a permissão administrativa de uma conta existente:

```powershell
# Conceder administração
node .\scripts\manage-local-admin.js

# Remover administração
node .\scripts\manage-local-admin.js --revoke
```

Depois disso, os próximos usuários devem ser criados pela área **Administração** do próprio portal.

## Proteção das informações

- A sessão é encerrada ao sair do portal e fica protegida durante a navegação.
- Documentos e fotografias só são disponibilizados para pessoas autenticadas e autorizadas.
- Arquivos enviados passam por verificações antes de serem aceitos.
- O sistema impede CPF inválido ou já utilizado por outra conta.
- Pessoas sem permissão não conseguem criar, alterar ou excluir registros.
- O acesso possui proteção contra tentativas repetidas de senha.
- Os avisos de login, logout e ações do portal desaparecem automaticamente e mostram uma barra de duração.

Cada página possui um ícone próprio na aba do navegador, facilitando a identificação das áreas abertas ao mesmo tempo.

Os dados ficam em `BackEnd/database.sqlite` e os arquivos enviados em `BackEnd/uploads/`. Faça uma cópia desses dois locais antes de atualizar ou mover a instalação.

Os contratos antigos existentes em `BackEnd/data/contracts.json` são transferidos para o banco na primeira atualização, sem modificar o arquivo original.

## Verificações

O projeto possui verificações para as regras de acesso, registros, arquivos, paginação e jornadas principais da interface.

```powershell
# Executa todas as verificações
npm.cmd test

# Executa somente as verificações das telas
npm.cmd test:e2e

# Verifica dependências com problemas altos ou críticos
npm.cmd run test:security
```

Na primeira execução das verificações de tela, instale o navegador necessário:

```powershell
npx.cmd playwright install chromium
```

As verificações também são executadas automaticamente a cada envio de alterações e solicitação de revisão no GitHub, conforme [ci.yml](.github/workflows/ci.yml).

## Organização do projeto

```text
FrontEnd/       telas, estilos e recursos visuais do portal
BackEnd/        regras do sistema, dados, arquivos enviados e histórico
tests/e2e/      verificações das principais jornadas na interface
scripts/        comandos de inicialização e manutenção local
docs/images/    imagens usadas nesta documentação
```

Para consultar a comunicação entre as telas e o serviço, veja [BackEnd/openapi.yaml](BackEnd/openapi.yaml).
